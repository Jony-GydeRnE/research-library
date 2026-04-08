/**
 * Notes panel — slides from right in the reader.
 * Rich text editor with live MathJax rendering.
 */
(() => {
  const R = window.__READER__;
  const readerMain = document.getElementById('readerMain');
  const inputBar = document.querySelector('.reader-wrapper > .input-bar');

  // Create the panel DOM
  const divider = document.createElement('div');
  divider.className = 'split-divider notes-divider';
  divider.id = 'notesDivider';
  divider.style.display = 'none';

  const panel = document.createElement('div');
  panel.className = 'split-chat-panel notes-panel';
  panel.id = 'notesPanel';
  panel.style.display = 'none';
  panel.innerHTML = `
    <div class="split-chat-header">
      <span class="split-chat-title">Note</span>
      <div style="display:flex;gap:0.25rem;">
        <button class="reader-btn notes-latex-btn" id="notesLatexInline" title="Wrap in inline math \\( \\)">
          <span style="font-size:0.75rem;font-weight:600;">\\(x\\)</span>
        </button>
        <button class="reader-btn notes-latex-btn" id="notesLatexDisplay" title="Wrap in display math \\[ \\]">
          <span style="font-size:0.75rem;font-weight:600;">\\[x\\]</span>
        </button>
        <button class="reader-btn" id="notesCloseBtn" title="Close">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    </div>
    <div class="notes-quote" id="notesQuote" style="display:none;">
      <blockquote id="notesQuoteText"></blockquote>
    </div>
    <div class="notes-editor-wrap">
      <div class="notes-editor" id="notesEditor" contenteditable="true" placeholder="Write your note..."></div>
      <div class="notes-preview" id="notesPreview"></div>
    </div>
    <div class="notes-footer">
      <button class="btn btn-primary btn-sm" id="notesSaveBtn">Save Note</button>
      <span class="notes-status" id="notesStatus"></span>
    </div>
  `;

  // Insert into reader-body-row (after readerMain)
  const bodyRow = readerMain.parentElement;
  bodyRow.appendChild(divider);
  bodyRow.appendChild(panel);

  let isOpen = false;
  let currentHighlightId = null;
  let currentNoteId = null;
  let highlightText = null;
  let typesetTimer = null;
  let splitRatio = parseFloat(localStorage.getItem('gyde-notes-ratio')) || 0.6;

  // ─── OPEN / CLOSE ─────────────────────────────────────────────

  function openNotesPanel(hlText, hlId) {
    highlightText = hlText;
    currentHighlightId = hlId || null;
    currentNoteId = null;

    const editor = document.getElementById('notesEditor');
    const quote = document.getElementById('notesQuote');
    const quoteText = document.getElementById('notesQuoteText');
    const status = document.getElementById('notesStatus');

    editor.innerHTML = '';
    status.textContent = '';

    if (highlightText) {
      quoteText.textContent = highlightText;
      quote.style.display = '';
    } else {
      quote.style.display = 'none';
    }

    isOpen = true;
    panel.style.display = 'flex';
    divider.style.display = '';
    if (inputBar) inputBar.style.display = 'none';
    applyRatio();
    editor.focus();
  }

  function closeNotesPanel() {
    isOpen = false;
    panel.style.display = 'none';
    divider.style.display = 'none';
    if (inputBar) inputBar.style.display = '';
    readerMain.style.flex = '';
    readerMain.style.width = '';
  }

  function applyRatio() {
    readerMain.style.flex = 'none';
    readerMain.style.width = (splitRatio * 100) + '%';
    panel.style.width = ((1 - splitRatio) * 100 - 0.3) + '%';
  }

  document.getElementById('notesCloseBtn').addEventListener('click', closeNotesPanel);

  // Expose for highlights.js
  window.__openNotesPanel = openNotesPanel;

  // ─── DRAGGABLE DIVIDER ─────────────────────────────────────────

  let dragging = false;
  divider.addEventListener('mousedown', (e) => {
    dragging = true;
    e.preventDefault();
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  });
  document.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const rect = bodyRow.getBoundingClientRect();
    let ratio = (e.clientX - rect.left) / rect.width;
    ratio = Math.max(0.3, Math.min(0.8, ratio));
    splitRatio = ratio;
    localStorage.setItem('gyde-notes-ratio', ratio);
    applyRatio();
  });
  document.addEventListener('mouseup', () => {
    if (dragging) { dragging = false; document.body.style.cursor = ''; document.body.style.userSelect = ''; }
  });

  // ─── LATEX BUTTONS ─────────────────────────────────────────────

  document.getElementById('notesLatexInline').addEventListener('click', () => {
    insertLatexWrap('\\(', '\\)');
  });

  document.getElementById('notesLatexDisplay').addEventListener('click', () => {
    insertLatexWrap('\\[', '\\]');
  });

  function insertLatexWrap(open, close) {
    const editor = document.getElementById('notesEditor');
    const sel = window.getSelection();
    if (!sel.rangeCount || !editor.contains(sel.anchorNode)) {
      // No selection — insert at cursor
      document.execCommand('insertText', false, open + ' ' + close);
      return;
    }
    const text = sel.toString();
    document.execCommand('insertText', false, open + (text || ' ') + close);
  }

  // ─── LIVE MATHJAX PREVIEW ──────────────────────────────────────

  const editor = document.getElementById('notesEditor');
  const preview = document.getElementById('notesPreview');

  editor.addEventListener('input', () => {
    clearTimeout(typesetTimer);
    typesetTimer = setTimeout(() => {
      preview.innerHTML = editor.innerHTML;
      if (window.MathJax && MathJax.typesetPromise) {
        MathJax.typesetPromise([preview]).catch(() => {});
      }
    }, 500);
  });

  // ─── SAVE ──────────────────────────────────────────────────────

  document.getElementById('notesSaveBtn').addEventListener('click', async () => {
    const content = editor.innerHTML;
    const status = document.getElementById('notesStatus');

    if (!content.trim()) {
      status.textContent = 'Note is empty';
      return;
    }

    try {
      const body = {
        bookId: R.bookId,
        pageNumber: R.currentPage,
        content,
        highlightId: currentHighlightId || undefined,
      };

      let res;
      if (currentNoteId) {
        res = await fetch('/api/notes/' + currentNoteId, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content }),
        });
      } else {
        res = await fetch('/api/notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }

      const note = await res.json();
      currentNoteId = note._id;
      status.textContent = 'Saved';
      setTimeout(() => { status.textContent = ''; }, 2000);
    } catch (err) {
      status.textContent = 'Failed to save';
    }
  });
})();
