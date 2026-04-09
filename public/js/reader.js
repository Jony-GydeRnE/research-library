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
  let scrollSpyObserver = null;

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
      // When returning to pages mode, re-apply the citation highlight if any.
      applyHighlightToVisible();
      updateActiveSectionForPage(R.currentPage);
    } else if (mode === 'scroll') {
      modeScrollBtn.classList.add('active');
      scrollContent.style.display = '';
      pageIndicator.style.display = 'none';
      headerPrevBtn.style.display = 'none';
      headerNextBtn.style.display = 'none';
      if (!scrollLoaded) {
        loadAllPages();
      } else {
        applyHighlightToVisible();
        // Rebuild scroll-spy in case the sidebar was regenerated.
        setupScrollSpy();
      }
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
      MathJax.typesetPromise([scrollContent])
        .then(() => {
          fixMathJaxErrors();
          applyHighlightToVisible();
          setupScrollSpy();
        })
        .catch(() => {
          applyHighlightToVisible();
          setupScrollSpy();
        });
    } else {
      applyHighlightToVisible();
      setupScrollSpy();
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

      updateActiveSectionForPage(num);

      saveBookmark(num);
      readerMain.scrollTop = 0;
      history.replaceState(null, '', `/reader/${R.bookId}/page/${num}`);

      // Re-apply the citation highlight on the new page if the quote happens
      // to appear there. Silently no-ops otherwise.
      applyHighlightToVisible();

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

  // ─── HIGHLIGHT FROM ?highlight= QUERY (chat citations) ──────────
  // The pending highlight persists across mode switches (pages <-> scroll)
  // so a quote linked from a chat citation stays visible wherever the user
  // lands — it only clears when the user explicitly dismisses it.
  function getQueryParam(name) {
    var m = new RegExp('[?&]' + name + '=([^&]+)').exec(window.location.search);
    return m ? decodeURIComponent(m[1].replace(/\+/g, ' ')) : null;
  }

  var pendingHighlight = getQueryParam('highlight');

  function clearExistingQuoteMarks(root) {
    (root || document).querySelectorAll('mark.quote-flash').forEach(function (m) {
      var parent = m.parentNode;
      if (!parent) return;
      while (m.firstChild) parent.insertBefore(m.firstChild, m);
      parent.removeChild(m);
      if (parent.normalize) parent.normalize();
    });
  }

  function highlightQuoteIn(container, quote, opts) {
    if (!quote || !container) return false;

    // Normalize whitespace, smart quotes, dashes, and case.
    function norm(s) {
      return (s || '')
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/[\u2013\u2014]/g, '-')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
    }

    var normNeedle = norm(quote);
    if (!normNeedle) return false;
    var words = normNeedle.split(' ').filter(Boolean);

    // Build a ladder of progressively shorter prefixes. Matching the
    // longest one that lands inside a single text node usually gives a
    // clean surroundContents; the shorter fallbacks catch cases where the
    // AI-supplied quote diverges slightly from the book text (paraphrase,
    // punctuation, hyphenation) or spans formatting elements.
    var prefixCounts = [words.length, 15, 10, 6, 4, 3];
    var prefixes = [];
    var seen = {};
    prefixCounts.forEach(function (n) {
      if (n >= 2 && n <= words.length) {
        var p = words.slice(0, n).join(' ');
        if (!seen[p]) { seen[p] = true; prefixes.push(p); }
      }
    });
    if (!prefixes.length) prefixes.push(normNeedle);

    // Collect all non-empty text nodes inside the container.
    var walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
    var nodes = [];
    var node;
    while ((node = walker.nextNode())) {
      if (node.nodeValue && node.nodeValue.trim()) nodes.push(node);
    }
    if (!nodes.length) return false;

    // Escape a string for use in a regex, and let any whitespace run in the
    // needle match any run of whitespace in the target (handles line breaks,
    // non-breaking spaces, etc.).
    function buildRegex(str, flags) {
      var escaped = str
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\s+/g, '\\s+');
      return new RegExp(escaped, flags || 'i');
    }

    function surroundAndScroll(n, start, end) {
      try {
        var range = document.createRange();
        range.setStart(n, start);
        range.setEnd(n, Math.min(n.nodeValue.length, end));
        var mark = document.createElement('mark');
        mark.className = 'quote-flash';
        range.surroundContents(mark);
        if (!opts || opts.scroll !== false) {
          mark.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return true;
      } catch (e) {
        return false;
      }
    }

    // PASS 1 — per-node regex match. Try each prefix against each text node.
    // Matches the longest prefix that lives entirely inside one node.
    for (var pi = 0; pi < prefixes.length; pi++) {
      var re = buildRegex(prefixes[pi]);
      for (var ni = 0; ni < nodes.length; ni++) {
        var m = re.exec(nodes[ni].nodeValue);
        if (!m) continue;
        var startOff = m.index;
        var endOff = m.index + m[0].length;
        if (surroundAndScroll(nodes[ni], startOff, endOff)) return true;
      }
    }

    // PASS 2 — cross-node match. Concatenate every text node (normalized)
    // into one string, find the prefix there, then anchor the highlight at
    // the first text node the match lands in. Only that leading node is
    // highlighted (surroundContents can't span elements cleanly) but the
    // user still sees the starting phrase flash and scroll into view, which
    // is what matters for "take me to this quote".
    var concat = '';
    var nodeStarts = [];
    for (var i = 0; i < nodes.length; i++) {
      nodeStarts.push(concat.length);
      concat += norm(nodes[i].nodeValue) + ' ';
    }
    for (var pj = 0; pj < prefixes.length; pj++) {
      var gIdx = concat.indexOf(prefixes[pj]);
      if (gIdx === -1) continue;
      var sIdx = 0;
      for (var j = 0; j < nodeStarts.length; j++) {
        if (nodeStarts[j] > gIdx) break;
        sIdx = j;
      }
      var startNode = nodes[sIdx];
      // Highlight whatever portion of the prefix is local to the start node
      // by regex-probing the first 3 words of the prefix inside it.
      var probeWords = prefixes[pj].split(' ').slice(0, 3).join(' ');
      var probeRe = buildRegex(probeWords);
      var pm = probeRe.exec(startNode.nodeValue);
      if (pm) {
        var s = pm.index;
        var e = Math.min(startNode.nodeValue.length, s + prefixes[pj].length + 20);
        if (surroundAndScroll(startNode, s, e)) return true;
      }
    }

    return false;
  }

  function applyHighlightToVisible() {
    if (!pendingHighlight) return;
    var container = null;
    if (mode === 'scroll') container = scrollContent;
    else if (mode === 'pages') container = content;
    else return; // pdf mode: nothing to do
    if (!container) return;
    // Re-apply even if already present — clear existing marks first so the
    // flash animation re-triggers and the quote is visually located again.
    clearExistingQuoteMarks(container);
    var attempts = 0;
    var tryHighlight = function () {
      attempts++;
      if (highlightQuoteIn(container, pendingHighlight) || attempts > 20) return;
      setTimeout(tryHighlight, 200);
    };
    setTimeout(tryHighlight, 150);
  }

  // Initial apply (for pages mode; scroll mode applies after loadAllPages).
  if (pendingHighlight && mode !== 'scroll') {
    applyHighlightToVisible();
  }

  // ─── ACTIVE-SECTION TRACKING ──────────────────────────────────
  // In scroll mode, as the user scrolls through pages the left sidebar
  // should highlight the chapter/section containing the page currently in
  // the viewport.

  function updateActiveSectionForPage(pageNum) {
    var links = Array.from(document.querySelectorAll(
      '.sidebar-nav .toc-link[data-page], .sidebar-nav .page-link[data-page]'
    ));
    if (!links.length) return;
    var sorted = links.slice().sort(function (a, b) {
      return parseInt(a.dataset.page, 10) - parseInt(b.dataset.page, 10);
    });
    var active = null;
    for (var i = 0; i < sorted.length; i++) {
      if (parseInt(sorted[i].dataset.page, 10) <= pageNum) active = sorted[i];
      else break;
    }
    links.forEach(function (l) { l.classList.remove('active'); });
    if (active) {
      active.classList.add('active');
      // Also mark the parent chapter if the active link is a section.
      if (active.classList.contains('section-link')) {
        var chapterLi = active.closest('li.toc-chapter');
        if (chapterLi) {
          var chapterLink = chapterLi.querySelector('.chapter-link');
          if (chapterLink) chapterLink.classList.add('active');
        }
      }
      // Keep the active link within the sidebar's visible area.
      if (typeof active.scrollIntoView === 'function') {
        var rect = active.getBoundingClientRect();
        if (rect.top < 0 || rect.bottom > window.innerHeight) {
          active.scrollIntoView({ block: 'nearest' });
        }
      }
    }
  }

  function setupScrollSpy() {
    if (scrollSpyObserver) {
      scrollSpyObserver.disconnect();
      scrollSpyObserver = null;
    }
    var sections = scrollContent.querySelectorAll('.scroll-page-section');
    if (!sections.length || !('IntersectionObserver' in window)) return;

    // Activation zone: upper ~30% of the reader viewport. A section becomes
    // "current" when its top enters this band.
    scrollSpyObserver = new IntersectionObserver(function (entries) {
      // Choose the entry with the smallest (most-negative or nearest-to-top)
      // boundingClientRect.top that is still intersecting — that's the
      // section whose content is currently under the top of the viewport.
      var candidates = entries.filter(function (e) { return e.isIntersecting; });
      if (!candidates.length) return;
      candidates.sort(function (a, b) {
        return a.boundingClientRect.top - b.boundingClientRect.top;
      });
      // Prefer the last candidate whose top is <= activation line.
      var chosen = candidates[candidates.length - 1].target;
      var pg = parseInt((chosen.id || '').replace('scroll-page-', ''), 10);
      if (!pg) return;
      R.currentPage = pg;
      saveBookmark(pg);
      updateActiveSectionForPage(pg);
    }, {
      root: readerMain,
      // Fire when the section enters the top 30% of the viewport.
      rootMargin: '0px 0px -70% 0px',
      threshold: 0,
    });

    sections.forEach(function (s) { scrollSpyObserver.observe(s); });

    // Prime the active state using whichever section is already in view.
    var closest = null;
    var closestDist = Infinity;
    var rootRect = readerMain.getBoundingClientRect();
    sections.forEach(function (s) {
      var r = s.getBoundingClientRect();
      var dist = Math.abs(r.top - rootRect.top);
      if (r.bottom > rootRect.top && dist < closestDist) {
        closestDist = dist;
        closest = s;
      }
    });
    if (closest) {
      var pg = parseInt((closest.id || '').replace('scroll-page-', ''), 10);
      if (pg) updateActiveSectionForPage(pg);
    }
  }

  // Initial pages-mode active section.
  if (mode === 'pages' || mode === 'pdf') {
    updateActiveSectionForPage(R.currentPage);
  }
})();
