const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  role: { type: String, enum: ['user', 'assistant'], required: true },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
}, { _id: false });

const chatSchema = new mongoose.Schema({
  title: String,
  messages: [messageSchema],
  collectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Collection' },
  bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book' },
  pageNumber: Number,
  highlightText: String,
  starred: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

chatSchema.index({ collectionId: 1 });
chatSchema.index({ bookId: 1 });
chatSchema.index({ updatedAt: -1 });

chatSchema.pre('save', function () {
  this.updatedAt = new Date();
  if (!this.title && this.messages.length > 0) {
    const first = this.messages[0].content;
    this.title = first.length > 60 ? first.substring(0, 57) + '...' : first;
  }
});

module.exports = mongoose.model('Chat', chatSchema);
