#!/usr/bin/env node
/**
 * sweep-book.js — manual quality sweep trigger.
 *
 * Usage:
 *   node scripts/sweep-book.js --book <bookId> [--detect-only] [--limit N]
 *   node scripts/sweep-book.js --chunk <chunkId> --pattern p1|p2|p3
 *
 * --detect-only  lists candidate bad chunks without running repairs
 * --limit N      stop after repairing N chunks (good for first runs)
 * --chunk X      repair a single chunk of the given pattern (dev mode)
 *
 * No Agenda, no scheduler, no background job. Just runs the
 * sweep in the foreground so the operator sees every step.
 */

require('dotenv').config();
const mongoose = require('mongoose');

const args = process.argv.slice(2);
function getFlag(name) {
  const i = args.indexOf(name);
  if (i < 0) return null;
  return args[i + 1] || true;
}
function hasFlag(name) { return args.includes(name); }

const bookId = getFlag('--book');
const chunkId = getFlag('--chunk');
const pattern = getFlag('--pattern') || 'p1';
const detectOnly = hasFlag('--detect-only');
const limit = parseInt(getFlag('--limit'), 10) || undefined;

if (!bookId && !chunkId) {
  console.error('Usage:');
  console.error('  node scripts/sweep-book.js --book <bookId> [--detect-only] [--limit N]');
  console.error('  node scripts/sweep-book.js --chunk <chunkId> --pattern p1|p2|p3');
  process.exit(1);
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const svc = require('../services/qualitySweepService');
  const Book = require('../models/Book');

  if (chunkId) {
    console.log(`\n=== single-chunk repair: ${chunkId} (pattern ${pattern}) ===\n`);
    const r = await svc.repairChunk(chunkId, { pattern });
    console.log('result:', JSON.stringify(r.result, null, 2));
    console.log('stats:', r.stats);
    console.log('log:');
    for (const l of r.log) console.log('  ', l);
    await mongoose.disconnect();
    return;
  }

  const book = await Book.findById(bookId).select('title').lean();
  if (!book) {
    console.error('book not found:', bookId);
    process.exit(2);
  }
  console.log(`\n=== quality sweep: ${book.title} ===\n`);

  if (detectOnly) {
    console.log('[detect-only] running detectors, no repairs, no LLM calls…\n');
    const r = await svc.detectCandidates(bookId);
    console.log(`total chunks: ${r.totalChunks}`);
    console.log(`pattern 1 (dense 1-span) matches: ${r.p1.length}`);
    for (const c of r.p1.slice(0, 10)) {
      console.log(`  chunk#${c.chunkIndex} p${c.pageNumber} wc=${c.wordCount} tags=${c.tagCount}`);
    }
    if (r.p1.length > 10) console.log(`  … +${r.p1.length - 10} more`);
    console.log(`pattern 2 (orphan pronoun) matches: ${r.p2.length}`);
    for (const c of r.p2.slice(0, 10)) {
      console.log(`  chunk#${c.chunkIndex} p${c.pageNumber} "${c.firstWord.slice(0, 60)}"`);
    }
    if (r.p2.length > 10) console.log(`  … +${r.p2.length - 10} more`);
    console.log(`pattern 3 (isolated node) matches: ${r.p3.length}`);
    for (const c of r.p3.slice(0, 10)) {
      console.log(`  chunk#${c.chunkIndex} p${c.pageNumber} wc=${c.wordCount}`);
    }
    if (r.p3.length > 10) console.log(`  … +${r.p3.length - 10} more`);
    await mongoose.disconnect();
    return;
  }

  // Full sweep
  const r = await svc.runSweepForBook(bookId, { limit });
  console.log('\n=== stats ===');
  for (const [k, v] of Object.entries(r.stats)) {
    console.log(`  ${k}: ${v}`);
  }
  console.log(`\nestimated cost: $${r.stats.estCostUsd.toFixed(4)}`);
  console.log(`\n=== last log lines ===`);
  for (const l of r.log.slice(-20)) console.log('  ', l);
  console.log(`\njob id: ${r.jobId}`);

  await mongoose.disconnect();
}

run().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
