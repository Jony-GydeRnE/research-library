const mongoose = require('mongoose');

/**
 * QualitySweepJob — one row per book per sweep run. Holds
 * progress + stats + cost so the stats modal and the CLI can
 * show "Quality sweep: N/M chunks reviewed, K repaired, $X".
 *
 * Owned by services/qualitySweepService.js.
 *
 * Unlike an Agenda job (which lives in the agenda collection),
 * this is OUR audit row — it survives after the Agenda job is
 * deleted and is queryable by book for history.
 */
const statsSubSchema = new mongoose.Schema({
  chunksScanned:              { type: Number, default: 0 },
  pattern1Matched:            { type: Number, default: 0 },
  pattern1Repaired:           { type: Number, default: 0 },
  pattern1Unrepairable:       { type: Number, default: 0 },
  pattern2Matched:            { type: Number, default: 0 },
  pattern2Merged:             { type: Number, default: 0 },
  pattern2Disambiguated:      { type: Number, default: 0 },
  pattern2Review:             { type: Number, default: 0 },
  pattern2Uncertain:          { type: Number, default: 0 },
  pattern3Matched:            { type: Number, default: 0 },
  pattern3Retagged:           { type: Number, default: 0 },
  pattern3RetaggedNoEdges:    { type: Number, default: 0 },
  pattern3ContentFree:        { type: Number, default: 0 },
  edgesCreated:               { type: Number, default: 0 },
  canonicalHits:              { type: Number, default: 0 },
  canonicalMisses:            { type: Number, default: 0 },
  opusInputTokens:            { type: Number, default: 0 },
  opusOutputTokens:           { type: Number, default: 0 },
  estCostUsd:                 { type: Number, default: 0 },
  errorCount:                 { type: Number, default: 0 },
}, { _id: false });

const qualitySweepJobSchema = new mongoose.Schema({
  bookId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Book',
    required: true,
    index: true,
  },
  sweepVersion: { type: Number, required: true },
  status: {
    type: String,
    enum: ['pending', 'running', 'done', 'failed', 'cancelled'],
    default: 'pending',
  },
  startedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
  stats: { type: statsSubSchema, default: () => ({}) },
  error: { type: String, default: null },
  // Free-form notes written by the sweeper for debugging —
  // e.g. "skipped 12 chunks already at version 1", "opus 429
  // at chunk #42 retried successfully".
  log: { type: [String], default: [] },
  createdAt: { type: Date, default: Date.now },
});

qualitySweepJobSchema.index({ bookId: 1, sweepVersion: -1 });
qualitySweepJobSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('QualitySweepJob', qualitySweepJobSchema);
