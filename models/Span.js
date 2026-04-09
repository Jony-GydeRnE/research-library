const mongoose = require('mongoose');

const spanSchema = new mongoose.Schema({
  bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true, index: true },
  pageNumber: { type: Number, required: true },
  chunkId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chunk', default: null },

  // Phase 2 span annotation fields
  sentenceStart: { type: Number, required: true },
  sentenceEnd: { type: Number, required: true },
  contextTags: [String],                    // e.g. ["free_propagator", "definition"]
  declarativeTags: [{
    kind: String,                           // p/a/c/e/r/q/s/k/x/d/v
    targetChunk: Number,
    targetTag: Number,
  }],
  searchClass: {
    type: String,
    enum: ['N', 'L', 'I', 'S', 'B'],
    default: 'N',
  },
  searchConfidence: { type: String, default: null },  // single letter a-z
  resolved: { type: Boolean, default: false },
  resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Edge', default: null },
  regexFlags: [String],                     // e.g. ["missing_proof", "citation:AM_Ch3"]

  // Phase 1 legacy fields (kept for compatibility)
  spanText: String,
  tags: [String],
  startOffset: Number,
  endOffset: Number,

  embedding: [Number],
  createdAt: { type: Date, default: Date.now },
});

spanSchema.index({ bookId: 1, pageNumber: 1 });
spanSchema.index({ chunkId: 1 });

module.exports = mongoose.model('Span', spanSchema);
