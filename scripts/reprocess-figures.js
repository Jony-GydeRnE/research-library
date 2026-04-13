/**
 * Re-run vision on specific pages of a book using the CURRENT
 * page-to-html.txt prompt so the new data-bbox format takes effect.
 * Writes the new htmlContent to the Page document (stashing the old
 * one into htmlContentLegacy the first time), then re-runs
 * figureService.detectAndCropFigures on the new HTML so the crops
 * are regenerated from the bbox data.
 *
 * Usage:
 *   node scripts/reprocess-figures.js <bookId> <page> [<page> ...]
 *   node scripts/reprocess-figures.js <bookId> all-with-figs
 *
 * `all-with-figs` auto-discovers every page that either (a) has a
 * `<figure` tag in its current htmlContent or (b) has any
 * page-N-fig-K.png file on disk.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const Book = require('../models/Book');
const Page = require('../models/Page');
const { convertPageWithVision } = require('../services/visionService');
const { detectAndCropFigures } = require('../services/figureService');

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

async function pagesWithFigures(bookId) {
  const bookDir = path.join(IMAGE_DIR, bookId);
  const pagesWithFigOnDisk = new Set();
  if (fs.existsSync(bookDir)) {
    for (const f of fs.readdirSync(bookDir)) {
      const m = f.match(/^page-(\d+)-fig-\d+\.png$/);
      if (m) pagesWithFigOnDisk.add(parseInt(m[1], 10));
    }
  }
  const dbPages = await Page.find(
    { bookId, htmlContent: /<figure/ },
    'pageNumber'
  ).lean();
  const pagesInDb = new Set(dbPages.map(p => p.pageNumber));
  const combined = new Set([...pagesWithFigOnDisk, ...pagesInDb]);
  return [...combined].sort((a, b) => a - b);
}

async function main() {
  const [,, bookId, ...rest] = process.argv;
  if (!bookId || rest.length === 0) {
    console.error('Usage: node scripts/reprocess-figures.js <bookId> <page>... | all-with-figs');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);

  const book = await Book.findById(bookId).lean();
  if (!book) throw new Error(`book ${bookId} not found`);

  let pageNums;
  if (rest[0] === 'all-with-figs') {
    pageNums = await pagesWithFigures(bookId);
  } else {
    pageNums = rest.map(n => parseInt(n, 10)).filter(n => n > 0);
  }

  if (pageNums.length === 0) {
    console.error('[info] no pages to reprocess');
    await mongoose.disconnect();
    return;
  }

  console.error(`[info] book: ${book.title}`);
  console.error(`[info] pages to reprocess: ${pageNums.join(',')}`);

  const kind = book.kind || 'paper';
  let ok = 0, failed = 0;
  const t0 = Date.now();

  for (const pageNum of pageNums) {
    const pngPath = path.join(IMAGE_DIR, bookId, `page-${pageNum}.png`);
    if (!fs.existsSync(pngPath)) {
      console.error(`[p${pageNum}] SKIP — png missing`);
      failed++;
      continue;
    }
    const pt0 = Date.now();
    try {
      const buf = fs.readFileSync(pngPath);
      let html = await convertPageWithVision(buf, pageNum, pageNum === 1, kind);
      // Extract bbox attrs from the returned HTML before the crop
      // pass so we can log whether the model actually emitted them.
      const bboxMatches = html.match(/data-bbox="([^"]+)"/g) || [];
      html = await detectAndCropFigures(html, bookId, pageNum);

      const plainText = htmlToPlainText(html);
      const h2 = html.match(/<h2[^>]*>([^<]+)<\/h2>/);
      const h3 = html.match(/<h3[^>]*>([^<]+)<\/h3>/);

      let pageDoc = await Page.findOne({ bookId, pageNumber: pageNum });
      if (!pageDoc) pageDoc = new Page({ bookId, pageNumber: pageNum });
      if (!pageDoc.htmlContentLegacy && pageDoc.htmlContent) {
        pageDoc.htmlContentLegacy = pageDoc.htmlContent;
      }
      pageDoc.htmlContent = html;
      pageDoc.rawText = plainText;
      if (h2) pageDoc.chapterTitle = h2[1];
      if (h3) pageDoc.sectionTitle = h3[1];
      pageDoc.hasImages = true;
      pageDoc.visionProcessed = true;
      await pageDoc.save();

      const elapsed = ((Date.now() - pt0) / 1000).toFixed(1);
      console.error(`[p${pageNum}] ok (${elapsed}s) bboxes=${bboxMatches.length} ${bboxMatches.map(s => s.slice(10,-1)).join(' | ')}`);
      ok++;
    } catch (err) {
      console.error(`[p${pageNum}] FAILED: ${err.message}`);
      failed++;
    }
    await new Promise(r => setTimeout(r, 800));
  }

  const totalSec = ((Date.now() - t0) / 1000).toFixed(1);
  console.error('');
  console.error('=== REPROCESS FIGURES COMPLETE ===');
  console.error(`ok: ${ok}, failed: ${failed}, wall: ${totalSec}s`);

  await mongoose.disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
