/**
 * canonicalDefinitionService — builds and consumes the
 * per-concept definition dictionary.
 *
 * Two-phase operation:
 *
 *   1. buildCanonicalDictionary(opts)
 *      Sweeps chunks + spans across the library (optionally
 *      scoped by bookId list). For each chunk that "is a
 *      definition" under the three-tier preference hierarchy
 *      (structural > role > tag), extract the concepts it
 *      defines and upsert rows into CanonicalDefinition.
 *      One concept → at most one canonical definition.
 *      Higher-tier sources replace lower-tier ones.
 *
 *   2. linkSpansToCanonicalDefinitions(opts)
 *      For every span in the library (optionally scoped by
 *      bookId list), emit a uses_definition Edge from the
 *      span to its concept's canonical chunk IF:
 *        - the span has a contextTag matching a canonical concept
 *        - the span is NOT inside the canonical chunk itself
 *          (prevents self-edges on the definition chunk)
 *        - an equivalent edge doesn't already exist
 *      Edges are written with method='canonical-lookup',
 *      confidence='z', relationshipType='uses_definition'.
 *
 * Both phases are pure DB sweeps — no LLM calls, no external
 * API calls. They can be re-run idempotently as the library
 * grows or as definitions are added/improved.
 */

const Chunk = require('../models/Chunk');
const Span = require('../models/Span');
const Edge = require('../models/Edge');
const CanonicalDefinition = require('../models/CanonicalDefinition');
const taxonomy = require('./taxonomyService');

// Preference tiers — lower number = stronger signal.
const TIER = { structural: 0, role: 1, tag: 2 };

// ─── Concept normalization ────────────────────────────────
// Every surface tag is first passed through taxonomy.getCanonicals()
// so that `bcfw_shifts` / `bcfw_shift` / `bcfw_recursion` all
// map to the SAME canonical concept name (whichever one the
// CONCEPTS table assigns). The CanonicalDefinition collection
// is keyed by canonical name, not raw tag, so a span whose
// surface form differs from the definition's surface form
// still finds the definition via the lookup.
//
// getCanonicals(tag) returns an array because a tag can belong
// to multiple concepts. In practice 95% of tags map to exactly
// one canonical concept, and the tail (multi-concept) does the
// right thing by emitting multiple candidates / multiple lookups.
function canonicalsFor(tag) {
  if (!tag || typeof tag !== 'string') return [];
  const c = taxonomy.getCanonicals(tag);
  return Array.isArray(c) ? c.filter(x => typeof x === 'string' && x.length >= 2) : [];
}

// ─── Anti-orphan text guard ────────────────────────────────
// If a chunk's text starts with a pronoun or demonstrative,
// it's referring to something earlier in the page and is
// almost certainly NOT a canonical definition — it's a
// follow-up sentence whose antecedent is elsewhere. The
// structural-type pipeline has been observed to mis-flag these
// as 'definition' because of page-level regex annotations
// overlapping the sentence range. Reject them here as a
// defensive second filter.
const PRONOUN_REJECT = /^\s*(these|this|that|those|it|they|them|such|hence|thus|therefore|so|consequently|accordingly|moreover|furthermore)\b/i;

function looksLikeRealDefinition(chunk) {
  const text = (chunk.sourceText || chunk.rawText || '').trim();
  if (!text) return false;
  if (PRONOUN_REJECT.test(text)) return false;
  return true;
}

// ─── Concept extraction per chunk ──────────────────────────
//
// Given a chunk (with its spans), figure out which concepts
// this chunk canonically defines and what tier the signal is.
// Returns a list of { concept, tier, spanId }.
//
// Tiers (strongest first):
//   0 structural+role: chunk.structuralType === 'definition' AND
//      at least one span in the chunk has role === 'definition'.
//      Both signals agree this is a definition block. Strongest.
//   1 role: at least one span has role === 'definition' (without
//      the chunk structuralType agreeing — happens when the
//      chunk is a multi-span narrative with one definition in it).
//   2 tag: a contextTag on any span endsWith '_definition'.
//      The concept is that tag with the suffix stripped.
//
// In ALL cases we also require `looksLikeRealDefinition(chunk)` —
// the chunk text must not start with a pronoun. This filters
// out cases where the upstream pipeline mis-assigned
// structuralType='definition' to an orphan sentence.
//
// A chunk may contribute multiple (concept, tier) pairs.
function extractCandidatesFromChunk(chunk, spans) {
  const out = [];
  if (!looksLikeRealDefinition(chunk)) return out;

  const chunkTags = new Set(chunk.contextTags || []);
  const defSpans = spans.filter(s => s.role === 'definition');
  const hasStructural = chunk.structuralType === 'definition';

  // Helper: emit one candidate per canonical concept for each
  // surface tag. A surface tag like `bcfw_shift` may canonicalize
  // to `bcfw_shifts` (or whatever the CONCEPTS table declares),
  // so downstream lookup on either surface form finds the row.
  const pushCanonical = (surfaceTag, tier, spanId) => {
    const cans = canonicalsFor(surfaceTag);
    for (const c of cans) {
      out.push({ concept: c, tier, spanId, surfaceTag });
    }
  };

  // Tier 0: structural AND role agree.
  if (hasStructural && defSpans.length > 0) {
    // Use the first def-span as the anchor — it's the actual
    // sentence doing the defining.
    const anchor = defSpans[0];
    for (const tag of (anchor.contextTags || [])) {
      if (isConceptTagLike(tag)) pushCanonical(tag, 0, anchor._id);
    }
    // Also attribute any chunk-level tags the anchor didn't
    // carry (definition chunks sometimes have umbrella tags).
    for (const tag of chunkTags) {
      if (!isConceptTagLike(tag)) continue;
      if ((anchor.contextTags || []).includes(tag)) continue;
      pushCanonical(tag, 0, anchor._id);
    }
  }

  // Tier 1: span role='definition' without structural agreement.
  // Skip if tier 0 already fired (we'd duplicate the concept).
  if (!hasStructural || defSpans.length === 0) {
    for (const span of defSpans) {
      for (const tag of (span.contextTags || [])) {
        if (!isConceptTagLike(tag)) continue;
        pushCanonical(tag, 1, span._id);
      }
    }
  }

  // Tier 2: contextTag endsWith '_definition'. This is the
  // weakest signal — tag suffix only, no role backing.
  for (const span of spans) {
    for (const tag of (span.contextTags || [])) {
      if (typeof tag !== 'string') continue;
      if (!tag.endsWith('_definition')) continue;
      const concept = tag.slice(0, -'_definition'.length);
      if (!isConceptTagLike(concept)) continue;
      pushCanonical(concept, 2, span._id);
    }
  }

  // Tier 2b: `:=` in the span text. A handwritten or
  // published definition of the form "BCFW shift := p_i + zq"
  // is unambiguous and should be picked up as tier-1 strength
  // (role-level signal) even if the span's role wasn't set to
  // 'definition' by the first pass. We identify the LHS of the
  // `:=` by looking at the chunk's dominant contextTag on the
  // same span and canonicalizing it. This is a safety net for
  // notes that went through ingestion before the `:=` prompt
  // rule was added.
  for (const span of spans) {
    const txt = span.spanText || '';
    if (!/:=|\\mathrel\{\\mathop:\}=|\\equiv/.test(txt)) continue;
    for (const tag of (span.contextTags || [])) {
      if (!isConceptTagLike(tag)) continue;
      // Tier 1 strength — the `:=` signal is as strong as a
      // role=definition assignment.
      pushCanonical(tag, 1, span._id);
    }
  }

  return out;
}

// A concept tag is a lowercase snake_case word (>= 2 chars) —
// matches the same pattern the span DSL parser accepts.
function isConceptTagLike(tag) {
  return typeof tag === 'string' && /^[a-z][a-z0-9_]+$/.test(tag) && tag.length >= 2;
}

// Rank-compare two candidates for the same concept. Returns
// true iff `cand` strictly beats `existing`. Lower tier wins;
// within the same tier, earlier page wins; ties broken
// arbitrarily by chunkIndex.
function candidateBeats(cand, existing) {
  if (cand.tier !== existing.tier) return cand.tier < existing.tier;
  if ((cand.pageNumber || 0) !== (existing.pageNumber || 0)) {
    return (cand.pageNumber || Infinity) < (existing.pageNumber || Infinity);
  }
  return (cand.chunkIndex || Infinity) < (existing.chunkIndex || Infinity);
}

// ─── Phase 1: build the dictionary ────────────────────────
async function buildCanonicalDictionary(opts = {}) {
  const filter = {};
  if (opts.bookIds && opts.bookIds.length) {
    filter.bookId = { $in: opts.bookIds };
  }

  // Load chunks (and the spans they own, in one query per
  // chunk since spans are small and indexed on chunkId).
  const chunks = await Chunk.find(filter)
    .select('_id bookId pageNumber chunkIndex structuralType contextTags spanIds sourceText rawText')
    .lean();

  if (chunks.length === 0) return { scanned: 0, upserted: 0 };

  const allSpanIds = chunks.flatMap(c => c.spanIds || []);
  const spans = allSpanIds.length > 0
    ? await Span.find({ _id: { $in: allSpanIds } })
        .select('_id chunkId contextTags role').lean()
    : [];
  const spansByChunk = new Map();
  for (const s of spans) {
    const k = String(s.chunkId || '');
    if (!spansByChunk.has(k)) spansByChunk.set(k, []);
    spansByChunk.get(k).push(s);
  }

  // Accumulate best candidate per concept across the whole sweep.
  const best = new Map(); // concept -> { tier, pageNumber, chunkIndex, chunkId, spanId, bookId }

  for (const c of chunks) {
    const chunkSpans = spansByChunk.get(String(c._id)) || [];
    const cands = extractCandidatesFromChunk(c, chunkSpans);
    for (const cand of cands) {
      const entry = {
        concept: cand.concept,
        tier: cand.tier,
        spanId: cand.spanId,
        pageNumber: c.pageNumber,
        chunkIndex: c.chunkIndex,
        chunkId: c._id,
        bookId: c.bookId,
      };
      const existing = best.get(cand.concept);
      if (!existing || candidateBeats(entry, existing)) {
        best.set(cand.concept, entry);
      }
    }
  }

  // Upsert each winner into CanonicalDefinition. If an existing
  // row loses to a new candidate (strictly better tier/page),
  // overwrite it. Otherwise keep the old row.
  let upserted = 0;
  for (const [concept, entry] of best.entries()) {
    const existingRow = await CanonicalDefinition.findOne({ concept }).lean();
    if (existingRow) {
      // Compare existing row against new candidate. Existing
      // row's "tier" is a string enum, convert via TIER.
      const existingEntry = {
        tier: TIER[existingRow.source] ?? 2,
        pageNumber: null, // unknown from the stored row; break ties toward new
        chunkIndex: null,
      };
      if (!candidateBeats(entry, existingEntry)) continue;
    }
    await CanonicalDefinition.findOneAndUpdate(
      { concept },
      {
        concept,
        definitionChunkId: entry.chunkId,
        definitionSpanId: entry.spanId || null,
        definitionBookId: entry.bookId,
        source: sourceFromTier(entry.tier),
        confidence: 'z',
        updatedAt: new Date(),
      },
      { upsert: true, new: true }
    );
    upserted++;
  }

  console.log(`[canonicalDefinitionService] build: scanned ${chunks.length} chunks, upserted ${upserted} canonical concepts (total candidates: ${best.size})`);
  return { scanned: chunks.length, upserted, concepts: best.size };
}

function sourceFromTier(tier) {
  return tier === 0 ? 'structural' : (tier === 1 ? 'role' : 'tag');
}

// ─── Phase 2: link spans to canonical definitions ─────────
async function linkSpansToCanonicalDefinitions(opts = {}) {
  // Load the dictionary into memory — at library scale this
  // is small (a few thousand rows).
  const defs = await CanonicalDefinition.find({}).lean();
  if (defs.length === 0) {
    console.log('[canonicalDefinitionService] link: no canonical definitions to link against');
    return { created: 0, skipped: 0, defsCount: 0 };
  }

  const defByConcept = new Map(defs.map(d => [d.concept, d]));

  // Load spans (optionally scoped to specific books).
  const spanFilter = {};
  if (opts.bookIds && opts.bookIds.length) {
    spanFilter.bookId = { $in: opts.bookIds };
  }

  const spans = await Span.find(spanFilter)
    .select('_id bookId chunkId contextTags').lean();

  let created = 0;
  let skipped = 0;
  let selfEdges = 0;

  // Pre-load existing canonical-lookup edges to avoid
  // re-creating ones that already exist. Scoped to the same
  // books so the in-memory set stays small.
  const existingEdgeFilter = { method: 'canonical-lookup' };
  if (opts.bookIds && opts.bookIds.length) {
    existingEdgeFilter.fromBookId = { $in: opts.bookIds };
  }
  const existingEdges = await Edge.find(existingEdgeFilter)
    .select('fromSpanId toChunkId').lean();
  const existingSet = new Set(
    existingEdges.map(e => `${String(e.fromSpanId || '')}:${String(e.toChunkId || '')}`)
  );

  for (const span of spans) {
    const tags = (span.contextTags || []).filter(isConceptTagLike);
    if (tags.length === 0) continue;

    // For each span tag, expand to its canonical concept names
    // via the taxonomy layer, then look up each canonical in
    // the dictionary. This is the synonym-aware lookup: a span
    // tagged `bcfw_shift` finds a canonical definition stored
    // under `bcfw_shifts` (or whatever the taxonomy declared
    // as the canonical form for that concept family).
    //
    // Per-span dedup: track which canonical chunks we've
    // already emitted an edge to for this span so we don't
    // double-count when two surface tags on the same span
    // resolve to the same canonical definition.
    const emittedTargets = new Set();

    for (const tag of tags) {
      const canonicalNames = canonicalsFor(tag);
      if (canonicalNames.length === 0) continue;

      for (const canonicalName of canonicalNames) {
        const def = defByConcept.get(canonicalName);
        if (!def) continue;

        // Skip self-edges: the span IS inside the definition chunk.
        if (String(span.chunkId || '') === String(def.definitionChunkId)) {
          selfEdges++;
          continue;
        }

        // Per-span target dedup.
        if (emittedTargets.has(String(def.definitionChunkId))) continue;

        const key = `${String(span._id)}:${String(def.definitionChunkId)}`;
        if (existingSet.has(key)) {
          emittedTargets.add(String(def.definitionChunkId));
          skipped++;
          continue;
        }

        await Edge.create({
          fromSpanId: span._id,
          fromChunkId: span.chunkId || null,
          fromBookId: span.bookId,
          toChunkId: def.definitionChunkId,
          toSpanId: def.definitionSpanId || null,
          toBookId: def.definitionBookId,
          relationshipType: 'uses_definition',
          confidence: def.confidence || 'z',
          relevance: 'z',
          method: 'canonical-lookup',
          resolved: true,
          createdAt: new Date(),
        });
        existingSet.add(key);
        emittedTargets.add(String(def.definitionChunkId));
        created++;
      }
    }
  }

  console.log(`[canonicalDefinitionService] link: ${created} new edges, ${skipped} already existed, ${selfEdges} self-edges skipped`);
  return { created, skipped, selfEdges, defsCount: defs.length };
}

// ─── Convenience: full re-sweep for a book ────────────────
// ─── Phase 3: resolveFromText — highlight → concept lookup ──
//
// Given a free-form string (what the user highlighted in the
// reader), return the best-matching canonical concept plus
// everything the metadata panel needs to render:
//   - the canonical concept name
//   - the synonym family
//   - the definition chunk (with book/page/preview)
//   - how many spans across the library carry this concept
//   - outgoing / incoming uses_definition edges
//
// The metadata panel calls this from a future API endpoint
// (e.g. GET /api/metadata/resolve?text=BCFW+shift). UI wiring
// is deliberately out of scope for the data-quality session;
// this service provides the resolver function that endpoint
// will wrap.
//
// Matching strategy (first hit wins):
//   1. Direct canonical lookup via taxonomy.getCanonicals().
//      "BCFW shift" → normalize to `bcfw_shift` → canonicalize
//      to `bcfw` → find CanonicalDefinition({concept:'bcfw'}).
//      This catches ~95% of cases.
//   2. If direct lookup misses, try a whole-word substring
//      match against every canonical concept in the dictionary.
//      "Britto-Cachazo-Feng-Witten shifts" normalizes to a
//      hyphen-stripped snake_case that may not match any
//      taxonomy marker directly, but substring search can
//      still find `bcfw` if the dictionary has it.
//   3. If still miss, fall back to a fuzzy whole-word overlap:
//      break the query into word tokens, look for any
//      canonical whose concept name contains >= 2 of the
//      query tokens. This catches awkward author-name
//      rephrasings.
//
// Returns null if no canonical matches.

function normalizeTextToSnakeCase(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .toLowerCase()
    .replace(/[-]+/g, ' ')      // hyphens → spaces → underscores
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\s/g, '_');
}

function tokenizeText(text) {
  if (!text || typeof text !== 'string') return [];
  return text
    .toLowerCase()
    .replace(/[-]+/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 2);
}

async function resolveFromText(rawText, opts = {}) {
  const Chunk = require('../models/Chunk');
  const Book = require('../models/Book');

  if (!rawText || typeof rawText !== 'string') return null;
  const text = rawText.trim();
  if (text.length === 0) return null;

  // ─── Strategy 1: direct canonical lookup ─────────────
  const snake = normalizeTextToSnakeCase(text);
  const candidateNames = new Set();
  // Try the snake-cased whole phrase
  for (const c of canonicalsFor(snake)) candidateNames.add(c);
  // Also try the individual word tokens in case the taxonomy
  // markers are single-word ("bcfw", "hidden_zero")
  for (const tok of tokenizeText(text)) {
    for (const c of canonicalsFor(tok)) candidateNames.add(c);
  }

  let def = null;
  let matchedVia = 'direct';
  for (const name of candidateNames) {
    const found = await CanonicalDefinition.findOne({ concept: name }).lean();
    if (found) { def = found; break; }
  }

  // ─── Strategy 2: substring scan over dictionary ──────
  if (!def) {
    matchedVia = 'substring';
    const tokens = tokenizeText(text);
    if (tokens.length > 0) {
      const all = await CanonicalDefinition.find({}).select('concept').lean();
      for (const row of all) {
        for (const tok of tokens) {
          if (row.concept.includes(tok) && tok.length >= 3) {
            def = await CanonicalDefinition.findOne({ concept: row.concept }).lean();
            break;
          }
        }
        if (def) break;
      }
    }
  }

  // ─── Strategy 3: fuzzy whole-word overlap ────────────
  if (!def) {
    matchedVia = 'fuzzy';
    const tokens = new Set(tokenizeText(text).filter(t => t.length >= 3));
    if (tokens.size >= 2) {
      const all = await CanonicalDefinition.find({}).select('concept').lean();
      let best = null;
      let bestOverlap = 0;
      for (const row of all) {
        const conceptTokens = new Set(
          row.concept.split('_').filter(t => t.length >= 3)
        );
        let overlap = 0;
        for (const t of tokens) if (conceptTokens.has(t)) overlap++;
        if (overlap >= 2 && overlap > bestOverlap) {
          bestOverlap = overlap;
          best = row;
        }
      }
      if (best) def = await CanonicalDefinition.findOne({ concept: best.concept }).lean();
    }
  }

  if (!def) return null;

  // Assemble the return shape. Fetch the definition chunk's
  // book + page + preview text. Fetch edge counts. The
  // metadata panel renders all of this.
  const Span = require('../models/Span');
  const chunk = await Chunk.findById(def.definitionChunkId)
    .select('_id bookId pageNumber sourceText rawText structuralType').lean();
  const book = chunk ? await Book.findById(chunk.bookId).select('_id title author kind').lean() : null;

  // Count how many spans library-wide carry this canonical
  // concept (via any surface tag that canonicalizes to it).
  // This is the "span count" the UI shows as a badge.
  const spanCount = await Span.countDocuments({
    contextTags: { $regex: new RegExp(`^${def.concept}|${def.concept}$`, 'i') },
  });

  return {
    query: text,
    matchedVia,
    canonicalConcept: def.concept,
    synonymFamily: Array.isArray(taxonomy.CONCEPTS?.[def.concept])
      ? taxonomy.CONCEPTS[def.concept]
      : [],
    spanCount,
    definition: chunk ? {
      chunkId: String(chunk._id),
      bookId: String(chunk.bookId),
      bookTitle: book?.title || null,
      bookKind: book?.kind || null,
      pageNumber: chunk.pageNumber,
      structuralType: chunk.structuralType || null,
      preview: (chunk.sourceText || chunk.rawText || '').slice(0, 400),
    } : null,
  };
}

async function rebuildCanonicalForBook(bookId) {
  // Drop any canonical edges for this book (from the FROM side)
  // so the link phase starts clean for this book. We don't drop
  // the canonical definitions themselves — they may be referenced
  // by other books and we'd need to rebuild across the library.
  await Edge.deleteMany({ method: 'canonical-lookup', fromBookId: bookId });
  const build = await buildCanonicalDictionary({}); // library-wide build
  const link = await linkSpansToCanonicalDefinitions({ bookIds: [bookId] });
  return { build, link };
}

module.exports = {
  buildCanonicalDictionary,
  linkSpansToCanonicalDefinitions,
  rebuildCanonicalForBook,
  resolveFromText,
  // exported for tests / ad-hoc reuse:
  extractCandidatesFromChunk,
  isConceptTagLike,
  candidateBeats,
  canonicalsFor,
  normalizeTextToSnakeCase,
  tokenizeText,
};
