const mongoose = require('mongoose');

const qualityScoreSchema = new mongoose.Schema({
  bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true },
  chunkId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chunk' },
  score: { type: Number, min: 0, max: 9, required: true },

  // Phase 2 fields
  sessionId: String,
  modelUsed: String,
  judgeModelUsed: String,
  triggeredReset: { type: Boolean, default: false },

  // Phase 1 legacy fields
  judgeModel: String,
  sampledAt: { type: Date, default: Date.now },
  flaggedForReinjection: Boolean,

  createdAt: { type: Date, default: Date.now },
});

qualityScoreSchema.index({ chunkId: 1 });
qualityScoreSchema.index({ bookId: 1 });

module.exports = mongoose.model('QualityScore', qualityScoreSchema);
