const Highlight = require('../models/Highlight');

exports.saveHighlight = async (req, res) => {
  try {
    const { bookId, pageNumber, startOffset, endOffset, text, color } = req.body;
    const highlight = await Highlight.create({
      bookId,
      pageNumber,
      startOffset,
      endOffset,
      text,
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
      bookId,
      pageNumber: parseInt(pageNumber, 10),
    }).sort({ startOffset: 1 }).lean();
    res.json(highlights);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getHighlightChat = async (req, res) => {
  try {
    const highlight = await Highlight.findById(req.params.id).lean();
    if (!highlight) return res.json({ chatId: null });
    res.json({ chatId: highlight.chatId || null });
  } catch (err) {
    res.json({ chatId: null });
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
