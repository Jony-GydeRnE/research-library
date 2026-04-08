const Book = require('../models/Book');

exports.showLibrary = async (req, res) => {
  try {
    const { status, collection } = req.query;
    const filter = {};
    if (status && ['uploading', 'processing', 'ready', 'error'].includes(status)) {
      filter.status = status;
    }
    if (collection) {
      filter.collections = collection;
    }

    const books = await Book.find(filter)
      .sort({ uploadedAt: -1 })
      .lean();

    // Gather unique collections for filter UI
    const allBooks = await Book.find().select('collections').lean();
    const collections = [...new Set(allBooks.flatMap(b => b.collections || []))].sort();

    res.render('library', {
      title: 'Library',
      books,
      collections,
      activeStatus: status || '',
      activeCollection: collection || '',
    });
  } catch (err) {
    console.error('Library error:', err);
    res.render('library', {
      title: 'Library',
      books: [],
      collections: [],
      activeStatus: '',
      activeCollection: '',
    });
  }
};

exports.getBookStatus = async (req, res) => {
  try {
    const books = await Book.find({ status: { $in: ['uploading', 'processing'] } })
      .select('_id status processingProgress title')
      .lean();
    res.json(books);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
