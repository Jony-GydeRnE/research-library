const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book' },
  type: {
    type: String,
    enum: ['extract-pdf', 'generate-html', 'generate-metadata',
           'resolve-edges-local', 'resolve-edges-cross']
  },
  status: {
    type: String,
    enum: ['pending', 'running', 'done', 'failed'],
    default: 'pending'
  },
  progress: { type: Number, default: 0 },
  error: String,
  startedAt: Date,
  completedAt: Date,
  createdAt: { type: Date, default: Date.now }
});

jobSchema.index({ bookId: 1 });
jobSchema.index({ status: 1 });

module.exports = mongoose.model('Job', jobSchema);
