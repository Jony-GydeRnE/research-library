#!/usr/bin/env node
/**
 * scripts/judge-sample.js — invoke services/judgeService.js from the CLI.
 *
 * EX-4b sidecar: lets us validate the rubric on a small sample before
 * wiring the judge into the per-ingestion path. Default is dry-run (no
 * QualityScore writes) so the rubric's calibration can be tuned without
 * polluting the dashboard.
 *
 * Usage:
 *   node scripts/judge-sample.js --book=<bookId> [--n=10] [--write] [--threshold=5]
 *
 * Flags:
 *   --book        bookId to sample. Required.
 *   --n           sample size (default 10 — keep small until calibration is set)
 *   --write       persist QualityScore documents (default: dry-run only)
 *   --threshold   grade below this triggers belowThreshold counter (default 5)
 *   --skip-existing  skip chunks that already have a QualityScore for this book
 *
 * Output: prints summary JSON to stdout. Pipe to a reports/ file for
 * archival when calibrating.
 */

require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
  const args = Object.fromEntries(process.argv.slice(2).map(a => {
    const [k, ...rest] = a.replace(/^--/, '').split('=');
    return [k, rest.join('=') || true];
  }));

  if (!args.book) {
    console.error('Usage: node scripts/judge-sample.js --book=<bookId> [--n=10] [--write]');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  const { judgeBook } = require('../services/judgeService');

  const sampleSize = parseInt(args.n, 10) || 10;
  const summary = await judgeBook(args.book, {
    sampleSize,
    dryRun: !args.write,
    skipExisting: !!args['skip-existing'],
    threshold: parseInt(args.threshold, 10) || 5,
  });

  console.log('\n=== JUDGE SAMPLE SUMMARY ===');
  console.log(JSON.stringify(summary, null, 2));
  process.exit(0);
}

main().catch(e => {
  console.error('[judge-sample] FATAL', e);
  process.exit(1);
});
