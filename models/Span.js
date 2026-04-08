const mongoose = require('mongoose');

const spanSchema = new mongoose.Schema({
  chunkId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chunk' },
  bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book' },
  pageNumber: Number,
  spanText: String,
  tags: [String],
  startOffset: Number,
  endOffset: Number,
  embedding: [Number],
  createdAt: { type: Date, default: Date.now }
});

spanSchema.index({ chunkId: 1 });
spanSchema.index({ bookId: 1 });

module.exports = mongoose.model('Span', spanSchema);
