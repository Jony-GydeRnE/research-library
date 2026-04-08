const Book = require('../models/Book');
const { getSidebarData } = require('../services/sidebarData');

exports.showLibrary = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status && ['uploading', 'processing', 'ready', 'error'].includes(status)) {
      filter.status = status;
    }

    const books = await Book.find(filter).sort({ uploadedAt: -1 }).lean();
    const sidebar = await getSidebarData();

    res.render('library', {
      title: 'Library',
      books,
      activeStatus: status || '',
      page: 'library',
      ...sidebar,
    });
  } catch (err) {
    console.error('Library error:', err);
    res.render('library', {
      title: 'Library',
      books: [],
      activeStatus: '',
      page: 'library',
      collections: [],
      orphanChats: [],
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
