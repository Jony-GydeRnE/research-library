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
// Heuristics:
//   - "[N] H. Elvang"-style author initial pattern (canonical bib entry)
//   - Starts with an email address (front-matter contact line that
//     somehow got tagged as a citation)
//   - Starts with "→" or "•" (footer/marker artifact)
//   - Contains an email address AND fewer than ~15 words of prose
//     (these are author-list spans, not content)
function isBibliographyLine(spanText) {
  if (!spanText) return false;
  const trimmed = spanText.trim();
  // Very short spans that begin with "[N]" — typically truncated bib
  // entry fragments like "[8] N." that don't carry enough text to
  // be a real citing sentence. A real citing sentence starts with
  // "[N]" only if the text is 25+ chars (which the regex below
  // would catch on the prefix anyway).
  if (trimmed.length < 30 && /^\s*\[\d+\]/.test(trimmed)) return true;
  if (/^\s*\[\d+\]\s+[A-Z]\.\s*[A-Z\-]/.test(trimmed)) return true;
  if (/^\s*[→•]/.test(trimmed)) return true;
  if (/^\s*[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/.test(trimmed)) return true;
  // Email address inside a short span = author contact list
  const wordCount = trimmed.split(/\s+/).length;
  if (/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/.test(trimmed) && wordCount < 18) return true;
  return false;
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

// ─── Tag-as-keyword text match ──────────────────────────────────
//
// Lexical tag overlap is necessary but not sufficient: the citing
// span and the target chunk often discuss the same concept but
// only one of them has it as an explicit context tag. To recover
// the missing matches we treat the citing span's tags as KEYWORDS
// and search for them as substrings (or as token-wise conjunctions)
// in the target chunk's source text.
//
// Example: citing span tagged `hidden_zeros, splitting` and target
// chunk has only generic tags like `feynman_diagrams,
// amplitude_zeros` BUT its text contains "zeros and factorizations"
// and "Tr(φ³) tree amplitudes". The tag-overlap signal is 0 but
// the text-match signal sees "zeros" and "amplitudes" and gives
// the chunk a positive score.
//
// Returns a float — the number of tag-keywords from the citing
// span that hit the target chunk's text. Whole-phrase match is +1,
// token-conjunction match (all tokens of the tag appear separately)
// is +0.5.
function tagTextMatchScore(sourceTags, targetText) {
  if (!sourceTags || !sourceTags.length || !targetText) return 0;
  const lowerText = targetText.toLowerCase();
  let matches = 0;
  for (const rawTag of sourceTags) {
    if (!rawTag) continue;
    const phrase = String(rawTag).replace(/_/g, ' ').toLowerCase();
    if (lowerText.includes(phrase)) {
      matches += 1;
      continue;
    }
    // Token-by-token: require every length-4+ token to appear (in
    // any order, anywhere in the text). 0.5 partial credit because
    // it's a weaker signal than the literal phrase.
    const tokens = phrase.split(/\s+/).filter(t => t.length >= 4);
    if (tokens.length === 0) continue;
    let allPresent = true;
    for (const t of tokens) {
      if (!lowerText.includes(t)) { allPresent = false; break; }
    }
    if (allPresent) matches += 0.5;
  }
  return matches;
}

// ─── Target chunk discovery ─────────────────────────────────────
//
// Given a citing span and the target Book, find the chunk in the
// target book that is most likely to contain the cited content.
//
// Strategy v2 (no LLM, no embeddings):
//   Primary signals (additive):
//     1. Tag overlap   — raw count of context-tag overlap between
//                        the citing span's contextTags and each
//                        candidate chunk's contextTags
//     2. Text match    — how many of the citing span's tags appear
//                        as phrases (or all-tokens-present) in the
//                        candidate chunk's source text. Recovers
//                        cases where the chunk discusses the
//                        concept but doesn't carry an explicit
//                        tag for it. Scored 0.4 per match, capped
//                        at +1.5.
//   Bonuses:
//     - Body boost     — pages 2/3/4+ get +0.05/+0.10/+0.15.
//                        Page 1 (abstract) gets 0 — neutral, not
//                        penalized. Per user guidance: abstracts
//                        should remain honest fallbacks.
//     - Type boost     — definition/theorem/lemma/proposition get
//                        +0.15, proof/corollary +0.10. Citation
//                        targets are usually formal results.
//     - Richness       — small bonus (≤0.05) for chunks with more
//                        total tags (richer target = more useful).
//     - Order          — tight tiebreaker (≤0.001) preferring
//                        earlier chunks.
//   Floor: at least one of (tag overlap, text match) must be > 0.
//   Returns null if no chunk shares anything with the citing span.

// Detect a bibliography-page chunk. These should NEVER be edge
// targets — they're just lists of references, and any text-keyword
// matching against them is spurious (the references mention many
// concepts but the chunk itself doesn't actually CONTAIN those
// concepts as content).
//
// Heuristics (any one triggers):
//   1. 4+ "[N]" markers in the full source text — real prose
//      chunks have 0-2 inline citations, bib chunks have many.
//   2. Density: more than 1 "[N]" marker per 200 chars of text.
//      A 200-char prose chunk with 2 citations is borderline; a
//      400-char chunk with 4 citations is clearly a bib block.
//   3. The chunk text starts with a "[N]" marker followed by
//      author initials ("[41] R. H. Boels...").
function isBibliographyChunk(chunk) {
  if (!chunk || !chunk.sourceText) return false;
  const text = chunk.sourceText;
  const matches = text.match(/\[\d+\]/g) || [];
  if (matches.length >= 4) return true;
  if (matches.length >= 2 && text.length > 0 && (matches.length / text.length) > (1 / 200)) return true;
  if (/^\s*\[\d+\]\s+[A-Z]\.\s*[A-Z\-]/.test(text)) return true;
  return false;
}

async function findBestTargetChunk(targetBookId, citingSpan) {
  const chunks = await Chunk.find({ bookId: targetBookId })
    .select('_id chunkIndex pageNumber contextTags structuralType sourceText')
    .lean();
  if (chunks.length === 0) return null;

  const sourceTags = new Set((citingSpan.contextTags || []).map(t => t.toLowerCase()));
  if (sourceTags.size === 0) return null;

  let best = null;
  for (const c of chunks) {
    // Skip bibliography-page chunks — they're never valid edge
    // targets. See isBibliographyChunk for the heuristic.
    if (isBibliographyChunk(c)) continue;
    const targetTags = new Set((c.contextTags || []).map(t => t.toLowerCase()));
    let overlap = 0;
    for (const t of sourceTags) if (targetTags.has(t)) overlap++;

    // Compute text-keyword signal even when tag overlap is zero —
    // chunks where the citing span's tags appear AS PHRASES in the
    // chunk text are real candidates even without explicit tag
    // matching. This is the fix for chunks like Section 3.1 of
    // Book 2 which discusses "zeros and factorizations" without
    // having `hidden_zeros` as an explicit tag.
    const textMatchRaw = tagTextMatchScore(citingSpan.contextTags, c.sourceText);

    // Floor: must have either tag overlap OR text match. Otherwise
    // the chunk shares nothing with the citing span and shouldn't
    // be a candidate.
    if (overlap === 0 && textMatchRaw === 0) continue;

    // Page-depth scoring: NEVER penalize. Body content gets a
    // small POSITIVE boost. Abstracts are neutral so they remain
    // honest fallbacks when nothing else matches. Per user
    // guidance on 2026-04-11: "abstract should be the fallback,
    // not penalized out of contention. A better model: abstracts
    // get zero bonus, body sections get a small positive boost.
    // Something beats nothing, and if an abstract is the only
    // match at 50% confidence, that's honest and useful."
    let pageBoost = 0;
    if (c.pageNumber === 1) pageBoost = 0;
    else if (c.pageNumber === 2) pageBoost = 0.05;
    else if (c.pageNumber === 3) pageBoost = 0.10;
    else pageBoost = 0.15;

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
    // crosses overlap, page boost, or type boost. Earlier chunks
    // win ties between adjacent chunks on the same page; nothing
    // more.
    const orderBonus = Math.max(0, 0.001 - 0.000001 * (c.chunkIndex || 0));

    // textMatchRaw was computed earlier for the floor-check.
    // Capped at +1.5 so a chunk with great text recall beats a
    // chunk with marginally higher tag overlap but no text match.
    const textBonus = Math.min(1.5, 0.4 * textMatchRaw);

    const score = overlap + pageBoost + typeBoost + richnessBonus + orderBonus + textBonus;

    if (!best || score > best.score) {
      best = {
        chunk: c,
        score,
        overlap,
        scoreDetail: `ovl=${overlap} p=${c.pageNumber} type=${stype} tags=${targetTags.size} txt=${textMatchRaw.toFixed(1)} score=${score.toFixed(3)}`,
      };
    }
  }

  // Minimum score floor: drop edges where the best candidate has
  // a score below 1.0. A score of 1.0 means roughly "one tag
  // overlap, no text match, no boosts" — the bare minimum to be
  // a meaningful match. Below that we're in pure fallback territory
  // where the chunk shares essentially nothing with the citing
  // span and any edge would be misleading.
  if (best && best.score < 1.0) return null;
  return best;
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
