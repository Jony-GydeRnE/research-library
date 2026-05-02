#!/usr/bin/env node
/**
 * scripts/audit-edges.js — EX-4d: stratified random sample of edges,
 * each rated correct / borderline / wrong by Opus against the
 * prompts/edge-audit.txt rubric.
 *
 * Output:
 *   - reports/YYYY-MM-DD/edge-audit-<slug>.csv   per-edge verdicts
 *   - reports/YYYY-MM-DD/edge-audit-<slug>.md    summary table
 *   - stdout                                     headline metrics
 *
 * Usage:
 *   node scripts/audit-edges.js [--n=200] [--book=<id>] [--method=<m>] [--write]
 *
 * Flags:
 *   --n          total sample size (default 200)
 *   --book       restrict to edges where fromBookId or toBookId matches
 *   --method     restrict to edges with this method
 *   --write      actually run the audit (default: dry-run prints stratification only)
 *   --slug       output filename slug (default: timestamp)
 *
 * Stratification: edges are bucketed by (relationshipType x confidence-tier)
 * where confidence-tier is high (s-z) / mid (j-r) / low (a-i). Sample is
 * proportional within each bucket so under-represented relationships still
 * get coverage.
 *
 * Cost: ~$0.015-0.025 per edge with prompt caching active.
 *   200 edges ≈ $3-5 per run.
 *   Repeatable monthly.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic();

const AUDIT_PROMPT_PATH = path.join(__dirname, '..', 'prompts', 'edge-audit.txt');
let _auditPromptCache = null;
function loadAuditPrompt() {
  if (_auditPromptCache) return _auditPromptCache;
  _auditPromptCache = fs.readFileSync(AUDIT_PROMPT_PATH, 'utf8');
  return _auditPromptCache;
}

function confidenceTier(letter) {
  if (!letter) return 'unknown';
  const c = letter.toLowerCase();
  if (c >= 's') return 'high';   // s-z (~73-100%)
  if (c >= 'j') return 'mid';    // j-r (~38-69%)
  return 'low';                   // a-i (~4-35%)
}

function pickStratified(edges, total) {
  const buckets = new Map();
  for (const e of edges) {
    const key = `${e.relationshipType || 'unset'}|${confidenceTier(e.confidence)}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(e);
  }

  const totalEdges = edges.length;
  const sample = [];
  // Proportional allocation, but each non-empty bucket gets at least 1.
  for (const [key, bucket] of buckets) {
    const target = Math.max(1, Math.round((bucket.length / totalEdges) * total));
    // Random sample within bucket.
    const shuffled = bucket.slice().sort(() => Math.random() - 0.5);
    for (const e of shuffled.slice(0, Math.min(target, bucket.length))) {
      sample.push({ ...e, _bucket: key });
    }
  }

  // If proportional rounding overshot, trim. If undershot, pad randomly.
  if (sample.length > total) {
    sample.length = total;
  } else if (sample.length < total) {
    const remaining = edges.filter(e => !sample.some(s => String(s._id) === String(e._id)));
    const shuffled = remaining.sort(() => Math.random() - 0.5);
    sample.push(...shuffled.slice(0, total - sample.length));
  }

  return sample;
}

function parseAuditJson(text) {
  if (!text) return null;
  let s = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  const start = s.indexOf('{');
  if (start === -1) return null;
  let depth = 0, end = -1;
  for (let i = start; i < s.length; i++) {
    if (s[i] === '{') depth++;
    else if (s[i] === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
  }
  if (end === -1) return null;
  try { return JSON.parse(s.slice(start, end)); } catch { return null; }
}

async function auditOneEdge(edge, chunks, books) {
  const sourceChunk = chunks.get(String(edge.fromChunkId));
  const targetChunk = chunks.get(String(edge.toChunkId));
  const sourceBook = books.get(String(edge.fromBookId));
  const targetBook = books.get(String(edge.toBookId));

  if (!sourceChunk || !targetChunk) {
    return { verdict: 'unverifiable', reason: 'missing source or target chunk' };
  }

  const userContent =
`CLAIMED_RELATIONSHIP: ${edge.relationshipType || 'unset'}
CLAIMED_CONFIDENCE: ${edge.confidence || '?'}
PICKER_METHOD: ${edge.method || 'unknown'}

SOURCE:
  book: ${sourceBook?.title?.slice(0, 80) || '?'}
  page: ${sourceChunk.pageNumber}
  text: ${(sourceChunk.sourceText || sourceChunk.rawText || '').slice(0, 1200)}

TARGET:
  book: ${targetBook?.title?.slice(0, 80) || '?'}
  page: ${targetChunk.pageNumber}
  text: ${(targetChunk.sourceText || targetChunk.rawText || '').slice(0, 1200)}
`;

  const resp = await client.messages.create({
    model: process.env.AUDIT_MODEL || 'claude-opus-4-6',
    max_tokens: 240,
    system: [{ type: 'text', text: loadAuditPrompt(), cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: userContent }],
  });

  const text = (resp.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
  const parsed = parseAuditJson(text);
  return {
    parsed,
    raw: text,
    usage: resp.usage,
  };
}

async function main() {
  const args = Object.fromEntries(process.argv.slice(2).map(a => {
    const [k, ...rest] = a.replace(/^--/, '').split('=');
    return [k, rest.join('=') || true];
  }));
  const total = parseInt(args.n, 10) || 200;
  const dry = !args.write;
  const slug = args.slug || `n${total}`;

  await mongoose.connect(process.env.MONGODB_URI);
  const Edge = require('../models/Edge');
  const Chunk = require('../models/Chunk');
  const Book = require('../models/Book');

  const filter = {};
  if (args.method) filter.method = args.method;
  if (args.book) {
    filter.$or = [{ fromBookId: args.book }, { toBookId: args.book }];
  }

  const allEdges = await Edge.find(filter).lean();
  console.log(`[audit] universe: ${allEdges.length} edges${args.method ? ' (method=' + args.method + ')' : ''}${args.book ? ' (book=' + args.book + ')' : ''}`);
  if (allEdges.length === 0) {
    console.log('[audit] no edges to audit, exiting');
    process.exit(0);
  }

  const sample = pickStratified(allEdges, total);
  console.log(`[audit] stratified sample size: ${sample.length}`);

  // Stratification report
  const stratReport = {};
  for (const e of sample) {
    stratReport[e._bucket] = (stratReport[e._bucket] || 0) + 1;
  }
  console.log('[audit] strata:', JSON.stringify(stratReport, null, 2));

  if (dry) {
    console.log('[audit] DRY RUN — pass --write to execute');
    process.exit(0);
  }

  // Pre-fetch all chunks + books used by the sample
  const chunkIds = new Set();
  const bookIds = new Set();
  for (const e of sample) {
    chunkIds.add(String(e.fromChunkId));
    chunkIds.add(String(e.toChunkId));
    if (e.fromBookId) bookIds.add(String(e.fromBookId));
    if (e.toBookId) bookIds.add(String(e.toBookId));
  }
  const chunks = new Map();
  for (const c of await Chunk.find({ _id: { $in: [...chunkIds] } }).lean()) {
    chunks.set(String(c._id), c);
  }
  const books = new Map();
  for (const b of await Book.find({ _id: { $in: [...bookIds] } }).select('title').lean()) {
    books.set(String(b._id), b);
  }

  const results = [];
  let inputTok = 0, outputTok = 0;
  let correct = 0, borderline = 0, wrong = 0, unverifiable = 0, failed = 0;
  const t0 = Date.now();

  for (let i = 0; i < sample.length; i++) {
    const edge = sample[i];
    let r;
    try {
      r = await auditOneEdge(edge, chunks, books);
    } catch (e) {
      console.warn(`[audit] edge ${edge._id} threw: ${e.message.slice(0, 160)}`);
      failed++;
      continue;
    }

    if (!r.parsed) {
      console.warn(`[audit] edge ${edge._id} unparseable: ${(r.raw || '').slice(0, 160)}`);
      failed++;
      continue;
    }

    inputTok += r.usage?.input_tokens || 0;
    outputTok += r.usage?.output_tokens || 0;

    const verdict = r.parsed.verdict;
    if (verdict === 'correct') correct++;
    else if (verdict === 'borderline') borderline++;
    else if (verdict === 'wrong') wrong++;
    else unverifiable++;

    results.push({
      edgeId: String(edge._id),
      bucket: edge._bucket,
      relationshipType: edge.relationshipType,
      confidence: edge.confidence,
      method: edge.method,
      verdict,
      reason: r.parsed.reason,
      would_change_relationship_to: r.parsed.would_change_relationship_to || '',
      would_change_confidence_to: r.parsed.would_change_confidence_to || '',
    });

    if ((i + 1) % 25 === 0) {
      const seen = correct + borderline + wrong;
      console.log(`[audit] ${i + 1}/${sample.length}: correct=${correct} (${(100*correct/seen).toFixed(1)}%), borderline=${borderline}, wrong=${wrong}`);
    }
  }

  const dateSlug = new Date().toISOString().slice(0, 10);
  const reportDir = path.join(__dirname, '..', 'reports', dateSlug);
  fs.mkdirSync(reportDir, { recursive: true });

  // CSV
  const csvLines = ['edgeId,bucket,relationship,confidence,method,verdict,reason,suggested_rel,suggested_conf'];
  for (const r of results) {
    const row = [
      r.edgeId, r.bucket, r.relationshipType, r.confidence, r.method,
      r.verdict, JSON.stringify(r.reason || ''),
      r.would_change_relationship_to || '', r.would_change_confidence_to || '',
    ];
    csvLines.push(row.join(','));
  }
  const csvPath = path.join(reportDir, `edge-audit-${slug}.csv`);
  fs.writeFileSync(csvPath, csvLines.join('\n'));

  // Per-bucket precision
  const bucketStats = {};
  for (const r of results) {
    if (!bucketStats[r.bucket]) bucketStats[r.bucket] = { total: 0, correct: 0, borderline: 0, wrong: 0 };
    bucketStats[r.bucket].total++;
    bucketStats[r.bucket][r.verdict]++;
  }

  // Markdown summary
  const seen = correct + borderline + wrong;
  const mdLines = [
    `# Edge Audit — ${dateSlug}`,
    '',
    `Sample: ${sample.length} edges (universe ${allEdges.length}).`,
    `Model: ${process.env.AUDIT_MODEL || 'claude-opus-4-6'}.`,
    `Duration: ${Math.round((Date.now() - t0) / 1000)}s.`,
    `Input tokens: ${inputTok}, output tokens: ${outputTok}.`,
    `Estimated cost (Opus 4.7 rates): $${((inputTok * 5 + outputTok * 25) / 1e6).toFixed(2)}.`,
    '',
    `## Headline`,
    '',
    `- correct:    ${correct} / ${seen} = ${seen ? (100*correct/seen).toFixed(1) : '0'}%`,
    `- borderline: ${borderline} / ${seen} = ${seen ? (100*borderline/seen).toFixed(1) : '0'}%`,
    `- wrong:      ${wrong} / ${seen} = ${seen ? (100*wrong/seen).toFixed(1) : '0'}%`,
    `- unparseable: ${failed}`,
    '',
    `## Per-bucket precision`,
    '',
    '| bucket | total | correct | borderline | wrong | precision |',
    '|---|---:|---:|---:|---:|---:|',
  ];
  for (const [bucket, s] of Object.entries(bucketStats).sort()) {
    const prec = s.total ? (100 * s.correct / s.total).toFixed(1) : '0';
    mdLines.push(`| ${bucket} | ${s.total} | ${s.correct} | ${s.borderline} | ${s.wrong} | ${prec}% |`);
  }
  mdLines.push('', `## Companion`, '', `Per-edge verdicts in \`${path.relative(path.join(__dirname, '..'), csvPath)}\`.`);
  const mdPath = path.join(reportDir, `edge-audit-${slug}.md`);
  fs.writeFileSync(mdPath, mdLines.join('\n'));

  console.log('\n=== AUDIT SUMMARY ===');
  console.log(`correct=${correct}/${seen} (${seen ? (100*correct/seen).toFixed(1) : '0'}%)`);
  console.log(`borderline=${borderline}, wrong=${wrong}, unparseable=${failed}`);
  console.log(`reports written: ${csvPath}\n                 ${mdPath}`);
  process.exit(0);
}

main().catch(e => {
  console.error('[audit-edges] FATAL', e);
  process.exit(1);
});
