const mongoose = require('mongoose');

const qualityScoreSchema = new mongoose.Schema({
  chunkId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chunk' },
  bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book' },
  score: Number,
  judgeModel: String,
  sampledAt: { type: Date, default: Date.now },
  flaggedForReinjection: Boolean
});

qualityScoreSchema.index({ chunkId: 1 });
qualityScoreSchema.index({ bookId: 1 });

module.exports = mongoose.model('QualityScore', qualityScoreSchema);
