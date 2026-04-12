const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  role: { type: String, enum: ['user', 'assistant'], required: true },
  // Mixed so tool-use turns can hold Anthropic block arrays
  // (tool_use / tool_result blocks) alongside plain-text turns.
  // kind='text' → content is a String (the normal chat case).
  // kind='tool' → content is an array of Anthropic content blocks,
  //               persisted so the next tool-use turn on this chat
  //               can replay the prior traversal history. These
  //               turns are filtered out of the UI render in
  //               views/chat.ejs and of any assistant-text JSON
  //               passed to the client.
  content: { type: mongoose.Schema.Types.Mixed, required: true },
  kind: { type: String, enum: ['text', 'tool'], default: 'text' },
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
