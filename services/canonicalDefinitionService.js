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

// Unicode hyphen variants: ASCII hyphen, U+2010 hyphen,
// U+2011 non-breaking hyphen, U+2012 figure dash, U+2013 en-dash,
// U+2014 em-dash, U+2212 minus sign. Mobile selection sometimes
// returns these, OCR/PDF text often uses non-ASCII variants for
// hyphenated author names. Strip them all to ASCII before
// normalization.
function asciifyHyphens(text) {
  return (text || '').replace(/[\u2010\u2011\u2012\u2013\u2014\u2212]/g, '-');
}

function normalizeTextToSnakeCase(text) {
  if (!text || typeof text !== 'string') return '';
  return asciifyHyphens(text)
    .toLowerCase()
    .replace(/[-]+/g, ' ')      // hyphens → spaces → underscores
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\s/g, '_');
}

// Hyphen-preserving form for layer-1 SYNONYMS lookup. Some
// taxonomy synonyms are stored with hyphens (e.g.
// 'britto-cachazo-feng-witten') so we need a normalized form
// that keeps them intact while still lowercasing and
// trimming everything else.
function normalizeTextToHyphenForm(text) {
  if (!text || typeof text !== 'string') return '';
  return asciifyHyphens(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenizeText(text) {
  if (!text || typeof text !== 'string') return [];
  return asciifyHyphens(text)
    .toLowerCase()
    .replace(/[-]+/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 2);
}

// Trivial query tokens that should not anchor a substring
// match by themselves. "shifts" / "theory" / etc. are common
// trailing words that otherwise cause spurious matches (e.g.
// "Britto-Cachazo-Feng-Witten shifts" falsely matching
// `non_adjacent_shifts` on "shifts"). If the only matching
// token is in this set, the candidate is skipped.
const WEAK_TOKENS = new Set([
  'shift', 'shifts', 'theory', 'equation', 'invariant', 'invariants',
  'amplitude', 'amplitudes', 'result', 'results', 'proof', 'proofs',
  'lemma', 'function', 'functions', 'variable', 'variables',
  'constant', 'constants', 'parameter', 'parameters',
  'operator', 'operators', 'vector', 'vectors', 'term', 'terms',
  'formula', 'formulas', 'expression', 'expressions',
  'condition', 'conditions', 'method', 'methods',
]);

/**
 * Multi-candidate resolver. Given a highlighted string, return
 * a RANKED list of definition candidates — not just the first
 * winner.
 *
 * Why multi-candidate: the user may highlight "BCFW shift" and
 * the library may have a definition for it in BOTH the source
 * paper (Rodina eq 12) AND in Jony's notes (p39 expository
 * form). The user wants to see BOTH, ranked by which one would
 * best teach the concept to someone who doesn't know it yet.
 *
 * Ranking pipeline:
 *
 * Step 1: Gather candidates.
 *   - Start from the CanonicalDefinition winners for every
 *     canonical concept name the taxonomy maps the query to.
 *   - Also gather EVERY span across the library with
 *     role='definition' whose contextTags canonicalize to any
 *     of those concepts. This is the pool of alternatives.
 *   - Also try substring / fuzzy fallback for the concept
 *     name itself when direct lookup misses.
 *
 * Step 2: Heuristic scoring.
 *   - Notes-book preference: a span in a notes-kind book gets
 *     a bonus (Jony's explicit instruction — notes tend to be
 *     more expository and pedagogical).
 *   - Content richness: longer preview with both prose and
 *     at least one `\(` inline math / `\[` display math is
 *     better than a bare section heading.
 *   - Structural evidence: chunk.structuralType === 'definition'
 *     with span role='definition' is better than tag-only.
 *   - Page earliness: lower page number wins in a tie.
 *
 * Step 3: Optional LLM judge pass.
 *   - For the top 3 heuristic candidates, call Claude Sonnet
 *     with their preview texts and ask which one teaches the
 *     concept best to a reader who's never seen it. Judge
 *     returns ranked list with one-line reasoning.
 *   - Disabled via opts.judge=false.
 *
 * Returns { query, canonicalConcept, synonymFamily, spanCount,
 *   candidates: [ {chunkId, bookId, bookTitle, bookKind,
 *     pageNumber, structuralType, preview, heuristicScore,
 *     judgeRank, judgeReason, tier, conceptName} ...] }
 * or null if no candidates.
 */
async function resolveFromText(rawText, opts = {}) {
  const Chunk = require('../models/Chunk');
  const Book = require('../models/Book');
  const Span = require('../models/Span');

  if (!rawText || typeof rawText !== 'string') return null;
  const text = rawText.trim();
  if (text.length === 0) return null;
  const useLLMJudge = opts.judge !== false;
  const maxCandidates = opts.maxCandidates || 5;

  // ─── Step 1a: identify candidate canonical concept names ─
  const conceptNames = new Set();

  // Try the snake-cased whole phrase against the markers table.
  const snake = normalizeTextToSnakeCase(text);
  for (const c of canonicalsFor(snake)) conceptNames.add(c);

  // Try the hyphen-preserving form too — taxonomy.SYNONYMS
  // stores some entries with hyphens (e.g.
  // 'britto-cachazo-feng-witten' → 'bcfw recursion').
  // Pass through the legacy normalize() layer first to fold
  // synonyms into a canonical form, THEN through getCanonicals()
  // to land on a CONCEPTS entry. Without this bridge step,
  // queries using author surnames in their full hyphenated
  // form never resolve.
  const hyphen = normalizeTextToHyphenForm(text);
  if (hyphen) {
    const synonymized = taxonomy.normalize(hyphen);
    for (const c of canonicalsFor(synonymized)) conceptNames.add(c);
    // Also try the raw hyphen form against the markers table
    // directly (markers can include hyphenated entries now).
    for (const c of canonicalsFor(hyphen)) conceptNames.add(c);
  }

  // Per-token tokens, each through the synonym layer.
  for (const tok of tokenizeText(text)) {
    if (tok.length < 2) continue;
    if (WEAK_TOKENS.has(tok)) continue;
    // Direct token lookup
    for (const c of canonicalsFor(tok)) conceptNames.add(c);
    // Synonym-layer hop in case the token itself is a known
    // alias (e.g. 'mnlsm' → 'nlsm').
    const syn = taxonomy.normalize(tok);
    if (syn !== tok) {
      for (const c of canonicalsFor(syn)) conceptNames.add(c);
    }
  }

  // Filter out conceptNames that resolved to a single weak
  // token (something like 'shifts' returning itself as a
  // canonical because no marker matched). These pollute the
  // candidate pool.
  for (const name of [...conceptNames]) {
    if (WEAK_TOKENS.has(name)) conceptNames.delete(name);
    // Also drop anything that's a single author-surname token
    // by itself — only valid as part of the bcfw expansion,
    // not as a standalone concept.
    if (['britto', 'cachazo', 'feng', 'witten'].includes(name)) {
      conceptNames.delete(name);
      conceptNames.add('bcfw'); // shortcut: any author surname → bcfw
    }
  }

  // Substring scan if we found no direct canonicals
  if (conceptNames.size === 0) {
    const all = await CanonicalDefinition.find({}).select('concept').lean();
    const tokens = tokenizeText(text).filter(t => t.length >= 3 && !WEAK_TOKENS.has(t));
    for (const row of all) {
      for (const tok of tokens) {
        if (row.concept.includes(tok)) {
          conceptNames.add(row.concept);
          break;
        }
      }
    }
  }

  // Fuzzy whole-word overlap as last resort
  if (conceptNames.size === 0) {
    const tokens = new Set(tokenizeText(text).filter(t => t.length >= 3 && !WEAK_TOKENS.has(t)));
    if (tokens.size >= 2) {
      const all = await CanonicalDefinition.find({}).select('concept').lean();
      for (const row of all) {
        const conceptTokens = new Set(row.concept.split('_').filter(t => t.length >= 3));
        let overlap = 0;
        for (const t of tokens) if (conceptTokens.has(t)) overlap++;
        if (overlap >= 2) conceptNames.add(row.concept);
      }
    }
  }

  if (conceptNames.size === 0) return null;

  // ─── Step 1b: gather candidate chunks ────────────────
  // For each canonical concept name, collect every span
  // library-wide whose contextTag canonicalizes to it AND
  // whose role or context indicates a definition. Include
  // the registered CanonicalDefinition as a guaranteed
  // candidate, then expand via span lookup for alternatives.

  const candidatesByChunk = new Map(); // chunkId -> candidate

  const addCandidate = async (chunk, span, tier, conceptName) => {
    if (!chunk) return;
    const key = String(chunk._id);
    if (candidatesByChunk.has(key)) {
      // Keep the best tier if duplicate
      const existing = candidatesByChunk.get(key);
      if (tier < existing.tier) existing.tier = tier;
      return;
    }
    const book = await Book.findById(chunk.bookId).select('_id title author kind').lean();
    candidatesByChunk.set(key, {
      chunkId: String(chunk._id),
      bookId: String(chunk.bookId),
      bookTitle: book?.title || null,
      bookKind: book?.kind || null,
      pageNumber: chunk.pageNumber,
      structuralType: chunk.structuralType || null,
      preview: (chunk.sourceText || chunk.rawText || '').slice(0, 600),
      tier,
      conceptName,
      spanId: span ? String(span._id) : null,
      spanRole: span?.role || null,
      spanText: span?.spanText || null,
    });
  };

  // 1b.1: Registered CanonicalDefinition winners
  for (const conceptName of conceptNames) {
    const def = await CanonicalDefinition.findOne({ concept: conceptName }).lean();
    if (!def) continue;
    const chunk = await Chunk.findById(def.definitionChunkId)
      .select('_id bookId pageNumber sourceText rawText structuralType').lean();
    const tier = def.source === 'structural' ? 0 : def.source === 'role' ? 1 : 2;
    await addCandidate(chunk, null, tier, conceptName);
  }

  // 1b.2: Alternative definition spans across the library
  // Look for any span whose contextTag canonicalizes to any
  // of our concept names AND has role='definition'.
  for (const conceptName of conceptNames) {
    // Find spans whose tags contain a variant that canonicalizes
    // to this concept. We use a regex against the canonical
    // name plus known markers.
    const markers = (taxonomy.CONCEPTS?.[conceptName] || [conceptName])
      .filter(m => typeof m === 'string' && m.length >= 2);
    if (markers.length === 0) continue;

    const rx = new RegExp(markers.map(m => m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'i');
    const altSpans = await Span.find({
      role: 'definition',
      contextTags: { $regex: rx },
    })
      .select('_id bookId chunkId contextTags role spanText sentenceStart sentenceEnd')
      .limit(20)
      .lean();

    for (const s of altSpans) {
      const chunk = await Chunk.findById(s.chunkId)
        .select('_id bookId pageNumber sourceText rawText structuralType').lean();
      if (!chunk) continue;
      // Tier 1 for role=definition; promoted to 0 if chunk
      // structuralType also says definition.
      const tier = chunk.structuralType === 'definition' ? 0 : 1;
      await addCandidate(chunk, s, tier, conceptName);
    }
  }

  // 1b.3: `:=` operator spans for any canonical concept name
  for (const conceptName of conceptNames) {
    const markers = (taxonomy.CONCEPTS?.[conceptName] || [conceptName])
      .filter(m => typeof m === 'string' && m.length >= 2);
    if (markers.length === 0) continue;
    const rx = new RegExp(markers.map(m => m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'i');
    const operatorSpans = await Span.find({
      contextTags: { $regex: rx },
      spanText: { $regex: /:=|\\mathrel\{\\mathop:\}=|\\equiv/ },
    })
      .select('_id bookId chunkId contextTags role spanText')
      .limit(10)
      .lean();

    for (const s of operatorSpans) {
      const chunk = await Chunk.findById(s.chunkId)
        .select('_id bookId pageNumber sourceText rawText structuralType').lean();
      if (!chunk) continue;
      await addCandidate(chunk, s, 1, conceptName); // := gets role-tier strength
    }
  }

  if (candidatesByChunk.size === 0) return null;

  // ─── Step 2: heuristic scoring ───────────────────────
  // Filter out candidates with empty or near-empty previews —
  // chunks whose sourceText wasn't properly extracted (common
  // on the first few sentences of handwritten notes pages).
  // A candidate with <25 chars of preview cannot teach
  // anything, regardless of how well it scores on the
  // structural heuristics.
  const candidates = [...candidatesByChunk.values()]
    .filter(c => {
      const p = (c.preview || '').trim();
      // Also require that the preview contains at least one
      // real word (>= 3 letter run) — a chunk whose preview is
      // just "\[...\]" or an equation label fails this and
      // isn't useful for teaching even if it's valid.
      return p.length >= 25 && /[a-zA-Z]{3,}/.test(p);
    });

  if (candidates.length === 0) return null;
  for (const c of candidates) {
    let score = 0;
    // Notes-book preference (Jony's explicit instruction)
    if (c.bookKind === 'notes') score += 30;
    // Tier quality: lower tier number is better
    score += (2 - c.tier) * 10;
    // Content richness heuristics
    const previewLen = (c.preview || '').length;
    if (previewLen >= 300) score += 8;
    else if (previewLen >= 150) score += 4;
    else if (previewLen < 50) score -= 5; // bare section heading penalty
    const hasInlineMath = /\\\(/.test(c.preview || '');
    const hasDisplayMath = /\\\[/.test(c.preview || '');
    if (hasInlineMath) score += 3;
    if (hasDisplayMath) score += 5;
    // `:=` operator bonus
    if (/:=|\\equiv/.test(c.spanText || c.preview || '')) score += 6;
    // Structural type bonus
    if (c.structuralType === 'definition') score += 5;
    else if (c.structuralType === 'theorem') score += 3;
    // Page earliness (smaller tiebreaker)
    score -= (c.pageNumber || 0) * 0.05;

    c.heuristicScore = Math.round(score * 100) / 100;
  }
  candidates.sort((a, b) => b.heuristicScore - a.heuristicScore);

  // Cap to top N
  const ranked = candidates.slice(0, maxCandidates);

  // ─── Step 3: LLM judge pass ──────────────────────────
  if (useLLMJudge && ranked.length >= 2) {
    try {
      await judgeCandidates(text, ranked.slice(0, Math.min(3, ranked.length)));
    } catch (err) {
      console.warn('[resolveFromText] judge failed:', err.message);
    }
  }

  // ─── Build the return envelope ───────────────────────
  const primaryConcept = ranked[0]?.conceptName || [...conceptNames][0];
  const spanCount = await Span.countDocuments({
    contextTags: { $regex: new RegExp(`${primaryConcept}`, 'i') },
  });

  return {
    query: text,
    canonicalConcept: primaryConcept,
    alternativeConcepts: [...conceptNames].filter(c => c !== primaryConcept),
    synonymFamily: Array.isArray(taxonomy.CONCEPTS?.[primaryConcept])
      ? taxonomy.CONCEPTS[primaryConcept]
      : [],
    spanCount,
    candidateCount: ranked.length,
    candidates: ranked,
    // Legacy compat: single-definition shape that older clients
    // (the current metadata-panel.js fallback block) still read.
    matchedVia: ranked[0] ? 'ranked' : null,
    definition: ranked[0] ? {
      chunkId: ranked[0].chunkId,
      bookId: ranked[0].bookId,
      bookTitle: ranked[0].bookTitle,
      bookKind: ranked[0].bookKind,
      pageNumber: ranked[0].pageNumber,
      structuralType: ranked[0].structuralType,
      preview: ranked[0].preview?.slice(0, 400),
    } : null,
  };
}

// ─── Step 3 helper: LLM judge for top candidates ───────
//
// Calls Claude Sonnet with the top 2-3 heuristic winners and
// asks which one best teaches the concept to a reader who
// doesn't know it yet. Mutates each candidate in place:
//   c.judgeRank      — 1-indexed rank from the judge
//   c.judgeReason    — one-line reasoning (why this rank)
//
// Sorts the candidates array by judgeRank after judging.
// Silently no-ops if ANTHROPIC_API_KEY is missing — heuristic
// ordering is preserved in that case.
async function judgeCandidates(query, candidates) {
  if (!candidates || candidates.length < 2) return;
  if (!process.env.ANTHROPIC_API_KEY) return;

  const Anthropic = require('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const payload = candidates.map((c, i) => ({
    id: i + 1,
    source: c.bookKind === 'notes' ? 'personal notes' : 'published paper',
    bookTitle: (c.bookTitle || '').slice(0, 60),
    page: c.pageNumber,
    structuralType: c.structuralType || 'narrative',
    preview: (c.preview || '').slice(0, 500),
  }));

  const system = `You are a pedagogy judge. You will be given a concept the user wants explained, and 2-3 candidate definition passages drawn from their research library. One or more may be from the user's own notes (expository, informal, example-heavy) and one or more may be from a published paper (formal, terse, often just the defining equation).

Your job is to rank the candidates by how well each would TEACH this concept to a reader who does not yet know what it is. Consider:
- Does the passage define the concept or just invoke it?
- Does it include concrete examples, derivations, or intuition-building context?
- Does it rely on other undefined concepts, and if so are those accessible?
- Would a new grad student understand the concept from this passage alone?

Return ONLY a JSON array of the form:
[
  {"id": <candidate id>, "rank": 1, "reason": "<one sentence>"},
  {"id": <candidate id>, "rank": 2, "reason": "<one sentence>"},
  ...
]
Best candidate gets rank 1. No prose outside the JSON.`;

  const userMsg = `Concept: ${query}

Candidates:

${payload.map(p => `[${p.id}] (${p.source}, ${p.bookTitle}, p.${p.page}, ${p.structuralType})
${p.preview}
`).join('\n')}

Rank by teaching quality. Return JSON only.`;

  const resp = await client.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 500,
    system,
    messages: [{ role: 'user', content: userMsg }],
  });

  const text = (resp.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
  // Extract JSON array from the response
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return;
  let verdict;
  try { verdict = JSON.parse(match[0]); } catch (_) { return; }
  if (!Array.isArray(verdict)) return;

  // Apply the verdict to the candidates (1-indexed id → array index)
  for (const v of verdict) {
    const idx = (v.id || 0) - 1;
    if (idx >= 0 && idx < candidates.length) {
      candidates[idx].judgeRank = v.rank;
      candidates[idx].judgeReason = v.reason || null;
    }
  }

  // Resort by judgeRank (ascending), fall back to heuristicScore
  candidates.sort((a, b) => {
    const ar = a.judgeRank ?? 99;
    const br = b.judgeRank ?? 99;
    if (ar !== br) return ar - br;
    return (b.heuristicScore || 0) - (a.heuristicScore || 0);
  });
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
