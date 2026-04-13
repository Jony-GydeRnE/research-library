/**
 * Re-extract and regenerate HTML for all books.
 * Processes pages in parallel batches of 20 for speed.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const os = require('os');
const mongoose = require('mongoose');
const Book = require('../models/Book');
const Page = require('../models/Page');
const { extractPages } = require('../services/pdfService');
const { getPdfBuffer } = require('../services/s3Service');
const { renderPageToImage, convertPageWithVision, isVisionAvailable } = require('../services/visionService');
const { detectAndCropFigures } = require('../services/figureService');

const BATCH_SIZE = 20;

async function processOnePage(p, pdfTmpPath, bookId) {
  const pageNum = p.pageNumber;
  const pngBuffer = await renderPageToImage(pdfTmpPath, pageNum, bookId);
  let html = await convertPageWithVision(pngBuffer, pageNum, pageNum === 1);

  const textItems = (p.textCoords || []).map(({ x, y, w, h }) => ({ x, y, w, h }));
  const pdfPageHeight = p.pdfPageHeight || 792;
  html = await detectAndCropFigures(html, bookId, pageNum);

  const h2Match = html.match(/<h2[^>]*>([^<]+)<\/h2>/);
  const h3Match = html.match(/<h3[^>]*>([^<]+)<\/h3>/);

  return {
    bookId, pageNumber: pageNum, rawText: p.text, htmlContent: html,
    chapterTitle: h2Match ? h2Match[1] : null,
    sectionTitle: h3Match ? h3Match[1] : null,
    hasEquations: true, hasImages: true, textItems, pdfPageHeight,
  };
}

async function processWithRetry(p, pdfTmpPath, bookId, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await processOnePage(p, pdfTmpPath, bookId);
    } catch (err) {
      if (err.status === 429 && attempt < retries) {
        console.log(`    Page ${p.pageNumber}: rate limited, retrying in 2s...`);
        await new Promise(r => setTimeout(r, 2000));
      } else {
        console.error(`    Page ${p.pageNumber}: FAILED - ${err.message}`);
        return null;
      }
    }
  }
}

async function reprocess() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  if (!isVisionAvailable()) {
    console.error('ERROR: OPENAI_API_KEY not set.');
    process.exit(1);
  }

  const books = await Book.find({ status: 'ready' });
  console.log(`Found ${books.length} books to reprocess\n`);

  for (const book of books) {
    console.log(`--- Reprocessing: ${book.title} ---`);
    const startTime = Date.now();

    try {
      const pdfBuffer = await getPdfBuffer(book.s3Key);
      const { pages, totalPages, metadata } = await extractPages(pdfBuffer);
      console.log(`  ${pages.length} pages extracted`);

      const pdfTmpPath = path.join(os.tmpdir(), `gyde-reprocess-${book._id}.pdf`);
      fs.writeFileSync(pdfTmpPath, pdfBuffer);
      await Page.deleteMany({ bookId: book._id });

      // Process in parallel batches
      const results = [];
      for (let i = 0; i < pages.length; i += BATCH_SIZE) {
        const batch = pages.slice(i, i + BATCH_SIZE);
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(pages.length / BATCH_SIZE);
        console.log(`  Batch ${batchNum}/${totalBatches} (pages ${i + 1}-${Math.min(i + BATCH_SIZE, pages.length)})`);

        const batchResults = await Promise.all(
          batch.map(p => processWithRetry(p, pdfTmpPath, book._id.toString()))
        );
        results.push(...batchResults.filter(Boolean));

        // Update progress
        const progress = Math.round((results.length / pages.length) * 100);
        book.processingProgress = progress;
        await book.save();
      }

      // Bulk insert all pages
      if (results.length > 0) {
        await Page.insertMany(results);
      }

      if (fs.existsSync(pdfTmpPath)) fs.unlinkSync(pdfTmpPath);

      if (!book.title && metadata.title) book.title = metadata.title;
      if (!book.author && metadata.author) book.author = metadata.author;
      book.pageCount = totalPages;
      book.processingProgress = 100;
      await book.save();

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`  Done. ${results.length}/${totalPages} pages in ${elapsed}s\n`);

    } catch (err) {
      console.error(`  ERROR: ${err.message}\n`);
    }
  }

  await mongoose.disconnect();
  console.log('Reprocessing complete.');
}

reprocess();
