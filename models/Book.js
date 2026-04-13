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
    // 'pending-citation' = stub Book record created from a bib entry
    //   in another book that referenced an arxivId/DOI we don't yet
    //   own. Has identifier metadata but no file, no pages, no
    //   chunks. When the real PDF gets uploaded later, the stub is
    //   "promoted" to status='processing'/'ready' and any edges
    //   pointing at the stub auto-resolve to the real chunks.
    enum: ['uploading', 'processing', 'ready', 'error', 'pending-citation'],
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

  // ─── Notes-as-books support ────────────────────────────────────
  // A Book is either a normal paper/book ('paper') or a personal
  // notes PDF that annotates one or more papers ('notes'). Notes
  // PDFs go through the SAME ingestion pipeline (vision → spans →
  // chunks → embeddings → bibliography) so the only difference is
  // a flag and the optional linkedBookIds list. After processing,
  // noteIngestionService matches each note chunk against the linked
  // source books' chunks and creates 'note-citation' Edges that
  // light up in the source-book reader as note-anchored highlights.
  kind: {
    type: String,
    enum: ['paper', 'notes'],
    default: 'paper',
  },
  // Source books these notes annotate. Empty for ordinary papers.
  // Populated either at upload time (?linkedBookId=...) or later
  // via the "Link to book" kebab action on a notes-kind book.
  linkedBookIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Book' }],

  // ─── Quality sweep bookkeeping (2026-04-12) ────────────
  qualitySweepAt: { type: Date, default: null },
  qualitySweepVersion: { type: Number, default: 0 },
  // Concept tags the canonical-definition lookup couldn't
  // resolve during Pattern 1 / Pattern 3 repairs. This is the
  // crawler's target queue: "ingest a paper that defines these".
  missingDefinitions: { type: [String], default: [] },
});

bookSchema.index({ arxivId: 1 });
bookSchema.index({ doi: 1 });

bookSchema.index({ isbn: 1 });
bookSchema.index({ fileHash: 1 });
bookSchema.index({ status: 1 });

module.exports = mongoose.model('Book', bookSchema);
