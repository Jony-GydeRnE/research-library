const mongoose = require('mongoose');

const chunkSchema = new mongoose.Schema({
  bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book' },
  pageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Page' },
  pageNumber: Number,
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
  embedding: [Number],
  qualityScore: Number,
  createdAt: { type: Date, default: Date.now }
});

chunkSchema.index({ bookId: 1, pageNumber: 1 });

module.exports = mongoose.model('Chunk', chunkSchema);
