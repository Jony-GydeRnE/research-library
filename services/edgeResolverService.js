/**
 * Edge resolver — turns S-tagged spans (specific external source
 * citations) into cross-book Edge documents whenever the cited
 * source is already in the library.
 *
 * Pipeline:
 *   1. For each S-tagged span in a source book:
 *      a. Extract the citation key from the span text (regex on
 *         "[N]" patterns)
 *      b. Look up the matching BibEntry on the source book
 *      c. If the BibEntry has a resolvedBookId (from
 *         bibliographyService.matchBibliographyToLibrary), proceed
 *   2. Find the best target chunk in the cited book using lexical
 *      tag overlap between the citing span's contextTags and each
 *      candidate chunk's contextTags. Tiebreaker: chunk with the
 *      most total tags (proxy for "most informative chunk").
 *      Fallback when overlap = 0: pick the cited book's first
 *      tagged chunk (usually the abstract/intro).
 *   3. Create an Edge document linking the source span → target
 *      chunk, with relationship type inferred from the citing span's
 *      role (citation/background → assumes; result/proof → extends;
 *      etc.) and method='lexical'.
 *
 * No LLM calls. No embeddings. The whole pass is regex + tag-set
 * intersection and runs in well under a second per book. The point
 * is to validate that the architecture WORKS — produce real Edge
 * documents we can render in the reader and chat UI. Once we know
 * the foundation is solid, we layer Nano + Opus on top per Vision
 * §4.3 to refine candidate ranking and confidence.
 */

const Edge = require('../models/Edge');
const Span = require('../models/Span');
const Chunk = require('../models/Chunk');
const Book = require('../models/Book');

// ─── Bibliography-line detection ────────────────────────────────
//
// A span is a "bibliography line" if its text IS a reference entry,
// not a citation made from running prose. These spans often get
// tagged role=citation by the span LLM (correctly — they ARE
// citations) and search=S (correctly — they reference an external
// source) but they shouldn't produce edges because the source side
// of an edge should be a span THAT cites, not a span that IS the
// citation entry. The bib-line-to-chunk edge is structurally an
// "X exists in the library" assertion, which carries no semantic
// signal about what the citing author wanted to say.
//
// Heuristic: text starts with "[N]" followed by an author initial
// pattern like "H. Elvang" or "N. Arkani-Hamed".
function isBibliographyLine(spanText) {
  if (!spanText) return false;
  return /^\s*\[\d+\]\s+[A-Z]\.\s*[A-Z\-]/.test(spanText);
}

// ─── Citation key extraction ────────────────────────────────────
//
// Span text contains references like "[15]", "[26-31]", "[Hart77]".
// We extract numeric keys first (the most common physics format)
// and fall back to alphanumeric keys for math/CS papers.
// "[26-31]" returns ["26", "27", "28", "29", "30", "31"].
//
// Returns empty array for bibliography-line spans — see
// isBibliographyLine above for the rationale.

function extractCitationKeys(spanText) {
  if (!spanText) return [];
  if (isBibliographyLine(spanText)) return [];
  const keys = new Set();
  // Numeric or numeric-range references in square brackets
  const re = /\[(\d+(?:[,\-\s\d]*\d)?)\]/g;
  let m;
  while ((m = re.exec(spanText)) !== null) {
    const inner = m[1];
    // Range: "26-31"
    if (/^\d+\-\d+$/.test(inner)) {
      const [a, b] = inner.split('-').map(Number);
      for (let k = a; k <= b; k++) keys.add(String(k));
    }
    // Comma-separated list: "5, 6, 8"
    else if (/[,]/.test(inner)) {
      inner.split(/[,\s]+/).forEach(k => {
        if (/^\d+$/.test(k)) keys.add(k);
      });
    }
    // Single number
    else if (/^\d+$/.test(inner)) {
      keys.add(inner);
    }
  }
  return Array.from(keys);
}

// ─── Relationship type inference ────────────────────────────────
//
// Map a citing span's role to an Edge relationshipType. The Vision
// doc's edge typology has 8 relations; the role tag from span
// generation is the cleanest signal we have without an LLM call.
//
// Default is 'assumes' because most citations are "we use the
// result of [X]" which is structurally an assumption that the
// cited result holds.

function relationshipFromRole(role) {
  switch (role) {
    case 'proof':
    case 'result':
      return 'extends';   // the citing work extends/uses the cited result
    case 'definition':
      return 'uses_definition';
    case 'preview':
    case 'background':
    case 'review':
    case 'citation':
    case 'claim':
    case 'remark':
    default:
      return 'assumes';
  }
}

// ─── Target chunk discovery ─────────────────────────────────────
//
// Given a citing span and the target Book, find the chunk in the
// target book that is most likely to contain the cited content.
//
// Strategy v1 (no LLM, no embeddings):
//   Primary signal:    raw count of context-tag overlap between
//                      the citing span's contextTags and each
//                      candidate chunk's contextTags.
//   Abstract penalty:  chunks on page 1 take a -0.4 score penalty
//                      and chunks on page 2 take -0.2. Rationale:
//                      paper abstracts have the broadest tag set
//                      (they summarize the whole paper) so they
//                      naturally win every overlap contest. But
//                      when somebody cites "the discovery of X
//                      in [N]", the right target is the section
//                      where X is defined and proven, not the
//                      abstract that merely lists it. The penalty
//                      pushes deeper-content chunks above the
//                      abstract when overlap is comparable. The
//                      penalty is small enough that an abstract
//                      with overlap=2 still beats a deeper chunk
//                      with overlap=1 (1.6 vs 1.x) but loses to
//                      a deeper chunk with overlap=2 (1.6 vs 2.x).
//   Definition boost:  chunks with structuralType definition,
//                      theorem, or proof get a small +0.1 bump
//                      because they're inherently citable
//                      content.
//   Tiebreakers:       larger target tag set, then earlier
//                      chunkIndex within the same page-tier.
//   Minimum overlap:   1. Returns null if no chunk shares any
//                      tag with the citing span — better to emit
//                      zero edges than to point at the wrong
//                      chunk.

async function findBestTargetChunk(targetBookId, citingSpan) {
  const chunks = await Chunk.find({ bookId: targetBookId })
    .select('_id chunkIndex pageNumber contextTags structuralType sourceText')
    .lean();
  if (chunks.length === 0) return null;

  const sourceTags = new Set((citingSpan.contextTags || []).map(t => t.toLowerCase()));
  if (sourceTags.size === 0) return null;

  let best = null;
  for (const c of chunks) {
    const targetTags = new Set((c.contextTags || []).map(t => t.toLowerCase()));
    if (targetTags.size === 0) continue;
    let overlap = 0;
    for (const t of sourceTags) if (targetTags.has(t)) overlap++;
    if (overlap === 0) continue;

    // Page-depth penalty: page 1 is the abstract / front matter
    // (heavy summary, not the actual content being cited). Page 2
    // is usually still introduction. Pages >= 3 are body content.
    //
    // Penalty is intentionally GENTLE — abstracts should still be
    // valid fallback targets when no deeper chunk has any overlap.
    // The user's guidance: "something is better than nothing if no
    // book gives a match and the relation is given an honest 50%
    // or lower confidence." With penalty -0.15 the abstract still
    // beats nothing (overlap=1 - 0.15 = 0.85, which clears the
    // "must have at least one overlap" floor). A deeper chunk with
    // the SAME overlap=1 still wins (1.0 vs 0.85). And an abstract
    // with overlap=2 still beats a deeper chunk with overlap=1
    // (1.85 vs 1.0) — which is correct, overlap=2 is real signal.
    let pagePenalty = 0;
    if (c.pageNumber === 1) pagePenalty = -0.15;
    else if (c.pageNumber === 2) pagePenalty = -0.07;

    // Structural-type boost: definitions, theorems, and proofs are
    // the canonical citation targets. Bump them slightly so they
    // outrank narrative chunks on the same page.
    const stype = (c.structuralType || '').toLowerCase();
    let typeBoost = 0;
    if (stype === 'definition' || stype === 'theorem' || stype === 'lemma' || stype === 'proposition') typeBoost = 0.15;
    else if (stype === 'proof' || stype === 'corollary') typeBoost = 0.10;

    // Tag-richness tiebreaker (small)
    const richnessBonus = Math.min(0.05, 0.01 * targetTags.size);

    // Earlier-chunk-index tiebreaker — capped tightly so it never
    // crosses overlap, page penalty, or type boost. Earlier chunks
    // win ties between adjacent chunks on the same page; nothing
    // more.
    const orderBonus = Math.max(0, 0.001 - 0.000001 * (c.chunkIndex || 0));

    const score = overlap + pagePenalty + typeBoost + richnessBonus + orderBonus;

    if (!best || score > best.score) {
      best = {
        chunk: c,
        score,
        overlap,
        scoreDetail: `ovl=${overlap} p=${c.pageNumber} type=${stype} tags=${targetTags.size} score=${score.toFixed(3)}`,
      };
    }
  }

  return best; // null if no chunk had any overlap
}

// ─── Confidence mapping ─────────────────────────────────────────
//
// Map raw overlap count to an a-z confidence letter. Per Edge model
// semantics: a = most confident, z = least confident.
//   overlap ≥ 4 → a (multiple shared tags, almost certainly the right chunk)
//   overlap = 3 → c
//   overlap = 2 → f
//   overlap = 1 → j (a single shared tag is the floor for emitting
//                   an edge; expect refinement when Nano/Opus enters
//                   the pipeline)
//   overlap = 0 → no edge created (caller skips)

function overlapToConfidence(overlap) {
  if (overlap >= 4) return 'a';
  if (overlap === 3) return 'c';
  if (overlap === 2) return 'f';
  if (overlap === 1) return 'j';
  return 'z';
}

// ─── Main resolver ──────────────────────────────────────────────
//
// Walk every S-tagged span in a source book and create Edge
// documents for those whose citation key resolves to a Book in
// the library.

async function resolveSEdgesForBook(sourceBookId) {
  const book = await Book.findById(sourceBookId).select('bibEntries').lean();
  if (!book || !book.bibEntries || book.bibEntries.length === 0) {
    return { edgesCreated: 0, spansProcessed: 0, reason: 'no bibEntries' };
  }
  // Build a key → resolvedBookId map for O(1) lookup
  const keyToTarget = {};
  for (const e of book.bibEntries) {
    if (e.resolvedBookId) keyToTarget[e.key] = e.resolvedBookId;
  }
  const resolvedKeys = Object.keys(keyToTarget);
  if (resolvedKeys.length === 0) {
    return { edgesCreated: 0, spansProcessed: 0, reason: 'no resolved bib entries' };
  }

  // Clear any existing lexical edges from this book — we're regenerating.
  await Edge.deleteMany({ fromBookId: sourceBookId, method: 'lexical' });

  // Pull every S-tagged span on this book in one query.
  const spans = await Span.find({ bookId: sourceBookId, searchClass: 'S' })
    .select('_id chunkId pageNumber contextTags role spanText sentenceStart sentenceEnd')
    .lean();

  let edgesCreated = 0;
  const examples = [];

  for (const span of spans) {
    const keys = extractCitationKeys(span.spanText);
    if (keys.length === 0) continue;
    for (const key of keys) {
      const targetBookId = keyToTarget[key];
      if (!targetBookId) continue;
      const target = await findBestTargetChunk(targetBookId, span);
      if (!target) continue;
      const relationshipType = relationshipFromRole(span.role);
      const confidence = overlapToConfidence(target.overlap);
      const edge = await Edge.create({
        fromChunkId: span.chunkId,
        fromSpanId: span._id,
        toChunkId: target.chunk._id,
        fromBookId: sourceBookId,
        toBookId: targetBookId,
        relationshipType,
        confidence,
        relevance: confidence,
        method: 'lexical',
        resolved: true,
      });
      edgesCreated++;
      if (examples.length < 5) {
        examples.push({
          edgeId: edge._id,
          fromBook: String(sourceBookId).substring(0, 8),
          toBook: String(targetBookId).substring(0, 8),
          citationKey: key,
          spanText: (span.spanText || '').substring(0, 80),
          targetChunkIndex: target.chunk.chunkIndex,
          targetPage: target.chunk.pageNumber,
          relationshipType,
          confidence,
          score: target.score,
          scoreDetail: target.scoreDetail,
        });
      }
    }
  }

  return {
    edgesCreated,
    spansProcessed: spans.length,
    resolvedKeys: resolvedKeys.length,
    examples,
  };
}

/**
 * Run the S-edge resolver for every book in the library. Useful
 * after a fresh bibliography pass.
 */
async function resolveSEdgesForLibrary() {
  const books = await Book.find({ status: { $ne: 'pending-citation' } }).select('_id title').lean();
  const summary = [];
  for (const b of books) {
    const r = await resolveSEdgesForBook(b._id);
    summary.push({ bookId: b._id, title: (b.title || '').substring(0, 50), ...r });
  }
  return summary;
}

module.exports = {
  extractCitationKeys,
  relationshipFromRole,
  overlapToConfidence,
  findBestTargetChunk,
  resolveSEdgesForBook,
  resolveSEdgesForLibrary,
};
