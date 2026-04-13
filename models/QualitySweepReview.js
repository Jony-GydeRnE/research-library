const mongoose = require('mongoose');

/**
 * QualitySweepReview — Pattern 2 merges in the uncertain zone
 * (confidence 0.60-0.85) that need human review before
 * auto-merging. Each row records the two candidate chunks,
 * Opus's verdict, and a status field the user toggles via
 * the stats modal:
 *
 *   pending  — needs review
 *   accepted — user confirmed the merge → the sweeper re-runs
 *              the merge transaction
 *   rejected — user rejected → the sweeper marks the chunks as
 *              pattern-2-uncertain and never re-queues them
 *   expired  — older than N days with no action → auto-
 *              rejected on next sweep
 */
const qualitySweepReviewSchema = new mongoose.Schema({
  bookId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Book',
    required: true,
    index: true,
  },
  sweepVersion: { type: Number, required: true },

  // The two candidate chunks being considered for merge.
  prevChunkId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chunk',
    required: true,
  },
  thisChunkId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chunk',
    required: true,
  },

  // Opus's verdict, verbatim — so the reviewer can see the
  // reasoning that got it into the review queue.
  opusVerdict: {
    decision: { type: String, enum: ['merge', 'disambiguate', 'uncertain'] },
    confidence: { type: Number, default: 0 },
    reasoning: { type: String, default: '' },
    proposedMergedSpans: { type: mongoose.Schema.Types.Mixed, default: null },
  },

  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'expired'],
    default: 'pending',
  },

  createdAt: { type: Date, default: Date.now },
  decidedAt: { type: Date, default: null },
});

qualitySweepReviewSchema.index({ bookId: 1, status: 1 });
qualitySweepReviewSchema.index({ status: 1, createdAt: 1 });

module.exports = mongoose.model('QualitySweepReview', qualitySweepReviewSchema);
