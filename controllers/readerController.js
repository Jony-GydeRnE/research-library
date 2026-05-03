const Book = require('../models/Book');
const Page = require('../models/Page');
const { getSidebarData } = require('../services/sidebarData');
const { getPageChunkView } = require('../services/chunkViewService');

exports.showReader = async (req, res) => {
  try {
    const { bookId } = req.params;
    const pageNumber =
      parseInt(req.params.pageNumber, 10) ||
      parseInt(req.query.page, 10) ||
      1;

    // Reject obviously malformed ids early to avoid a Mongoose CastError
    // (which would 500 the page). Mongo ObjectIds are 24 hex chars.
    const looksLikeObjectId = /^[a-f0-9]{24}$/i.test(String(bookId || ''));
    const book = looksLikeObjectId ? await Book.findById(bookId).lean() : null;
    if (!book) {
      // Used to redirect to /collections, which dumped the user into the
      // All Books grid (and, when loaded inside the chat-split iframe,
      // surfaced an "Instructions" column that has nothing to do with
      // the cited book). Render a focused "not found" view instead so
      // the popup stays scoped to the citation.
      return res.status(404).send(`<!doctype html>
<html><head><meta charset="utf-8">
<title>Book not found</title>
<style>
  body { margin:0; background:#1a1a1a; color:#ddd; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; height:100vh; display:flex; align-items:center; justify-content:center; padding:1.5rem; box-sizing:border-box; }
  .card { max-width:420px; text-align:center; }
  h1 { font-size:1.05rem; margin:0 0 0.5rem; color:#fff; }
  p { font-size:0.85rem; line-height:1.5; margin:0.4rem 0; color:#aaa; }
  code { font-size:0.75rem; background:rgba(255,255,255,0.06); padding:0.15rem 0.35rem; border-radius:3px; color:#d8b06b; word-break:break-all; }
</style>
</head><body>
  <div class="card">
    <h1>Book not found</h1>
    <p>This citation points to a book that is not in your library.</p>
    <p>id: <code>${String(bookId).replace(/[<>&"']/g, c => ({ '<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;' }[c]))}</code></p>
  </div>
</body></html>`);
    }

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

// Chunks view: returns the metadata-forward representation of
// one page (chunks, spans, tags, edges ranked by confidence).
// Consumed by public/js/chunks-view.js for the "Chunks" reader mode.
exports.getPageChunks = async (req, res) => {
  try {
    const { bookId, pageNumber } = req.params;
    const view = await getPageChunkView(bookId, parseInt(pageNumber, 10));
    res.json(view);
  } catch (err) {
    console.error('getPageChunks error:', err);
    res.status(500).json({ error: err.message });
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
