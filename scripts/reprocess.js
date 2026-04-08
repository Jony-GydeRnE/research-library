/**
 * Re-extract and regenerate HTML for all books.
 * Every page goes through GPT-4o vision — no text fallback.
 * Run with: node scripts/reprocess.js
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

async function reprocess() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  if (!isVisionAvailable()) {
    console.error('ERROR: OPENAI_API_KEY not set. Vision is required.');
    process.exit(1);
  }

  const books = await Book.find({ status: 'ready' });
  console.log(`Found ${books.length} books to reprocess\n`);

  for (const book of books) {
    console.log(`--- Reprocessing: ${book.title} ---`);

    try {
      const pdfBuffer = await getPdfBuffer(book.s3Key);
      const { pages, totalPages, metadata } = await extractPages(pdfBuffer);
      console.log(`  ${pages.length} pages extracted (text for rawText field)`);

      // Save PDF to temp file for Swift renderer
      const pdfTmpPath = path.join(os.tmpdir(), `gyde-reprocess-${book._id}.pdf`);
      fs.writeFileSync(pdfTmpPath, pdfBuffer);

      // Delete old pages
      await Page.deleteMany({ bookId: book._id });

      for (const p of pages) {
        const pageNum = p.pageNumber;
        console.log(`  Page ${pageNum}: GPT-4o vision`);

        // Render page to PNG (saved permanently to uploads/images/{bookId}/)
        const pngBuffer = await renderPageToImage(pdfTmpPath, pageNum, book._id.toString());

        // Send to GPT-4o vision
        let html = await convertPageWithVision(pngBuffer, pageNum, pageNum === 1);

        // Strip _str from textCoords before saving (only needed for caption search)
        const textItems = (p.textCoords || []).map(({ x, y, w, h }) => ({ x, y, w, h }));
        const pdfPageHeight = p.pdfPageHeight || 792;

        // Detect and crop figures from text coordinate gaps
        html = await detectAndCropFigures(html, book._id.toString(), pageNum, p.textCoords || [], pdfPageHeight);

        // Extract headings from vision HTML
        const h2Match = html.match(/<h2[^>]*>([^<]+)<\/h2>/);
        const h3Match = html.match(/<h3[^>]*>([^<]+)<\/h3>/);

        await Page.create({
          bookId: book._id,
          pageNumber: pageNum,
          rawText: p.text,
          htmlContent: html,
          chapterTitle: h2Match ? h2Match[1] : null,
          sectionTitle: h3Match ? h3Match[1] : null,
          hasEquations: true,
          hasImages: true,
          textItems,
          pdfPageHeight,
        });
      }

      // Clean up temp PDF
      if (fs.existsSync(pdfTmpPath)) fs.unlinkSync(pdfTmpPath);

      if (!book.title && metadata.title) book.title = metadata.title;
      if (!book.author && metadata.author) book.author = metadata.author;
      book.pageCount = totalPages;
      await book.save();

      console.log(`  Done. ${totalPages} pages saved.\n`);

    } catch (err) {
      console.error(`  ERROR: ${err.message}\n`);
    }
  }

  await mongoose.disconnect();
  console.log('Reprocessing complete.');
}

reprocess();
