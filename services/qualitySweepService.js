/**
 * qualitySweepService — post-ingestion metadata repair.
 *
 * Surgically fixes bad chunks/spans already in MongoDB using
 * Opus with escalating context. Three repair patterns:
 *
 *   P1 — dense 1-span chunks (multi-concept decomposition)
 *   P2 — orphan pronoun chunks (merge or disambiguate)
 *   P3 — isolated nodes (no tags, no edges)
 *
 * Never touches PDFs or Page.htmlContent. Never deletes
 * existing spans/chunks/edges — repairs are add-only with
 * qualityRepairStatus flags. Rollback is a status flip.
 *
 * See reports/2026-04-12/quality-sweep-spec.md for the full
 * design doc and decisions log.
 *
 * Entry points:
 *   runSweepForBook(bookId, opts)  — full sweep on one book
 *   detectCandidates(bookId)       — dry-run: list bad chunks only
 *   repairChunk(chunkId, opts)     — single-chunk surgical repair
 *                                    (used by detectors + manual)
 */

const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');

const Chunk = require('../models/Chunk');
const Span = require('../models/Span');
const Edge = require('../models/Edge');
const Page = require('../models/Page');
const Book = require('../models/Book');
const QualitySweepJob = require('../models/QualitySweepJob');
const QualitySweepReview = require('../models/QualitySweepReview');
const CanonicalDefinition = require('../models/CanonicalDefinition');

const pipeline = require('../config/pipeline');
const chunkService = require('./chunkService');

// Reuse the existing span-DSL parser so any format mistakes
// Opus makes are caught by the same rules as initial ingestion.
const spanService = require('./spanService');

// ─── Anthropic client (lazy) ──────────────────────────────
let _client = null;
function getClient() {
  if (_client) return _client;
  if (!process.env.ANTHROPIC_API_KEY) return null;
  _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _client;
}

// ─── Prompt file loader (cached) ──────────────────────────
const PROMPT_DIR = path.join(__dirname, '..', 'prompts');
const _promptCache = {};
function loadPrompt(name) {
  if (_promptCache[name]) return _promptCache[name];
  _promptCache[name] = fs.readFileSync(path.join(PROMPT_DIR, name), 'utf-8');
  return _promptCache[name];
}

// ─── Pronoun-starter detection (same list as chunker) ────
const PRONOUN_REJECT = /^\s*(these|this|that|those|it|they|them|such|the following|hence|thus|therefore|so|consequently|accordingly|moreover|furthermore)\b/i;

// ───────────────────────────────────────────────────────────
// DETECTION
// ───────────────────────────────────────────────────────────
//
// detectCandidates(bookId) returns, for each pattern, the list
// of chunks that currently match the pattern's detector. Dry-
// run friendly: no writes, no LLM calls. The CLI uses this to
// print a preview before the user runs the actual sweep.

async function detectCandidates(bookId) {
  const chunks = await Chunk.find({ bookId })
    .sort({ pageNumber: 1, chunkIndex: 1 })
    .lean();
  const spanIds = chunks.flatMap(c => c.spanIds || []);
  const spans = spanIds.length > 0
    ? await Span.find({ _id: { $in: spanIds } })
        .select('_id chunkId contextTags role searchClass spanText').lean()
    : [];
  const spansByChunk = new Map();
  for (const s of spans) {
    const k = String(s.chunkId || '');
    if (!spansByChunk.has(k)) spansByChunk.set(k, []);
    spansByChunk.get(k).push(s);
  }

  // Pre-compute incoming-edge counts per chunk in one query.
  const chunkIds = chunks.map(c => c._id);
  const incoming = await Edge.aggregate([
    { $match: { toChunkId: { $in: chunkIds } } },
    { $group: { _id: '$toChunkId', count: { $sum: 1 } } },
  ]);
  const inEdgeCount = new Map(incoming.map(r => [String(r._id), r.count]));
  const outgoing = await Edge.aggregate([
    { $match: { fromChunkId: { $in: chunkIds } } },
    { $group: { _id: '$fromChunkId', count: { $sum: 1 } } },
  ]);
  const outEdgeCount = new Map(outgoing.map(r => [String(r._id), r.count]));

  const p1 = [];
  const p2 = [];
  const p3 = [];

  for (const c of chunks) {
    // Skip already-processed chunks at current sweep version
    if ((c.qualitySweepVersion || 0) >= pipeline.QUALITY_SWEEP_VERSION) continue;
    // Skip chunks marked merged/replaced — they're tombstones
    if (c.qualityRepairStatus === 'merged' || c.qualityRepairStatus === 'replaced') continue;

    const chunkSpans = spansByChunk.get(String(c._id)) || [];
    const inCount = inEdgeCount.get(String(c._id)) || 0;
    const outCount = outEdgeCount.get(String(c._id)) || 0;

    // ── Pattern 1: dense 1-span
    if (pipeline.PATTERN_1_ENABLED && chunkSpans.length === 1) {
      const span = chunkSpans[0];
      const tagCount = (span.contextTags || []).length;
      const wc = c.wordCount || (c.sourceText || '').split(/\s+/).filter(Boolean).length;
      if (tagCount >= pipeline.PATTERN_1_MIN_TAGS ||
          wc >= pipeline.PATTERN_1_MIN_WORDS) {
        // Skip pure definitions like "X := ..."
        if (!(span.spanText || '').includes(':=')) {
          p1.push({ chunkId: c._id, pageNumber: c.pageNumber, chunkIndex: c.chunkIndex, wordCount: wc, tagCount });
        }
      }
    }

    // ── Pattern 2: orphan pronoun
    if (pipeline.PATTERN_2_ENABLED) {
      const startsOrphan = PRONOUN_REJECT.test(c.sourceText || '');
      const notStructural = !['theorem', 'definition', 'proof'].includes(c.structuralType);
      if (startsOrphan && notStructural && inCount === 0) {
        p2.push({ chunkId: c._id, pageNumber: c.pageNumber, chunkIndex: c.chunkIndex, firstWord: (c.sourceText || '').slice(0, 50) });
      }
    }

    // ── Pattern 3: isolated node
    if (pipeline.PATTERN_3_ENABLED) {
      const tags = c.contextTags || [];
      const noTags = tags.length === 0 || (tags.length === 1 && tags[0] === 'narrative');
      const noEdges = inCount === 0 && outCount === 0;
      const wc = c.wordCount || (c.sourceText || '').split(/\s+/).filter(Boolean).length;
      if (noTags && noEdges && wc >= pipeline.PATTERN_3_MIN_WORDS) {
        p3.push({ chunkId: c._id, pageNumber: c.pageNumber, chunkIndex: c.chunkIndex, wordCount: wc });
      }
    }
  }

  return {
    bookId: String(bookId),
    totalChunks: chunks.length,
    p1, p2, p3,
    stats: {
      p1Count: p1.length,
      p2Count: p2.length,
      p3Count: p3.length,
    },
  };
}

// ───────────────────────────────────────────────────────────
// CONTEXT BUILDERS — produce the string context given to Opus
// ───────────────────────────────────────────────────────────

async function getNeighborChunks(bookId, pageNumber, chunkIndex, before, after) {
  // Same-page neighbors first. If we need more than the page
  // has, spill into adjacent pages.
  const allPage = await Chunk.find({ bookId, pageNumber })
    .sort({ chunkIndex: 1 })
    .select('_id chunkIndex pageNumber sourceText structuralType contextTags').lean();
  const selfIdx = allPage.findIndex(c => c.chunkIndex === chunkIndex);
  if (selfIdx === -1) return { prev: [], next: [] };
  const prev = allPage.slice(Math.max(0, selfIdx - before), selfIdx);
  const next = allPage.slice(selfIdx + 1, selfIdx + 1 + after);
  return { prev, next };
}

async function getPageRawText(bookId, pageNumber) {
  const page = await Page.findOne({ bookId, pageNumber })
    .select('rawText').lean();
  return page?.rawText || '';
}

function formatChunkBrief(c) {
  return `[chunk #${c.chunkIndex} ${c.structuralType || ''}] ${(c.sourceText || '').slice(0, 400)}`;
}

// ───────────────────────────────────────────────────────────
// OPUS CALL WRAPPER — tracks tokens + cost
// ───────────────────────────────────────────────────────────

async function callOpus(systemPrompt, userMessage, statsAccumulator) {
  const client = getClient();
  if (!client) {
    throw new Error('ANTHROPIC_API_KEY missing');
  }
  const model = pipeline.QUALITY_SWEEP_MODEL || 'claude-opus-4-6';
  const resp = await client.messages.create({
    model,
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  // Token + cost accounting.
  const inputTokens = resp.usage?.input_tokens || 0;
  const outputTokens = resp.usage?.output_tokens || 0;
  const cost =
    (inputTokens / 1_000_000) * pipeline.QUALITY_SWEEP_OPUS_INPUT_USD_PER_MT +
    (outputTokens / 1_000_000) * pipeline.QUALITY_SWEEP_OPUS_OUTPUT_USD_PER_MT;
  if (statsAccumulator) {
    statsAccumulator.opusInputTokens += inputTokens;
    statsAccumulator.opusOutputTokens += outputTokens;
    statsAccumulator.estCostUsd += cost;
  }

  const text = (resp.content || [])
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('\n');
  return { text, inputTokens, outputTokens, cost };
}

// ───────────────────────────────────────────────────────────
// ESCALATION LADDER
// ───────────────────────────────────────────────────────────
//
// Given a context level (0-3) and a chunk, produce the
// context block Opus will see. Higher levels load more
// surrounding material.

async function buildContext(pattern, chunk, level) {
  const { bookId, pageNumber, chunkIndex } = chunk;
  const parts = [];

  // Neighbor counts per pattern per level
  const neighborPlan = {
    p1: [[2, 2], [5, 5], [5, 5], [5, 5]],
    p2: [[1, 1], [3, 3], [5, 5], [5, 5]],
    p3: [[3, 3], [5, 5], [5, 5], [5, 5]],
  };
  const [before, after] = neighborPlan[pattern][Math.min(level, 3)];
  const { prev, next } = await getNeighborChunks(bookId, pageNumber, chunkIndex, before, after);

  parts.push(`CHUNK UNDER REPAIR (chunk #${chunkIndex}, page ${pageNumber}):`);
  parts.push(chunk.sourceText || '');
  parts.push('');
  parts.push(`CURRENT TAGS: ${(chunk.contextTags || []).join(', ') || '(none)'}`);
  parts.push(`STRUCTURAL TYPE: ${chunk.structuralType || 'unknown'}`);
  parts.push('');

  if (prev.length > 0) {
    parts.push(`PREVIOUS CHUNKS on page ${pageNumber}:`);
    for (const p of prev) parts.push('  ' + formatChunkBrief(p));
    parts.push('');
  }
  if (next.length > 0) {
    parts.push(`NEXT CHUNKS on page ${pageNumber}:`);
    for (const p of next) parts.push('  ' + formatChunkBrief(p));
    parts.push('');
  }

  if (level >= 1) {
    const pageText = await getPageRawText(bookId, pageNumber);
    if (pageText) {
      parts.push(`FULL PAGE ${pageNumber} TEXT:`);
      parts.push(pageText.slice(0, 6000));
      parts.push('');
    }
  }

  if (level >= 2) {
    const book = await Book.findById(bookId)
      .select('title author summary keyConcepts').lean();
    if (book) {
      parts.push(`BOOK METADATA:`);
      parts.push(`  Title: ${book.title || ''}`);
      parts.push(`  Author: ${book.author || ''}`);
      parts.push(`  Summary: ${(book.summary || '').slice(0, 500)}`);
      parts.push(`  Key concepts: ${(book.keyConcepts || []).join(', ')}`);
      parts.push('');
    }
  }

  if (level >= 3) {
    // Load top-10 most-connected chunks in the book as
    // load-bearing anchors. Cheap aggregation.
    const hubs = await Edge.aggregate([
      { $match: { $or: [{ fromBookId: bookId }, { toBookId: bookId }] } },
      { $group: { _id: '$toChunkId', c: { $sum: 1 } } },
      { $sort: { c: -1 } },
      { $limit: 10 },
    ]);
    const hubIds = hubs.map(h => h._id).filter(Boolean);
    if (hubIds.length > 0) {
      const hubChunks = await Chunk.find({ _id: { $in: hubIds } })
        .select('chunkIndex sourceText contextTags').lean();
      parts.push(`LOAD-BEARING CHUNKS in this book:`);
      for (const h of hubChunks) {
        parts.push('  ' + formatChunkBrief(h));
      }
      parts.push('');
    }
  }

  return parts.join('\n');
}

// ───────────────────────────────────────────────────────────
// OPUS OUTPUT PARSING
// ───────────────────────────────────────────────────────────
//
// Each pattern has its own output format. All three end with
// a CONFIDENCE: line for the escalation loop.

function parseConfidence(text) {
  const m = text.match(/CONFIDENCE:\s*([\d.]+)/i);
  if (!m) return null;
  const v = parseFloat(m[1]);
  return isNaN(v) ? null : Math.max(0, Math.min(1, v));
}

function isRefuseOutput(text) {
  return /^\s*REFUSE\b/im.test(text);
}

function stripConfidenceLine(text) {
  return text.replace(/CONFIDENCE:\s*[\d.]+.*$/im, '').trim();
}

// ───────────────────────────────────────────────────────────
// PATTERN 1 — DECOMPOSE
// ───────────────────────────────────────────────────────────

async function repairPattern1(chunk, statsAccumulator, log) {
  const systemPrompt = loadPrompt('repair-decompose.txt');
  const version = pipeline.QUALITY_SWEEP_VERSION;
  const maxLevel = pipeline.QUALITY_SWEEP_MAX_ESCALATION || 3;

  for (let level = 0; level <= maxLevel; level++) {
    const context = await buildContext('p1', chunk, level);
    const { text } = await callOpus(systemPrompt, context, statsAccumulator);

    if (isRefuseOutput(text)) {
      log.push(`[p1] chunk#${chunk.chunkIndex} REFUSE at level ${level}: ${text.split('\n')[0]}`);
      if (level < maxLevel) continue;
      return { outcome: 'unrepairable', reason: 'opus refused at max level' };
    }

    const conf = parseConfidence(text) || 0.7;
    const dslText = stripConfidenceLine(text);

    // Parse the DSL output with the EXISTING span parser —
    // format bugs are caught the same way as ingestion.
    const parsed = spanService._parseDSLForRepair
      ? spanService._parseDSLForRepair(dslText, chunk.bookId, chunk.pageNumber)
      : fallbackParseSpanLines(dslText);

    // Filter down to non-empty, enriched spans.
    const goodSpans = parsed.filter(s =>
      s && s.sentenceStart != null && (s.contextTags || []).length > 0
    );

    if (goodSpans.length < 2) {
      log.push(`[p1] chunk#${chunk.chunkIndex} level ${level}: only ${goodSpans.length} span(s) parsed, escalating`);
      if (level < maxLevel) continue;
      return { outcome: 'unrepairable', reason: 'opus did not produce multiple spans' };
    }

    // Good decomposition — write new spans and mark old.
    const existingSpans = await Span.find({ _id: { $in: chunk.spanIds || [] } }).lean();
    const origSpan = existingSpans[0]; // Pattern 1 only fires on 1-span chunks

    // Materialize spanText for each new span from the chunk source text.
    // The new spans all cover the same sentence range as the original,
    // so their spanText is the full chunk sourceText.
    const newSpanDocs = [];
    for (const s of goodSpans) {
      const doc = await Span.create({
        bookId: chunk.bookId,
        pageNumber: chunk.pageNumber,
        sentenceStart: origSpan.sentenceStart,
        sentenceEnd: origSpan.sentenceEnd,
        contextTags: s.contextTags,
        role: s.role || null,
        declarativeTags: s.declarativeTags || [],
        searchClass: s.searchClass || 'N',
        searchConfidence: s.searchConfidence || null,
        gapType: s.gapType || null,
        spanText: origSpan.spanText,
        chunkId: chunk._id,
        qualitySweepAt: new Date(),
        qualitySweepVersion: version,
        qualityRepairStatus: 'repaired',
      });
      newSpanDocs.push(doc);
    }

    // Mark the original span replaced, pointing at its
    // replacements for resolveSpanId().
    await Span.findByIdAndUpdate(origSpan._id, {
      qualitySweepAt: new Date(),
      qualitySweepVersion: version,
      qualityRepairStatus: 'replaced',
      replacedBy: newSpanDocs.map(d => d._id),
    });

    // Update the chunk in place: new spanIds, recomputed tags,
    // bumped quality fields. We deliberately do NOT re-run the
    // chunker here because the new spans all share the same
    // sentence range — the chunker's overlap rule would keep
    // them in one chunk anyway, and re-running for a
    // single-page subset is a bigger surface than we need
    // right now. (Chunker re-run is listed as a todo if we
    // see multi-sentence chunks that need re-grouping.)
    const unionTags = [...new Set(newSpanDocs.flatMap(d => d.contextTags || []))];
    const unionSearch = [...new Set(newSpanDocs.map(d => d.searchClass).filter(sc => sc && sc !== 'N'))];
    await Chunk.findByIdAndUpdate(chunk._id, {
      spanIds: newSpanDocs.map(d => d._id),
      contextTags: unionTags,
      searchClasses: unionSearch,
      qualitySweepAt: new Date(),
      qualitySweepVersion: version,
      qualityRepairStatus: 'repaired',
      $push: { qualityRepairApplied: 'p1-decompose' },
    });

    // Canonical-definition piggyback: emit uses_definition
    // edges for any newly-tagged concept with an Ld gap.
    const canonicalResult = await linkNewSpansToCanonicals(newSpanDocs, chunk);
    statsAccumulator.edgesCreated += canonicalResult.created;
    statsAccumulator.canonicalHits += canonicalResult.hits;
    statsAccumulator.canonicalMisses += canonicalResult.misses;
    if (canonicalResult.misses > 0) {
      await Book.findByIdAndUpdate(chunk.bookId, {
        $addToSet: { missingDefinitions: { $each: canonicalResult.missingConcepts } },
      });
    }

    log.push(`[p1] chunk#${chunk.chunkIndex} level ${level}: decomposed 1→${newSpanDocs.length} spans, ${canonicalResult.created} canonical edges, conf ${conf.toFixed(2)}`);
    return { outcome: 'repaired', spansCreated: newSpanDocs.length, level, confidence: conf };
  }

  return { outcome: 'unrepairable', reason: 'exhausted escalation' };
}

// Fallback DSL parser — simplified version of parseSpanOutput
// from spanService. We import this rather than using the full
// parser because spanService doesn't export parseSpanOutput.
// Keep logic minimal and in sync with the real parser.
function fallbackParseSpanLines(dsl, pageNumber) {
  const out = [];
  const lines = (dsl || '').split('\n').map(l => l.trim()).filter(Boolean);
  const ROLE_TAGS = new Set([
    'claim', 'background', 'conjecture', 'result', 'review',
    'definition', 'equation', 'application', 'citation', 'preview',
    'proof', 'remark', 'example', 'figure_ref',
  ]);
  const L_TYPE_MAP = { d: 'definition', v: 'derivation', p: 'proof' };

  for (const line of lines) {
    if (line.startsWith('#') || line.startsWith('//')) continue;
    if (/^CONFIDENCE/i.test(line)) continue;
    const parts = line.split(/\s+/);
    if (parts.length < 2) continue;
    let start, end;
    const range = parts[0];
    if (range.includes('-')) {
      const [a, b] = range.split('-').map(Number);
      start = a; end = b;
    } else {
      start = end = parseInt(range, 10);
    }
    if (isNaN(start)) continue;

    const contextTags = [];
    let role = null;
    let searchClass = 'N';
    let searchConfidence = null;
    let gapType = null;

    for (let i = 1; i < parts.length; i++) {
      const t = parts[i];
      if (/^S$/.test(t)) { searchClass = 'S'; continue; }
      if (/^[LIB]$/.test(t)) { searchClass = t; continue; }
      if (/^[LISB][a-z]$/.test(t)) {
        searchClass = t[0];
        const suf = t[1];
        if (t[0] === 'L' && L_TYPE_MAP[suf]) gapType = L_TYPE_MAP[suf];
        else if (t[0] !== 'S') searchConfidence = suf;
        continue;
      }
      if (ROLE_TAGS.has(t)) { role = t; continue; }
      if (/^[a-z][a-z0-9_]*$/.test(t)) { contextTags.push(t); continue; }
    }
    out.push({
      sentenceStart: start,
      sentenceEnd: end,
      contextTags,
      role,
      searchClass,
      searchConfidence,
      gapType,
    });
  }
  return out;
}

// ───────────────────────────────────────────────────────────
// PATTERN 2 — MERGE / DISAMBIGUATE (ORPHANS)
// ───────────────────────────────────────────────────────────

async function repairPattern2(chunk, statsAccumulator, log) {
  const systemPrompt = loadPrompt('repair-anaphor.txt');
  const version = pipeline.QUALITY_SWEEP_VERSION;
  const maxLevel = pipeline.QUALITY_SWEEP_MAX_ESCALATION || 3;

  for (let level = 0; level <= maxLevel; level++) {
    const context = await buildContext('p2', chunk, level);
    const { text } = await callOpus(systemPrompt, context, statsAccumulator);

    // Parse verdict block
    const decisionMatch = text.match(/DECISION:\s*(MERGE|DISAMBIGUATE|UNCERTAIN)/i);
    const confidence = parseConfidence(text) || 0;
    const decision = (decisionMatch ? decisionMatch[1] : 'UNCERTAIN').toUpperCase();

    if (decision === 'UNCERTAIN') {
      if (level < maxLevel) continue;
      await Chunk.findByIdAndUpdate(chunk._id, {
        qualityRepairStatus: 'pattern-2-uncertain',
        qualitySweepAt: new Date(),
        qualitySweepVersion: version,
      });
      log.push(`[p2] chunk#${chunk.chunkIndex}: UNCERTAIN at max level, skipping`);
      return { outcome: 'uncertain', confidence };
    }

    // Queue for review if in the 0.60-0.85 band on MERGE
    if (decision === 'MERGE' && confidence < pipeline.QUALITY_SWEEP_AUTO_MERGE_THRESHOLD) {
      if (confidence < pipeline.QUALITY_SWEEP_REVIEW_THRESHOLD) {
        if (level < maxLevel) continue;
        await Chunk.findByIdAndUpdate(chunk._id, {
          qualityRepairStatus: 'pattern-2-uncertain',
          qualitySweepAt: new Date(),
          qualitySweepVersion: version,
        });
        log.push(`[p2] chunk#${chunk.chunkIndex}: merge confidence ${confidence.toFixed(2)} too low, skipping`);
        return { outcome: 'uncertain', confidence };
      }

      // Review queue
      const prev = await getPreviousChunkFor(chunk);
      if (!prev) {
        log.push(`[p2] chunk#${chunk.chunkIndex}: wanted to queue merge but no prev chunk`);
        return { outcome: 'uncertain', confidence };
      }
      await QualitySweepReview.create({
        bookId: chunk.bookId,
        sweepVersion: version,
        prevChunkId: prev._id,
        thisChunkId: chunk._id,
        opusVerdict: {
          decision: 'merge',
          confidence,
          reasoning: (text.match(/REASONING:\s*(.+)/) || [])[1] || '',
          proposedMergedSpans: text,
        },
        status: 'pending',
      });
      await Chunk.findByIdAndUpdate(chunk._id, {
        qualityRepairStatus: 'pattern-2-review',
        qualitySweepAt: new Date(),
        qualitySweepVersion: version,
      });
      log.push(`[p2] chunk#${chunk.chunkIndex}: queued for review (conf ${confidence.toFixed(2)})`);
      return { outcome: 'review', confidence };
    }

    if (decision === 'MERGE') {
      // Auto-merge above threshold — create merged chunk
      const prev = await getPreviousChunkFor(chunk);
      if (!prev) {
        log.push(`[p2] chunk#${chunk.chunkIndex}: MERGE decision but no prev chunk to merge with`);
        return { outcome: 'unrepairable', reason: 'no previous chunk' };
      }
      const merged = await performMerge(prev, chunk, text, version);
      log.push(`[p2] chunk#${chunk.chunkIndex}: merged with prev #${prev.chunkIndex} → new chunk ${String(merged._id).slice(-6)} (conf ${confidence.toFixed(2)})`);
      return { outcome: 'merged', mergedId: merged._id, confidence };
    }

    if (decision === 'DISAMBIGUATE') {
      // Add new concept tags to the chunk's existing spans
      // based on Opus's output DSL lines.
      const dslBody = text.split('---')[1] || '';
      const parsed = fallbackParseSpanLines(dslBody);
      const newTags = [...new Set(parsed.flatMap(p => p.contextTags || []))];
      if (newTags.length === 0) {
        log.push(`[p2] chunk#${chunk.chunkIndex}: DISAMBIGUATE decision but no new tags parsed`);
        if (level < maxLevel) continue;
        return { outcome: 'unrepairable', reason: 'no disambiguation tags' };
      }
      await Chunk.findByIdAndUpdate(chunk._id, {
        $addToSet: { contextTags: { $each: newTags } },
        qualitySweepAt: new Date(),
        qualitySweepVersion: version,
        qualityRepairStatus: 'repaired',
        $push: { qualityRepairApplied: 'p2-disambiguate' },
      });
      // Apply the new tags to the first span too
      if (chunk.spanIds && chunk.spanIds[0]) {
        await Span.findByIdAndUpdate(chunk.spanIds[0], {
          $addToSet: { contextTags: { $each: newTags } },
          qualitySweepAt: new Date(),
          qualitySweepVersion: version,
          qualityRepairStatus: 'repaired',
        });
      }
      log.push(`[p2] chunk#${chunk.chunkIndex}: disambiguated with +${newTags.length} tags (conf ${confidence.toFixed(2)})`);
      return { outcome: 'disambiguated', tagsAdded: newTags.length, confidence };
    }
  }

  return { outcome: 'unrepairable', reason: 'exhausted escalation' };
}

async function getPreviousChunkFor(chunk) {
  // Prefer same-page previous chunk; fall back to last chunk
  // of the previous page if none.
  const samePage = await Chunk.findOne({
    bookId: chunk.bookId,
    pageNumber: chunk.pageNumber,
    chunkIndex: { $lt: chunk.chunkIndex },
  }).sort({ chunkIndex: -1 }).lean();
  if (samePage) return samePage;

  const prevPage = await Chunk.findOne({
    bookId: chunk.bookId,
    pageNumber: chunk.pageNumber - 1,
  }).sort({ chunkIndex: -1 }).lean();
  return prevPage;
}

async function performMerge(prevChunk, thisChunk, opusOutputText, version) {
  // Create a new Chunk doc containing the union of both
  // chunks' spans. DO NOT delete the originals — mark them
  // merged and point mergedInto at the new chunk.
  const crossPage = prevChunk.pageNumber !== thisChunk.pageNumber;
  const unionSpanIds = [...(prevChunk.spanIds || []), ...(thisChunk.spanIds || [])];
  const unionTags = [...new Set([...(prevChunk.contextTags || []), ...(thisChunk.contextTags || [])])];

  const Page = require('../models/Page');
  let sourceText = '';
  if (crossPage) {
    // Pull both pages' rawText and concatenate the merged region
    const [pA, pB] = await Promise.all([
      Page.findOne({ bookId: prevChunk.bookId, pageNumber: prevChunk.pageNumber }).select('rawText').lean(),
      Page.findOne({ bookId: thisChunk.bookId, pageNumber: thisChunk.pageNumber }).select('rawText').lean(),
    ]);
    sourceText = `${prevChunk.sourceText || ''} ${thisChunk.sourceText || ''}`.trim();
  } else {
    sourceText = `${prevChunk.sourceText || ''} ${thisChunk.sourceText || ''}`.trim();
  }

  const merged = await Chunk.create({
    bookId: thisChunk.bookId,
    pageNumber: prevChunk.pageNumber, // anchor to the first page
    chunkIndex: prevChunk.chunkIndex, // inherit index from first
    spanIds: unionSpanIds,
    sentenceStart: prevChunk.sentenceStart,
    sentenceEnd: thisChunk.sentenceEnd,
    structuralType: prevChunk.structuralType || thisChunk.structuralType || 'narrative',
    contextTags: unionTags,
    searchClasses: [...new Set([...(prevChunk.searchClasses || []), ...(thisChunk.searchClasses || [])])],
    sourceText,
    wordCount: sourceText.split(/\s+/).filter(Boolean).length,
    qualitySweepAt: new Date(),
    qualitySweepVersion: version,
    qualityRepairApplied: ['p2-merge'],
    qualityRepairStatus: 'repaired',
    crossesPages: crossPage ? [prevChunk.pageNumber, thisChunk.pageNumber] : [],
  });

  // Redirect spans
  await Span.updateMany(
    { _id: { $in: unionSpanIds } },
    { chunkId: merged._id }
  );

  // Mark originals merged
  await Chunk.findByIdAndUpdate(prevChunk._id, {
    qualityRepairStatus: 'merged',
    mergedInto: merged._id,
    qualitySweepAt: new Date(),
    qualitySweepVersion: version,
  });
  await Chunk.findByIdAndUpdate(thisChunk._id, {
    qualityRepairStatus: 'merged',
    mergedInto: merged._id,
    qualitySweepAt: new Date(),
    qualitySweepVersion: version,
  });

  return merged;
}

// ───────────────────────────────────────────────────────────
// PATTERN 3 — RETAG ISOLATED NODES
// ───────────────────────────────────────────────────────────

async function repairPattern3(chunk, statsAccumulator, log) {
  const systemPrompt = loadPrompt('repair-retag.txt');
  const version = pipeline.QUALITY_SWEEP_VERSION;
  const maxLevel = pipeline.QUALITY_SWEEP_MAX_ESCALATION || 3;

  // Pattern 3 skips already-content-rich chunks: its detector
  // already checked for empty tags + zero edges, so we just
  // need to run the retag.
  for (let level = 0; level <= maxLevel; level++) {
    const context = await buildContext('p3', chunk, level);
    const { text } = await callOpus(systemPrompt, context, statsAccumulator);

    if (isRefuseOutput(text)) {
      log.push(`[p3] chunk#${chunk.chunkIndex} REFUSE at level ${level}`);
      if (level < maxLevel) continue;
      await Chunk.findByIdAndUpdate(chunk._id, {
        qualityRepairStatus: 'pattern-3-content-free',
        qualitySweepAt: new Date(),
        qualitySweepVersion: version,
      });
      return { outcome: 'content-free' };
    }

    const conf = parseConfidence(text) || 0.5;
    const dslText = stripConfidenceLine(text);
    const parsed = fallbackParseSpanLines(dslText);
    const good = parsed.filter(s => (s.contextTags || []).length > 0);

    if (good.length === 0) {
      if (level < maxLevel) continue;
      await Chunk.findByIdAndUpdate(chunk._id, {
        qualityRepairStatus: 'pattern-3-content-free',
        qualitySweepAt: new Date(),
        qualitySweepVersion: version,
      });
      return { outcome: 'content-free' };
    }

    // For Pattern 3 we UPDATE the existing spans rather than
    // create new ones — the sentences are fine, only the
    // metadata was missing. If the chunk has N existing spans
    // and Opus returned M tagged outputs, we map by sentence
    // range (best effort) and merge tags.
    const existingSpans = await Span.find({ _id: { $in: chunk.spanIds || [] } }).lean();
    const spansBySentence = new Map();
    for (const s of existingSpans) {
      const key = `${s.sentenceStart}-${s.sentenceEnd}`;
      if (!spansBySentence.has(key)) spansBySentence.set(key, []);
      spansBySentence.get(key).push(s);
    }

    // Group Opus outputs by their sentence range, merge tags
    // per (existing) span they map to.
    const updatesPerSpan = new Map(); // spanId -> { contextTags, role, searchClass }
    for (const out of good) {
      const key = `${out.sentenceStart}-${out.sentenceEnd}`;
      const targets = spansBySentence.get(key) || existingSpans; // fallback: apply to all spans
      for (const t of targets) {
        if (!updatesPerSpan.has(String(t._id))) {
          updatesPerSpan.set(String(t._id), { contextTags: new Set(), role: null, searchClass: 'N', gapType: null });
        }
        const u = updatesPerSpan.get(String(t._id));
        for (const tag of out.contextTags) u.contextTags.add(tag);
        if (out.role && !u.role) u.role = out.role;
        if (out.searchClass && out.searchClass !== 'N') u.searchClass = out.searchClass;
        if (out.gapType) u.gapType = out.gapType;
      }
    }

    // Apply updates
    const newSpanDocs = [];
    for (const [spanId, u] of updatesPerSpan.entries()) {
      const tags = [...u.contextTags];
      await Span.findByIdAndUpdate(spanId, {
        $addToSet: { contextTags: { $each: tags } },
        role: u.role || undefined,
        searchClass: u.searchClass !== 'N' ? u.searchClass : undefined,
        gapType: u.gapType || undefined,
        qualitySweepAt: new Date(),
        qualitySweepVersion: version,
        qualityRepairStatus: 'repaired',
      });
      const updated = await Span.findById(spanId).lean();
      newSpanDocs.push(updated);
    }

    // Union tags onto the chunk
    const unionTags = [...new Set(newSpanDocs.flatMap(d => d.contextTags || []))];
    await Chunk.findByIdAndUpdate(chunk._id, {
      contextTags: unionTags,
      qualitySweepAt: new Date(),
      qualitySweepVersion: version,
      qualityRepairStatus: 'repaired',
      $push: { qualityRepairApplied: 'p3-retag' },
    });

    // Canonical piggyback
    const canonicalResult = await linkNewSpansToCanonicals(newSpanDocs, chunk);
    statsAccumulator.edgesCreated += canonicalResult.created;
    statsAccumulator.canonicalHits += canonicalResult.hits;
    statsAccumulator.canonicalMisses += canonicalResult.misses;
    if (canonicalResult.missingConcepts.length > 0) {
      await Book.findByIdAndUpdate(chunk.bookId, {
        $addToSet: { missingDefinitions: { $each: canonicalResult.missingConcepts } },
      });
    }

    // Decide if this counts as "retagged with edges" or
    // "retagged but still no edges" for the stats bucket.
    const noEdges = canonicalResult.created === 0;
    if (noEdges) {
      await Chunk.findByIdAndUpdate(chunk._id, {
        qualityRepairStatus: 'pattern-3-no-edges',
      });
    }

    log.push(`[p3] chunk#${chunk.chunkIndex} level ${level}: retagged with ${unionTags.length} tags, ${canonicalResult.created} edges, conf ${conf.toFixed(2)}`);
    return {
      outcome: noEdges ? 'retagged-no-edges' : 'retagged',
      tagsAdded: unionTags.length,
      edgesAdded: canonicalResult.created,
      confidence: conf,
    };
  }

  return { outcome: 'unrepairable', reason: 'exhausted escalation' };
}

// ───────────────────────────────────────────────────────────
// CANONICAL DEFINITION PIGGYBACK
// ───────────────────────────────────────────────────────────

async function linkNewSpansToCanonicals(spans, chunk) {
  // For each span in `spans`, look up each of its contextTags
  // in the CanonicalDefinition collection. Hit → emit a
  // uses_definition edge. Miss → add to missingConcepts.
  let created = 0;
  let hits = 0;
  let misses = 0;
  const missingConcepts = [];

  for (const span of spans) {
    const tags = (span.contextTags || []);
    for (const tag of tags) {
      const canonical = await CanonicalDefinition.findOne({ concept: tag }).lean();
      if (!canonical) {
        // Only count as a "miss" if the span had an Ld marker —
        // otherwise it's not being claimed as a missing
        // definition in the first place.
        if (span.gapType === 'definition' || span.searchClass === 'L') {
          misses++;
          missingConcepts.push(tag);
        }
        continue;
      }
      // Skip self-edge: span is inside its own canonical chunk
      if (String(span.chunkId || chunk._id) === String(canonical.definitionChunkId)) {
        continue;
      }
      // Dedup: do we already have this edge?
      const exists = await Edge.findOne({
        fromSpanId: span._id,
        toChunkId: canonical.definitionChunkId,
        method: 'canonical-lookup',
      }).lean();
      if (exists) { hits++; continue; }

      await Edge.create({
        fromSpanId: span._id,
        fromChunkId: span.chunkId || chunk._id,
        fromBookId: span.bookId || chunk.bookId,
        toChunkId: canonical.definitionChunkId,
        toSpanId: canonical.definitionSpanId || null,
        toBookId: canonical.definitionBookId,
        relationshipType: 'uses_definition',
        confidence: canonical.confidence || 'z',
        relevance: 'z',
        method: 'canonical-lookup',
        resolved: true,
        createdAt: new Date(),
      });
      created++;
      hits++;
    }
  }

  return { created, hits, misses, missingConcepts: [...new Set(missingConcepts)] };
}

// ───────────────────────────────────────────────────────────
// RUN SWEEP — top-level orchestrator
// ───────────────────────────────────────────────────────────

async function runSweepForBook(bookId, opts = {}) {
  const version = pipeline.QUALITY_SWEEP_VERSION;
  const jobRow = await QualitySweepJob.create({
    bookId,
    sweepVersion: version,
    status: 'running',
    startedAt: new Date(),
    stats: {},
  });

  const stats = {
    chunksScanned: 0,
    pattern1Matched: 0, pattern1Repaired: 0, pattern1Unrepairable: 0,
    pattern2Matched: 0, pattern2Merged: 0, pattern2Disambiguated: 0, pattern2Review: 0, pattern2Uncertain: 0,
    pattern3Matched: 0, pattern3Retagged: 0, pattern3RetaggedNoEdges: 0, pattern3ContentFree: 0,
    edgesCreated: 0,
    canonicalHits: 0, canonicalMisses: 0,
    opusInputTokens: 0, opusOutputTokens: 0, estCostUsd: 0,
    errorCount: 0,
  };
  const log = [];

  try {
    const cands = await detectCandidates(bookId);
    log.push(`detected: p1=${cands.p1.length} p2=${cands.p2.length} p3=${cands.p3.length}`);
    stats.pattern1Matched = cands.p1.length;
    stats.pattern2Matched = cands.p2.length;
    stats.pattern3Matched = cands.p3.length;

    // Repair order: p2 first (affects neighbors), then p1, then p3.
    const order = [
      ...cands.p2.map(c => ({ kind: 'p2', ...c })),
      ...cands.p1.map(c => ({ kind: 'p1', ...c })),
      ...cands.p3.map(c => ({ kind: 'p3', ...c })),
    ];

    const limit = opts.limit || order.length;
    let processed = 0;

    for (const cand of order) {
      if (processed >= limit) break;
      if (stats.estCostUsd >= pipeline.QUALITY_SWEEP_COST_WARN_PER_BOOK_USD) {
        log.push(`cost warning: est $${stats.estCostUsd.toFixed(2)} reached budget ceiling, pausing`);
        break;
      }
      processed++;
      stats.chunksScanned++;

      const chunk = await Chunk.findById(cand.chunkId).lean();
      if (!chunk) continue;

      try {
        let result;
        if (cand.kind === 'p1') {
          result = await repairPattern1(chunk, stats, log);
          if (result.outcome === 'repaired') stats.pattern1Repaired++;
          else stats.pattern1Unrepairable++;
        } else if (cand.kind === 'p2') {
          result = await repairPattern2(chunk, stats, log);
          if (result.outcome === 'merged') stats.pattern2Merged++;
          else if (result.outcome === 'disambiguated') stats.pattern2Disambiguated++;
          else if (result.outcome === 'review') stats.pattern2Review++;
          else stats.pattern2Uncertain++;
        } else if (cand.kind === 'p3') {
          result = await repairPattern3(chunk, stats, log);
          if (result.outcome === 'retagged') stats.pattern3Retagged++;
          else if (result.outcome === 'retagged-no-edges') stats.pattern3RetaggedNoEdges++;
          else if (result.outcome === 'content-free') stats.pattern3ContentFree++;
        }
      } catch (err) {
        stats.errorCount++;
        log.push(`ERROR chunk#${chunk.chunkIndex}: ${err.message}`);
        console.error('[qualitySweep]', err);
      }

      // Flush stats every 5 chunks
      if (processed % 5 === 0) {
        await QualitySweepJob.findByIdAndUpdate(jobRow._id, {
          stats,
          $push: { log: { $each: log.slice(-5) } },
        });
      }
    }

    await QualitySweepJob.findByIdAndUpdate(jobRow._id, {
      status: 'done',
      completedAt: new Date(),
      stats,
      log,
    });
    await Book.findByIdAndUpdate(bookId, {
      qualitySweepAt: new Date(),
      qualitySweepVersion: version,
    });

    return { jobId: jobRow._id, stats, log };
  } catch (err) {
    await QualitySweepJob.findByIdAndUpdate(jobRow._id, {
      status: 'failed',
      completedAt: new Date(),
      error: err.message,
      stats,
      log,
    });
    throw err;
  }
}

// ───────────────────────────────────────────────────────────
// SINGLE-CHUNK REPAIR (for CLI / dev testing)
// ───────────────────────────────────────────────────────────

async function repairChunk(chunkId, opts = {}) {
  const chunk = await Chunk.findById(chunkId).lean();
  if (!chunk) throw new Error('chunk not found: ' + chunkId);
  const stats = {
    opusInputTokens: 0, opusOutputTokens: 0, estCostUsd: 0,
    edgesCreated: 0, canonicalHits: 0, canonicalMisses: 0,
  };
  const log = [];
  const pattern = opts.pattern || 'p1';
  let result;
  if (pattern === 'p1') result = await repairPattern1(chunk, stats, log);
  else if (pattern === 'p2') result = await repairPattern2(chunk, stats, log);
  else if (pattern === 'p3') result = await repairPattern3(chunk, stats, log);
  return { result, stats, log };
}

module.exports = {
  detectCandidates,
  runSweepForBook,
  repairChunk,
  // For tests
  fallbackParseSpanLines,
  buildContext,
};
