const Highlight = require('../models/Highlight');
const Chat = require('../models/Chat');

exports.saveHighlight = async (req, res) => {
  try {
    const { bookId, pageNumber, startOffset, endOffset, text, color } = req.body;
    const highlight = await Highlight.create({
      bookId, pageNumber, startOffset, endOffset, text,
      color: color || 'yellow',
    });
    res.status(201).json(highlight);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getHighlights = async (req, res) => {
  try {
    const { bookId, pageNumber } = req.params;
    const highlights = await Highlight.find({
      bookId, pageNumber: parseInt(pageNumber, 10),
    }).sort({ startOffset: 1 }).lean();
    res.json(highlights);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getHighlightDetail = async (req, res) => {
  try {
    const highlight = await Highlight.findById(req.params.id).lean();
    if (!highlight) return res.status(404).json({ error: 'Not found' });
    res.json(highlight);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getHighlightChats = async (req, res) => {
  try {
    const highlight = await Highlight.findById(req.params.id).lean();
    if (!highlight) return res.json({ chatIds: [], chats: [] });

    if (highlight.chatIds && highlight.chatIds.length > 0) {
      const chats = await Chat.find({ _id: { $in: highlight.chatIds } })
        .select('_id title updatedAt').sort({ updatedAt: -1 }).lean();
      return res.json({ chatIds: highlight.chatIds, chats });
    }

    res.json({ chatIds: [], chats: [] });
  } catch (err) {
    res.json({ chatIds: [], chats: [] });
  }
};

exports.updateHighlight = async (req, res) => {
  try {
    const { color } = req.body;
    const update = {};
    if (color) update.color = color;
    const highlight = await Highlight.findByIdAndUpdate(req.params.id, update, { new: true }).lean();
    res.json(highlight);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.linkChat = async (req, res) => {
  try {
    const { highlightId, chatId } = req.body;
    await Highlight.findByIdAndUpdate(highlightId, { $addToSet: { chatIds: chatId } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteHighlight = async (req, res) => {
  try {
    await Highlight.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
