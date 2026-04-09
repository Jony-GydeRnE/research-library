const fs = require('fs');
const path = require('path');
const multer = require('multer');
const Book = require('../models/Book');
const Collection = require('../models/Collection');
const Page = require('../models/Page');
const Span = require('../models/Span');
const Chunk = require('../models/Chunk');
const Highlight = require('../models/Highlight');
const Note = require('../models/Note');

const COVER_DIR = path.join(__dirname, '..', 'uploads', 'covers');

// Multer for cover uploads
const coverStorage = multer.memoryStorage();
exports.coverUpload = multer({
  storage: coverStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files allowed'));
  },
}).single('cover');

// Upload custom cover for a book
exports.setCover = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image provided' });
    if (!fs.existsSync(COVER_DIR)) fs.mkdirSync(COVER_DIR, { recursive: true });

    const ext = req.file.mimetype.split('/')[1] || 'png';
    const filename = `${req.params.id}.${ext}`;
    const filepath = path.join(COVER_DIR, filename);
    fs.writeFileSync(filepath, req.file.buffer);

    const coverUrl = `/covers/${filename}`;
    await Book.findByIdAndUpdate(req.params.id, { coverUrl });

    res.json({ ok: true, coverUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Copy book to another collection (book stays in current collections too)
exports.copyToCollection = async (req, res) => {
  try {
    const { targetCollectionId } = req.body;
    await Collection.findByIdAndUpdate(targetCollectionId, { $addToSet: { bookIds: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Move book to another collection (remove from current, add to target)
exports.moveToCollection = async (req, res) => {
  try {
    const { fromCollectionId, targetCollectionId } = req.body;
    if (fromCollectionId) {
      await Collection.findByIdAndUpdate(fromCollectionId, { $pull: { bookIds: req.params.id } });
    }
    await Collection.findByIdAndUpdate(targetCollectionId, { $addToSet: { bookIds: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE the book entirely from the library (and all collections, pages, spans, chunks, highlights, notes)
exports.deleteBook = async (req, res) => {
  try {
    const bookId = req.params.id;

    // Remove from all collections
    await Collection.updateMany({}, { $pull: { bookIds: bookId } });

    // Delete all related data
    await Page.deleteMany({ bookId });
    await Span.deleteMany({ bookId });
    await Chunk.deleteMany({ bookId });
    await Highlight.deleteMany({ bookId });
    await Note.deleteMany({ bookId });

    // Delete the book itself
    await Book.findByIdAndDelete(bookId);

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
