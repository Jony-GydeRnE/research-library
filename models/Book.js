const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema({
  title: String,
  author: String,
  isbn: String,
  fileHash: String,
  s3Key: String,
  coverUrl: String,
  pageCount: Number,
  status: {
    type: String,
    enum: ['uploading', 'processing', 'ready', 'error'],
    default: 'uploading'
  },
  processingProgress: { type: Number, default: 0 },
  processingStatus: { type: String, default: '' },   // e.g. "vision-processing", "complete"
  visionProgress: { type: String, default: '' },      // e.g. "12/35 pages"
  uploadedAt: { type: Date, default: Date.now },
  readyAt: Date,
  collections: [String],
  tags: [String],
  keyConcepts: [String],
  summary: String,
  chapterSummaries: [{ chapter: String, summary: String, pageStart: Number }],
  academicLevel: String,
  documentType: String,

  // ─── Phase 3: Edge graph foundations ───────────────────────────
  // arXiv identifier extracted from the first two pages during
  // bibliography processing. Stored normalized to the canonical
  // form (no version suffix, no leading "arXiv:"). Used for fast
  // exact matching when resolving citations from another book in
  // the library.
  arxivId: String,
  // DOI extracted from the same scan (rare in physics papers but
  // common in math/CS). Same normalization rules.
  doi: String,
  // Parsed bibliography entries for this book. Populated by
  // bibliographyService. Each entry stores the raw text plus the
  // parsed key, authors, year, and arXiv/DOI identifiers — and a
  // resolvedBookId pointing to the matched Book in the library
  // (null until library matching runs).
  bibEntries: [{
    key: String,        // "[15]" → "15"
    rawText: String,    // the full reference line
    authors: String,    // best-effort author list
    year: Number,
    arxivId: String,    // normalized
    doi: String,        // normalized
    resolvedBookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book' },
  }],
});

bookSchema.index({ arxivId: 1 });
bookSchema.index({ doi: 1 });

bookSchema.index({ isbn: 1 });
bookSchema.index({ fileHash: 1 });
bookSchema.index({ status: 1 });

module.exports = mongoose.model('Book', bookSchema);
