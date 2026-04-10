const fs = require('fs');
const path = require('path');
const multer = require('multer');
const Book = require('../models/Book');
const Collection = require('../models/Collection');
const Page = require('../models/Page');
const Span = require('../models/Span');
const Chunk = require('../models/Chunk');
const Edge = require('../models/Edge');
const Highlight = require('../models/Highlight');
const Note = require('../models/Note');

const COVER_DIR = path.join(__dirname, '..', 'uploads', 'covers');

// Multer for cover uploads
const coverStorage = multer.memoryStorage();
exports.coverUpload = multer({
  storage: coverStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files allowed'));
  },
}).single('cover');

// Upload custom cover for a book
exports.setCover = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image provided' });
    if (!fs.existsSync(COVER_DIR)) fs.mkdirSync(COVER_DIR, { recursive: true });

    const ext = req.file.mimetype.split('/')[1] || 'png';
    const filename = `${req.params.id}.${ext}`;
    const filepath = path.join(COVER_DIR, filename);
    fs.writeFileSync(filepath, req.file.buffer);

    const coverUrl = `/covers/${filename}`;
    await Book.findByIdAndUpdate(req.params.id, { coverUrl });

    res.json({ ok: true, coverUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Copy book to another collection (book stays in current collections too)
exports.copyToCollection = async (req, res) => {
  try {
    const { targetCollectionId } = req.body;
    await Collection.findByIdAndUpdate(targetCollectionId, { $addToSet: { bookIds: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Move book to another collection (remove from current, add to target)
exports.moveToCollection = async (req, res) => {
  try {
    const { fromCollectionId, targetCollectionId } = req.body;
    if (fromCollectionId) {
      await Collection.findByIdAndUpdate(fromCollectionId, { $pull: { bookIds: req.params.id } });
    }
    await Collection.findByIdAndUpdate(targetCollectionId, { $addToSet: { bookIds: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── List books ────────────────────────────────────────────────
//
// Lightweight endpoint used by pickers (e.g. "Link to source book").
// Filters by kind and excludes pending-citation stubs and books
// without files. Returns just _id + title + author for the picker UI.

exports.listBooks = async (req, res) => {
  try {
    const filter = { status: { $ne: 'pending-citation' } };
    if (req.query.kind === 'paper') {
      // Include books with kind unset — they pre-date the schema
      // addition and are semantically papers (the default).
      filter.$or = [{ kind: 'paper' }, { kind: { $exists: false } }];
    } else if (req.query.kind) {
      filter.kind = req.query.kind;
    }
    const books = await Book.find(filter)
      .select('_id title author kind')
      .sort({ uploadedAt: -1 })
      .lean();
    res.json(books);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── Notes linking ─────────────────────────────────────────────
//
// "Link to book" kebab action: marks a Book as kind='notes',
// sets linkedBookIds, and runs noteIngestionService to populate
// note-citation Edges. Used for the workflow:
//
//   1. User uploads handwritten notes PDF normally
//   2. Standard pipeline runs (vision → spans → chunks → embeddings)
//   3. User clicks kebab → "Link to book" → picks the source paper
//   4. This endpoint flips kind to 'notes', stores linkedBookIds,
//      and triggers the matching pass
//
// Returns the matching result so the caller can show "created N
// note-citation edges" feedback.

exports.linkBookAsNotes = async (req, res) => {
  try {
    const bookId = req.params.id;
    const { linkedBookIds } = req.body;
    if (!Array.isArray(linkedBookIds) || linkedBookIds.length === 0) {
      return res.status(400).json({ error: 'linkedBookIds required (array of source book ids)' });
    }
    const book = await Book.findByIdAndUpdate(
      bookId,
      { kind: 'notes', linkedBookIds },
      { new: true }
    ).lean();
    if (!book) return res.status(404).json({ error: 'book not found' });

    const { matchNotesToSourceBooks } = require('../services/noteIngestionService');
    const result = await matchNotesToSourceBooks(bookId);
    res.json({ ok: true, book, matching: result });
  } catch (err) {
    console.error('[booksController.linkBookAsNotes]', err);
    res.status(500).json({ error: err.message });
  }
};

// ─── Stats ─────────────────────────────────────────────────────
//
// Per-book stats: counts, distributions, cost estimate, storage.
// Used by the "Info" item in the kebab menu on the All Files /
// collection pages so the user can sense-check ingestion quality
// and rough $ spend per book.
//
// Cost constants are rough — pegged to current GPT-4o pricing and
// the Vision doc's per-book estimates. They'll drift; treat as
// an order-of-magnitude indicator, not an invoice.

const COST_PER_VISION_PAGE = 0.015;     // GPT-4o vision render of one page PNG
const COST_PER_SPAN_PAGE   = 0.005;     // span LLM call per page (avg of full + short prompt)
const COST_PER_METADATA    = 0.01;      // one-shot openai metadata extraction

function summarize(values) {
  if (!values || values.length === 0) return { mean: 0, median: 0, stddev: 0, min: 0, max: 0, n: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const sum = sorted.reduce((a, b) => a + b, 0);
  const mean = sum / n;
  const median = n % 2 === 0 ? (sorted[n/2 - 1] + sorted[n/2]) / 2 : sorted[(n-1)/2];
  const variance = sorted.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
  const stddev = Math.sqrt(variance);
  return { mean, median, stddev, min: sorted[0], max: sorted[n-1], n };
}

exports.getBookStats = async (req, res) => {
  try {
    const bookId = req.params.id;
    const book = await Book.findById(bookId).lean();
    if (!book) return res.status(404).json({ error: 'Book not found' });

    const t0 = Date.now();
    const [pages, chunks, spans, edgesOut, edgesIn] = await Promise.all([
      Page.find({ bookId }).select('pageNumber rawText htmlContent visionProcessed').lean(),
      Chunk.find({ bookId }).select('pageNumber contextTags sourceText').lean(),
      Span.find({ bookId }).select('pageNumber contextTags spanText searchClass role').lean(),
      Edge.find({ fromBookId: bookId }).lean(),
      Edge.find({ toBookId: bookId }).lean(),
    ]);
    const retrievalMs = Date.now() - t0;

    // Distributions per page
    const pagesById = new Map();
    for (const p of pages) pagesById.set(p.pageNumber, p);
    const chunksPerPage = new Map();
    for (const c of chunks) chunksPerPage.set(c.pageNumber, (chunksPerPage.get(c.pageNumber) || 0) + 1);
    const spansPerPage = new Map();
    for (const s of spans) spansPerPage.set(s.pageNumber, (spansPerPage.get(s.pageNumber) || 0) + 1);

    const pageNums = pages.map(p => p.pageNumber);
    const chunksDist = pageNums.map(n => chunksPerPage.get(n) || 0);
    const spansDist  = pageNums.map(n => spansPerPage.get(n) || 0);
    const tagsPerChunk = chunks.map(c => (c.contextTags || []).length);
    const tagsPerSpan  = spans.map(s => (s.contextTags || []).length);

    const visionPages = pages.filter(p => p.visionProcessed).length;

    // Storage: bytes of metadata in MongoDB vs PDF source if available locally
    const metadataBytes =
      Buffer.byteLength(JSON.stringify(pages)) +
      Buffer.byteLength(JSON.stringify(chunks)) +
      Buffer.byteLength(JSON.stringify(spans)) +
      Buffer.byteLength(JSON.stringify(edgesOut.concat(edgesIn))) +
      Buffer.byteLength(JSON.stringify(book));
    // Source content bytes: sum of raw page text. PDF file size if a
    // local copy exists is more accurate, so prefer that.
    let sourceBytes = pages.reduce((s, p) => s + (p.rawText ? Buffer.byteLength(p.rawText) : 0), 0);
    let sourceFromPdf = false;
    if (book.s3Key) {
      const basename = book.s3Key.replace(/^pdfs\//, '');
      const candidates = [
        path.join(__dirname, '..', 'uploads', 'pdfs', basename),
        path.join(__dirname, '..', book.s3Key),
      ];
      for (const c of candidates) {
        if (fs.existsSync(c)) { sourceBytes = fs.statSync(c).size; sourceFromPdf = true; break; }
      }
    }
    const storageRatio = sourceBytes > 0 ? (metadataBytes + sourceBytes) / sourceBytes : null;

    // Cost estimate (rough)
    const visionCost   = visionPages * COST_PER_VISION_PAGE;
    const spanCost     = pages.length * COST_PER_SPAN_PAGE;
    const metadataCost = COST_PER_METADATA;
    const totalCost    = visionCost + spanCost + metadataCost;

    res.json({
      title: book.title,
      author: book.author,
      pageCount: pages.length,
      visionPages,
      chunkCount: chunks.length,
      spanCount: spans.length,
      tagCount: tagsPerChunk.reduce((a, b) => a + b, 0) + tagsPerSpan.reduce((a, b) => a + b, 0),
      edgeCount: { in: edgesIn.length, out: edgesOut.length },
      distributions: {
        chunksPerPage: summarize(chunksDist),
        spansPerPage: summarize(spansDist),
        tagsPerChunk: summarize(tagsPerChunk),
        tagsPerSpan: summarize(tagsPerSpan),
      },
      cost: {
        vision: visionCost,
        spans: spanCost,
        metadata: metadataCost,
        total: totalCost,
      },
      storage: {
        metadataBytes,
        sourceBytes,
        sourceFromPdf,
        ratio: storageRatio, // (metadata + source) / source
      },
      retrievalMs,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE the book entirely from the library (and all collections, pages, spans, chunks, highlights, notes)
exports.deleteBook = async (req, res) => {
  try {
    const bookId = req.params.id;

    // Remove from all collections
    await Collection.updateMany({}, { $pull: { bookIds: bookId } });

    // Delete all related data
    await Page.deleteMany({ bookId });
    await Span.deleteMany({ bookId });
    await Chunk.deleteMany({ bookId });
    await Highlight.deleteMany({ bookId });
    await Note.deleteMany({ bookId });

    // Delete the book itself
    await Book.findByIdAndDelete(bookId);

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
