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
  const modeChunksBtn = document.getElementById('modeChunksBtn');
  const chunksContent = document.getElementById('readerChunksContent');

  // Initial mode resolution order:
  //   1. ?mode=<pages|scroll|pdf|chunks> query param (from an
  //      edge-click in the chunks view so quoted citations
  //      land in the right layout)
  //   2. localStorage (user's last-used mode)
  //   3. 'pages' default
  function getQueryModeOverride() {
    try {
      const m = new URLSearchParams(window.location.search).get('mode');
      if (m && ['pages', 'scroll', 'pdf', 'chunks'].includes(m)) return m;
    } catch (_) {}
    return null;
  }
  let mode = getQueryModeOverride() || localStorage.getItem('gyde-reader-mode') || 'pages';
  let scrollLoaded = false;
  let scrollSpyObserver = null;

  // ─── MODE TOGGLE ───────────────────────────────────────────────

  function setMode(newMode) {
    mode = newMode;
    localStorage.setItem('gyde-reader-mode', mode);

    [modePagesBtn, modeScrollBtn, modePdfBtn, modeChunksBtn].forEach(b => b && b.classList.remove('active'));
    content.style.display = 'none';
    scrollContent.style.display = 'none';
    originalView.style.display = 'none';
    if (chunksContent) chunksContent.style.display = 'none';

    if (mode === 'pages') {
      modePagesBtn.classList.add('active');
      content.style.display = '';
      pageIndicator.style.display = '';
      headerPrevBtn.style.display = '';
      headerNextBtn.style.display = '';
      // Reset main scroll so Pages view always lands at top of
      // the current page (otherwise coming from a scrolled
      // Chunks / Scroll position leaves Pages at the wrong
      // offset and looks like "I went back to the start").
      if (readerMain) readerMain.scrollTop = 0;
      // If the currently-mounted content is for a different
      // page than R.currentPage (e.g. the user scrolled through
      // chunks/scroll and landed on a new page, then switched
      // to pages), pull in the right page. Without this the
      // mode switch silently shows whatever page was last
      // explicitly loaded via goToPage, usually page 1.
      if (content.getAttribute('data-page') !== String(R.currentPage)) {
        goToPage(R.currentPage);
      }
      // When returning to pages mode, re-apply the citation highlight if any.
      applyHighlightToVisible();
      updateActiveSectionForPage(R.currentPage);
      currentPageNum.textContent = R.currentPage;
      pageJump.value = R.currentPage;
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
        // Preserve reading position when re-entering scroll
        // mode: scroll the current page's section into view.
        const target = document.getElementById(`scroll-page-${R.currentPage}`);
        if (target) target.scrollIntoView({ behavior: 'auto', block: 'start' });
      }
    } else if (mode === 'pdf') {
      modePdfBtn.classList.add('active');
      originalView.style.display = '';
      originalImg.src = `/images/${R.bookId}/page-${R.currentPage}.png`;
      pageIndicator.style.display = '';
      headerPrevBtn.style.display = '';
      headerNextBtn.style.display = '';
      currentPageNum.textContent = R.currentPage;
      pageJump.value = R.currentPage;
    } else if (mode === 'chunks') {
      modeChunksBtn && modeChunksBtn.classList.add('active');
      if (chunksContent) chunksContent.style.display = '';
      pageIndicator.style.display = '';
      headerPrevBtn.style.display = '';
      headerNextBtn.style.display = '';
      // Only (re)load the full chunks scroll the FIRST time
      // the user enters chunks mode. Subsequent mode switches
      // should leave the chunks DOM mounted and just scroll to
      // the current page — this keeps mode switches feeling
      // instant and preserves any state the user has set up
      // (popovers, scroll position within a chunk, etc).
      if (window.GydeChunksView) {
        if (!chunksContent || chunksContent.childElementCount === 0) {
          window.GydeChunksView.load(R.bookId, R.currentPage, chunksContent);
        } else {
          window.GydeChunksView.jumpTo(R.currentPage);
        }
      }
    }

    updateArrowState();
  }

  function updateArrowState() {
    headerPrevBtn.disabled = R.currentPage <= 1;
    headerNextBtn.disabled = R.currentPage >= R.totalPages;
  }

  // When the chunks-view scrolls past a new page section, it
  // dispatches a 'cv-page-change' event so we can mirror
  // R.currentPage. Without this, switching from chunks → any
  // other mode always dropped back to whatever page was last
  // explicitly loaded (usually page 1), which is the bug the
  // user reported: "I'm on chunk 14, I hit scroll, it sends
  // me to page 1". Listen on chunksContent so it works
  // regardless of which mode is active when the event fires.
  if (chunksContent) {
    chunksContent.addEventListener('cv-page-change', function (ev) {
      const pg = ev && ev.detail && ev.detail.pageNumber;
      if (!pg) return;
      R.currentPage = pg;
      currentPageNum.textContent = pg;
      pageJump.value = pg;
      saveBookmark(pg);
      updateActiveSectionForPage(pg);
      updateArrowState();
    });
  }

  modePagesBtn.addEventListener('click', () => setMode('pages'));
  modeScrollBtn.addEventListener('click', () => setMode('scroll'));
  modePdfBtn.addEventListener('click', () => setMode('pdf'));
  if (modeChunksBtn) modeChunksBtn.addEventListener('click', () => setMode('chunks'));
  // Expose setMode for chunks-view so page-nav from within the
  // chunks panel can refresh after a page change.
  window.__readerSetMode = setMode;
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

    // Jump to whatever page we were on BEFORE scroll-loaded
    // starts — otherwise the first-time entry always lands at
    // page 1 even if the user was mid-book. Called both
    // immediately and after MathJax to survive layout shifts.
    function jumpToCurrent() {
      const target = document.getElementById(`scroll-page-${R.currentPage}`);
      if (target) target.scrollIntoView({ behavior: 'auto', block: 'start' });
    }
    jumpToCurrent();

    if (window.MathJax && MathJax.typesetPromise) {
      MathJax.typesetPromise([scrollContent])
        .then(() => {
          fixMathJaxErrors();
          jumpToCurrent();
          applyHighlightToVisible();
          setupScrollSpy();
        })
        .catch(() => {
          jumpToCurrent();
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

    // Chunks mode already has all pages rendered; just scroll.
    // Skip the /api/page/:num fetch since we don't need the HTML.
    if (mode === 'chunks') {
      R.currentPage = num;
      currentPageNum.textContent = num;
      pageJump.value = num;
      updateArrowState();
      if (window.GydeChunksView) window.GydeChunksView.jumpTo(num);
      updateActiveSectionForPage(num);
      saveBookmark(num);
      history.replaceState(null, '', `/reader/${R.bookId}/page/${num}`);
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
        content.setAttribute('data-page', String(num));
        if (window.MathJax && MathJax.typesetPromise) {
          MathJax.typesetPromise([content]).then(() => fixMathJaxErrors()).catch(() => {});
        }
      } else if (mode === 'pdf') {
        originalImg.src = `/images/${R.bookId}/page-${num}.png`;
      } else if (mode === 'chunks' && window.GydeChunksView) {
        // Chunks view is already scrolling across all pages;
        // Prev/Next arrows just scroll to the right section.
        window.GydeChunksView.jumpTo(num);
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
  console.debug('[highlight] search term:', pendingHighlight && pendingHighlight.substring(0, 80));

  // Unwrap any existing citation callout boxes by moving their children
  // back into the parent in place, then removing the empty wrapper. This
  // restores the page to its normal layout without touching any text or
  // MathJax content — we only ever insert/remove block-level wrappers.
  function clearExistingCallouts(root) {
    (root || document).querySelectorAll('.citation-callout-box').forEach(function (box) {
      var parent = box.parentNode;
      if (!parent) return;
      // Skip the dismiss button when moving children back out.
      Array.prototype.slice.call(box.childNodes).forEach(function (child) {
        if (child.nodeType === 1 && child.classList && child.classList.contains('callout-dismiss')) return;
        parent.insertBefore(child, box);
      });
      parent.removeChild(box);
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
    var prefixCounts = [words.length, 40, 30, 20, 15, 10, 6, 4, 3];
    var prefixes = [];
    var seen = {};
    prefixCounts.forEach(function (n) {
      if (n >= 2 && n <= words.length) {
        var p = words.slice(0, n).join(' ');
        if (!seen[p]) { seen[p] = true; prefixes.push(p); }
      }
    });
    if (!prefixes.length) prefixes.push(normNeedle);

    console.debug('[highlight] trying quote (' + words.length + ' words), prefixes:',
      prefixes.map(function (p) { return p.substring(0, 40); }));

    // Collect all non-empty text nodes inside the container.
    var walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
    var nodes = [];
    var node;
    while ((node = walker.nextNode())) {
      if (node.nodeValue && node.nodeValue.trim()) nodes.push(node);
    }
    if (!nodes.length) return false;

    console.debug('[highlight] ' + nodes.length + ' text nodes, first:',
      nodes[0] && nodes[0].nodeValue && nodes[0].nodeValue.substring(0, 80));

    // Walk up from a text node to the nearest block-level ancestor that
    // sits directly inside the container (or inside a .page-content inside
    // the container — scroll mode nests .page-content inside each scroll
    // section). This is the element we will wrap in a callout box.
    function findBlockAncestor(textNode) {
      var el = textNode.parentElement;
      while (el && el !== container) {
        var parent = el.parentElement;
        if (!parent) return null;
        if (parent === container) return el;
        if (parent.classList && parent.classList.contains('page-content')) return el;
        if (parent.classList && parent.classList.contains('scroll-page-section')) return el;
        el = parent;
      }
      return null;
    }

    // Wrap a block element (and optionally the next 1-2 siblings if the
    // quote spans multiple paragraphs) in a .citation-callout-box. Uses
    // insertBefore/appendChild only — never touches innerHTML or any text
    // content, so MathJax renderings are preserved exactly.
    function wrapInCallout(blockEl, extraSiblings) {
      if (!blockEl || !blockEl.parentNode) return false;
      var parent = blockEl.parentNode;

      var box = document.createElement('div');
      box.className = 'citation-callout-box';

      var dismiss = document.createElement('button');
      dismiss.type = 'button';
      dismiss.className = 'callout-dismiss';
      dismiss.setAttribute('aria-label', 'Dismiss citation');
      dismiss.innerHTML = '&times;';
      dismiss.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        pendingHighlight = null;
        clearExistingCallouts(container);
      });
      box.appendChild(dismiss);

      // Insert the wrapper before the target block, then move the block
      // (and any requested siblings) into it in DOM order.
      parent.insertBefore(box, blockEl);
      box.appendChild(blockEl);
      var moved = 1;
      while (extraSiblings && moved <= extraSiblings && box.nextSibling) {
        box.appendChild(box.nextSibling);
        moved++;
      }

      // Pull in sibling elements that logically continue the matched
      // block. Papers routinely sequence a quote like "We can write"
      // directly into \[...\] + "(28)" as sibling blocks, and a citation
      // that names a section usually means "the heading AND its lead
      // paragraph" — both cases should end up inside one callout.
      //
      // We only ever move whole DOM elements via appendChild, so any
      // MathJax subtree (mjx-container and its descendants) travels
      // intact as a single node — no retypesetting, no reflow, no
      // chance of breaking rendered equations.
      //
      // Absorption rules (in order of check):
      //   1. Whitespace text nodes — swallowed silently, never a stop.
      //   2. Elements with class "math-display" — wrapped display math
      //      from the legacy htmlService pipeline OR from the new
      //      visionService post-processor.
      //   3. <mjx-container> elements — MathJax-rendered display math
      //      from any vision-processed page that was rendered before
      //      the math-display normalization shipped (belt + suspenders
      //      for existing books that haven't been reprocessed).
      //   4. Short <p> matching /^\(?[A-Z]?\d+(\.\d+)?[a-z]?\)?\.?$/ —
      //      equation-number labels like "(26)", "(B25)", "3.14", "26".
      //      Widened from the previous pattern to catch alphanumeric
      //      appendix labels and decimals.
      //   5. Empty or whitespace-only <p> — vertical spacer paragraphs
      //      between equations. These otherwise abort the loop.
      //   6. If the matched block was a heading (<h1>-<h6>), the FIRST
      //      following prose <p> is also absorbed once. Almost every
      //      section-level citation is "Heading. First sentence…".
      //      Only one leading paragraph is pulled — trailing paragraphs
      //      still need their own match or the widened highlightWords
      //      cap in chat.ejs to extend PASS 2's block span.
      //   7. Anything else — real next paragraph, another heading, a
      //      figure — hard stops the loop.
      var isHeadingBlock = /^h[1-6]$/.test((blockEl.tagName || '').toLowerCase());
      var absorbedLeadingPara = false;
      var next = box.nextSibling;
      while (next) {
        // Rule 1: whitespace text nodes.
        if (next.nodeType === 3 && !next.nodeValue.trim()) {
          var wsNext = next.nextSibling;
          box.appendChild(next);
          next = wsNext;
          continue;
        }
        if (next.nodeType !== 1) break;
        var tag = next.tagName ? next.tagName.toLowerCase() : '';
        var cls = (typeof next.className === 'string') ? next.className : '';

        // Rule 2: explicit math-display class.
        if (cls.indexOf('math-display') !== -1) {
          var mNext = next.nextSibling;
          box.appendChild(next);
          next = mNext;
          continue;
        }

        // Rule 3: MathJax-rendered display equation. Covers vision pages
        // that weren't normalized upstream. Treat any top-level
        // mjx-container as absorbable — inline math normally lives
        // inside a <p>, so if we see an mjx-container as a direct
        // sibling of the matched block it's display math.
        if (tag === 'mjx-container') {
          var jNext = next.nextSibling;
          box.appendChild(next);
          next = jNext;
          continue;
        }

        if (tag === 'p') {
          var tc = (next.textContent || '').trim();
          // Rule 5: empty / whitespace-only spacer paragraph.
          if (tc.length === 0) {
            var spNext = next.nextSibling;
            box.appendChild(next);
            next = spNext;
            continue;
          }
          // Rule 4: equation-number label (widened pattern).
          if (tc.length < 16 && /^\(?[A-Z]?\d+(\.\d+)?[a-z]?\)?\.?$/.test(tc)) {
            var eNext = next.nextSibling;
            box.appendChild(next);
            next = eNext;
            continue;
          }
          // Rule 6: heading → first-paragraph.
          if (isHeadingBlock && !absorbedLeadingPara) {
            var hNext = next.nextSibling;
            box.appendChild(next);
            next = hNext;
            absorbedLeadingPara = true;
            continue;
          }
        }

        // Rule 7: hard stop.
        break;
      }

      if (!opts || opts.scroll !== false) {
        box.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return true;
    }

    // Escape a string for use in a regex, and let any whitespace run in the
    // needle match any run of whitespace in the target (handles line breaks,
    // non-breaking spaces, etc.).
    function buildRegex(str, flags) {
      var escaped = str
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\s+/g, '\\s+');
      return new RegExp(escaped, flags || 'i');
    }

    // PASS 1 — per-node regex match. For each prefix, for each text node,
    // try to find the prefix inside that single text node. On a hit, wrap
    // the block ancestor of the text node. Matches the longest prefix that
    // lives entirely inside one node.
    for (var pi = 0; pi < prefixes.length; pi++) {
      var re = buildRegex(prefixes[pi]);
      for (var ni = 0; ni < nodes.length; ni++) {
        if (!re.test(nodes[ni].nodeValue)) continue;
        var block1 = findBlockAncestor(nodes[ni]);
        if (block1 && wrapInCallout(block1)) {
          console.debug('[highlight] PASS 1 hit on prefix #' + pi);
          return true;
        }
      }
    }

    // Build a concatenated normalized string covering every text node in
    // the container, plus a parallel array recording the start offset of
    // each text node inside that concat. Used by PASS 2 and the LaTeX
    // fallback to locate WHICH text node a match lands in.
    var concat = '';
    var nodeStarts = [];
    for (var i = 0; i < nodes.length; i++) {
      nodeStarts.push(concat.length);
      concat += norm(nodes[i].nodeValue) + ' ';
    }

    function nodeIndexForConcatPos(gIdx) {
      var sIdx = 0;
      for (var j = 0; j < nodeStarts.length; j++) {
        if (nodeStarts[j] > gIdx) break;
        sIdx = j;
      }
      return sIdx;
    }

    // PASS 2 — cross-node match. Look for each prefix in the concat string,
    // map back to the text node where it starts, and wrap that node's
    // block ancestor. If the quote visibly spans two paragraphs we also
    // pull in the next sibling so the whole passage sits inside the box.
    for (var pj = 0; pj < prefixes.length; pj++) {
      var gIdx = concat.indexOf(prefixes[pj]);
      if (gIdx === -1) continue;
      var startNodeIdx = nodeIndexForConcatPos(gIdx);
      var endNodeIdx = nodeIndexForConcatPos(gIdx + prefixes[pj].length);
      var startNode = nodes[startNodeIdx];
      var block2 = findBlockAncestor(startNode);
      if (block2) {
        // How many block-level siblings does the match span?
        var extras = 0;
        if (endNodeIdx > startNodeIdx) {
          var endBlock = findBlockAncestor(nodes[endNodeIdx]);
          if (endBlock && endBlock !== block2) extras = 1;
        }
        if (wrapInCallout(block2, extras)) {
          console.debug('[highlight] PASS 2 cross-node hit on prefix #' + pj);
          return true;
        }
      }
    }

    // LATEX EDGE CASE — the quote starts with (or is dominated by) math
    // content, so none of the word-based prefixes match. Strip everything
    // but [a-z0-9] from both the needle and the concat, carrying a parallel
    // index map back to the original concat, then look for the first 20
    // alnum characters of the needle. Good enough to identify WHICH
    // paragraph the span lives in even when the rendered unicode symbols
    // bear no textual resemblance to the AI-supplied LaTeX source.
    var alnumNeedle = '';
    for (var an = 0; an < normNeedle.length; an++) {
      var cn = normNeedle.charCodeAt(an);
      if ((cn >= 48 && cn <= 57) || (cn >= 97 && cn <= 122)) alnumNeedle += normNeedle[an];
    }
    if (alnumNeedle.length >= 8) {
      var alnumConcat = '';
      var alnumToConcat = [];
      for (var ac = 0; ac < concat.length; ac++) {
        var cc = concat.charCodeAt(ac);
        if ((cc >= 48 && cc <= 57) || (cc >= 97 && cc <= 122)) {
          alnumConcat += concat[ac];
          alnumToConcat.push(ac);
        }
      }
      var probeLen = Math.min(20, alnumNeedle.length);
      var alnumIdx = alnumConcat.indexOf(alnumNeedle.substring(0, probeLen));
      // Try progressively shorter alnum probes — LaTeX-dense spans often
      // share only a handful of identifier characters with the rendering.
      while (alnumIdx === -1 && probeLen > 6) {
        probeLen -= 2;
        alnumIdx = alnumConcat.indexOf(alnumNeedle.substring(0, probeLen));
      }
      if (alnumIdx !== -1) {
        var origIdx = alnumToConcat[alnumIdx];
        console.debug('[highlight] LaTeX fallback alnum match (probeLen=' + probeLen + ') at concat pos', origIdx);
        var fbNode = nodes[nodeIndexForConcatPos(origIdx)];
        var fbBlock = findBlockAncestor(fbNode);
        if (fbBlock && wrapInCallout(fbBlock)) return true;
      }
    }

    console.warn('[highlight] NO MATCH. First 200 chars of page text:',
      concat.substring(0, 200));
    return false;
  }

  function applyHighlightToVisible() {
    if (!pendingHighlight) return;
    var container = null;
    if (mode === 'scroll') container = scrollContent;
    else if (mode === 'pages') container = content;
    else return; // pdf mode: nothing to do
    if (!container) return;
    // Re-apply even if already present — unwrap any existing callout first
    // so the new one appears at the right block and re-triggers the
    // appear animation.
    clearExistingCallouts(container);
    var attempts = 0;
    var tryHighlight = function () {
      // The user may have dismissed the citation between attempts; if so,
      // stop trying.
      if (!pendingHighlight) return;
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
