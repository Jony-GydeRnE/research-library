const Book = require('../models/Book');
const Page = require('../models/Page');

exports.showReader = async (req, res) => {
  try {
    const { bookId } = req.params;
    const pageNumber = parseInt(req.params.pageNumber, 10) || 1;

    const book = await Book.findById(bookId).lean();
    if (!book) {
      return res.status(404).render('library', {
        title: 'Library',
        books: [],
        collections: [],
        activeStatus: '',
        activeCollection: '',
      });
    }

    // Get the requested page
    const page = await Page.findOne({ bookId, pageNumber }).lean();

    // Build chapter navigation: all pages that have a chapter or section title
    const navPages = await Page.find({ bookId })
      .select('pageNumber chapterTitle sectionTitle')
      .sort({ pageNumber: 1 })
      .lean();

    // Build structured TOC
    const toc = [];
    let currentChapter = null;

    for (const p of navPages) {
      if (p.chapterTitle) {
        currentChapter = {
          title: p.chapterTitle,
          page: p.pageNumber,
          sections: [],
        };
        toc.push(currentChapter);
      }
      if (p.sectionTitle) {
        const section = { title: p.sectionTitle, page: p.pageNumber };
        if (currentChapter) {
          currentChapter.sections.push(section);
        } else {
          toc.push({ title: p.sectionTitle, page: p.pageNumber, sections: [] });
        }
      }
    }

    res.render('reader', {
      title: book.title || 'Reader',
      book,
      page,
      pageNumber,
      toc,
    });

  } catch (err) {
    console.error('Reader error:', err);
    res.status(500).send('Error loading reader');
  }
};

// API: get page content as JSON (for client-side page navigation without reload)
exports.getPage = async (req, res) => {
  try {
    const { bookId, pageNumber } = req.params;
    const page = await Page.findOne({
      bookId,
      pageNumber: parseInt(pageNumber, 10),
    }).lean();

    if (!page) {
      return res.status(404).json({ error: 'Page not found' });
    }

    res.json({
      pageNumber: page.pageNumber,
      htmlContent: page.htmlContent,
      chapterTitle: page.chapterTitle,
      sectionTitle: page.sectionTitle,
      hasEquations: page.hasEquations,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
