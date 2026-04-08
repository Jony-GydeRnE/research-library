/**
 * Reader highlighting system.
 * Shows popup on text selection with Highlight / Add Note / Ask AI buttons.
 * Loads and renders existing highlights on page load/navigation.
 */
(() => {
  const R = window.__READER__;
  const content = document.getElementById('readerContent');
  let popup = null;

  // ─── CREATE POPUP ──────────────────────────────────────────────

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
    return popup;
  }

  function showPopup(x, y) {
    createPopup();
    popup.style.display = 'flex';
    popup.style.left = Math.min(x, window.innerWidth - 260) + 'px';
    popup.style.top = (y - 45) + 'px';
  }

  function hidePopup() {
    if (popup) popup.style.display = 'none';
  }

  // ─── SELECTION HANDLER ─────────────────────────────────────────

  function getSelectionInfo() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return null;

    const range = sel.getRangeAt(0);
    const text = sel.toString().trim();
    if (!text || text.length < 2) return null;

    // Check selection is inside reader content
    if (!content.contains(range.commonAncestorContainer)) return null;

    // Calculate offsets relative to the page content text
    const pageContent = content.querySelector('.page-content');
    if (!pageContent) return null;

    // Use a TreeWalker to calculate character offsets
    const startOffset = getTextOffset(pageContent, range.startContainer, range.startOffset);
    const endOffset = getTextOffset(pageContent, range.endContainer, range.endOffset);

    return { text, startOffset, endOffset, range };
  }

  function getTextOffset(root, node, offset) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let charCount = 0;
    while (walker.nextNode()) {
      if (walker.currentNode === node) {
        return charCount + offset;
      }
      charCount += walker.currentNode.textContent.length;
    }
    return charCount + offset;
  }

  content.addEventListener('mouseup', (e) => {
    setTimeout(() => {
      const info = getSelectionInfo();
      if (info) {
        const rect = info.range.getBoundingClientRect();
        showPopup(rect.left + rect.width / 2 - 120, rect.top + window.scrollY);

        // Wire buttons
        popup.querySelector('.hl-highlight').onclick = () => saveHighlight(info);
        popup.querySelector('.hl-ask').onclick = () => askAI(info);
        popup.querySelector('.hl-note').onclick = () => { saveHighlight(info); /* TODO: open note panel */ };
      } else {
        hidePopup();
      }
    }, 10);
  });

  document.addEventListener('mousedown', (e) => {
    if (popup && !popup.contains(e.target)) hidePopup();
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

      // Visually mark the text
      applyHighlightToRange(info.range, hl._id);
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
      // surroundContents fails on partial element selections — use extractContents
      const fragment = range.extractContents();
      mark.appendChild(fragment);
      range.insertNode(mark);
    }
  }

  // ─── ASK AI ────────────────────────────────────────────────────

  async function askAI(info) {
    hidePopup();
    window.getSelection().removeAllRanges();

    // Save highlight first
    await fetch('/api/highlights', {
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

    // Create chat with highlight context
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Explain this passage: "' + info.text.substring(0, 500) + '"',
        context: 'reader',
        bookId: R.bookId,
        pageNumber: R.currentPage,
        highlightText: info.text,
      }),
    });
    const data = await res.json();
    if (data.chatId) window.location.href = '/chat/' + data.chatId;
  }

  // ─── LOAD EXISTING HIGHLIGHTS ──────────────────────────────────

  async function loadHighlights() {
    try {
      const res = await fetch(`/api/highlights/${R.bookId}/${R.currentPage}`);
      const highlights = await res.json();
      renderHighlights(highlights);
    } catch (e) {
      // Silently fail
    }
  }

  function renderHighlights(highlights) {
    const pageContent = content.querySelector('.page-content');
    if (!pageContent || highlights.length === 0) return;

    // Get all text nodes
    const walker = document.createTreeWalker(pageContent, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);

    // For each highlight, find the text range and wrap it
    highlights.forEach(hl => {
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
      } catch (e) {
        // Skip highlights that can't be re-rendered (DOM changed)
      }
    });
  }

  // Load highlights on page load
  loadHighlights();

  // Re-load highlights when page changes (hook into reader.js goToPage)
  const origGoToPage = window.__readerGoToPage;
  window.__readerAfterPageLoad = function() {
    loadHighlights();
  };
})();
