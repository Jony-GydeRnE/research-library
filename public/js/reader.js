(() => {
  const R = window.__READER__;
  const content = document.getElementById('readerContent');
  const originalView = document.getElementById('readerOriginal');
  const originalImg = document.getElementById('originalPageImg');
  const currentPageNum = document.getElementById('currentPageNum');
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  const pageJump = document.getElementById('pageJump');
  const sidebar = document.getElementById('readerSidebar');
  const sidebarToggle = document.getElementById('sidebarToggle');
  const themeToggle = document.getElementById('themeToggle');
  const viewOriginalToggle = document.getElementById('viewOriginalToggle');

  let showingOriginal = false;

  // ─── VIEW ORIGINAL TOGGLE ─────────────────────────────────────

  viewOriginalToggle.addEventListener('click', () => {
    showingOriginal = !showingOriginal;
    if (showingOriginal) {
      content.style.display = 'none';
      originalView.style.display = '';
      originalImg.src = `/images/${R.bookId}/page-${R.currentPage}.png`;
      viewOriginalToggle.classList.add('active');
      viewOriginalToggle.title = 'Switch to HTML view';
    } else {
      content.style.display = '';
      originalView.style.display = 'none';
      viewOriginalToggle.classList.remove('active');
      viewOriginalToggle.title = 'Toggle original page image';
    }
  });

  // ─── PAGE NAVIGATION ──────────────────────────────────────────

  async function goToPage(num) {
    num = Math.max(1, Math.min(num, R.totalPages));
    if (num === R.currentPage) return;

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

      // Update original image source
      originalImg.src = `/images/${R.bookId}/page-${num}.png`;

      // Re-render MathJax, then handle errors
      if (window.MathJax && MathJax.typesetPromise) {
        MathJax.typesetPromise([content]).then(() => {
          fixMathJaxErrors();
        }).catch(() => {});
      }

      // Update active TOC link
      document.querySelectorAll('.toc-link.active, .page-link.active').forEach(el => el.classList.remove('active'));
      const activeLink = document.querySelector(`[data-page="${num}"]`);
      if (activeLink) activeLink.classList.add('active');

      saveBookmark(num);

      content.scrollTop = 0;
      document.querySelector('.reader-main').scrollTop = 0;

      history.replaceState(null, '', `/reader/${R.bookId}/page/${num}`);

    } catch (err) {
      console.error('Failed to load page:', err);
    }
  }

  // Replace broken MathJax equations with clickable fallback
  function fixMathJaxErrors() {
    document.querySelectorAll('mjx-container[data-mjx-error]').forEach(el => {
      const fallback = document.createElement('span');
      fallback.className = 'mathjax-fallback';
      fallback.textContent = '[equation \u2014 view original page]';
      fallback.addEventListener('click', () => {
        viewOriginalToggle.click();
      });
      el.replaceWith(fallback);
    });
  }

  prevBtn.addEventListener('click', () => goToPage(R.currentPage - 1));
  nextBtn.addEventListener('click', () => goToPage(R.currentPage + 1));

  pageJump.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      goToPage(parseInt(pageJump.value, 10));
      pageJump.blur();
    }
  });

  pageJump.addEventListener('change', () => {
    goToPage(parseInt(pageJump.value, 10));
  });

  // Keyboard navigation
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      goToPage(R.currentPage - 1);
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      goToPage(R.currentPage + 1);
    }
  });

  // TOC and page links
  document.querySelectorAll('.toc-link, .page-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      goToPage(parseInt(link.dataset.page, 10));
    });
  });

  // ─── SIDEBAR TOGGLE ───────────────────────────────────────────

  const sidebarKey = 'gyde-reader-sidebar';
  if (localStorage.getItem(sidebarKey) === 'collapsed') {
    sidebar.classList.add('collapsed');
  }

  sidebarToggle.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
    localStorage.setItem(sidebarKey, sidebar.classList.contains('collapsed') ? 'collapsed' : 'open');
  });

  // ─── DARK MODE TOGGLE ─────────────────────────────────────────

  const themeKey = 'gyde-reader-theme';

  themeToggle.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem(themeKey, next);
  });

  // ─── BOOKMARK ─────────────────────────────────────────────────

  const bookmarkKey = `gyde-bookmark-${R.bookId}`;

  function saveBookmark(page) {
    localStorage.setItem(bookmarkKey, JSON.stringify({ page, timestamp: Date.now() }));
  }

  saveBookmark(R.currentPage);
})();
