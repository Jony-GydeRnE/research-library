/**
 * Notes panel — slide-from-right in the reader.
 * Textarea editor, MathJax preview on save, pencil to re-edit.
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
        <button class="reader-btn" id="notesEditBtn" title="Edit note" style="display:none;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
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
  let splitRatio = parseFloat(localStorage.getItem('gyde-notes-ratio')) || 0.6;

  const titleInput = document.getElementById('noteTitleInput');
  const textarea = document.getElementById('notesTextarea');
  const previewPane = document.getElementById('notesPreviewPane');
  const editBtn = document.getElementById('notesEditBtn');
  const latexInline = document.getElementById('notesLatexInline');
  const latexDisplay = document.getElementById('notesLatexDisplay');

  // ─── MATHJAX RENDER ────────────────────────────────────────────

  function renderNotePreview(content, el) {
    if (!content) { el.innerHTML = '<em style="color:#888">Empty note</em>'; return; }

    // Convert $$ ... $$ to \[ ... \] and $ ... $ to \( ... \)
    var html = content
      .replace(/\$\$([\s\S]*?)\$\$/g, '\\[$1\\]')
      .replace(/(?<![\\$])\$(?!\$)(.+?)(?<![\\$])\$/g, '\\($1\\)');

    // Escape HTML but preserve LaTeX delimiters
    html = html
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Restore LaTeX delimiters that got escaped
    html = html
      .replace(/\\\(/g, '\\(').replace(/\\\)/g, '\\)')
      .replace(/\\\[/g, '\\[').replace(/\\\]/g, '\\]');

    // Newlines to <br>
    html = html.replace(/\n/g, '<br>');

    el.innerHTML = html;

    if (window.MathJax && window.MathJax.typesetPromise) {
      MathJax.typesetClear([el]);
      MathJax.typesetPromise([el]).then(function() {
        console.log('MathJax typeset SUCCESS on notes preview');
      }).catch(function(err) {
        console.error('MathJax typeset FAILED:', err);
      });
    } else {
      console.error('MathJax not available! window.MathJax =', window.MathJax);
    }
  }

  // ─── EDIT / PREVIEW MODE ───────────────────────────────────────

  function showEditMode() {
    textarea.style.display = '';
    previewPane.style.display = 'none';
    editBtn.style.display = 'none';
    latexInline.style.display = '';
    latexDisplay.style.display = '';
    textarea.focus();
  }

  function showPreviewMode() {
    renderNotePreview(textarea.value, previewPane);
    textarea.style.display = 'none';
    previewPane.style.display = '';
    editBtn.style.display = '';
    latexInline.style.display = 'none';
    latexDisplay.style.display = 'none';
  }

  editBtn.addEventListener('click', showEditMode);

  // ─── OPEN / CLOSE ─────────────────────────────────────────────

  function openNotesPanel(hlText, hlId) {
    currentHighlightId = hlId || null;
    currentNoteId = null;

    titleInput.value = '';
    textarea.value = '';
    previewPane.innerHTML = '';
    document.getElementById('notesStatus').textContent = '';

    if (hlText) {
      document.getElementById('notesQuoteText').textContent = hlText;
      document.getElementById('notesQuote').style.display = '';
    } else {
      document.getElementById('notesQuote').style.display = 'none';
    }

    showEditMode();
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
      var res = await fetch('/api/notes/' + noteId);
      var note = await res.json();
      titleInput.value = note.title || '';
      textarea.value = note.content || '';
      // Show rendered preview by default for existing notes
      showPreviewMode();
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

  // ─── DRAGGABLE DIVIDER ─────────────────────────────────────────

  let dragging = false;
  divider.addEventListener('mousedown', (e) => {
    dragging = true; e.preventDefault();
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  });
  document.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    var rect = bodyRow.getBoundingClientRect();
    var ratio = Math.max(0.3, Math.min(0.8, (e.clientX - rect.left) / rect.width));
    splitRatio = ratio;
    localStorage.setItem('gyde-notes-ratio', ratio);
    applyRatio();
  });
  document.addEventListener('mouseup', () => {
    if (dragging) { dragging = false; document.body.style.cursor = ''; document.body.style.userSelect = ''; }
  });

  // ─── LATEX BUTTONS ─────────────────────────────────────────────

  latexInline.addEventListener('click', () => insertAtCursor('\\( ', ' \\)'));
  latexDisplay.addEventListener('click', () => insertAtCursor('\n\\[ ', ' \\]\n'));

  function insertAtCursor(before, after) {
    var start = textarea.selectionStart;
    var end = textarea.selectionEnd;
    var selected = textarea.value.substring(start, end);
    textarea.setRangeText(before + (selected || 'x') + after, start, end, 'end');
    textarea.focus();
  }

  // ─── TITLE SAVE ────────────────────────────────────────────────

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
    var content = textarea.value;
    var title = titleInput.value.trim();
    var status = document.getElementById('notesStatus');

    if (!content.trim()) { status.textContent = 'Note is empty'; return; }

    try {
      var res;
      if (currentNoteId) {
        res = await fetch('/api/notes/' + currentNoteId, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: content, title: title }),
        });
      } else {
        res = await fetch('/api/notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bookId: R.bookId, pageNumber: R.currentPage,
            content: content, title: title || 'Untitled Note',
            highlightId: currentHighlightId || undefined,
          }),
        });
      }

      var note = await res.json();
      var isNew = !currentNoteId;
      currentNoteId = note._id;

      if (isNew && currentHighlightId) {
        fetch('/api/highlights/link-note', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ highlightId: currentHighlightId, noteId: note._id }),
        }).catch(function(){});
      }

      status.textContent = 'Saved';
      setTimeout(function() { status.textContent = ''; }, 2000);

      // Switch to preview mode after saving
      showPreviewMode();
    } catch (err) {
      status.textContent = 'Failed to save';
    }
  });
})();
