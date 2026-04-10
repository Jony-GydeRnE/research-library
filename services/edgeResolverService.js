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

// ─── Citation key extraction ────────────────────────────────────
//
// Span text contains references like "[15]", "[26-31]", "[Hart77]".
// We extract numeric keys first (the most common physics format)
// and fall back to alphanumeric keys for math/CS papers.
// "[26-31]" returns ["26", "27", "28", "29", "30", "31"].

function extractCitationKeys(spanText) {
  if (!spanText) return [];
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
//   Score = raw count of context-tag overlap between the citing
//           span's contextTags and each candidate chunk's
//           contextTags.
//   Tiebreakers (in order):
//     1. Larger target chunk tag set wins (richer = more
//        informative target — but only as a tiebreaker, never as a
//        primary signal).
//     2. Lower chunkIndex wins (earlier in the book = more
//        likely the introduction / setup that's being cited).
//   Minimum overlap to create an edge: 1.
//   No fallback when overlap = 0 — better to emit zero edges than
//   to point readers at the wrong chunk.
//
// Returns { chunk, score, scoreDetail } or null if no candidate
// has at least one tag in common.

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
    // Composite score: integer overlap is the primary signal, with
    // a small fractional bump for richer target chunks and a
    // smaller bump for earlier chunks. Floats stay below 1 so
    // the integer overlap part never gets crossed by tiebreakers.
    const score = overlap
      + Math.min(0.5, 0.01 * targetTags.size)
      + Math.max(0, 0.0001 * (1000 - (c.chunkIndex || 0)));
    if (!best || score > best.score) {
      best = {
        chunk: c,
        score,
        overlap,
        scoreDetail: `overlap=${overlap} target_tags=${targetTags.size} chunk=${c.chunkIndex}`,
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
  const books = await Book.find().select('_id title').lean();
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
