const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema({
  title: String,
  author: String,
  isbn: String,
  fileHash: String,
  s3Key: String,
  coverUrl: String,
  pageCount: Number,
  status: {
    type: String,
    enum: ['uploading', 'processing', 'ready', 'error'],
    default: 'uploading'
  },
  processingProgress: { type: Number, default: 0 },
  uploadedAt: { type: Date, default: Date.now },
  readyAt: Date,
  collections: [String],
  tags: [String]
});

bookSchema.index({ isbn: 1 });
bookSchema.index({ fileHash: 1 });
bookSchema.index({ status: 1 });

module.exports = mongoose.model('Book', bookSchema);
