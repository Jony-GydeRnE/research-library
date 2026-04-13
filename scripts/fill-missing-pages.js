/**
 * Fill in Page records for a book where the original vision pass
 * dropped some pages due to 429/TPM errors. Runs SERIALLY so we
 * stay well under the gpt-4o TPM budget.
 *
 * Uses existing page PNGs on disk (no re-render). Only calls vision
 * for pageNumbers that (a) are within 1..Book.pageCount, (b) have a
 * page-N.png on disk, and (c) have no Page document in Mongo yet.
 *
 * Usage:
 *   node scripts/fill-missing-pages.js <bookId>
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const Book = require('../models/Book');
const Page = require('../models/Page');
const { convertPageWithVision } = require('../services/visionService');

const IMAGE_DIR = path.join(__dirname, '..', 'uploads', 'images');

function htmlToPlainText(html) {
  return (html || '')
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
  const [,, bookId] = process.argv;
  if (!bookId) { console.error('Usage: node scripts/fill-missing-pages.js <bookId>'); process.exit(1); }

  const t0 = Date.now();
  await mongoose.connect(process.env.MONGODB_URI);

  const book = await Book.findById(bookId).lean();
  if (!book) throw new Error('book not found');

  const existing = await Page.find({ bookId }, 'pageNumber').lean();
  const have = new Set(existing.map(p => p.pageNumber));

  const missing = [];
  for (let n = 1; n <= book.pageCount; n++) {
    if (have.has(n)) continue;
    const pngPath = path.join(IMAGE_DIR, bookId, `page-${n}.png`);
    if (fs.existsSync(pngPath)) missing.push(n);
  }

  console.error(`[info] book: ${book.title}`);
  console.error(`[info] pageCount=${book.pageCount}, have=${have.size}, missing=${missing.length}`);
  if (missing.length === 0) { console.error('[info] nothing to do'); await mongoose.disconnect(); return; }

  const kind = book.kind || 'paper';
  let ok = 0, failed = 0;

  for (const pageNum of missing) {
    const pngPath = path.join(IMAGE_DIR, bookId, `page-${pageNum}.png`);
    const pt0 = Date.now();
    try {
      const buf = fs.readFileSync(pngPath);
      const html = await convertPageWithVision(buf, pageNum, pageNum === 1, kind);
      const plainText = htmlToPlainText(html);
      const h2 = html.match(/<h2[^>]*>([^<]+)<\/h2>/);
      const h3 = html.match(/<h3[^>]*>([^<]+)<\/h3>/);
      await Page.create({
        bookId,
        pageNumber: pageNum,
        rawText: plainText,
        htmlContent: html,
        chapterTitle: h2 ? h2[1] : null,
        sectionTitle: h3 ? h3[1] : null,
        hasEquations: true,
        hasImages: false,
        visionProcessed: true,
      });
      const elapsed = ((Date.now() - pt0) / 1000).toFixed(1);
      console.error(`[p${pageNum}] ok (${elapsed}s, ${html.length} chars)`);
      ok++;
    } catch (err) {
      console.error(`[p${pageNum}] FAILED: ${err.message}`);
      failed++;
    }
    // gentle serial throttle to respect 30k TPM
    await new Promise(r => setTimeout(r, 800));
  }

  const totalSec = ((Date.now() - t0) / 1000).toFixed(1);
  console.error('');
  console.error('=== FILL COMPLETE ===');
  console.error(`ok: ${ok}, failed: ${failed}, wall: ${totalSec}s`);

  await mongoose.disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
