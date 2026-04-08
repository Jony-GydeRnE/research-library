const Note = require('../models/Note');
const Highlight = require('../models/Highlight');

exports.saveNote = async (req, res) => {
  try {
    const { bookId, pageNumber, highlightId, content, title } = req.body;
    const note = await Note.create({
      bookId, pageNumber, highlightId,
      content, title: title || 'Untitled Note',
    });

    // Link note to highlight if provided
    if (highlightId) {
      await Highlight.findByIdAndUpdate(highlightId, { $addToSet: { noteIds: note._id } });
    }

    res.status(201).json(note);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateNote = async (req, res) => {
  try {
    const { content, title } = req.body;
    const update = {};
    if (content !== undefined) update.content = content;
    if (title !== undefined) update.title = title;
    const note = await Note.findByIdAndUpdate(req.params.id, update, { new: true }).lean();
    res.json(note);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getNotesForBook = async (req, res) => {
  try {
    const notes = await Note.find({ bookId: req.params.bookId })
      .sort({ createdAt: -1 }).lean();
    res.json(notes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getNote = async (req, res) => {
  try {
    const note = await Note.findById(req.params.id).lean();
    if (!note) return res.status(404).json({ error: 'Not found' });
    res.json(note);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteNote = async (req, res) => {
  try {
    await Note.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
