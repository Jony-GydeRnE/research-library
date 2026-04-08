const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema({
  bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book' },
  pageNumber: Number,
  highlightId: { type: mongoose.Schema.Types.ObjectId, ref: 'Highlight' },
  collectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Collection' },
  title: String,
  content: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

noteSchema.index({ bookId: 1 });
noteSchema.index({ collectionId: 1 });

noteSchema.pre('save', function () {
  this.updatedAt = new Date();
});

module.exports = mongoose.model('Note', noteSchema);
