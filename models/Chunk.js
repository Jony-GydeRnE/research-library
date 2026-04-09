const mongoose = require('mongoose');

const chunkSchema = new mongoose.Schema({
  bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true, index: true },
  pageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Page' },
  pageNumber: Number,

  // Phase 1 legacy fields (kept for compatibility)
  rawText: String,
  summary: String,
  chunkType: {
    type: String,
    enum: ['definition', 'theorem', 'proof', 'derivation', 'example',
           'assumption', 'remark', 'equation', 'exposition', 'unknown']
  },
  subjectTags: [String],
  conceptTags: [String],
  hasMissingProof: Boolean,
  operatorSignature: String,
  qualityScore: Number,

  // Phase 2 fields
  chapterNumber: Number,
  sectionTitle: String,
  chunkIndex: { type: Number },             // sequential within book
  sentenceStart: Number,
  sentenceEnd: Number,
  spanIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Span' }],
  structuralType: {
    type: String,
    enum: ['theorem', 'definition', 'proof', 'example', 'remark',
           'narrative', 'notation', 'equation', 'unknown']
  },
  contextTags: [String],                    // union of all span context tags
  searchClasses: [String],                  // union of search-class tags from spans
  hasUnresolvedSpans: { type: Boolean, default: false },
  nextChunkId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chunk' },
  prevChunkId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chunk' },
  embedding: [Number],
  wordCount: Number,
  sourceText: String,                       // the actual text this chunk covers

  createdAt: { type: Date, default: Date.now },
});

chunkSchema.index({ bookId: 1, pageNumber: 1 });
chunkSchema.index({ bookId: 1, chunkIndex: 1 });

module.exports = mongoose.model('Chunk', chunkSchema);
