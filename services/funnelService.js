/**
 * funnelService — Phase 3 four-layer edge resolution funnel.
 *
 * Per Vision.md §4.3 / Gyde-research-libarary-specs.md §3.3, the
 * cross-document edge pipeline is:
 *
 *   Layer 1 (free):    concept tag overlap via taxonomyService
 *                      narrows from N chunks → ~50-100 candidates
 *   Layer 2 (cheap):   embedding cosine similarity
 *                      narrows ~50-100 → top 20 candidates
 *   Layer 3 (nano):    micro-LLM ranker emits compressed verdicts
 *                      ranks 20 → ordered list, top 3-4 advance
 *   Layer 4 (opus):    strict classifier emits relationship + conf
 *                      top 3-4 → final Edge documents with type
 *                      and confidence letters
 *
 * Stop conditions:
 *   - First Layer 4 verdict with confidence >= EDGE_STOPPING_CONFIDENCE
 *   - All ranked candidates exhausted
 *   - Per-source-span LLM call budget exhausted (safety)
 *
 * The funnel is invoked PER source span (a span that cites another
 * book — i.e. a span where the citation key resolved to a known
 * Book in the library). The current `resolveSEdgesForBook` in
 * edgeResolverService.js does the same loop over S-tagged spans
 * but uses a single-stage scoring heuristic. This file replaces
 * that scoring with the funnel.
 *
 * Edge documents created here carry:
 *   - method: 'llm'   (vs 'lexical' for the scoring resolver)
 *   - confidence: a-z letter from the Layer 4 classifier
 *   - relevance: a-z letter from the Layer 4 classifier
 *   - relationshipType: from the Layer 4 classifier (proves /
 *     extends / etc.) — NOT defaulted to 'assumes'
 *
 * Cost discipline:
 *   - Embeddings are pre-computed (one-time, cheap, ~$0.50 for the
 *     5-book corpus). The cosine filter is in-memory, no API call.
 *   - Layer 3 nano call: ~500 in + 30 out tokens, gpt-4o-mini, ~$0.0001
 *   - Layer 4 opus calls: ~1200 in + 5 out tokens each, ~$0.02
 *   - Per source span: 1 nano call + 1-3 opus calls = ~$0.03-0.07
 *   - 5-book corpus has ~100 S-tagged spans → ~$3-7 total per run
 */

const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');
const Anthropic = require('@anthropic-ai/sdk');
const Edge = require('../models/Edge');
const Span = require('../models/Span');
const Chunk = require('../models/Chunk');
const Book = require('../models/Book');
const pipeline = require('../config/pipeline');
const { expandTags } = require('./taxonomyService');
const { embed } = require('./embeddingService');
const {
  indexToLetter,
  letterToIndex,
  fractionToConfidence,
  confidenceToFraction,
  letterToRelationship,
  relationshipToLetter,
  decodeRanking,
  decodeClassification,
} = require('./compressionService');

// ─── LLM clients ────────────────────────────────────────────────

let _openai = null;
function getOpenAI() {
  if (!_openai && process.env.OPENAI_API_KEY) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

let _anthropic = null;
function getAnthropic() {
  if (!_anthropic && process.env.ANTHROPIC_API_KEY) {
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _anthropic;
}

// ─── Prompts (loaded once) ──────────────────────────────────────

const PROMPT_DIR = path.join(__dirname, '..', 'prompts');
let _rankPrompt = null;
let _classifyPrompt = null;
let _pickPrompt = null;
function rankPrompt() {
  if (!_rankPrompt) _rankPrompt = fs.readFileSync(path.join(PROMPT_DIR, 'edge-rank.txt'), 'utf-8');
  return _rankPrompt;
}
function classifyPrompt() {
  if (!_classifyPrompt) _classifyPrompt = fs.readFileSync(path.join(PROMPT_DIR, 'edge-classify.txt'), 'utf-8');
  return _classifyPrompt;
}
function pickPrompt() {
  if (!_pickPrompt) _pickPrompt = fs.readFileSync(path.join(PROMPT_DIR, 'edge-pick.txt'), 'utf-8');
  return _pickPrompt;
}

// ─── Cosine similarity ──────────────────────────────────────────

function cosineSimilarity(a, b) {
  if (!a || !b || a.length === 0 || a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// ─── Layer 1: concept-tag pre-filter ────────────────────────────
//
// Cheap pass that drops candidates with zero concept overlap. The
// embedding pass will rank what survives. We DO allow the embedding
// pass to see candidates with overlap=0 if the candidate pool is
// small (under 30) — that's the case where the source's tag
// vocabulary doesn't intersect any target tag and we have to rely
// on semantic similarity alone.

function tagPreFilter(sourceConcepts, candidateChunks, opts = {}) {
  const minOverlap = opts.minOverlap || 1;
  const fallbackUnderN = opts.fallbackUnderN || 30;
  const filtered = candidateChunks.filter(c => {
    const concepts = expandTags(c.contextTags || []);
    let overlap = 0;
    for (const t of sourceConcepts) if (concepts.has(t)) overlap++;
    return overlap >= minOverlap;
  });
  // If the corpus is small AND the filter killed everything, fall
  // back to the full chunk list — embedding cosine alone will rank
  // them.
  if (filtered.length === 0 && candidateChunks.length < fallbackUnderN) {
    return candidateChunks;
  }
  return filtered;
}

// ─── Layer 2: embedding cosine ranking ──────────────────────────
//
// Takes the surviving candidates from Layer 1 and ranks them by
// cosine similarity against the source span's embedding. Returns
// top K (default 20) sorted descending.

async function cosineRank(sourceSpan, candidates, k = 20) {
  // Get the source span's embedding. If the span doesn't have one
  // yet, compute on the fly using the span text + tags.
  let srcEmbed = sourceSpan.embedding;
  if (!srcEmbed || srcEmbed.length === 0) {
    let text = sourceSpan.spanText || '';
    if (sourceSpan.contextTags && sourceSpan.contextTags.length) {
      text += '\nTags: ' + sourceSpan.contextTags.join(', ');
    }
    srcEmbed = await embed(text);
    if (srcEmbed) {
      try {
        await Span.findByIdAndUpdate(sourceSpan._id, { embedding: srcEmbed });
      } catch (err) { /* non-fatal */ }
    }
  }
  if (!srcEmbed || srcEmbed.length === 0) return candidates.slice(0, k);

  const scored = [];
  for (const c of candidates) {
    if (!c.embedding || c.embedding.length === 0) continue;
    const cos = cosineSimilarity(srcEmbed, c.embedding);
    scored.push({ chunk: c, cosine: cos });
  }
  scored.sort((a, b) => b.cosine - a.cosine);
  return scored.slice(0, k);
}

// ─── Layer 3: nano ranker ───────────────────────────────────────
//
// Sends the top 20 candidates (lettered a..t) to the nano model
// with the rank prompt. The model emits a compressed line of
// 2-letter verdicts. Decoded into an ordered list of (chunkIndex,
// confidence) pairs that we map back to actual chunks.
//
// Cost: ~500 input tokens + 30 output tokens at gpt-4o-mini pricing
// = ~$0.0001 per call.

async function nanoRank(sourceSpan, sourceBook, targetBook, rankedCandidates) {
  const client = getOpenAI();
  if (!client) return rankedCandidates.map((c, i) => ({ chunk: c.chunk, fraction: 1 - i * 0.05 }));

  // Cap at 26 so we can use single-letter labels
  const candidates = rankedCandidates.slice(0, 26);

  // Build the prompt input block
  const lines = [];
  lines.push('SOURCE_SPAN: "' + (sourceSpan.spanText || '').replace(/\s+/g, ' ').trim().substring(0, 240) + '"');
  lines.push('SOURCE_TAGS: ' + (sourceSpan.contextTags || []).join(', '));
  lines.push('SOURCE_BOOK: ' + (sourceBook.title || ''));
  lines.push('');
  lines.push('CANDIDATES (target book: ' + (targetBook.title || '') + '):');
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i].chunk;
    const letter = indexToLetter(i + 1);
    const text = (c.sourceText || '').replace(/\s+/g, ' ').trim().substring(0, 160);
    const tags = (c.contextTags || []).slice(0, 5).join(',');
    lines.push(letter + ': p' + c.pageNumber + ' [' + (c.structuralType || 'narrative') + '] tags=[' + tags + '] text="' + text + '"');
  }
  const userInput = lines.join('\n');

  const response = await client.chat.completions.create({
    model: process.env.NANO_MODEL || 'gpt-4o-mini',
    temperature: 0.1,
    max_tokens: 80,
    messages: [
      { role: 'system', content: rankPrompt() },
      { role: 'user', content: userInput },
    ],
  });

  const rawOutput = response.choices?.[0]?.message?.content || '';
  const decoded = decodeRanking(rawOutput);

  // Map decoded entries back to candidate chunks. Skip indices
  // that fall outside the candidate range (the nano model
  // sometimes hallucinates a letter beyond what we showed it).
  const result = [];
  const seen = new Set();
  for (const entry of decoded) {
    if (entry.chunkIndex < 1 || entry.chunkIndex > candidates.length) continue;
    if (seen.has(entry.chunkIndex)) continue;
    seen.add(entry.chunkIndex);
    const candidate = candidates[entry.chunkIndex - 1];
    if (!candidate) continue;
    result.push({
      chunk: candidate.chunk,
      cosine: candidate.cosine,
      nanoConfidence: entry.confidence,
      nanoFraction: entry.fraction,
    });
  }
  return { ranked: result, rawOutput };
}

// ─── Layer 4: strict classifier ─────────────────────────────────
//
// For each top-ranked candidate, send the source span + target
// chunk to the strong model with the classify prompt. The model
// emits a 3-letter verdict (relationship, confidence, relevance).
// Stop early when the verdict's confidence crosses
// EDGE_STOPPING_CONFIDENCE — we don't need to classify the rest if
// we already have a strong edge.
//
// Cost: ~1200 input tokens + 5 output tokens at Opus pricing
// = ~$0.02 per call. With early stopping at confidence 't' (~75%)
// the average is closer to 1.5 calls per source span.

async function classifyEdge(sourceSpan, sourceBook, targetChunk, targetBook) {
  const client = getAnthropic();
  if (!client) {
    // Fallback: synthesize a default verdict from cosine
    return { relationship: 'assumes', confidence: 'k', relevance: 'k', fraction: 0.5, raw: '(no anthropic client)' };
  }

  const userInput = [
    'SOURCE_SPAN: "' + (sourceSpan.spanText || '').replace(/\s+/g, ' ').trim().substring(0, 320) + '"',
    'SOURCE_TAGS: ' + (sourceSpan.contextTags || []).join(', '),
    'SOURCE_BOOK: ' + (sourceBook.title || ''),
    '',
    'TARGET_CHUNK: "' + (targetChunk.sourceText || '').replace(/\s+/g, ' ').trim().substring(0, 320) + '"',
    'TARGET_TAGS: ' + (targetChunk.contextTags || []).join(', '),
    'TARGET_BOOK: ' + (targetBook.title || ''),
    'TARGET_PAGE: ' + targetChunk.pageNumber,
    'TARGET_TYPE: ' + (targetChunk.structuralType || 'narrative'),
  ].join('\n');

  const response = await client.messages.create({
    model: process.env.EDGE_MODEL || pipeline.EDGE_MODEL || 'claude-opus-4-6',
    max_tokens: 16,
    system: classifyPrompt(),
    messages: [{ role: 'user', content: userInput }],
  });

  const raw = response.content?.[0]?.text || '';
  const decoded = decodeClassification(raw);
  if (decoded.length === 0) {
    return { relationship: 'assumes', confidence: 'k', relevance: 'k', fraction: 0.5, raw };
  }
  return { ...decoded[0], raw };
}

// ─── Funnel orchestrator ────────────────────────────────────────

// ─── Layer 3 fused: Opus picker + classifier (single call) ──────
//
// Empirically the nano ranker (gpt-4o-mini) doesn't reliably
// surface the bullseye when the candidates all share concept tags
// and only differ on whether they're the section header / theorem
// statement vs follow-up paraphrase. We bypass nano entirely and
// send the top-12 cosine candidates directly to Opus in ONE call,
// asking it to (a) pick the best chunk and (b) emit relationship
// + confidence + relevance in 4 letters total. Cost is comparable
// to the nano + 4-classify loop (~$0.04/span) but precision is
// dramatically better.
//
// Output format: 4 chars, e.g. "nepz" = "candidate n, extends,
// confidence p, relevance z". Decoded via decodePickVerdict.

const PICK_CANDIDATE_COUNT = 12;

function decodePickVerdict(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const compact = raw.replace(/[^a-zA-Z]/g, '');
  if (compact.length < 4) return null;
  const chunkLetter = compact[0].toLowerCase();
  const relLetter = compact[1].toLowerCase();
  const confLetter = compact[2].toLowerCase();
  const relevLetter = compact[3].toLowerCase();
  return {
    chunkIndex: letterToIndex(chunkLetter),
    relationship: letterToRelationship(relLetter),
    confidence: confLetter,
    relevance: relevLetter,
  };
}

async function pickAndClassify(sourceSpan, sourceBook, targetBook, candidates) {
  // Use GPT-4o for the picker. Empirically Opus 4.6 is too chatty
  // for the strict 4-letter format and burns tokens on prose
  // explanation; GPT-4o follows the format reliably with
  // temperature=0. The picker is the high-volume call (1 per
  // source span) and GPT-4o is also cheaper than Opus, so this is
  // the right model choice. Strong-model auditing can be a
  // separate Phase 4 quality pass on top.
  const client = getOpenAI();
  if (!client) {
    return { error: '(no openai client)' };
  }
  const top = candidates.slice(0, PICK_CANDIDATE_COUNT);

  const lines = [];
  lines.push('SOURCE_SPAN: "' + (sourceSpan.spanText || '').replace(/\s+/g, ' ').trim().substring(0, 320) + '"');
  lines.push('SOURCE_TAGS: ' + (sourceSpan.contextTags || []).join(', '));
  lines.push('SOURCE_BOOK: ' + (sourceBook.title || ''));
  lines.push('');
  lines.push('CANDIDATES (target book: ' + (targetBook.title || '') + '):');
  for (let i = 0; i < top.length; i++) {
    const c = top[i].chunk;
    const letter = indexToLetter(i + 1);
    const text = (c.sourceText || '').replace(/\s+/g, ' ').trim().substring(0, 220);
    const tags = (c.contextTags || []).slice(0, 6).join(',');
    lines.push(letter + ': p' + c.pageNumber + ' [' + (c.structuralType || 'narrative') + '] tags=[' + tags + '] text="' + text + '"');
  }
  lines.push('');
  lines.push('Output exactly 4 lowercase letters on one line. No prose. No explanations.');
  const userInput = lines.join('\n');

  // Retry on 429 TPM / transient failures. The OpenAI SDK's internal
  // retry count is 2 and caps its backoff around a few seconds, which
  // is not long enough to wait out a TPM window (reset is up to 60s).
  // Walk an exponential backoff up to ~32s with Retry-After hint
  // parsing, so large batch runs (e.g. matchNotesToSourceBooks across
  // 643 notes chunks × 5 books) do not hemorrhage silent failures.
  let response;
  const maxAttempts = 6;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      response = await client.chat.completions.create({
        model: process.env.EDGE_PICKER_MODEL || 'gpt-4o',
        temperature: 0,
        max_tokens: 8,
        messages: [
          { role: 'system', content: pickPrompt() },
          { role: 'user', content: userInput },
        ],
      });
      break;
    } catch (err) {
      const is429 = err.status === 429 || /rate limit/i.test(err.message || '');
      const transient = is429 || err.code === 'ETIMEDOUT' || err.code === 'ECONNRESET' || err.status === 503;
      if (!transient || attempt === maxAttempts - 1) throw err;
      // Parse "Please try again in Xs" / "Xms" from the error message
      let waitMs;
      const hint = (err.message || '').match(/try again in ([0-9.]+)(s|ms)/i);
      if (hint) {
        waitMs = Math.round(Number(hint[1]) * (hint[2].toLowerCase() === 's' ? 1000 : 1));
        waitMs = Math.max(waitMs, 500); // floor so we don't spin
      } else {
        waitMs = Math.min(32000, 2000 * Math.pow(2, attempt));
      }
      // Add jitter so parallel callers don't thundering-herd
      waitMs += Math.floor(Math.random() * 400);
      await new Promise(r => setTimeout(r, waitMs));
    }
  }

  const raw = response.choices?.[0]?.message?.content || '';
  // Find the first 4-letter contiguous letter sequence in the
  // reply. GPT-4o usually outputs exactly 4 letters at temperature
  // 0, but occasional preambles get salvaged by the regex.
  const cleanMatch = raw.match(/^[a-zA-Z]{4}$/m) || raw.match(/[a-zA-Z]{4}/);
  const cleaned = cleanMatch ? cleanMatch[0] : raw;
  const decoded = decodePickVerdict(cleaned);
  if (!decoded || !decoded.chunkIndex || decoded.chunkIndex > top.length) {
    return { error: 'invalid pick verdict: ' + raw, raw };
  }
  const picked = top[decoded.chunkIndex - 1];
  return {
    chunk: picked.chunk,
    cosine: picked.cosine,
    relationship: decoded.relationship,
    confidence: decoded.confidence,
    relevance: decoded.relevance,
    fraction: confidenceToFraction(decoded.confidence) * confidenceToFraction(decoded.relevance),
    raw,
  };
}

const TOP_RANKED = 4;          // top-K from Layer 3 to send to Layer 4
// Stop ONLY after we've evaluated at least MIN_CLASSIFY candidates
// AND we've found one with confidence >= STOP_LETTER. Without the
// minimum, the first reasonable verdict short-circuits the whole
// pass and we miss bullseye targets that nano ranked second or
// third. Empirically MIN_CLASSIFY=3 catches the bullseye in test
// cases where the cosine ranker put the bullseye in position 2-3.
const STOP_LETTER = pipeline.EDGE_STOPPING_CONFIDENCE || 't';
const MIN_CLASSIFY = 3;

async function resolveSpanThroughFunnel(sourceSpan, sourceBook, targetBookId) {
  const targetBook = await Book.findById(targetBookId).lean();
  if (!targetBook) return { error: 'target book not found' };

  // Layer 1: HYBRID candidate gathering. Two parallel paths:
  //   (a) concept-tag pre-filter — chunks that share at least one
  //       canonical concept with the source span. Recall-strong
  //       on lexically aligned matches but misses chunks where
  //       the LLM tagged the same idea with different words.
  //   (b) embedding cosine TOP-25 across ALL chunks — captures
  //       semantic similarity even when tags don't overlap.
  // We union both, dedup, and pass up to 25 to Layer 3 (the
  // 26-letter cap leaves one slot for safety). Empirically the
  // bullseye chunk for Edge 3 (Section 3.1 examples) was at
  // cosine rank 14 — top-20 missed it, top-25 catches it.
  //
  // Bibliography chunks are filtered out at this stage — they're
  // never valid edge targets. The lexical resolver's
  // isBibliographyChunk heuristic catches chunks whose text is
  // just a list of `[N] Author, Title` references. Without this
  // filter, Opus sometimes picks a bib chunk because the cited
  // paper's title appears verbatim in the chunk text.
  const { isBibliographyChunk } = require('./edgeResolverService');
  const allChunksRaw = await Chunk.find({ bookId: targetBookId })
    .select('_id pageNumber chunkIndex sourceText contextTags structuralType embedding')
    .lean();

  // Identify bibliography pages: pages whose chunks include either
  // (a) a chunk that the existing isBibliographyChunk heuristic
  //     catches (4+ [N] markers, dense citations, [N] author-init
  //     prefix), OR
  // (b) a chunk whose text starts with "Bibliography" or
  //     "References" (the section header), OR
  // (c) a chunk shorter than 25 chars that matches a bib-fragment
  //     pattern like "[2] N." or "Arkani-Hamed, Y." — Book 2's
  //     bibliography is split into many tiny fragments which the
  //     existing heuristic misses individually.
  // All chunks on a bibliography page are excluded from the
  // candidate pool. This is the right granularity because once
  // a page is recognized as bibliography, every chunk on it is
  // either a fragment of a reference entry or surrounding context.
  const bibPages = new Set();
  const BIB_FRAGMENT = /^\s*(?:\[\d+\]\s*[A-Z][a-z]?\.?|Bibliography|References)/;
  for (const c of allChunksRaw) {
    if (isBibliographyChunk(c)) {
      bibPages.add(c.pageNumber);
      continue;
    }
    const txt = (c.sourceText || '').trim();
    if (txt.length === 0) continue;
    if (BIB_FRAGMENT.test(txt) && txt.length < 50) {
      bibPages.add(c.pageNumber);
    } else if (/^Bibliography|^References\b/i.test(txt)) {
      bibPages.add(c.pageNumber);
    }
  }
  const allChunks = allChunksRaw.filter(c => {
    if (bibPages.has(c.pageNumber)) return false;
    if (isBibliographyChunk(c)) return false;
    // Skip very short chunks (< 40 chars) — they can't carry
    // enough content to be useful citation targets and are
    // typically OCR/parse fragments.
    if ((c.sourceText || '').trim().length < 40) return false;
    return true;
  });
  const sourceConcepts = expandTags(sourceSpan.contextTags || []);
  const conceptFiltered = tagPreFilter(sourceConcepts, allChunks);

  // Cosine top 25 across ALL chunks (not just concept-filtered).
  // This is the recall path — chunks the embedding finds
  // semantically similar even if tags don't match.
  const cosineTopAll = await cosineRank(sourceSpan, allChunks, 25);

  // Cosine ranking restricted to the concept-filtered pool — these
  // are the chunks that share at least one canonical concept AND
  // are semantically close. High-precision subset.
  const cosineTopConcept = await cosineRank(sourceSpan, conceptFiltered, 15);

  // Union: dedup by chunk id, preserving the best cosine seen.
  const seen = new Map();
  for (const r of cosineTopConcept) {
    seen.set(String(r.chunk._id), r);
  }
  for (const r of cosineTopAll) {
    const k = String(r.chunk._id);
    if (!seen.has(k)) seen.set(k, r);
  }
  // Re-sort the union by cosine descending
  const cosineRanked = [...seen.values()]
    .sort((a, b) => b.cosine - a.cosine)
    .slice(0, 25);
  if (cosineRanked.length === 0) return { error: 'no candidates after layer 2' };

  // Layer 3 fused: single Opus call picks the best chunk AND
  // classifies the relationship in one shot. Replaces the older
  // nano-rank + classify-loop approach which couldn't reliably
  // surface section-header / theorem chunks as canonical citation
  // targets.
  let pickResult;
  try {
    pickResult = await pickAndClassify(sourceSpan, sourceBook, targetBook, cosineRanked);
  } catch (err) {
    return { error: 'layer 3 pick failed: ' + err.message };
  }
  if (pickResult.error) return { error: pickResult.error };

  return {
    best: pickResult,
    verdicts: [pickResult],
    layer1Count: conceptFiltered.length,
    layer2Count: cosineRanked.length,
    layer3Raw: pickResult.raw,
  };
}

/**
 * Resolve all S-tagged spans in a source book through the funnel
 * and create Edge documents (method='llm'). Existing 'llm' edges
 * for this book are wiped before re-resolving so the operation is
 * idempotent.
 */
async function resolveBookEdgesViaFunnel(sourceBookId, opts = {}) {
  const sourceBook = await Book.findById(sourceBookId).lean();
  if (!sourceBook) return { error: 'source book not found' };
  if (!sourceBook.bibEntries || sourceBook.bibEntries.length === 0) {
    return { edgesCreated: 0, reason: 'no bibEntries' };
  }
  const keyToTarget = {};
  for (const e of sourceBook.bibEntries) {
    if (e.resolvedBookId) keyToTarget[e.key] = e.resolvedBookId;
  }
  if (Object.keys(keyToTarget).length === 0) {
    return { edgesCreated: 0, reason: 'no resolved bib entries' };
  }

  // Wipe existing llm edges for this book
  await Edge.deleteMany({ fromBookId: sourceBookId, method: 'llm' });

  const spans = await Span.find({ bookId: sourceBookId, searchClass: 'S' })
    .select('_id chunkId pageNumber contextTags role spanText sentenceStart sentenceEnd embedding')
    .lean();

  // Extract citation keys from each span and process
  const { extractCitationKeys } = require('./edgeResolverService');
  let edgesCreated = 0;
  let spansProcessed = 0;
  const results = [];

  // Per-book budget cap so a runaway book can't blow our wallet
  const maxLLMCalls = opts.maxLLMCalls || 200;
  let llmCallCount = 0;

  for (const span of spans) {
    if (llmCallCount >= maxLLMCalls) {
      console.log('[funnelService] LLM call budget reached, stopping');
      break;
    }
    const keys = extractCitationKeys(span.spanText);
    if (keys.length === 0) continue;
    spansProcessed++;
    for (const key of keys) {
      const targetBookId = keyToTarget[key];
      if (!targetBookId) continue;
      const result = await resolveSpanThroughFunnel(span, sourceBook, targetBookId);
      llmCallCount += 1 + (result?.verdicts?.length || 0);
      if (result.error || !result.best) continue;
      const verdict = result.best;
      // Floors: drop edges where Opus is barely confident OR
      // where Opus rated the relevance very low. The relevance
      // floor catches the case where Opus says "yes this is a
      // citation edge but the target chunk barely addresses it" —
      // empirically those are noise (e.g. G/W p11 omega-shifts
      // landing on a p36 chunk with relev=a). Combined fraction
      // floor catches verdicts where neither dimension is strong.
      const cfLetter = verdict.confidence || 'a';
      const rvLetter = verdict.relevance || 'a';
      const cfFraction = confidenceToFraction(cfLetter);
      const rvFraction = confidenceToFraction(rvLetter);
      if (cfLetter < 'f' || rvLetter < 'f') continue;
      if (cfFraction * rvFraction < 0.10) continue;
      const edge = await Edge.create({
        fromChunkId: span.chunkId,
        fromSpanId: span._id,
        toChunkId: verdict.chunk._id,
        fromBookId: sourceBookId,
        toBookId: targetBookId,
        relationshipType: verdict.relationship,
        confidence: verdict.confidence,
        relevance: verdict.relevance,
        method: 'llm',
        resolved: true,
      });
      edgesCreated++;
      results.push({
        spanText: (span.spanText || '').substring(0, 60),
        targetPage: verdict.chunk.pageNumber,
        relationship: verdict.relationship,
        confidence: verdict.confidence,
        relevance: verdict.relevance,
        cosine: verdict.cosine,
      });
    }
  }

  return {
    sourceBookId,
    sourceBookTitle: sourceBook.title,
    spansProcessed,
    edgesCreated,
    llmCallCount,
    results,
  };
}

async function resolveLibraryViaFunnel(opts = {}) {
  const books = await Book.find({ status: { $ne: 'pending-citation' } }).select('_id title').lean();
  const summary = [];
  for (const b of books) {
    const r = await resolveBookEdgesViaFunnel(b._id, opts);
    summary.push({ bookId: b._id, title: b.title, ...r });
  }
  return summary;
}

module.exports = {
  resolveSpanThroughFunnel,
  resolveBookEdgesViaFunnel,
  resolveLibraryViaFunnel,
  pickAndClassify,
  // exposed for tests
  cosineSimilarity,
  tagPreFilter,
  cosineRank,
  nanoRank,
  classifyEdge,
};
