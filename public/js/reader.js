(() => {
  const R = window.__READER__;
  const content = document.getElementById('readerContent');
  const scrollContent = document.getElementById('readerScrollContent');
  const originalView = document.getElementById('readerOriginal');
  const originalImg = document.getElementById('originalPageImg');
  const currentPageNum = document.getElementById('currentPageNum');
  const pageIndicator = document.getElementById('pageIndicator');
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  const pageJump = document.getElementById('pageJump');
  const pageNav = document.getElementById('readerPageNav');
  const readerMain = document.getElementById('readerMain');
  const themeToggle = document.getElementById('themeToggle');
  const modePagesBtn = document.getElementById('modePagesBtn');
  const modeScrollBtn = document.getElementById('modeScrollBtn');
  const modePdfBtn = document.getElementById('modePdfBtn');

  let mode = localStorage.getItem('gyde-reader-mode') || 'pages';
  let scrollLoaded = false;

  // ─── MODE TOGGLE (Pages / Scroll / PDF) ────────────────────────

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
      pageNav.style.display = '';
      pageIndicator.style.display = '';
    } else if (mode === 'scroll') {
      modeScrollBtn.classList.add('active');
      scrollContent.style.display = '';
      pageNav.style.display = 'none';
      pageIndicator.style.display = 'none';
      if (!scrollLoaded) loadAllPages();
    } else if (mode === 'pdf') {
      modePdfBtn.classList.add('active');
      originalView.style.display = '';
      originalImg.src = `/images/${R.bookId}/page-${R.currentPage}.png`;
      pageNav.style.display = '';
      pageIndicator.style.display = '';
    }
  }

  modePagesBtn.addEventListener('click', () => setMode('pages'));
  modeScrollBtn.addEventListener('click', () => setMode('scroll'));
  modePdfBtn.addEventListener('click', () => setMode('pdf'));

  // Init
  setMode(mode);

  // ─── LOAD ALL PAGES (scroll mode) ─────────────────────────────

  async function loadAllPages() {
    scrollLoaded = true;
    scrollContent.innerHTML = '<div class="scroll-loading">Loading all pages...</div>';

    const pages = [];
    for (let i = 1; i <= R.totalPages; i++) {
      try {
        const res = await fetch(`/reader/${R.bookId}/api/page/${i}`);
        const data = await res.json();
        pages.push(data);
      } catch (e) {
        pages.push({ pageNumber: i, htmlContent: '<div class="page-content"><p class="empty-page">Failed to load page ' + i + '</p></div>' });
      }
    }

    scrollContent.innerHTML = '';
    pages.forEach(p => {
      const section = document.createElement('div');
      section.className = 'scroll-page-section';
      section.id = `scroll-page-${p.pageNumber}`;
      section.innerHTML = `<div class="scroll-page-number">Page ${p.pageNumber}</div>${p.htmlContent}`;
      scrollContent.appendChild(section);
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
      const section = document.getElementById(`scroll-page-${num}`);
      if (section) section.scrollIntoView({ behavior: 'smooth' });
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
      prevBtn.disabled = num <= 1;
      nextBtn.disabled = num >= R.totalPages;

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

  prevBtn.addEventListener('click', () => goToPage(R.currentPage - 1));
  nextBtn.addEventListener('click', () => goToPage(R.currentPage + 1));
  pageJump.addEventListener('keydown', (e) => { if (e.key === 'Enter') { goToPage(parseInt(pageJump.value, 10)); pageJump.blur(); } });
  pageJump.addEventListener('change', () => goToPage(parseInt(pageJump.value, 10)));

  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); goToPage(R.currentPage - 1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); goToPage(R.currentPage + 1); }
  });

  document.querySelectorAll('.toc-link, .page-link').forEach(link => {
    link.addEventListener('click', (e) => { e.preventDefault(); goToPage(parseInt(link.dataset.page, 10)); });
  });

  // ─── DARK MODE ─────────────────────────────────────────────────

  themeToggle.addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('gyde-reader-theme', next);
  });

  // ─── BOOKMARK ──────────────────────────────────────────────────

  function saveBookmark(pg) {
    localStorage.setItem(`gyde-bookmark-${R.bookId}`, JSON.stringify({ page: pg, timestamp: Date.now() }));
  }
  saveBookmark(R.currentPage);
})();
