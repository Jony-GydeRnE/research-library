/**
 * Notes panel — slide-from-right in the reader.
 * Editable title, raw text editor with LaTeX, edit/preview toggle.
 */
(() => {
  const R = window.__READER__;
  const readerMain = document.getElementById('readerMain');
  const inputBar = document.querySelector('.reader-wrapper > .input-bar');

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
      <input type="text" class="note-title-input" id="noteTitleInput" placeholder="Untitled Note" spellcheck="false" />
      <div style="display:flex;gap:0.25rem;flex-shrink:0;">
        <button class="reader-btn" id="notesEditPreviewBtn" title="Toggle edit/preview">
          <svg class="icon-preview" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          <svg class="icon-edit" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:none"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
        </button>
        <button class="reader-btn notes-latex-btn" id="notesLatexInline" title="Inline math \\( \\)">
          <span style="font-size:0.7rem;font-weight:700;font-family:serif;">x²</span>
        </button>
        <button class="reader-btn notes-latex-btn" id="notesLatexDisplay" title="Display math \\[ \\]">
          <span style="font-size:0.7rem;font-weight:700;font-family:serif;">∑</span>
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
      <textarea class="notes-textarea" id="notesTextarea" placeholder="Write your note... Use \\( x^2 \\) for inline math or \\[ E=mc^2 \\] for display math."></textarea>
      <div class="notes-preview-pane" id="notesPreviewPane" style="display:none;"></div>
    </div>
    <div class="notes-footer">
      <button class="btn btn-primary btn-sm" id="notesSaveBtn">Save</button>
      <span class="notes-status" id="notesStatus"></span>
    </div>
  `;

  const bodyRow = readerMain.parentElement;
  bodyRow.appendChild(divider);
  bodyRow.appendChild(panel);

  let isOpen = false;
  let currentHighlightId = null;
  let currentNoteId = null;
  let highlightText = null;
  let editMode = true; // true = edit, false = preview
  let splitRatio = parseFloat(localStorage.getItem('gyde-notes-ratio')) || 0.6;

  const titleInput = document.getElementById('noteTitleInput');
  const textarea = document.getElementById('notesTextarea');
  const previewPane = document.getElementById('notesPreviewPane');
  const editPreviewBtn = document.getElementById('notesEditPreviewBtn');

  // ─── OPEN / CLOSE ─────────────────────────────────────────────

  function openNotesPanel(hlText, hlId) {
    highlightText = hlText;
    currentHighlightId = hlId || null;
    currentNoteId = null;

    titleInput.value = '';
    textarea.value = '';
    previewPane.innerHTML = '';
    document.getElementById('notesStatus').textContent = '';

    if (highlightText) {
      document.getElementById('notesQuoteText').textContent = highlightText;
      document.getElementById('notesQuote').style.display = '';
    } else {
      document.getElementById('notesQuote').style.display = 'none';
    }

    setEditMode(true);
    isOpen = true;
    panel.style.display = 'flex';
    divider.style.display = '';
    if (inputBar) inputBar.style.display = 'none';
    applyRatio();
    titleInput.focus();
  }

  async function openNotesPanelWithId(noteId, hlText, hlId) {
    openNotesPanel(hlText, hlId);
    currentNoteId = noteId;
    textarea.value = 'Loading...';

    try {
      const res = await fetch('/api/notes/' + noteId);
      const note = await res.json();
      titleInput.value = note.title || '';
      textarea.value = note.content || '';
    } catch (e) {
      textarea.value = '';
      document.getElementById('notesStatus').textContent = 'Failed to load';
    }
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

  window.__openNotesPanel = openNotesPanel;
  window.__openNotesPanelWithId = openNotesPanelWithId;

  // ─── EDIT / PREVIEW TOGGLE ─────────────────────────────────────

  function setEditMode(isEdit) {
    editMode = isEdit;
    if (isEdit) {
      textarea.style.display = '';
      previewPane.style.display = 'none';
      editPreviewBtn.querySelector('.icon-preview').style.display = '';
      editPreviewBtn.querySelector('.icon-edit').style.display = 'none';
      document.getElementById('notesLatexInline').style.display = '';
      document.getElementById('notesLatexDisplay').style.display = '';
    } else {
      textarea.style.display = 'none';
      previewPane.style.display = '';
      editPreviewBtn.querySelector('.icon-preview').style.display = 'none';
      editPreviewBtn.querySelector('.icon-edit').style.display = '';
      document.getElementById('notesLatexInline').style.display = 'none';
      document.getElementById('notesLatexDisplay').style.display = 'none';
      renderPreview();
    }
  }

  function renderPreview() {
    // Convert raw text to HTML with LaTeX preserved
    var raw = textarea.value;
    var html = raw
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\n\n+/g, '</p><p>')
      .replace(/\n/g, '<br>');
    // Restore LaTeX delimiters
    html = html.replace(/\\&lt;/g, '\\<').replace(/\\&gt;/g, '\\>');
    // Undo escaping inside \( \) and \[ \]
    html = html.replace(/\\\(/g, '\\(').replace(/\\\)/g, '\\)');
    html = html.replace(/\\\[/g, '\\[').replace(/\\\]/g, '\\]');

    previewPane.innerHTML = '<p>' + html + '</p>';
    if (window.MathJax && MathJax.typesetPromise) {
      MathJax.typesetPromise([previewPane]).catch(function(){});
    }
  }

  editPreviewBtn.addEventListener('click', () => setEditMode(!editMode));

  // ─── DRAGGABLE DIVIDER ─────────────────────────────────────────

  let dragging = false;
  divider.addEventListener('mousedown', (e) => {
    dragging = true; e.preventDefault();
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
    insertAtCursor('\\( ', ' \\)');
  });
  document.getElementById('notesLatexDisplay').addEventListener('click', () => {
    insertAtCursor('\n\\[ ', ' \\]\n');
  });

  function insertAtCursor(before, after) {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = textarea.value.substring(start, end);
    const insert = before + (selected || 'x') + after;
    textarea.setRangeText(insert, start, end, 'end');
    textarea.focus();
  }

  // ─── TITLE SAVE ON BLUR/ENTER ──────────────────────────────────

  function saveTitle() {
    if (!currentNoteId) return;
    fetch('/api/notes/' + currentNoteId, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: titleInput.value.trim() }),
    }).catch(function(){});
  }

  titleInput.addEventListener('blur', saveTitle);
  titleInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); saveTitle(); textarea.focus(); }
  });

  // ─── SAVE NOTE ─────────────────────────────────────────────────

  document.getElementById('notesSaveBtn').addEventListener('click', async () => {
    const content = textarea.value;
    const title = titleInput.value.trim();
    const status = document.getElementById('notesStatus');

    if (!content.trim()) { status.textContent = 'Note is empty'; return; }

    try {
      let res;
      if (currentNoteId) {
        res = await fetch('/api/notes/' + currentNoteId, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content, title }),
        });
      } else {
        res = await fetch('/api/notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bookId: R.bookId, pageNumber: R.currentPage,
            content, title: title || 'Untitled Note',
            highlightId: currentHighlightId || undefined,
          }),
        });
      }

      const note = await res.json();
      const isNew = !currentNoteId;
      currentNoteId = note._id;

      if (isNew && currentHighlightId) {
        fetch('/api/highlights/link-note', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ highlightId: currentHighlightId, noteId: note._id }),
        }).catch(function(){});
      }

      status.textContent = 'Saved';
      setTimeout(() => { status.textContent = ''; }, 2000);
    } catch (err) {
      status.textContent = 'Failed to save';
    }
  });
})();
