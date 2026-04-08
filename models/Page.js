const mongoose = require('mongoose');

const pageSchema = new mongoose.Schema({
  bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book' },
  pageNumber: Number,
  rawText: String,
  htmlContent: String,
  chapterTitle: String,
  sectionTitle: String,
  hasEquations: Boolean,
  hasImages: Boolean,
  imageS3Keys: [String],
  textItems: [{ x: Number, y: Number, w: Number, h: Number }],
  pdfPageHeight: Number
});

pageSchema.index({ bookId: 1, pageNumber: 1 });

module.exports = mongoose.model('Page', pageSchema);
