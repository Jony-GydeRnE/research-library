#!/usr/bin/env node
/**
 * scripts/reprocess_empty_pages.js
 *
 * Flexible reprocessor for Page documents whose vision pass dropped
 * (typically 429 TPM rate limits during generate-html that the retry
 * loop gave up on). Finds every Page for a given book with empty
 * htmlContent and runs visionService.convertPageWithVision against
 * a freshly-rendered PNG, pacing calls so we stay well under TPM.
 *
 * Usage:
 *   node scripts/reprocess_empty_pages.js --book=<bookId>
 *   node scripts/reprocess_empty_pages.js --title="Lagrangians and Euler"
 *   node scripts/reprocess_empty_pages.js --book=<bookId> --pages=45,47,50
 *   node scripts/reprocess_empty_pages.js --book=<bookId> --dry-run
 *
 * Flags:
 *   --book=<id>       explicit Book _id
 *   --title=<str>     case-insensitive substring match on Book.title
 *   --pages=a,b,c     limit to specific page numbers (default: all empty)
 *   --delay=<ms>      delay between vision calls (default 3500ms)
 *   --backoff=<ms>    base exponential backoff on 429 (default 4000ms)
 *   --retries=<n>     max retry attempts per page on 429 (default 5)
 *   --skip-spans      don't re-run span generation afterward
 *   --skip-match      don't re-run noteIngestion matching afterward
 *   --dry-run         report what would be reprocessed, do nothing
 *
 * Safety:
 *   - Only touches pages where htmlContent is empty/missing. Never
 *     overwrites a page that already has vision output.
 *   - Writes per-page progress so if the script is killed mid-run
 *     the successful pages stay persisted.
 *   - Logs every failure to ErrorLog with jobType='reprocess-empty-pages'
 *     so you can grep back later.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const Book = require('../models/Book');
const Page = require('../models/Page');
const ErrorLog = require('../models/ErrorLog');
const { renderPageToImage, convertPageWithVision, isVisionAvailable } = require('../services/visionService');
const { getPdfBuffer } = require('../services/s3Service');

// ───────── arg parsing ─────────
function parseArgs(argv) {
  const args = {};
  for (const a of argv.slice(2)) {
    const [k, v] = a.replace(/^--/, '').split('=');
    args[k] = v === undefined ? true : v;
  }
  return args;
}
const args = parseArgs(process.argv);
const DELAY_MS = Number(args.delay ?? 3500);
const BACKOFF_BASE = Number(args.backoff ?? 4000);
const MAX_RETRIES = Number(args.retries ?? 5);
const DRY_RUN = !!args['dry-run'];
const SKIP_SPANS = !!args['skip-spans'];
const SKIP_MATCH = !!args['skip-match'];
const TARGET_PAGES = args.pages ? String(args.pages).split(',').map(Number) : null;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function resolveBook() {
  if (args.book) {
    const b = await Book.findById(args.book).lean();
    if (!b) throw new Error('No book with _id=' + args.book);
    return b;
  }
  if (args.title) {
    const re = new RegExp(String(args.title).replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'), 'i');
    const b = await Book.findOne({ title: re }).lean();
    if (!b) throw new Error('No book matched title ~= ' + args.title);
    return b;
  }
  throw new Error('Pass --book=<id> or --title="<substring>"');
}

async function findEmptyPages(bookId) {
  const pages = await Page.find({ bookId })
    .select('_id pageNumber htmlContent rawText visionProcessed')
    .sort({ pageNumber: 1 })
    .lean();
  const empty = pages.filter(p => !p.htmlContent || p.htmlContent.length === 0);
  if (TARGET_PAGES) {
    return empty.filter(p => TARGET_PAGES.includes(p.pageNumber));
  }
  return empty;
}

async function withRateLimitRetry(fn) {
  let lastErr;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const is429 = err.status === 429 || /rate limit/i.test(err.message || '');
      if (!is429 && err.code !== 'ETIMEDOUT' && err.code !== 'ECONNRESET') throw err;
      const wait = Math.min(60000, BACKOFF_BASE * Math.pow(2, attempt));
      console.log('    ↳ 429/transient — backoff ' + wait + 'ms (attempt ' + (attempt + 1) + '/' + MAX_RETRIES + ')');
      await sleep(wait);
    }
  }
  throw lastErr;
}

function htmlToPlainText(html) {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<figure[\s\S]*?<\/figure>/gi, '')
    .replace(/<img[^>]*>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function main() {
  if (!isVisionAvailable()) {
    console.error('OPENAI_API_KEY not set — aborting');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('[reprocess] connected to mongo');

  const book = await resolveBook();
  console.log('[reprocess] target: ' + book._id + '  "' + (book.title || '').slice(0, 60) + '"  kind=' + (book.kind || 'paper') + '  pageCount=' + book.pageCount);

  const emptyPages = await findEmptyPages(book._id);
  console.log('[reprocess] empty pages: ' + emptyPages.length);
  if (emptyPages.length === 0) {
    console.log('[reprocess] nothing to do');
    await mongoose.disconnect();
    return;
  }
  console.log('[reprocess] pages: ' + emptyPages.map(p => p.pageNumber).join(','));

  if (DRY_RUN) {
    console.log('[reprocess] --dry-run: exiting without calling vision');
    await mongoose.disconnect();
    return;
  }

  // Materialize the PDF locally so we can re-render pages via Swift.
  const pdfBuffer = await getPdfBuffer(book.s3Key);
  const tmpPath = path.join('/tmp', 'reprocess-' + book._id + '.pdf');
  fs.writeFileSync(tmpPath, pdfBuffer);
  console.log('[reprocess] pdf materialized at ' + tmpPath + ' (' + pdfBuffer.length + ' bytes)');

  const kind = book.kind || 'paper';
  let ok = 0, fail = 0;
  const t0 = Date.now();

  for (let i = 0; i < emptyPages.length; i++) {
    const p = emptyPages[i];
    const pageNum = p.pageNumber;
    const isFirst = pageNum === 1;
    const tag = '[reprocess ' + (i + 1) + '/' + emptyPages.length + '] page ' + pageNum;
    try {
      console.log(tag + ' — rendering PNG');
      const png = await renderPageToImage(tmpPath, pageNum, String(book._id));
      console.log(tag + ' — vision call');
      const html = await withRateLimitRetry(() => convertPageWithVision(png, pageNum, isFirst, kind));
      const plain = htmlToPlainText(html);
      await Page.updateOne(
        { _id: p._id },
        { $set: { htmlContent: html, rawText: plain, visionProcessed: true } }
      );
      console.log(tag + ' — OK (' + html.length + ' chars html, ' + plain.length + ' chars text)');
      ok++;
    } catch (err) {
      console.error(tag + ' — FAIL: ' + (err.message || err));
      fail++;
      await ErrorLog.create({
        bookId: book._id,
        jobType: 'reprocess-empty-pages',
        message: 'Page ' + pageNum + ': ' + (err.message || String(err)),
        stack: err.stack,
      });
    }
    // Pace calls to stay under TPM even for the high tier
    if (i < emptyPages.length - 1) await sleep(DELAY_MS);
  }

  const elapsed = Math.round((Date.now() - t0) / 1000);
  console.log('[reprocess] done: ok=' + ok + ' fail=' + fail + ' elapsed=' + elapsed + 's');

  // ── Re-run downstream pipeline if any pages were recovered ──
  if (ok > 0 && !SKIP_SPANS) {
    console.log('[reprocess] regenerating spans + chunks for book');
    try {
      const { generateSpansForBook } = require('../services/spanService');
      const res = await generateSpansForBook(book._id);
      console.log('[reprocess] spans: ' + JSON.stringify({
        pagesProcessed: res.pagesProcessed,
        spansCreated: res.spansCreated,
        chunksCreated: res.chunksCreated,
        edgesCreated: res.edgesCreated,
      }));
    } catch (err) {
      console.error('[reprocess] span generation failed: ' + err.message);
    }
  }

  // For notes books, generateSpansForBook's post-chain guards against
  // re-running matchNotesToSourceBooks (it only auto-runs when a paper
  // book is regenerated). Call it explicitly here so note→paper
  // edges pick up the newly-populated pages.
  if (ok > 0 && !SKIP_MATCH && kind === 'notes') {
    console.log('[reprocess] re-running matchNotesToSourceBooks');
    try {
      const { matchNotesToSourceBooks } = require('../services/noteIngestionService');
      const res = await matchNotesToSourceBooks(book._id);
      console.log('[reprocess] note-match: ' + JSON.stringify({
        edgesCreated: res.edgesCreated,
        error: res.error,
      }));
    } catch (err) {
      console.error('[reprocess] note matching failed: ' + err.message);
    }
  }

  await mongoose.disconnect();
  console.log('[reprocess] disconnected — complete');
}

main().catch(err => { console.error(err); process.exit(1); });
