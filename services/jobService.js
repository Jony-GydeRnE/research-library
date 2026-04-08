const fs = require('fs');
const path = require('path');
const os = require('os');
const { Agenda } = require('agenda');
const mongoose = require('mongoose');
const Book = require('../models/Book');
const Page = require('../models/Page');
const Job = require('../models/Job');
const ErrorLog = require('../models/ErrorLog');
const { extractPages } = require('./pdfService');
const { getPdfBuffer } = require('./s3Service');
const { renderPageToImage, convertPageWithVision, isVisionAvailable } = require('./visionService');
const { detectAndCropFigures } = require('./figureService');
const pipeline = require('../config/pipeline');

let agenda;

async function initAgenda() {
  agenda = new Agenda({
    db: {
      address: process.env.MONGODB_URI,
      collection: 'agendaJobs',
    },
    processEvery: '5 seconds',
  });

  defineJobs();
  await agenda.start();
  console.log('Agenda job queue started');
  return agenda;
}

function defineJobs() {

  // ─── EXTRACT PDF ───────────────────────────────────────────────
  agenda.define('extract-pdf', async (job) => {
    const { bookId } = job.attrs.data;
    const jobDoc = await Job.findOne({ bookId, type: 'extract-pdf', status: 'pending' });
    if (!jobDoc) return;

    jobDoc.status = 'running';
    jobDoc.startedAt = new Date();
    await jobDoc.save();

    try {
      const book = await Book.findById(bookId);
      if (!book) throw new Error('Book not found');

      book.status = 'processing';
      await book.save();

      const pdfBuffer = await getPdfBuffer(book.s3Key);
      const { pages, totalPages, metadata } = await extractPages(pdfBuffer);

      if (!book.title && metadata.title) book.title = metadata.title;
      if (!book.author && metadata.author) book.author = metadata.author;
      book.pageCount = totalPages;

      const batchSize = pipeline.maxPagesPerJob;
      for (let i = 0; i < pages.length; i += batchSize) {
        const batch = pages.slice(i, i + batchSize);
        const pageDocs = batch.map(p => ({
          bookId: book._id,
          pageNumber: p.pageNumber,
          rawText: p.text,
          hasEquations: false,
          hasImages: false,
        }));
        await Page.insertMany(pageDocs);

        const progress = Math.round(((i + batch.length) / pages.length) * 50);
        book.processingProgress = progress;
        await book.save();
        jobDoc.progress = progress;
        await jobDoc.save();
      }

      jobDoc.status = 'done';
      jobDoc.progress = 50;
      jobDoc.completedAt = new Date();
      await jobDoc.save();

      book.processingProgress = 50;
      await book.save();

      const htmlJob = new Job({
        bookId: book._id,
        type: 'generate-html',
        status: 'pending',
      });
      await htmlJob.save();
      await agenda.now('generate-html', { bookId: bookId.toString() });

    } catch (err) {
      jobDoc.status = 'failed';
      jobDoc.error = err.message;
      jobDoc.completedAt = new Date();
      await jobDoc.save();

      await Book.findByIdAndUpdate(bookId, { status: 'error' });

      await ErrorLog.create({
        bookId,
        jobType: 'extract-pdf',
        message: err.message,
        stack: err.stack,
      });
    }
  });

  // ─── GENERATE HTML ─────────────────────────────────────────────
  agenda.define('generate-html', async (job) => {
    const { bookId } = job.attrs.data;
    const jobDoc = await Job.findOne({ bookId, type: 'generate-html', status: 'pending' });
    if (!jobDoc) return;

    jobDoc.status = 'running';
    jobDoc.startedAt = new Date();
    await jobDoc.save();

    let pdfTmpPath = null;

    try {
      const book = await Book.findById(bookId);
      if (!book) throw new Error('Book not found');

      if (!isVisionAvailable()) {
        throw new Error('OPENAI_API_KEY not configured — vision is required for HTML generation');
      }

      const pages = await Page.find({ bookId }).sort({ pageNumber: 1 });
      const totalPages = pages.length;

      // Save PDF to temp file for Swift renderer
      const pdfBuffer = await getPdfBuffer(book.s3Key);
      pdfTmpPath = path.join(os.tmpdir(), `gyde-${book._id}.pdf`);
      fs.writeFileSync(pdfTmpPath, pdfBuffer);

      // Process pages in parallel batches of 20
      const BATCH = 20;
      let processed = 0;

      for (let i = 0; i < totalPages; i += BATCH) {
        const batch = pages.slice(i, i + BATCH);

        const results = await Promise.all(batch.map(async (page) => {
          const pageNum = page.pageNumber;
          try {
            const pngBuffer = await renderPageToImage(pdfTmpPath, pageNum, book._id.toString());
            let html = await convertPageWithVision(pngBuffer, pageNum, pageNum === 1);
            html = await detectAndCropFigures(html, book._id.toString(), pageNum, page.textItems || [], page.pdfPageHeight || 792);
            return { page, html };
          } catch (err) {
            // Retry once on rate limit
            if (err.status === 429) {
              await new Promise(r => setTimeout(r, 2000));
              try {
                const pngBuffer = await renderPageToImage(pdfTmpPath, pageNum, book._id.toString());
                let html = await convertPageWithVision(pngBuffer, pageNum, pageNum === 1);
                html = await detectAndCropFigures(html, book._id.toString(), pageNum, page.textItems || [], page.pdfPageHeight || 792);
                return { page, html };
              } catch (e2) { return { page, html: null, error: e2.message }; }
            }
            return { page, html: null, error: err.message };
          }
        }));

        // Save results
        for (const r of results) {
          if (r.html) {
            const h2 = r.html.match(/<h2[^>]*>([^<]+)<\/h2>/);
            const h3 = r.html.match(/<h3[^>]*>([^<]+)<\/h3>/);
            r.page.htmlContent = r.html;
            if (h2) r.page.chapterTitle = h2[1];
            if (h3) r.page.sectionTitle = h3[1];
            r.page.hasEquations = true;
            r.page.hasImages = true;
            await r.page.save();
          }
          processed++;
        }

        const progress = 50 + Math.round((processed / totalPages) * 50);
        book.processingProgress = progress;
        await book.save();
        jobDoc.progress = progress;
        await jobDoc.save();
      }

      book.status = 'ready';
      book.processingProgress = 100;
      book.readyAt = new Date();
      await book.save();

      // Clean up temp PDF
      if (fs.existsSync(pdfTmpPath)) fs.unlinkSync(pdfTmpPath);

      jobDoc.status = 'done';
      jobDoc.progress = 100;
      jobDoc.completedAt = new Date();
      await jobDoc.save();

    } catch (err) {
      if (pdfTmpPath && fs.existsSync(pdfTmpPath)) {
        try { fs.unlinkSync(pdfTmpPath); } catch(e) {}
      }
      jobDoc.status = 'failed';
      jobDoc.error = err.message;
      jobDoc.completedAt = new Date();
      await jobDoc.save();

      await Book.findByIdAndUpdate(bookId, { status: 'error' });

      await ErrorLog.create({
        bookId,
        jobType: 'generate-html',
        message: err.message,
        stack: err.stack,
      });
    }
  });
}

function getAgenda() {
  return agenda;
}

module.exports = { initAgenda, getAgenda };
