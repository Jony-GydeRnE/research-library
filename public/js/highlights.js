/**
 * Reader highlighting system.
 * Works in both Pages and Scroll modes.
 * Supports text selection AND clicking on MathJax equations.
 */
(() => {
  const R = window.__READER__;
  const pagesContent = document.getElementById('readerContent');
  const scrollContent = document.getElementById('readerScrollContent');
  let popup = null;
  let pendingInfo = null;

  // ─── POPUP ─────────────────────────────────────────────────────

  function createPopup() {
    if (popup) return popup;
    popup = document.createElement('div');
    popup.className = 'highlight-popup';
    popup.innerHTML = `
      <button class="hl-btn hl-highlight" title="Highlight">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
        Highlight
      </button>
      <button class="hl-btn hl-note" title="Add Note">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
        Note
      </button>
      <button class="hl-btn hl-ask" title="Ask AI">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        Ask AI
      </button>
    `;
    document.body.appendChild(popup);

    popup.querySelector('.hl-highlight').addEventListener('click', () => {
      if (pendingInfo) saveHighlight(pendingInfo);
    });
    popup.querySelector('.hl-note').addEventListener('click', () => {
      if (pendingInfo) saveHighlight(pendingInfo);
    });
    popup.querySelector('.hl-ask').addEventListener('click', () => {
      if (pendingInfo) askAI(pendingInfo);
    });

    return popup;
  }

  function showPopup(x, y, info) {
    createPopup();
    pendingInfo = info;
    popup.style.display = 'flex';
    popup.style.left = Math.min(x, window.innerWidth - 260) + 'px';
    popup.style.top = Math.max(10, y - 50) + 'px';
  }

  function hidePopup() {
    if (popup) popup.style.display = 'none';
    pendingInfo = null;
  }

  // ─── TEXT SELECTION (works in both pages + scroll content) ─────

  function getActiveContentEl() {
    // Return whichever content container is currently visible
    if (scrollContent && scrollContent.style.display !== 'none') return scrollContent;
    return pagesContent;
  }

  function getSelectionInfo(container) {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return null;

    const range = sel.getRangeAt(0);
    const text = sel.toString().trim();
    if (!text || text.length < 2) return null;

    if (!container.contains(range.commonAncestorContainer)) return null;

    // Find the closest .page-content ancestor for offset calculation
    let pageContent = range.commonAncestorContainer;
    while (pageContent && !pageContent.classList?.contains('page-content')) {
      pageContent = pageContent.parentElement;
    }
    if (!pageContent) pageContent = container.querySelector('.page-content');
    if (!pageContent) return null;

    const startOffset = getTextOffset(pageContent, range.startContainer, range.startOffset);
    const endOffset = getTextOffset(pageContent, range.endContainer, range.endOffset);

    return { text, startOffset, endOffset, range, isEquation: false };
  }

  function getTextOffset(root, node, offset) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let charCount = 0;
    while (walker.nextNode()) {
      if (walker.currentNode === node) return charCount + offset;
      charCount += walker.currentNode.textContent.length;
    }
    return charCount + offset;
  }

  // Listen on both content areas
  function onMouseUp(e) {
    setTimeout(() => {
      const container = getActiveContentEl();
      const info = getSelectionInfo(container);
      if (info) {
        const rect = info.range.getBoundingClientRect();
        showPopup(rect.left + rect.width / 2 - 120, rect.top + window.scrollY, info);
      } else {
        hidePopup();
      }
    }, 10);
  }

  pagesContent.addEventListener('mouseup', onMouseUp);
  if (scrollContent) scrollContent.addEventListener('mouseup', onMouseUp);

  // ─── MATHJAX EQUATION CLICK ────────────────────────────────────

  function onMathClick(e) {
    // Walk up to find the mjx-container
    let el = e.target;
    while (el && el.tagName !== 'MJX-CONTAINER') {
      el = el.parentElement;
    }
    if (!el) return;

    // Extract LaTeX source
    let latex = '';

    // MathJax 3 stores the original in aria-label or in the source element
    // Try multiple methods
    if (el.getAttribute('data-mjx-texclass')) {
      // Search for the original TeX in a <script> or <annotation> inside
      const annotation = el.querySelector('annotation');
      if (annotation) latex = annotation.textContent;
    }

    // Fallback: reconstruct from the container's accessible text
    if (!latex) {
      latex = el.getAttribute('aria-label') || '';
    }

    // Fallback: get the alt text or textContent
    if (!latex) {
      latex = el.textContent || '';
    }

    if (!latex || latex.length < 2) return;

    // Check if display or inline
    const isDisplay = el.getAttribute('display') === 'true';
    const displayText = isDisplay ? '\\[' + latex + '\\]' : '\\(' + latex + '\\)';

    const rect = el.getBoundingClientRect();
    const info = {
      text: displayText,
      startOffset: -1,  // equation highlights use text match, not offsets
      endOffset: -1,
      range: null,
      isEquation: true,
      element: el,
    };

    showPopup(rect.left + rect.width / 2 - 120, rect.top + window.scrollY, info);
  }

  // Delegate click on mjx-container elements
  document.addEventListener('click', (e) => {
    // Check if we clicked on or inside a MathJax container
    let el = e.target;
    while (el && el !== document.body) {
      if (el.tagName === 'MJX-CONTAINER') {
        e.preventDefault();
        e.stopPropagation();
        onMathClick(e);
        return;
      }
      el = el.parentElement;
    }
  }, true);

  // Close popup on outside click (but not on MathJax)
  document.addEventListener('mousedown', (e) => {
    if (popup && !popup.contains(e.target)) {
      let el = e.target;
      while (el && el !== document.body) {
        if (el.tagName === 'MJX-CONTAINER') return; // don't close for math clicks
        el = el.parentElement;
      }
      hidePopup();
    }
  });

  // ─── SAVE HIGHLIGHT ────────────────────────────────────────────

  async function saveHighlight(info) {
    hidePopup();
    window.getSelection().removeAllRanges();

    try {
      const res = await fetch('/api/highlights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookId: R.bookId,
          pageNumber: R.currentPage,
          startOffset: info.startOffset,
          endOffset: info.endOffset,
          text: info.text,
        }),
      });
      const hl = await res.json();

      // Visual highlight
      if (info.isEquation && info.element) {
        info.element.classList.add('reader-highlight-eq');
      } else if (info.range) {
        applyHighlightToRange(info.range, hl._id);
      }
    } catch (err) {
      console.error('Failed to save highlight:', err);
    }
  }

  function applyHighlightToRange(range, hlId) {
    const mark = document.createElement('mark');
    mark.className = 'reader-highlight';
    mark.dataset.highlightId = hlId;
    try {
      range.surroundContents(mark);
    } catch (e) {
      const fragment = range.extractContents();
      mark.appendChild(fragment);
      range.insertNode(mark);
    }
  }

  // ─── ASK AI ────────────────────────────────────────────────────

  async function askAI(info) {
    hidePopup();
    window.getSelection().removeAllRanges();

    // Save highlight
    try {
      const res = await fetch('/api/highlights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookId: R.bookId,
          pageNumber: R.currentPage,
          startOffset: info.startOffset,
          endOffset: info.endOffset,
          text: info.text,
        }),
      });
      const hl = await res.json();
      if (info.isEquation && info.element) {
        info.element.classList.add('reader-highlight-eq');
      } else if (info.range) {
        applyHighlightToRange(info.range, hl._id);
      }
    } catch (e) {}

    // Open split chat panel
    if (window.__openSplitChat) {
      window.__openSplitChat(info.text);
    }
  }

  // ─── LOAD EXISTING HIGHLIGHTS ──────────────────────────────────

  async function loadHighlights() {
    try {
      const res = await fetch(`/api/highlights/${R.bookId}/${R.currentPage}`);
      const highlights = await res.json();
      renderHighlights(highlights);
    } catch (e) {}
  }

  function renderHighlights(highlights) {
    const container = getActiveContentEl();
    const pageContent = container.querySelector('.page-content');
    if (!pageContent || highlights.length === 0) return;

    const walker = document.createTreeWalker(pageContent, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);

    highlights.forEach(hl => {
      if (hl.startOffset < 0) return; // equation highlight, skip offset-based rendering
      try {
        const range = document.createRange();
        let charCount = 0;
        let startSet = false;

        for (const node of textNodes) {
          const nodeEnd = charCount + node.textContent.length;
          if (!startSet && hl.startOffset >= charCount && hl.startOffset < nodeEnd) {
            range.setStart(node, hl.startOffset - charCount);
            startSet = true;
          }
          if (startSet && hl.endOffset >= charCount && hl.endOffset <= nodeEnd) {
            range.setEnd(node, hl.endOffset - charCount);
            applyHighlightToRange(range, hl._id);
            break;
          }
          charCount = nodeEnd;
        }
      } catch (e) {}
    });
  }

  loadHighlights();

  window.__readerAfterPageLoad = function () {
    loadHighlights();
  };
})();
