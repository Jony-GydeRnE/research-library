const Book = require('../models/Book');
const Page = require('../models/Page');
const { getSidebarData } = require('../services/sidebarData');

exports.showReader = async (req, res) => {
  try {
    const { bookId } = req.params;
    const pageNumber =
      parseInt(req.params.pageNumber, 10) ||
      parseInt(req.query.page, 10) ||
      1;

    const book = await Book.findById(bookId).lean();
    if (!book) return res.redirect('/collections');

    const page = await Page.findOne({ bookId, pageNumber }).lean();

    const navPages = await Page.find({ bookId })
      .select('pageNumber chapterTitle sectionTitle')
      .sort({ pageNumber: 1 })
      .lean();

    const toc = [];
    let currentChapter = null;

    for (const p of navPages) {
      if (p.chapterTitle) {
        currentChapter = { title: p.chapterTitle, page: p.pageNumber, sections: [] };
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

    const sidebar = await getSidebarData();

    res.render('reader', {
      title: book.title || 'Reader',
      book,
      page,
      pageNumber,
      toc,
      page_type: 'reader',
      ...sidebar,
    });

  } catch (err) {
    console.error('Reader error:', err);
    res.status(500).send('Error loading reader');
  }
};

exports.getPage = async (req, res) => {
  try {
    const { bookId, pageNumber } = req.params;
    const page = await Page.findOne({ bookId, pageNumber: parseInt(pageNumber, 10) }).lean();
    if (!page) return res.status(404).json({ error: 'Page not found' });
    // Build the served content. Vision-rendered HTML wins when
    // available; otherwise we fall back to a paragraph render of
    // the pdf-parse text so the user can read the page immediately
    // even before vision processing finishes (the upload pipeline
    // can take 10-30 minutes for the full vision pass).
    let html = page.htmlContent;
    let visionPending = false;
    if (!html && (page.rawTextLegacy || page.rawText)) {
      const fallback = page.rawTextLegacy || page.rawText || '';
      const escaped = fallback
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      const paras = escaped.split(/\n\n+/).filter(p => p.trim());
      html = '<div class="page-content vision-pending" data-page-number="' + page.pageNumber + '">'
        + '<div class="vision-pending-banner">'
        + '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>'
        + '<span>Showing fast text extraction. Vision processing in progress — equations and figures will appear as soon as they finish.</span>'
        + '</div>'
        + paras.map(p => '<p>' + p.replace(/\s+/g, ' ').trim() + '</p>').join('')
        + '</div>';
      visionPending = true;
    }
    res.json({
      pageNumber: page.pageNumber,
      htmlContent: html,
      visionPending,
      chapterTitle: page.chapterTitle,
      sectionTitle: page.sectionTitle,
      hasEquations: page.hasEquations,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
