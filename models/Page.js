const mongoose = require('mongoose');

const pageSchema = new mongoose.Schema({
  bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book' },
  pageNumber: Number,
  rawText: String,
  htmlContent: String,
  chapterTitle: String,
  sectionTitle: String,
  hasEquations: Boolean,
  hasImages: Boolean,
  imageS3Keys: [String],
  textItems: [{ x: Number, y: Number, w: Number, h: Number }],
  pdfPageHeight: Number,

  // Phase 2 fields
  rawTextLegacy: String,                    // Original pdf-parse text, preserved for highlight re-mapping
  htmlContentLegacy: String,                // Pre-rewrite HTML, preserved when notesRewrite overwrites htmlContent
  visionProcessed: { type: Boolean, default: false },
  structuralAnnotations: [{                 // Regex-detected signals
    kind: String,                           // "theorem", "definition", "missing_proof", "citation", "equation"
    sentenceRange: [Number],
    value: String,                          // e.g. "it is obvious that" or "[AM, Ch. 3]"
  }],
  topics: [String],
  concepts: [String],
  equations: [String],
  chunkIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Chunk' }],
  spanIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Span' }],
});

pageSchema.index({ bookId: 1, pageNumber: 1 });

module.exports = mongoose.model('Page', pageSchema);
