// services/judgeService.js
//
// EX-4b: Quality judge service. Samples N chunks per book, scores their
// span annotations against the six-axis rubric in prompts/judge-rating.txt,
// stores the result as a QualityScore document. Two callers expected:
//
//   1. Manual sweep:   await judgeBook(bookId, { sampleSize: 50 });
//   2. Per-ingestion:  awaitable hook from spanService.generateSpansForBook
//      (not yet wired — see EX-4 sequencing).
//
// Cost model (current Opus 4.7 pricing): ~2-4K input + ~250 output per chunk
// judged. ~$0.015-0.03 per chunk with prompt caching active. Sampling 50
// chunks ≈ $1.00. Acceptable for weekly sweeps across the whole library.
//
// Output:
//   - One QualityScore document per (bookId, chunkId) judged. Existing
//     scores for the same (bookId, chunkId) are not overwritten — a new
//     score is appended so the dashboard can render a time series.
//   - Returns a summary { sampled, mean, p10, p50, p90, axisAverages,
//     belowThreshold, issuesByCategory, durationMs, costEstimate }.

const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const Chunk = require('../models/Chunk');
const Span = require('../models/Span');
const QualityScore = require('../models/QualityScore');
const pipeline = require('../config/pipeline');

const client = new Anthropic();

// Default judge model — falls back to pipeline.judgeModel, then Opus 4.7.
const DEFAULT_JUDGE_MODEL = process.env.JUDGE_MODEL
  || pipeline.judgeModel
  || 'claude-opus-4-7';

const RUBRIC_PATH = path.join(__dirname, '..', 'prompts', 'judge-rating.txt');
let _rubricCache = null;
function loadRubric() {
  if (_rubricCache) return _rubricCache;
  _rubricCache = fs.readFileSync(RUBRIC_PATH, 'utf8');
  return _rubricCache;
}

const AXES = [
  'specificity',
  'normalization',
  'role_accuracy',
  'gap_detection',
  'declarative_precision',
  'search_class_accuracy',
];

function quantile(sorted, q) {
  if (!sorted.length) return null;
  const i = (sorted.length - 1) * q;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}

function mean(arr) {
  if (!arr.length) return null;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function pickRandomSample(arr, n) {
  if (n >= arr.length) return arr.slice();
  const out = [];
  const used = new Set();
  while (out.length < n) {
    const i = Math.floor(Math.random() * arr.length);
    if (used.has(i)) continue;
    used.add(i);
    out.push(arr[i]);
  }
  return out;
}

function buildChunkInput(chunk, spans) {
  // Render the chunk text with sentence numbers. spans table follows.
  // Sentences are split on simple punctuation — judge sees rough boundaries
  // not perfect ones; the rubric tolerates that.
  const text = (chunk.rawText || '').trim();
  const sentenceMatches = text.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) || [text];
  const numbered = sentenceMatches
    .map((s, idx) => `[${idx + 1}] ${s.trim()}`)
    .join('\n');

  const spanLines = spans
    .map(s => {
      const range = s.startOffset != null && s.endOffset != null
        ? `${s.startOffset}-${s.endOffset}`
        : '?';
      const tags = (s.tags || []).join(' ');
      return `${range} ${tags}`.trim();
    })
    .join('\n') || '(no spans)';

  return `CHUNK_TEXT:\n${numbered}\n\nSPANS_EMITTED:\n${spanLines}\n`;
}

function parseJudgeJson(text) {
  if (!text) return null;
  // Strip code fences if the model added any.
  let s = text.trim();
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  // Find first balanced brace.
  const start = s.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let end = -1;
  for (let i = start; i < s.length; i++) {
    if (s[i] === '{') depth++;
    else if (s[i] === '}') {
      depth--;
      if (depth === 0) { end = i + 1; break; }
    }
  }
  if (end === -1) return null;
  try {
    return JSON.parse(s.slice(start, end));
  } catch {
    return null;
  }
}

async function judgeOneChunk(chunk, spans, opts = {}) {
  const model = opts.model || DEFAULT_JUDGE_MODEL;
  const rubric = loadRubric();
  const userContent = buildChunkInput(chunk, spans);

  const resp = await client.messages.create({
    model,
    max_tokens: 600,
    system: [
      { type: 'text', text: rubric, cache_control: { type: 'ephemeral' } },
    ],
    messages: [{ role: 'user', content: userContent }],
  });

  const text = (resp.content || [])
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('');

  const parsed = parseJudgeJson(text);
  return {
    raw: text,
    parsed,
    usage: resp.usage,
    model,
  };
}

function validateVerdict(v) {
  if (!v || typeof v !== 'object') return { ok: false, reason: 'no JSON parsed' };
  for (const a of AXES) {
    if (typeof v[a] !== 'number' || v[a] < 0 || v[a] > 3) {
      return { ok: false, reason: `axis ${a} out of range or missing` };
    }
  }
  if (typeof v.total !== 'number' || v.total < 0 || v.total > 18) {
    return { ok: false, reason: 'total out of range' };
  }
  if (typeof v.grade !== 'number' || v.grade < 0 || v.grade > 9) {
    return { ok: false, reason: 'grade out of range' };
  }
  // Soft check: total should equal axis sum. Don't reject on mismatch — log it.
  const axisSum = AXES.reduce((s, a) => s + v[a], 0);
  if (axisSum !== v.total) {
    v._axis_sum_mismatch = { reported: v.total, computed: axisSum };
  }
  return { ok: true };
}

async function judgeBook(bookId, opts = {}) {
  const sampleSize = opts.sampleSize ?? 50;
  const skipExisting = opts.skipExisting ?? false;
  const dryRun = opts.dryRun ?? false;
  const t0 = Date.now();

  const allChunks = await Chunk.find({ bookId }).lean();
  if (!allChunks.length) {
    return { sampled: 0, mean: null, message: 'no chunks for this book' };
  }

  let pool = allChunks;
  if (skipExisting) {
    const existing = await QualityScore.find({ bookId }).distinct('chunkId');
    const existingSet = new Set(existing.map(id => String(id)));
    pool = pool.filter(c => !existingSet.has(String(c._id)));
  }

  const sample = pickRandomSample(pool, sampleSize);
  console.log(`[judgeService] book=${bookId} pool=${pool.length} sample=${sample.length} model=${DEFAULT_JUDGE_MODEL}`);

  const grades = [];
  const axisScores = Object.fromEntries(AXES.map(a => [a, []]));
  const issuesAcc = [];
  let belowThreshold = 0;
  let scored = 0, failed = 0;
  let inputToksTotal = 0, outputToksTotal = 0;

  for (let i = 0; i < sample.length; i++) {
    const chunk = sample[i];
    const spans = await Span.find({ chunkId: chunk._id }).lean();

    let verdict, raw, model;
    try {
      const r = await judgeOneChunk(chunk, spans);
      verdict = r.parsed;
      raw = r.raw;
      model = r.model;
      inputToksTotal += r.usage?.input_tokens || 0;
      outputToksTotal += r.usage?.output_tokens || 0;
    } catch (e) {
      console.warn(`[judgeService] chunk ${chunk._id} threw: ${e.message.slice(0, 160)}`);
      failed++;
      continue;
    }

    const v = validateVerdict(verdict);
    if (!v.ok) {
      console.warn(`[judgeService] chunk ${chunk._id} invalid verdict: ${v.reason} — raw: ${(raw || '').slice(0, 160)}`);
      failed++;
      continue;
    }

    grades.push(verdict.grade);
    AXES.forEach(a => axisScores[a].push(verdict[a]));
    if (Array.isArray(verdict.issues)) issuesAcc.push(...verdict.issues);
    if (verdict.grade < (opts.threshold ?? 5)) belowThreshold++;
    scored++;

    if (!dryRun) {
      await QualityScore.create({
        bookId,
        chunkId: chunk._id,
        score: verdict.grade,
        modelUsed: model,
        judgeModelUsed: model,
        flaggedForReinjection: verdict.grade < (opts.threshold ?? 5),
      });
    }

    if ((i + 1) % 10 === 0) {
      console.log(`[judgeService] ${i + 1}/${sample.length} chunks judged, mean grade ${mean(grades).toFixed(2)}`);
    }
  }

  const sortedGrades = grades.slice().sort((a, b) => a - b);
  const summary = {
    sampled: scored,
    failed,
    mean: scored ? +mean(grades).toFixed(2) : null,
    p10: scored ? +quantile(sortedGrades, 0.1).toFixed(2) : null,
    p50: scored ? +quantile(sortedGrades, 0.5).toFixed(2) : null,
    p90: scored ? +quantile(sortedGrades, 0.9).toFixed(2) : null,
    axisAverages: Object.fromEntries(
      AXES.map(a => [a, axisScores[a].length ? +mean(axisScores[a]).toFixed(2) : null])
    ),
    belowThreshold,
    issuesSample: issuesAcc.slice(0, 30),
    durationMs: Date.now() - t0,
    inputTokens: inputToksTotal,
    outputTokens: outputToksTotal,
    model: DEFAULT_JUDGE_MODEL,
    dryRun,
  };

  console.log(`[judgeService] book=${bookId} done. mean grade=${summary.mean} below5=${belowThreshold}/${scored} duration=${Math.round(summary.durationMs / 1000)}s`);
  return summary;
}

module.exports = {
  judgeBook,
  judgeOneChunk,
  parseJudgeJson,
  validateVerdict,
  loadRubric,
  AXES,
};
