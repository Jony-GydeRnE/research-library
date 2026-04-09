const Collection = require('../models/Collection');
const Book = require('../models/Book');
const Chat = require('../models/Chat');
const { getSidebarData } = require('../services/sidebarData');

exports.listCollections = async (req, res) => {
  try {
    let collections = await Collection.find().sort({ updatedAt: -1 }).lean();
    collections.sort((a, b) => {
      if (a.title === 'All Books') return -1;
      if (b.title === 'All Books') return 1;
      return new Date(b.updatedAt) - new Date(a.updatedAt);
    });
    const allBooks = await Book.find().sort({ uploadedAt: -1 }).lean();

    if (collections.length === 0) {
      const defaultCol = await Collection.create({
        title: 'All Books',
        bookIds: allBooks.map(b => b._id),
      });
      collections = [defaultCol.toObject()];
    }

    // Load chats for each collection
    for (const col of collections) {
      col.chats = await Chat.find({ collectionId: col._id }).sort({ updatedAt: -1 }).limit(10).lean();
    }

    const active = collections[0];
    const books = await Book.find({ _id: { $in: active.bookIds } }).lean();
    const orphanChats = await Chat.find({ collectionId: null }).sort({ updatedAt: -1 }).limit(20).lean();

    res.render('collections', {
      title: active.title,
      collections,
      activeCollection: active,
      books,
      orphanChats,
      page: 'collections',
    });
  } catch (err) {
    console.error('Collections error:', err);
    res.status(500).send('Error loading collections');
  }
};

exports.showCollection = async (req, res) => {
  try {
    let collections = await Collection.find().sort({ updatedAt: -1 }).lean();
    collections.sort((a, b) => {
      if (a.title === 'All Books') return -1;
      if (b.title === 'All Books') return 1;
      return new Date(b.updatedAt) - new Date(a.updatedAt);
    });
    const collection = await Collection.findById(req.params.id).lean();
    if (!collection) return res.redirect('/collections');

    for (const col of collections) {
      col.chats = await Chat.find({ collectionId: col._id }).sort({ updatedAt: -1 }).limit(10).lean();
    }

    const books = await Book.find({ _id: { $in: collection.bookIds } }).lean();
    collection.chats = await Chat.find({ collectionId: collection._id }).sort({ updatedAt: -1 }).lean();
    const orphanChats = await Chat.find({ collectionId: null }).sort({ updatedAt: -1 }).limit(20).lean();

    res.render('collections', {
      title: collection.title,
      collections,
      activeCollection: collection,
      books,
      orphanChats,
      page: 'collections',
    });
  } catch (err) {
    console.error('Collection detail error:', err);
    res.status(500).send('Error loading collection');
  }
};

exports.createCollection = async (req, res) => {
  try {
    const { title, color } = req.body;
    const collection = await Collection.create({ title: title || 'Untitled Collection', color });
    res.status(201).json(collection);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateCollection = async (req, res) => {
  try {
    const { title, description, instructions, color, bookIds } = req.body;
    const update = {};
    if (title !== undefined) update.title = title;
    if (description !== undefined) update.description = description;
    if (instructions !== undefined) update.instructions = instructions;
    if (color !== undefined) update.color = color;
    if (bookIds !== undefined) update.bookIds = bookIds;
    const collection = await Collection.findByIdAndUpdate(req.params.id, update, { new: true }).lean();
    res.json(collection);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.addBookToCollection = async (req, res) => {
  try {
    const { bookId } = req.body;
    await Collection.findByIdAndUpdate(req.params.id, { $addToSet: { bookIds: bookId } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Remove a book from this collection only (does not delete the book)
exports.removeBookFromCollection = async (req, res) => {
  try {
    const { bookId } = req.body;
    await Collection.findByIdAndUpdate(req.params.id, { $pull: { bookIds: bookId } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// List all collections (for picker UIs)
exports.listAll = async (req, res) => {
  try {
    const cols = await Collection.find().select('_id title color').sort({ title: 1 }).lean();
    res.json(cols);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
