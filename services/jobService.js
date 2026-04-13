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

function htmlToPlainText(html) {
  return (html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<figure[\s\S]*?<\/figure>/gi, '')  // strip figure blocks
    .replace(/<img[^>]*>/gi, '')                  // strip images
    .replace(/<[^>]+>/g, '')                      // strip all remaining tags
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')                   // collapse excess newlines
    .trim();
}

async function visionProcessPage(pdfTmpPath, page, bookId, isFirstPage, kind = 'paper') {
  const pageNum = page.pageNumber;
  const pngBuffer = await renderPageToImage(pdfTmpPath, pageNum, bookId);
  let html = await convertPageWithVision(pngBuffer, pageNum, isFirstPage, kind);
  html = await detectAndCropFigures(html, bookId, pageNum);

  const h2 = html.match(/<h2[^>]*>([^<]+)<\/h2>/);
  const h3 = html.match(/<h3[^>]*>([^<]+)<\/h3>/);

  // Extract plain text from vision HTML for rawText
  const plainText = htmlToPlainText(html);

  return { html, plainText, chapterTitle: h2 ? h2[1] : null, sectionTitle: h3 ? h3[1] : null };
}

/**
 * Reconcile-after-vision: make sure every rendered page PNG on disk
 * is represented by a Page document with visionProcessed=true. This
 * is the auto-recovery safety net for the bug we hit on the
 * Lagrangians notes book — the original parallel vision burst
 * saturated gpt-4o TPM, 33 pages returned 429s, the orchestrator
 * moved on without retrying and marked the book "ready" with
 * silent holes in the reader.
 *
 * Runs SERIALLY with a small per-page delay so it's guaranteed to
 * stay under any TPM budget, and uses the existing PNG on disk —
 * no re-rendering.
 *
 * Called at the end of generate-html, immediately before the book
 * is transitioned to status='ready'. Tries up to maxRounds passes;
 * each round picks up whatever is still missing/failed.
 */
async function reconcilePages(book, { maxRounds = 2, delayMs = 800 } = {}) {
  const bookId = book._id.toString();
  const IMAGE_DIR = path.join(__dirname, '..', 'uploads', 'images', bookId);
  if (!fs.existsSync(IMAGE_DIR)) return { repaired: 0, stillMissing: 0 };

  const kind = book.kind || 'paper';
  let repaired = 0;

  for (let round = 0; round < maxRounds; round++) {
    // Find every rendered PNG on disk (page-N.png)
    const pngs = fs.readdirSync(IMAGE_DIR)
      .map(f => f.match(/^page-(\d+)\.png$/))
      .filter(Boolean)
      .map(m => parseInt(m[1], 10))
      .sort((a, b) => a - b);

    if (pngs.length === 0) return { repaired, stillMissing: 0 };

    // Pages that are either (a) entirely absent from the DB, or
    // (b) present but flagged visionProcessed=false.
    const existing = await Page.find(
      { bookId, pageNumber: { $in: pngs } },
      'pageNumber visionProcessed'
    ).lean();
    const okSet = new Set(existing.filter(p => p.visionProcessed).map(p => p.pageNumber));
    const needsFix = pngs.filter(n => !okSet.has(n));

    if (needsFix.length === 0) return { repaired, stillMissing: 0 };

    console.log(`  [reconcile round ${round + 1}] ${needsFix.length} pages need vision — serial retry`);

    for (const pageNum of needsFix) {
      const pngPath = path.join(IMAGE_DIR, `page-${pageNum}.png`);
      try {
        const buf = fs.readFileSync(pngPath);
        const html = await convertPageWithVision(buf, pageNum, pageNum === 1, kind);
        const plainText = htmlToPlainText(html);
        const h2 = html.match(/<h2[^>]*>([^<]+)<\/h2>/);
        const h3 = html.match(/<h3[^>]*>([^<]+)<\/h3>/);

        let pageDoc = await Page.findOne({ bookId, pageNumber: pageNum });
        if (!pageDoc) {
          pageDoc = new Page({ bookId, pageNumber: pageNum });
        }
        if (!pageDoc.rawTextLegacy && pageDoc.rawText) pageDoc.rawTextLegacy = pageDoc.rawText;
        pageDoc.htmlContent = html;
        pageDoc.rawText = plainText;
        if (h2) pageDoc.chapterTitle = h2[1];
        if (h3) pageDoc.sectionTitle = h3[1];
        pageDoc.hasEquations = true;
        pageDoc.hasImages = true;
        pageDoc.visionProcessed = true;
        await pageDoc.save();
        repaired++;
      } catch (err) {
        console.warn(`  [reconcile] page ${pageNum} failed: ${err.message}`);
        await ErrorLog.create({
          bookId, jobType: 'generate-html',
          message: `reconcile page ${pageNum}: ${err.message}`,
        });
      }
      await new Promise(r => setTimeout(r, delayMs));
    }
  }

  // Whatever's still not right after maxRounds.
  const finalPngs = fs.readdirSync(IMAGE_DIR)
    .map(f => f.match(/^page-(\d+)\.png$/)).filter(Boolean).map(m => parseInt(m[1], 10));
  const finalOk = await Page.find(
    { bookId, pageNumber: { $in: finalPngs }, visionProcessed: true },
    'pageNumber'
  ).lean();
  const stillMissing = finalPngs.length - finalOk.length;
  return { repaired, stillMissing };
}

async function visionProcessWithRetry(pdfTmpPath, page, bookId, isFirstPage, kind = 'paper') {
  // Retry up to VISION_MAX_RETRIES times on transient errors. Each
  // retry waits longer (exponential backoff capped at 8s). Hard
  // failures (Swift renderer crash, file not found, etc.) are not
  // retried — they'll fail the same way every time.
  const maxRetries = pipeline.VISION_MAX_RETRIES || 3;
  let lastError = null;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await visionProcessPage(pdfTmpPath, page, bookId, isFirstPage, kind);
    } catch (err) {
      lastError = err;
      // Only retry on rate limits and transient network errors
      const retriable = err.status === 429 || err.status === 503 || err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT';
      if (!retriable) break;
      const delay = Math.min(8000, 1000 * Math.pow(2, attempt));
      await new Promise(r => setTimeout(r, delay));
    }
  }
  return { error: lastError ? lastError.message : 'unknown error' };
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

      const allPages = await Page.find({ bookId }).sort({ pageNumber: 1 });
      const totalPages = allPages.length;
      // Skip already-processed pages on resume — the user's
      // reported case is a sleep-killed job that left half the
      // book mid-vision. Re-running from scratch is wasted work
      // AND wasted dollars.
      const pages = allPages.filter(p => !p.visionProcessed);
      let alreadyDone = totalPages - pages.length;

      const pdfBuffer = await getPdfBuffer(book.s3Key);
      pdfTmpPath = path.join(os.tmpdir(), `gyde-${book._id}.pdf`);
      fs.writeFileSync(pdfTmpPath, pdfBuffer);

      // Process in parallel batches. Bumped from 20 to
      // VISION_BATCH_SIZE (60) for the speed win — most books fit
      // in one batch instead of three sequential ones.
      const BATCH = pipeline.VISION_BATCH_SIZE || 60;
      let processed = alreadyDone;
      let succeeded = alreadyDone;

      const interBatchDelay = pipeline.VISION_BATCH_DELAY_MS || 12000;
      for (let i = 0; i < pages.length; i += BATCH) {
        const batch = pages.slice(i, i + BATCH);

        const results = await Promise.all(batch.map(async (page) => {
          const result = await visionProcessWithRetry(pdfTmpPath, page, book._id.toString(), page.pageNumber === 1, book.kind || 'paper');
          return { page, ...result };
        }));

        for (const r of results) {
          if (r.html) {
            if (!r.page.rawTextLegacy && r.page.rawText) {
              r.page.rawTextLegacy = r.page.rawText;
            }

            r.page.htmlContent = r.html;
            if (r.plainText) r.page.rawText = r.plainText;  // Update rawText from vision
            if (r.chapterTitle) r.page.chapterTitle = r.chapterTitle;
            if (r.sectionTitle) r.page.sectionTitle = r.sectionTitle;
            r.page.hasEquations = true;
            r.page.hasImages = true;
            r.page.visionProcessed = true;
            await r.page.save();
            succeeded++;

            // Update book title from page 1 vision output if better
            if (r.page.pageNumber === 1) {
              const titleMatch = r.html.match(/<h1[^>]*class="paper-title"[^>]*>([^<]+)<\/h1>/);
              if (titleMatch) {
                const visionTitle = titleMatch[1].trim();
                // Update if vision title is cleaner (no garbled chars)
                if (visionTitle.length > 5 && !visionTitle.includes('\ufffd')) {
                  const currentBook = await Book.findById(bookId);
                  if (currentBook) {
                    currentBook.title = visionTitle;
                    await currentBook.save();
                  }
                }
              }
            }
          } else if (r.error) {
            // Vision failed — keep pdf-parse rawText, log error.
            // Don't increment succeeded for failed pages — the
            // visionProgress string should reflect ACTUAL successes
            // not "we tried" so the user can see real progress.
            r.page.visionProcessed = false;
            await r.page.save();
            console.warn(`  Page ${r.page.pageNumber}: vision failed — ${r.error}`);
            await ErrorLog.create({ bookId, jobType: 'generate-html', message: `Page ${r.page.pageNumber}: ${r.error}` });
          }
          processed++;
        }

        book.processingProgress = 25 + Math.round((succeeded / totalPages) * 75);
        book.visionProgress = `${succeeded}/${totalPages} pages`;
        await book.save();
        jobDoc.progress = book.processingProgress;
        await jobDoc.save();

        // Inter-batch pause to keep us under TPM. Without this,
        // the next batch fires immediately and stacks 429s.
        if (i + BATCH < pages.length && interBatchDelay > 0) {
          await new Promise(r => setTimeout(r, interBatchDelay));
        }
      }

      // Clean up temp PDF
      if (fs.existsSync(pdfTmpPath)) fs.unlinkSync(pdfTmpPath);

      // Auto-recovery: reconcile any pages the parallel vision burst
      // dropped (typically due to gpt-4o TPM 429s). Uses existing
      // PNGs on disk — serial retry with a small delay.
      try {
        const rec = await reconcilePages(book);
        if (rec.repaired > 0) console.log(`  [reconcile] repaired ${rec.repaired} page(s); still missing ${rec.stillMissing}`);
      } catch (recErr) {
        console.warn(`  [reconcile] failed: ${recErr.message}`);
      }

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
          const result = await visionProcessWithRetry(pdfTmpPath, page, book._id.toString(), page.pageNumber === 1, book.kind || 'paper');
          return { page, ...result };
        }));

        for (const r of results) {
          if (r.html) {
            // Preserve original in legacy (only if empty)
            if (!r.page.rawTextLegacy && r.page.rawText) {
              r.page.rawTextLegacy = r.page.rawText;
            }

            r.page.htmlContent = r.html;
            if (r.plainText) r.page.rawText = r.plainText;  // Update rawText from vision
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
