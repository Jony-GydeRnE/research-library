/**
 * Reader highlighting system.
 * - Temporary highlights clear on dismiss (only persisted on explicit action)
 * - Right-click context menu replaced with our popup
 * - Persisted highlights with chatId are clickable → open split chat
 * - Selections spanning MathJax elements extract LaTeX source
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
      <button class="hl-btn hl-highlight">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
        Highlight
      </button>
      <button class="hl-btn hl-note">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
        Note
      </button>
      <button class="hl-btn hl-ask">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        Ask AI
      </button>
    `;
    document.body.appendChild(popup);

    popup.querySelector('.hl-highlight').addEventListener('click', () => { if (pendingInfo) persistHighlight(pendingInfo); });
    popup.querySelector('.hl-note').addEventListener('click', () => { if (pendingInfo) openNote(pendingInfo); });
    popup.querySelector('.hl-ask').addEventListener('click', () => { if (pendingInfo) askAI(pendingInfo); });

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
    // Clear temporary selection — don't persist
    window.getSelection().removeAllRanges();
    pendingInfo = null;
  }

  // ─── ACTIVE CONTAINER ──────────────────────────────────────────

  function getActiveContentEl() {
    if (scrollContent && scrollContent.style.display !== 'none') return scrollContent;
    return pagesContent;
  }

  // ─── EXTRACT SELECTION (text + LaTeX from equations) ───────────

  function getSelectionInfo(container) {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return null;

    const range = sel.getRangeAt(0);
    if (!container.contains(range.commonAncestorContainer)) return null;

    // Build rich text: walk through the range, extract text nodes and LaTeX from mjx-containers
    const richText = extractRichText(range);
    if (!richText || richText.length < 2) return null;

    // Find page-content for offset calc
    let pageContent = range.commonAncestorContainer;
    while (pageContent && !pageContent.classList?.contains('page-content')) {
      pageContent = pageContent.parentElement;
    }
    if (!pageContent) pageContent = container.querySelector('.page-content');

    let startOffset = -1, endOffset = -1;
    if (pageContent) {
      startOffset = getTextOffset(pageContent, range.startContainer, range.startOffset);
      endOffset = getTextOffset(pageContent, range.endContainer, range.endOffset);
    }

    return { text: richText, startOffset, endOffset, range, isEquation: false };
  }

  /** Walk through a range and extract text + LaTeX from any mjx-container elements. */
  function extractRichText(range) {
    const fragment = range.cloneContents();
    let result = '';

    function walk(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        result += node.textContent;
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        if (node.tagName === 'MJX-CONTAINER') {
          // Extract LaTeX
          const latex = getMathLatex(node);
          const isDisplay = node.getAttribute('display') === 'true';
          result += isDisplay ? ' \\[' + latex + '\\] ' : ' \\(' + latex + '\\) ';
        } else {
          node.childNodes.forEach(walk);
        }
      }
    }

    fragment.childNodes.forEach(walk);
    return result.trim();
  }

  /** Extract LaTeX source from a MathJax container element. */
  function getMathLatex(el) {
    const annotation = el.querySelector('annotation');
    if (annotation) return annotation.textContent;
    return el.getAttribute('aria-label') || el.textContent || '';
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

  // ─── MOUSEUP + RIGHT-CLICK ─────────────────────────────────────

  function onSelectionEvent(e, fromContextMenu) {
    const handle = () => {
      const container = getActiveContentEl();
      const info = getSelectionInfo(container);
      if (info) {
        const rect = info.range.getBoundingClientRect();
        const x = fromContextMenu ? e.clientX : rect.left + rect.width / 2 - 120;
        const y = fromContextMenu ? e.clientY + window.scrollY : rect.top + window.scrollY;
        showPopup(x, y, info);
      } else if (!fromContextMenu) {
        // Only hide on mouseup if nothing selected — don't hide on right-click miss
      }
    };

    if (fromContextMenu) handle();
    else setTimeout(handle, 10);
  }

  function onMouseUp(e) { onSelectionEvent(e, false); }

  function onContextMenu(e) {
    const container = getActiveContentEl();
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed && container.contains(sel.anchorNode)) {
      e.preventDefault();
      onSelectionEvent(e, true);
    }
  }

  pagesContent.addEventListener('mouseup', onMouseUp);
  pagesContent.addEventListener('contextmenu', onContextMenu);
  if (scrollContent) {
    scrollContent.addEventListener('mouseup', onMouseUp);
    scrollContent.addEventListener('contextmenu', onContextMenu);
  }

  // ─── MATHJAX EQUATION CLICK ────────────────────────────────────

  document.addEventListener('click', (e) => {
    let el = e.target;
    while (el && el !== document.body) {
      if (el.tagName === 'MJX-CONTAINER') {
        e.preventDefault();
        e.stopPropagation();
        const latex = getMathLatex(el);
        if (!latex || latex.length < 2) return;
        const isDisplay = el.getAttribute('display') === 'true';
        const text = isDisplay ? '\\[' + latex + '\\]' : '\\(' + latex + '\\)';
        const rect = el.getBoundingClientRect();
        showPopup(rect.left + rect.width / 2 - 120, rect.top + window.scrollY, {
          text, startOffset: -1, endOffset: -1, range: null, isEquation: true, element: el,
        });
        return;
      }
      el = el.parentElement;
    }
  }, true);

  // Close popup on outside click
  document.addEventListener('mousedown', (e) => {
    if (popup && !popup.contains(e.target)) {
      let el = e.target;
      while (el && el !== document.body) {
        if (el.tagName === 'MJX-CONTAINER') return;
        el = el.parentElement;
      }
      hidePopup();
    }
  });

  // ─── PERSIST HIGHLIGHT ─────────────────────────────────────────

  async function persistHighlight(info) {
    hidePopup();

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
        info.element.dataset.highlightId = hl._id;
      } else if (info.range) {
        applyHighlightToRange(info.range, hl._id);
      }
    } catch (err) {
      console.error('Failed to save highlight:', err);
    }
  }

  function applyHighlightToRange(range, hlId) {
    // Use highlight/mark wrapping that handles cross-element selections
    try {
      const mark = document.createElement('mark');
      mark.className = 'reader-highlight';
      mark.dataset.highlightId = hlId;
      range.surroundContents(mark);
    } catch (e) {
      // Cross-element selection: wrap each text node segment individually
      const startContainer = range.startContainer;
      const endContainer = range.endContainer;

      if (startContainer === endContainer) {
        // Same node — extract and wrap
        const mark = document.createElement('mark');
        mark.className = 'reader-highlight';
        mark.dataset.highlightId = hlId;
        const fragment = range.extractContents();
        mark.appendChild(fragment);
        range.insertNode(mark);
      } else {
        // Multi-node: wrap the fragment
        const mark = document.createElement('mark');
        mark.className = 'reader-highlight';
        mark.dataset.highlightId = hlId;
        const fragment = range.extractContents();
        mark.appendChild(fragment);
        range.insertNode(mark);
      }
    }
  }

  // ─── OPEN NOTE ─────────────────────────────────────────────────

  async function openNote(info) {
    let hlId = null;

    // Persist highlight
    try {
      const res = await fetch('/api/highlights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookId: R.bookId, pageNumber: R.currentPage,
          startOffset: info.startOffset, endOffset: info.endOffset, text: info.text,
        }),
      });
      const hl = await res.json();
      hlId = hl._id;
      if (info.isEquation && info.element) {
        info.element.classList.add('reader-highlight-eq');
        info.element.dataset.highlightId = hl._id;
      } else if (info.range) {
        applyHighlightToRange(info.range, hl._id);
      }
    } catch (e) {}

    hidePopup();

    if (window.__openNotesPanel) {
      window.__openNotesPanel(info.text, hlId);
    }
  }

  // ─── ASK AI ────────────────────────────────────────────────────

  async function askAI(info) {
    // Save highlight first
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
        info.element.dataset.highlightId = hl._id;
      } else if (info.range) {
        applyHighlightToRange(info.range, hl._id);
      }
    } catch (e) {}

    hidePopup();

    if (window.__openSplitChat) {
      // Pass a callback to link the chat to the highlight after creation
      var _hlId = hlId;
      window.__openSplitChat(info.text, function(newChatId) {
        if (_hlId && newChatId) {
          fetch('/api/highlights/link-chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ highlightId: _hlId, chatId: newChatId }),
          }).catch(function(){});
        }
      });
    }
  }

  // ─── CLICK ON PERSISTED HIGHLIGHTS ─────────────────────────────

  let chatDropdown = null;

  function removeChatDropdown() {
    if (chatDropdown) { chatDropdown.remove(); chatDropdown = null; }
  }

  document.addEventListener('click', (e) => {
    // Close dropdown on outside click
    if (chatDropdown && !chatDropdown.contains(e.target)) {
      removeChatDropdown();
    }

    const mark = e.target.closest('.reader-highlight[data-highlight-id], .reader-highlight-eq[data-highlight-id]');
    if (!mark) return;

    const hlId = mark.dataset.highlightId;
    if (!hlId) return;

    fetch(`/api/highlights/chat/${hlId}`).then(r => r.json()).then(data => {
      if (data.chats && data.chats.length === 1) {
        // Single chat — open directly
        if (window.__openSplitChatWithId) window.__openSplitChatWithId(data.chats[0]._id);
      } else if (data.chats && data.chats.length > 1) {
        // Multiple chats — show dropdown
        removeChatDropdown();
        chatDropdown = document.createElement('div');
        chatDropdown.className = 'highlight-chat-dropdown';
        const rect = mark.getBoundingClientRect();
        chatDropdown.style.left = rect.left + 'px';
        chatDropdown.style.top = (rect.bottom + window.scrollY + 4) + 'px';

        data.chats.forEach(chat => {
          const item = document.createElement('button');
          item.className = 'hl-dropdown-item';
          item.textContent = chat.title || 'Untitled Chat';
          item.addEventListener('click', () => {
            removeChatDropdown();
            if (window.__openSplitChatWithId) window.__openSplitChatWithId(chat._id);
          });
          chatDropdown.appendChild(item);
        });

        document.body.appendChild(chatDropdown);
      } else {
        // No chats — open new chat with highlight text
        const text = mark.textContent || mark.getAttribute('aria-label') || '';
        if (text && window.__openSplitChat) window.__openSplitChat(text);
      }
    }).catch(() => {});
  });

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
      if (hl.startOffset < 0) return;
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
  window.__readerAfterPageLoad = function () { loadHighlights(); };
})();
