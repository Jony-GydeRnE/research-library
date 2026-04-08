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

    popup.querySelector('.hl-highlight').addEventListener('click', (e) => {
      if (!pendingInfo) return;
      if (pendingInfo._existingHlId) {
        var btnRect = e.target.closest('.hl-btn').getBoundingClientRect();
        var hlId = pendingInfo._existingHlId;
        var markEl = pendingInfo._markEl;
        hidePopup();
        showColorPicker(hlId, markEl, btnRect);
        return;
      }
      persistHighlight(pendingInfo);
    });
    popup.querySelector('.hl-note').addEventListener('click', (e) => {
      if (!pendingInfo) return;
      if (pendingInfo._existingHlId) {
        var hlId = pendingInfo._existingHlId;
        var text = pendingInfo.text;
        var noteIds = pendingInfo._noteIds || [];
        var btnRect = e.target.closest('.hl-btn').getBoundingClientRect();
        hidePopup();
        if (noteIds.length > 0) {
          showNotesDropdown(text, hlId, noteIds, btnRect);
        } else {
          if (window.__openNotesPanel) window.__openNotesPanel(text, hlId);
        }
        return;
      }
      openNote(pendingInfo);
    });
    popup.querySelector('.hl-ask').addEventListener('click', (e) => {
      if (!pendingInfo) return;
      if (pendingInfo._existingHlId) {
        // Existing highlight: fetch chats BEFORE doing anything
        var hlId = pendingInfo._existingHlId;
        var text = pendingInfo.text;
        var btnRect = e.target.closest('.hl-btn').getBoundingClientRect();
        hidePopup();
        askAIExisting(hlId, text, btnRect);
        return;
      }
      askAI(pendingInfo);
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

  // Close popup and dropdown on outside click
  document.addEventListener('mousedown', (e) => {
    // Don't close if clicking inside popup or dropdown
    if (popup && popup.contains(e.target)) return;
    if (chatDropdown && chatDropdown.contains(e.target)) return;

    // Don't close for MathJax clicks (handled separately)
    let el = e.target;
    while (el && el !== document.body) {
      if (el.tagName === 'MJX-CONTAINER') return;
      el = el.parentElement;
    }

    if (popup && popup.style.display !== 'none') hidePopup();
    removeChatDropdown();
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
    let savedHlId = null;
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
      savedHlId = hl._id;
      if (info.isEquation && info.element) {
        info.element.classList.add('reader-highlight-eq');
        info.element.dataset.highlightId = hl._id;
      } else if (info.range) {
        applyHighlightToRange(info.range, hl._id);
      }
    } catch (e) {}

    hidePopup();

    // Check if this highlight already has chats
    if (savedHlId) {
      try {
        const chatsRes = await fetch('/api/highlights/chat/' + savedHlId);
        const chatsData = await chatsRes.json();
        if (chatsData.chats && chatsData.chats.length > 0) {
          // Show dropdown with existing chats + "New Chat" option
          showAskAIDropdown(info.text, savedHlId, chatsData.chats);
          return;
        }
      } catch(e) {}
    }

    // No existing chats — open fresh split chat
    openFreshChat(info.text, savedHlId);
  }

  function openFreshChat(text, hlId) {
    if (window.__openSplitChat) {
      window.__openSplitChat(text, function(newChatId) {
        if (hlId && newChatId) {
          fetch('/api/highlights/link-chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ highlightId: hlId, chatId: newChatId }),
          }).catch(function(){});
        }
      });
    }
  }

  function showAskAIDropdown(text, hlId, existingChats, anchorRect) {
    removeChatDropdown();
    chatDropdown = document.createElement('div');
    chatDropdown.className = 'highlight-chat-dropdown';

    // Position below the anchor (the Ask AI button or the highlight mark)
    if (anchorRect) {
      chatDropdown.style.position = 'fixed';
      chatDropdown.style.left = Math.min(anchorRect.left, window.innerWidth - 240) + 'px';
      chatDropdown.style.top = (anchorRect.bottom + 4) + 'px';
    } else {
      chatDropdown.style.position = 'fixed';
      chatDropdown.style.left = '50%';
      chatDropdown.style.top = '50%';
      chatDropdown.style.transform = 'translate(-50%, -50%)';
    }

    // "New Chat" button
    const newBtn = document.createElement('button');
    newBtn.className = 'hl-dropdown-item hl-dropdown-new';
    newBtn.textContent = '+ New Chat';
    newBtn.addEventListener('click', function() {
      removeChatDropdown();
      openFreshChat(text, hlId);
    });
    chatDropdown.appendChild(newBtn);

    // Existing chats
    existingChats.forEach(function(chat) {
      const item = document.createElement('button');
      item.className = 'hl-dropdown-item';
      item.textContent = chat.title || 'Untitled Chat';
      item.addEventListener('click', function() {
        removeChatDropdown();
        if (window.__openSplitChatWithId) window.__openSplitChatWithId(chat._id);
      });
      chatDropdown.appendChild(item);
    });

    document.body.appendChild(chatDropdown);
    setTimeout(function() { chatDropdown.dataset.ready = 'true'; }, 50);
  }

  // ─── COLOR PICKER ──────────────────────────────────────────────

  const HL_COLORS = [
    { name: 'Bondi Blue', value: 'rgba(0, 155, 189, 0.25)' },
    { name: 'Grape', value: 'rgba(108, 52, 131, 0.25)' },
    { name: 'Tangerine', value: 'rgba(255, 128, 0, 0.25)' },
    { name: 'Strawberry', value: 'rgba(225, 44, 44, 0.25)' },
    { name: 'Lime', value: 'rgba(99, 187, 62, 0.25)' },
  ];

  function showColorPicker(hlId, markEl, anchorRect) {
    removeChatDropdown();

    chatDropdown = document.createElement('div');
    chatDropdown.className = 'highlight-chat-dropdown hl-color-picker';
    chatDropdown.style.position = 'fixed';
    chatDropdown.style.left = Math.min(anchorRect.left, window.innerWidth - 220) + 'px';
    chatDropdown.style.top = (anchorRect.bottom + 4) + 'px';
    chatDropdown.style.display = 'flex';
    chatDropdown.style.gap = '4px';
    chatDropdown.style.padding = '6px 8px';
    chatDropdown.style.alignItems = 'center';

    HL_COLORS.forEach(function(c) {
      var swatch = document.createElement('button');
      swatch.className = 'hl-color-swatch';
      swatch.style.background = c.value.replace('0.25', '0.6');
      swatch.title = c.name;
      swatch.addEventListener('click', function() {
        fetch('/api/highlights/' + hlId, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ color: c.value }),
        }).catch(function(){});
        if (markEl) markEl.style.background = c.value;
        removeChatDropdown();
      });
      chatDropdown.appendChild(swatch);
    });

    // Remove highlight swatch
    var removeSwatch = document.createElement('button');
    removeSwatch.className = 'hl-color-swatch hl-color-remove';
    removeSwatch.title = 'Remove highlight';
    removeSwatch.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/></svg>';
    removeSwatch.addEventListener('click', async function() {
      // Check for attached chats/notes before deleting
      try {
        var detail = await fetch('/api/highlights/detail/' + hlId).then(function(r) { return r.json(); });
        var chatCount = (detail.chatIds || []).length;
        var noteCount = (detail.noteIds || []).length;
        if (chatCount > 0 || noteCount > 0) {
          var msg = 'This highlight has ' + chatCount + ' chat(s) and ' + noteCount + ' note(s) attached. Remove anyway?';
          if (!confirm(msg)) { removeChatDropdown(); return; }
        }
      } catch(e) {}

      fetch('/api/highlights/' + hlId, { method: 'DELETE' }).catch(function(){});
      if (markEl) {
        var parent = markEl.parentNode;
        while (markEl.firstChild) parent.insertBefore(markEl.firstChild, markEl);
        markEl.remove();
      }
      removeChatDropdown();
    });
    chatDropdown.appendChild(removeSwatch);

    document.body.appendChild(chatDropdown);
    // Delay readiness so the same click doesn't immediately dismiss
    setTimeout(function() { chatDropdown.dataset.ready = 'true'; }, 50);
  }

  // ─── NOTES DROPDOWN ─────────────────────────────────────────────

  async function showNotesDropdown(text, hlId, noteIds, anchorRect) {
    removeChatDropdown();
    chatDropdown = document.createElement('div');
    chatDropdown.className = 'highlight-chat-dropdown';
    chatDropdown.style.position = 'fixed';
    chatDropdown.style.left = Math.min(anchorRect.left, window.innerWidth - 240) + 'px';
    chatDropdown.style.top = (anchorRect.bottom + 4) + 'px';

    // "+ New Note" button
    var newBtn = document.createElement('button');
    newBtn.className = 'hl-dropdown-item hl-dropdown-new';
    newBtn.textContent = '+ New Note';
    newBtn.addEventListener('click', function() {
      removeChatDropdown();
      if (window.__openNotesPanel) window.__openNotesPanel(text, hlId);
    });
    chatDropdown.appendChild(newBtn);

    // Load existing notes — newest first
    var reversedIds = noteIds.slice().reverse();
    for (var i = 0; i < reversedIds.length; i++) {
      try {
        var res = await fetch('/api/notes/' + reversedIds[i]);
        var note = await res.json();
        var item = document.createElement('button');
        item.className = 'hl-dropdown-item';
        item.textContent = note.title || (note.content ? note.content.substring(0, 40) + '...' : 'Untitled Note');
        (function(noteId) {
          item.addEventListener('click', function() {
            removeChatDropdown();
            if (window.__openNotesPanelWithId) window.__openNotesPanelWithId(noteId, text, hlId);
          });
        })(reversedIds[i]);
        chatDropdown.appendChild(item);
      } catch(e) {}
    }

    document.body.appendChild(chatDropdown);
    setTimeout(function() { chatDropdown.dataset.ready = 'true'; }, 50);
  }

  // ─── ASK AI ON EXISTING HIGHLIGHT ───────────────────────────────

  async function askAIExisting(hlId, text, anchorRect) {
    // Do NOT open split panel yet — check for existing chats first
    try {
      const res = await fetch('/api/highlights/chat/' + hlId);
      const data = await res.json();
      if (data.chats && data.chats.length > 0) {
        // Show dropdown with existing chats + New Chat
        showAskAIDropdown(text, hlId, data.chats, anchorRect);
        return;
      }
    } catch(e) {}

    // No existing chats — open fresh split chat directly
    openFreshChat(text, hlId);
  }

  // ─── CLICK ON PERSISTED HIGHLIGHTS ─────────────────────────────

  let chatDropdown = null;

  function removeChatDropdown() {
    if (chatDropdown) { chatDropdown.remove(); chatDropdown = null; }
  }

  document.addEventListener('click', (e) => {
    // Close dropdown on outside click (only after it's ready)
    if (chatDropdown && !chatDropdown.contains(e.target) && chatDropdown.dataset.ready) {
      removeChatDropdown();
    }

    // Don't handle clicks inside the popup itself
    if (popup && popup.contains(e.target)) return;

    const mark = e.target.closest('.reader-highlight[data-highlight-id], .reader-highlight-eq[data-highlight-id]');
    if (!mark) return;

    const hlId = mark.dataset.highlightId;
    if (!hlId) return;

    // Fetch highlight data (for noteId), then show popup
    const rect = mark.getBoundingClientRect();
    const hlText = mark.textContent || mark.getAttribute('aria-label') || '';

    fetch('/api/highlights/chat/' + hlId).then(r => r.json()).then(function(data) {
      // data may have noteId from the highlight doc — we need a separate fetch
      // For now, construct info; noteId will be fetched separately when needed
      const persistedInfo = {
        text: hlText,
        startOffset: -1,
        endOffset: -1,
        range: null,
        isEquation: mark.classList.contains('reader-highlight-eq'),
        element: mark.classList.contains('reader-highlight-eq') ? mark : null,
        _existingHlId: hlId,
        _markEl: mark,
        _noteIds: [],
      };

      // Fetch the highlight to get noteIds
      fetch('/api/highlights/detail/' + hlId).then(function(r2) { return r2.json(); }).then(function(hlData) {
        persistedInfo._noteIds = hlData.noteIds || [];
        showPopup(rect.left + rect.width / 2 - 120, rect.top + window.scrollY, persistedInfo);
      }).catch(function() {
        showPopup(rect.left + rect.width / 2 - 120, rect.top + window.scrollY, persistedInfo);
      });
    }).catch(function() {
      const persistedInfo = {
        text: hlText, startOffset: -1, endOffset: -1, range: null,
        isEquation: false, element: null, _existingHlId: hlId, _markEl: mark, _noteId: null,
      };
      showPopup(rect.left + rect.width / 2 - 120, rect.top + window.scrollY, persistedInfo);
    });
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
