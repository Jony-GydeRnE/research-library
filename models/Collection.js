const mongoose = require('mongoose');

const collectionSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  instructions: String,
  bookIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Book' }],
  chatIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Chat' }],
  color: { type: String, default: '#2d5a7b' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

collectionSchema.pre('save', function () {
  this.updatedAt = new Date();
});

module.exports = mongoose.model('Collection', collectionSchema);
