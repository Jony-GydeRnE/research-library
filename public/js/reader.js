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
  const viewOriginalToggle = document.getElementById('viewOriginalToggle');
  const modePagesBtn = document.getElementById('modePagesBtn');
  const modeScrollBtn = document.getElementById('modeScrollBtn');

  let showingOriginal = false;
  let mode = localStorage.getItem('gyde-reader-mode') || 'pages';
  let scrollLoaded = false;

  // ─── INIT MODE ─────────────────────────────────────────────────

  if (mode === 'scroll') {
    activateScrollMode();
  }

  // ─── MODE TOGGLE ───────────────────────────────────────────────

  modePagesBtn.addEventListener('click', () => {
    if (mode === 'pages') return;
    mode = 'pages';
    localStorage.setItem('gyde-reader-mode', 'pages');
    activatePagesMode();
  });

  modeScrollBtn.addEventListener('click', () => {
    if (mode === 'scroll') return;
    mode = 'scroll';
    localStorage.setItem('gyde-reader-mode', 'scroll');
    activateScrollMode();
  });

  function activatePagesMode() {
    modePagesBtn.classList.add('active');
    modeScrollBtn.classList.remove('active');
    content.style.display = '';
    scrollContent.style.display = 'none';
    pageNav.style.display = '';
    pageIndicator.style.display = '';
    if (showingOriginal) viewOriginalToggle.click();
  }

  function activateScrollMode() {
    modeScrollBtn.classList.add('active');
    modePagesBtn.classList.remove('active');
    content.style.display = 'none';
    scrollContent.style.display = '';
    pageNav.style.display = 'none';
    pageIndicator.style.display = 'none';
    if (showingOriginal) viewOriginalToggle.click();
    if (!scrollLoaded) loadAllPages();
  }

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

    // Typeset MathJax
    if (window.MathJax && MathJax.typesetPromise) {
      MathJax.typesetPromise([scrollContent]).then(() => {
        fixMathJaxErrors();
      }).catch(() => {});
    }
  }

  // ─── VIEW ORIGINAL TOGGLE ─────────────────────────────────────

  viewOriginalToggle.addEventListener('click', () => {
    showingOriginal = !showingOriginal;
    if (showingOriginal) {
      content.style.display = 'none';
      scrollContent.style.display = 'none';
      originalView.style.display = '';
      originalImg.src = `/images/${R.bookId}/page-${R.currentPage}.png`;
      viewOriginalToggle.classList.add('active');
    } else {
      originalView.style.display = 'none';
      if (mode === 'scroll') {
        scrollContent.style.display = '';
      } else {
        content.style.display = '';
      }
      viewOriginalToggle.classList.remove('active');
    }
  });

  // ─── PAGE NAVIGATION (pages mode) ─────────────────────────────

  async function goToPage(num) {
    num = Math.max(1, Math.min(num, R.totalPages));
    if (num === R.currentPage && mode === 'pages') return;

    if (mode === 'scroll') {
      // In scroll mode, just scroll to the page section
      const section = document.getElementById(`scroll-page-${num}`);
      if (section) section.scrollIntoView({ behavior: 'smooth' });
      R.currentPage = num;
      return;
    }

    try {
      const res = await fetch(`/reader/${R.bookId}/api/page/${num}`);
      if (!res.ok) throw new Error('Page not found');
      const data = await res.json();

      content.innerHTML = data.htmlContent || '<div class="page-content"><p class="empty-page">No content.</p></div>';
      R.currentPage = num;
      currentPageNum.textContent = num;
      pageJump.value = num;
      prevBtn.disabled = num <= 1;
      nextBtn.disabled = num >= R.totalPages;
      originalImg.src = `/images/${R.bookId}/page-${num}.png`;

      if (window.MathJax && MathJax.typesetPromise) {
        MathJax.typesetPromise([content]).then(() => fixMathJaxErrors()).catch(() => {});
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
      fb.textContent = '[equation \u2014 view original page]';
      fb.addEventListener('click', () => viewOriginalToggle.click());
      el.replaceWith(fb);
    });
  }

  prevBtn.addEventListener('click', () => goToPage(R.currentPage - 1));
  nextBtn.addEventListener('click', () => goToPage(R.currentPage + 1));

  pageJump.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { goToPage(parseInt(pageJump.value, 10)); pageJump.blur(); }
  });
  pageJump.addEventListener('change', () => goToPage(parseInt(pageJump.value, 10)));

  // Keyboard nav
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); goToPage(R.currentPage - 1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); goToPage(R.currentPage + 1); }
  });

  // TOC links
  document.querySelectorAll('.toc-link, .page-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      goToPage(parseInt(link.dataset.page, 10));
    });
  });

  // ─── DARK MODE ─────────────────────────────────────────────────

  themeToggle.addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('gyde-reader-theme', next);
  });

  // ─── BOOKMARK ──────────────────────────────────────────────────

  function saveBookmark(page) {
    localStorage.setItem(`gyde-bookmark-${R.bookId}`, JSON.stringify({ page, timestamp: Date.now() }));
  }
  saveBookmark(R.currentPage);
})();
