(() => {
  const R = window.__READER__;
  const content = document.getElementById('readerContent');
  const scrollContent = document.getElementById('readerScrollContent');
  const originalView = document.getElementById('readerOriginal');
  const originalImg = document.getElementById('originalPageImg');
  const currentPageNum = document.getElementById('currentPageNum');
  const pageIndicator = document.getElementById('pageIndicator');
  const headerPrevBtn = document.getElementById('headerPrevBtn');
  const headerNextBtn = document.getElementById('headerNextBtn');
  const pageJump = document.getElementById('pageJump');
  const readerMain = document.getElementById('readerMain');
  const modePagesBtn = document.getElementById('modePagesBtn');
  const modeScrollBtn = document.getElementById('modeScrollBtn');
  const modePdfBtn = document.getElementById('modePdfBtn');

  let mode = localStorage.getItem('gyde-reader-mode') || 'pages';
  let scrollLoaded = false;

  // ─── MODE TOGGLE ───────────────────────────────────────────────

  function setMode(newMode) {
    mode = newMode;
    localStorage.setItem('gyde-reader-mode', mode);

    [modePagesBtn, modeScrollBtn, modePdfBtn].forEach(b => b.classList.remove('active'));
    content.style.display = 'none';
    scrollContent.style.display = 'none';
    originalView.style.display = 'none';

    if (mode === 'pages') {
      modePagesBtn.classList.add('active');
      content.style.display = '';
      pageIndicator.style.display = '';
      headerPrevBtn.style.display = '';
      headerNextBtn.style.display = '';
    } else if (mode === 'scroll') {
      modeScrollBtn.classList.add('active');
      scrollContent.style.display = '';
      pageIndicator.style.display = 'none';
      headerPrevBtn.style.display = 'none';
      headerNextBtn.style.display = 'none';
      if (!scrollLoaded) loadAllPages();
    } else if (mode === 'pdf') {
      modePdfBtn.classList.add('active');
      originalView.style.display = '';
      originalImg.src = `/images/${R.bookId}/page-${R.currentPage}.png`;
      pageIndicator.style.display = '';
      headerPrevBtn.style.display = '';
      headerNextBtn.style.display = '';
    }

    updateArrowState();
  }

  function updateArrowState() {
    headerPrevBtn.disabled = R.currentPage <= 1;
    headerNextBtn.disabled = R.currentPage >= R.totalPages;
  }

  modePagesBtn.addEventListener('click', () => setMode('pages'));
  modeScrollBtn.addEventListener('click', () => setMode('scroll'));
  modePdfBtn.addEventListener('click', () => setMode('pdf'));
  setMode(mode);

  // ─── LOAD ALL PAGES (scroll) ───────────────────────────────────

  async function loadAllPages() {
    scrollLoaded = true;
    scrollContent.innerHTML = '<div class="scroll-loading">Loading all pages...</div>';

    const pages = [];
    for (let i = 1; i <= R.totalPages; i++) {
      try {
        const res = await fetch(`/reader/${R.bookId}/api/page/${i}`);
        pages.push(await res.json());
      } catch (e) {
        pages.push({ pageNumber: i, htmlContent: '<div class="page-content"><p class="empty-page">Failed to load page ' + i + '</p></div>' });
      }
    }

    scrollContent.innerHTML = '';
    pages.forEach(p => {
      const s = document.createElement('div');
      s.className = 'scroll-page-section';
      s.id = `scroll-page-${p.pageNumber}`;
      s.innerHTML = `<div class="scroll-page-number">Page ${p.pageNumber}</div>${p.htmlContent}`;
      scrollContent.appendChild(s);
    });

    if (window.MathJax && MathJax.typesetPromise) {
      MathJax.typesetPromise([scrollContent]).then(() => fixMathJaxErrors()).catch(() => {});
    }
  }

  // ─── PAGE NAVIGATION ──────────────────────────────────────────

  async function goToPage(num) {
    num = Math.max(1, Math.min(num, R.totalPages));
    if (num === R.currentPage && mode !== 'scroll') return;

    if (mode === 'scroll') {
      const el = document.getElementById(`scroll-page-${num}`);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
      R.currentPage = num;
      return;
    }

    try {
      const res = await fetch(`/reader/${R.bookId}/api/page/${num}`);
      if (!res.ok) throw new Error('Page not found');
      const data = await res.json();

      R.currentPage = num;
      currentPageNum.textContent = num;
      pageJump.value = num;
      updateArrowState();

      if (mode === 'pages') {
        content.innerHTML = data.htmlContent || '<div class="page-content"><p class="empty-page">No content.</p></div>';
        if (window.MathJax && MathJax.typesetPromise) {
          MathJax.typesetPromise([content]).then(() => fixMathJaxErrors()).catch(() => {});
        }
      } else if (mode === 'pdf') {
        originalImg.src = `/images/${R.bookId}/page-${num}.png`;
      }

      document.querySelectorAll('.toc-link.active, .page-link.active').forEach(el => el.classList.remove('active'));
      const activeLink = document.querySelector(`[data-page="${num}"]`);
      if (activeLink) activeLink.classList.add('active');

      saveBookmark(num);
      readerMain.scrollTop = 0;
      history.replaceState(null, '', `/reader/${R.bookId}/page/${num}`);

      // Reload highlights for new page
      if (window.__readerAfterPageLoad) window.__readerAfterPageLoad();
    } catch (err) {
      console.error('Failed to load page:', err);
    }
  }

  function fixMathJaxErrors() {
    document.querySelectorAll('mjx-container[data-mjx-error]').forEach(el => {
      const fb = document.createElement('span');
      fb.className = 'mathjax-fallback';
      fb.textContent = '[equation \u2014 view original]';
      fb.style.cssText = 'color:var(--r-text-muted);cursor:pointer;font-style:italic;font-size:0.85em;';
      fb.addEventListener('click', () => setMode('pdf'));
      el.replaceWith(fb);
    });
  }

  headerPrevBtn.addEventListener('click', () => goToPage(R.currentPage - 1));
  headerNextBtn.addEventListener('click', () => goToPage(R.currentPage + 1));

  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); goToPage(R.currentPage - 1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); goToPage(R.currentPage + 1); }
  });

  document.querySelectorAll('.toc-link, .page-link').forEach(link => {
    link.addEventListener('click', (e) => { e.preventDefault(); goToPage(parseInt(link.dataset.page, 10)); });
  });

  // ─── BOOKMARK ──────────────────────────────────────────────────

  function saveBookmark(pg) {
    localStorage.setItem(`gyde-bookmark-${R.bookId}`, JSON.stringify({ page: pg, timestamp: Date.now() }));
  }
  saveBookmark(R.currentPage);
})();
