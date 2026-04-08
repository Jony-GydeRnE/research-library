const mongoose = require('mongoose');

const highlightSchema = new mongoose.Schema({
  bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true },
  pageNumber: { type: Number, required: true },
  startOffset: Number,
  endOffset: Number,
  text: String,
  noteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Note' },
  chatIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Chat' }],
  color: { type: String, default: 'yellow' },
  createdAt: { type: Date, default: Date.now },
});

highlightSchema.index({ bookId: 1, pageNumber: 1 });

module.exports = mongoose.model('Highlight', highlightSchema);
