const mongoose = require('mongoose');

const errorLogSchema = new mongoose.Schema({
  bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book' },
  jobType: String,
  message: String,
  stack: String,
  createdAt: { type: Date, default: Date.now }
});

errorLogSchema.index({ bookId: 1 });

module.exports = mongoose.model('ErrorLog', errorLogSchema);
