const fs = require('fs');
const path = require('path');
const os = require('os');
const { Agenda } = require('agenda');
const mongoose = require('mongoose');
const Book = require('../models/Book');
const Page = require('../models/Page');
const Job = require('../models/Job');
const ErrorLog = require('../models/ErrorLog');
const Highlight = require('../models/Highlight');
const { extractPages } = require('./pdfService');
const { getPdfBuffer } = require('./s3Service');
const { renderPageToImage, convertPageWithVision, isVisionAvailable } = require('./visionService');
const { detectAndCropFigures } = require('./figureService');
const { annotateBook } = require('./regexService');
const { extractBookMetadata } = require('./metadataService');
const pipeline = require('../config/pipeline');

let agenda;

async function initAgenda() {
  agenda = new Agenda({
    db: { address: process.env.MONGODB_URI, collection: 'agendaJobs' },
    processEvery: '5 seconds',
  });
  defineJobs();
  await agenda.start();
  console.log('Agenda job queue started');
  return agenda;
}

// ─── SHARED: Vision-process a single page ────────────────────────

async function visionProcessPage(pdfTmpPath, page, bookId, isFirstPage) {
  const pageNum = page.pageNumber;
  const pngBuffer = await renderPageToImage(pdfTmpPath, pageNum, bookId);
  let html = await convertPageWithVision(pngBuffer, pageNum, isFirstPage);
  html = await detectAndCropFigures(html, bookId, pageNum, [], 792);

  const h2 = html.match(/<h2[^>]*>([^<]+)<\/h2>/);
  const h3 = html.match(/<h3[^>]*>([^<]+)<\/h3>/);

  return { html, chapterTitle: h2 ? h2[1] : null, sectionTitle: h3 ? h3[1] : null };
}

async function visionProcessWithRetry(pdfTmpPath, page, bookId, isFirstPage) {
  try {
    return await visionProcessPage(pdfTmpPath, page, bookId, isFirstPage);
  } catch (err) {
    if (err.status === 429) {
      await new Promise(r => setTimeout(r, 2000));
      try {
        return await visionProcessPage(pdfTmpPath, page, bookId, isFirstPage);
      } catch (e2) { return { error: e2.message }; }
    }
    return { error: err.message };
  }
}

// ─── SHARED: Re-map highlights after rawText changes ─────────────

async function remapHighlights(bookId, pageNumber, newRawText) {
  const highlights = await Highlight.find({ bookId, pageNumber });
  for (const hl of highlights) {
    if (!hl.text || hl.startOffset < 0) continue;
    const idx = newRawText.indexOf(hl.text);
    if (idx >= 0) {
      hl.startOffset = idx;
      hl.endOffset = idx + hl.text.length;
      await hl.save();
    } else {
      console.warn(`  Highlight re-map failed for page ${pageNumber}: "${hl.text.substring(0, 40)}..." not found in new rawText`);
    }
  }
}

// ─── JOB DEFINITIONS ─────────────────────────────────────────────

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
      book.processingStatus = 'extracting-text';
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
          rawTextLegacy: p.text,  // preserve original pdf-parse text
          hasEquations: false,
          hasImages: false,
          visionProcessed: false,
          textItems: (p.textCoords || []).map(({ x, y, w, h }) => ({ x, y, w, h })),
          pdfPageHeight: p.pdfPageHeight || 792,
        }));
        await Page.insertMany(pageDocs);

        const progress = Math.round(((i + batch.length) / pages.length) * 25);
        book.processingProgress = progress;
        await book.save();
        jobDoc.progress = progress;
        await jobDoc.save();
      }

      jobDoc.status = 'done';
      jobDoc.progress = 25;
      jobDoc.completedAt = new Date();
      await jobDoc.save();
      book.processingProgress = 25;
      await book.save();

      // Enqueue vision processing
      const htmlJob = new Job({ bookId: book._id, type: 'generate-html', status: 'pending' });
      await htmlJob.save();
      await agenda.now('generate-html', { bookId: bookId.toString() });

    } catch (err) {
      jobDoc.status = 'failed';
      jobDoc.error = err.message;
      jobDoc.completedAt = new Date();
      await jobDoc.save();
      await Book.findByIdAndUpdate(bookId, { status: 'error' });
      await ErrorLog.create({ bookId, jobType: 'extract-pdf', message: err.message, stack: err.stack });
    }
  });

  // ─── GENERATE HTML (Vision Processing) ─────────────────────────
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
        // No vision key — mark as ready with text-only content
        book.status = 'ready';
        book.processingProgress = 100;
        book.processingStatus = 'complete-text-only';
        book.readyAt = new Date();
        await book.save();
        jobDoc.status = 'done';
        jobDoc.progress = 100;
        jobDoc.completedAt = new Date();
        await jobDoc.save();
        return;
      }

      book.processingStatus = 'vision-processing';
      await book.save();

      const pages = await Page.find({ bookId }).sort({ pageNumber: 1 });
      const totalPages = pages.length;

      const pdfBuffer = await getPdfBuffer(book.s3Key);
      pdfTmpPath = path.join(os.tmpdir(), `gyde-${book._id}.pdf`);
      fs.writeFileSync(pdfTmpPath, pdfBuffer);

      // Process in parallel batches of 20
      const BATCH = 20;
      let processed = 0;

      for (let i = 0; i < totalPages; i += BATCH) {
        const batch = pages.slice(i, i + BATCH);

        const results = await Promise.all(batch.map(async (page) => {
          const result = await visionProcessWithRetry(pdfTmpPath, page, book._id.toString(), page.pageNumber === 1);
          return { page, ...result };
        }));

        for (const r of results) {
          if (r.html) {
            // Preserve original rawText in legacy field (only if not already set)
            if (!r.page.rawTextLegacy && r.page.rawText) {
              r.page.rawTextLegacy = r.page.rawText;
            }

            r.page.htmlContent = r.html;
            if (r.chapterTitle) r.page.chapterTitle = r.chapterTitle;
            if (r.sectionTitle) r.page.sectionTitle = r.sectionTitle;
            r.page.hasEquations = true;
            r.page.hasImages = true;
            r.page.visionProcessed = true;
            await r.page.save();
          } else if (r.error) {
            // Vision failed — keep pdf-parse rawText, log error
            r.page.visionProcessed = false;
            await r.page.save();
            console.warn(`  Page ${r.page.pageNumber}: vision failed — ${r.error}`);
            await ErrorLog.create({ bookId, jobType: 'generate-html', message: `Page ${r.page.pageNumber}: ${r.error}` });
          }
          processed++;
        }

        book.processingProgress = 25 + Math.round((processed / totalPages) * 75);
        book.visionProgress = `${processed}/${totalPages} pages`;
        await book.save();
        jobDoc.progress = book.processingProgress;
        await jobDoc.save();
      }

      // Clean up temp PDF
      if (fs.existsSync(pdfTmpPath)) fs.unlinkSync(pdfTmpPath);

      // Run regex pre-annotation (Step 2 — zero cost)
      console.log(`  Running regex pre-annotation...`);
      await annotateBook(bookId);

      // Run surface metadata extraction (Step 3 — cheap, ~$0.02)
      if (process.env.OPENAI_API_KEY) {
        console.log(`  Running surface metadata extraction...`);
        try {
          await extractBookMetadata(bookId);
          console.log(`  Metadata extraction complete.`);
        } catch (metaErr) {
          console.warn(`  Metadata extraction failed: ${metaErr.message}`);
        }
      }

      book.status = 'ready';
      book.processingProgress = 100;
      book.processingStatus = 'complete';
      book.visionProgress = `${totalPages}/${totalPages} pages`;
      book.readyAt = new Date();
      await book.save();

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
      await ErrorLog.create({ bookId, jobType: 'generate-html', message: err.message, stack: err.stack });
    }
  });

  // ─── REPROCESS VISION (Phase 2: re-run vision on existing book) ─
  agenda.define('reprocess-vision', async (job) => {
    const { bookId } = job.attrs.data;
    const jobDoc = await Job.findOne({ bookId, type: 'reprocess-vision', status: 'pending' });

    if (jobDoc) {
      jobDoc.status = 'running';
      jobDoc.startedAt = new Date();
      await jobDoc.save();
    }

    let pdfTmpPath = null;

    try {
      const book = await Book.findById(bookId);
      if (!book) throw new Error('Book not found');
      if (!isVisionAvailable()) throw new Error('OPENAI_API_KEY not configured');

      book.processingStatus = 'vision-processing';
      await book.save();

      const pages = await Page.find({ bookId }).sort({ pageNumber: 1 });
      const totalPages = pages.length;

      const pdfBuffer = await getPdfBuffer(book.s3Key);
      pdfTmpPath = path.join(os.tmpdir(), `gyde-reprocess-${book._id}.pdf`);
      fs.writeFileSync(pdfTmpPath, pdfBuffer);

      const BATCH = 20;
      let processed = 0;

      for (let i = 0; i < totalPages; i += BATCH) {
        const batch = pages.slice(i, i + BATCH);

        const results = await Promise.all(batch.map(async (page) => {
          const result = await visionProcessWithRetry(pdfTmpPath, page, book._id.toString(), page.pageNumber === 1);
          return { page, ...result };
        }));

        for (const r of results) {
          if (r.html) {
            // Preserve original in legacy (only if empty)
            if (!r.page.rawTextLegacy && r.page.rawText) {
              r.page.rawTextLegacy = r.page.rawText;
            }

            r.page.htmlContent = r.html;
            if (r.chapterTitle) r.page.chapterTitle = r.chapterTitle;
            if (r.sectionTitle) r.page.sectionTitle = r.sectionTitle;
            r.page.hasEquations = true;
            r.page.hasImages = true;
            r.page.visionProcessed = true;
            await r.page.save();

            // Re-map highlights for this page
            await remapHighlights(bookId, r.page.pageNumber, r.page.rawText || '');
          } else if (r.error) {
            r.page.visionProcessed = false;
            await r.page.save();
            console.warn(`  Page ${r.page.pageNumber}: vision reprocess failed — ${r.error}`);
          }
          processed++;
        }

        book.visionProgress = `${processed}/${totalPages} pages`;
        await book.save();
        if (jobDoc) { jobDoc.progress = Math.round((processed / totalPages) * 100); await jobDoc.save(); }
      }

      if (fs.existsSync(pdfTmpPath)) fs.unlinkSync(pdfTmpPath);

      book.processingStatus = 'complete';
      book.visionProgress = `${totalPages}/${totalPages} pages`;
      await book.save();

      if (jobDoc) {
        jobDoc.status = 'done';
        jobDoc.progress = 100;
        jobDoc.completedAt = new Date();
        await jobDoc.save();
      }

    } catch (err) {
      if (pdfTmpPath && fs.existsSync(pdfTmpPath)) {
        try { fs.unlinkSync(pdfTmpPath); } catch(e) {}
      }
      if (jobDoc) {
        jobDoc.status = 'failed';
        jobDoc.error = err.message;
        jobDoc.completedAt = new Date();
        await jobDoc.save();
      }
      await ErrorLog.create({ bookId, jobType: 'reprocess-vision', message: err.message, stack: err.stack });
    }
  });
}

function getAgenda() { return agenda; }

module.exports = { initAgenda, getAgenda };
