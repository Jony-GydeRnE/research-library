const mongoose = require('mongoose');

const spanSchema = new mongoose.Schema({
  bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true, index: true },
  pageNumber: { type: Number, required: true },
  chunkId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chunk', default: null },

  // Phase 2 span annotation fields
  sentenceStart: { type: Number, required: true },
  sentenceEnd: { type: Number, required: true },
  contextTags: [String],                    // e.g. ["free_propagator", "amplitude_zeros"]
  role: String,                             // claim, background, result, proof, citation, definition, etc.
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
  // gapType is set ONLY when searchClass='L'. Identifies which
  // KIND of logical gap the span flagged so the matcher can pull
  // notes / cited papers that fill the right kind of hole.
  // Format set by the span-generation prompt:
  //   'definition' (Ld): a term used without being defined
  //   'derivation' (Lv): a result stated without showing the steps
  //   'proof'      (Lp): an assertion without a proof
  // Legacy `Lt` (L with confidence letter) parses to gapType=null
  // and the confidence in searchConfidence — kept for backward
  // compatibility with pre-2026-04-12 spans.
  gapType: { type: String, default: null },
  resolved: { type: Boolean, default: false },
  resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Edge', default: null },
  regexFlags: [String],                     // e.g. ["missing_proof", "citation:AM_Ch3"]

  // Phase 1 legacy fields (kept for compatibility)
  spanText: String,
  tags: [String],
  startOffset: Number,
  endOffset: Number,

  embedding: [Number],

  // ─── Quality sweep bookkeeping (2026-04-12) ────────────
  // Same shape as Chunk.quality* fields. 'replaced' means
  // this span was decomposed into multiple new spans by
  // Pattern 1; readers should resolveSpanId() through
  // replacedBy[] to reach a canonical replacement.
  qualitySweepAt: { type: Date, default: null },
  qualitySweepVersion: { type: Number, default: 0 },
  qualityRepairStatus: {
    type: String,
    enum: ['untouched', 'repaired', 'replaced', 'error'],
    default: 'untouched',
  },
  replacedBy: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: 'Span',
    default: [],
  },

  createdAt: { type: Date, default: Date.now },
});

spanSchema.index({ bookId: 1, pageNumber: 1 });
spanSchema.index({ chunkId: 1 });

module.exports = mongoose.model('Span', spanSchema);
