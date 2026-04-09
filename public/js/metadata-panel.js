/**
 * Metadata panel — shows span/chunk/edge data for a highlight.
 * Opens in the right panel slot (same as notes/chat).
 */
(() => {
  const R = window.__READER__;
  const readerMain = document.getElementById('readerMain');
  const readerContent = document.getElementById('readerContent');
  const inputBar = document.querySelector('.reader-wrapper > .input-bar');

  const divider = document.createElement('div');
  divider.className = 'split-divider metadata-divider';
  divider.style.display = 'none';

  const panel = document.createElement('div');
  panel.className = 'split-chat-panel metadata-panel';
  panel.style.display = 'none';
  panel.innerHTML = `
    <div class="split-chat-header">
      <span class="split-chat-title">Metadata</span>
      <button class="reader-btn" id="metadataCloseBtn" title="Close">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <div class="metadata-quote" style="display:none;">
      <blockquote id="metadataQuoteText"></blockquote>
    </div>
    <div class="metadata-content" id="metadataContent">
      <div class="metadata-loading">Loading metadata...</div>
    </div>
  `;

  const bodyRow = readerMain.parentElement;
  bodyRow.appendChild(divider);
  bodyRow.appendChild(panel);

  let isOpen = false;
  let splitRatio = parseFloat(localStorage.getItem('gyde-metadata-ratio')) || 0.6;
  let activeSpanMarks = [];

  const SEARCH_CLASS_LABELS = {
    N: { label: 'No search needed', color: '#666' },
    L: { label: 'Logical gap', color: '#d4a017' },
    I: { label: 'Internal reference', color: '#4a9eda' },
    S: { label: 'External source', color: '#e07020' },
    B: { label: 'Broad search needed', color: '#d44' },
  };

  const DECL_TAG_LABELS = {
    p: 'proves', a: 'assumes', c: 'contradicts', e: 'extends',
    r: 'prerequisite', q: 'equivalent', s: 'supports',
    k: 'special case', x: 'example of', d: 'data for', v: 'figure ref',
  };

  // ─── OPEN / CLOSE ─────────────────────────────────────────────

  function openMetadataPanel(highlightText, bookId, pageNumber, hlId, startOffset, endOffset) {
    const quoteEl = panel.querySelector('.metadata-quote');
    const quoteText = document.getElementById('metadataQuoteText');
    const contentEl = document.getElementById('metadataContent');

    if (highlightText) {
      quoteText.textContent = highlightText;
      quoteEl.style.display = '';
    } else {
      quoteEl.style.display = 'none';
    }

    contentEl.innerHTML = '<div class="metadata-loading">Loading metadata...</div>';

    isOpen = true;
    panel.style.display = 'flex';
    divider.style.display = '';
    if (inputBar) inputBar.style.display = 'none';
    applyRatio();

    fetchAndRender(bookId, pageNumber, highlightText, startOffset, endOffset);
  }

  function closeMetadataPanel() {
    isOpen = false;
    panel.style.display = 'none';
    divider.style.display = 'none';
    if (inputBar) inputBar.style.display = '';
    readerMain.style.flex = '';
    readerMain.style.width = '';
    clearSpanMarks();
  }

  function applyRatio() {
    readerMain.style.flex = 'none';
    readerMain.style.width = (splitRatio * 100) + '%';
    panel.style.width = ((1 - splitRatio) * 100 - 0.3) + '%';
  }

  document.getElementById('metadataCloseBtn').addEventListener('click', closeMetadataPanel);
  window.__openMetadataPanel = openMetadataPanel;

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
    localStorage.setItem('gyde-metadata-ratio', ratio);
    applyRatio();
  });
  document.addEventListener('mouseup', () => {
    if (dragging) { dragging = false; document.body.style.cursor = ''; document.body.style.userSelect = ''; }
  });

  // ─── FETCH AND RENDER ──────────────────────────────────────────

  async function fetchAndRender(bookId, pageNumber, highlightText, startOffset, endOffset) {
    const contentEl = document.getElementById('metadataContent');

    try {
      let url = `/api/spans/intersecting?bookId=${bookId}&pageNumber=${pageNumber}`;
      if (startOffset !== undefined && endOffset !== undefined) {
        url += `&startOffset=${startOffset}&endOffset=${endOffset}`;
      }
      const res = await fetch(url);
      const spans = await res.json();

      if (!spans || spans.length === 0) {
        contentEl.innerHTML = `
          <div class="metadata-empty">
            <p>No metadata generated for this passage yet.</p>
            <p style="font-size:0.75rem;color:var(--r-text-muted);">Run the metadata pipeline to generate spans.</p>
          </div>`;
        return;
      }

      contentEl.innerHTML = '';
      const hlLower = (highlightText || '').toLowerCase();

      for (const span of spans) {
        const card = document.createElement('div');
        card.className = 'metadata-span-card';

        let html = `<div class="span-header">Sentences ${span.sentenceStart}–${span.sentenceEnd}`;
        if (span.chunk) html += ` <span class="span-chunk-badge">#${span.chunk.chunkIndex} ${span.chunk.structuralType || ''}</span>`;
        html += `</div>`;

        // Show the span's own text (extracted server-side from sentence range)
        if (span.spanText) {
          let text = span.spanText;
          // Bold the highlight portion if found
          if (hlLower && text.toLowerCase().includes(hlLower.substring(0, 40))) {
            const idx = text.toLowerCase().indexOf(hlLower.substring(0, 40));
            const matchLen = Math.min(hlLower.length, text.length - idx);
            text = escapeHtml(text.substring(0, idx)) +
              '<strong class="span-highlight-match">' + escapeHtml(text.substring(idx, idx + matchLen)) + '</strong>' +
              escapeHtml(text.substring(idx + matchLen));
          } else {
            text = escapeHtml(text);
          }
          html += `<div class="span-text">${text}</div>`;
        }

        // Context tags
        if (span.contextTags?.length > 0) {
          html += `<div class="span-tags">${span.contextTags.map(t =>
            `<span class="tag-pill">${t.replace(/_/g, ' ')}</span>`
          ).join('')}</div>`;
        }

        // Declarative tags
        if (span.declarativeTags?.length > 0) {
          html += `<div class="span-declarative">`;
          span.declarativeTags.forEach(d => {
            const label = DECL_TAG_LABELS[d.kind] || d.kind;
            html += `<a class="decl-arrow" data-chunk="${d.targetChunk}" title="Navigate to chunk ${d.targetChunk}">${label} → Chunk ${d.targetChunk}.${d.targetTag}</a>`;
          });
          html += `</div>`;
        }

        // Search class
        if (span.searchClass && span.searchClass !== 'N') {
          const sc = SEARCH_CLASS_LABELS[span.searchClass] || { label: span.searchClass, color: '#888' };
          html += `<div class="span-search-badge" style="border-color:${sc.color};color:${sc.color}">`;
          html += `${span.searchClass} — ${sc.label}`;
          if (span.searchConfidence) html += ` (confidence: ${span.searchConfidence})`;
          html += `</div>`;
        }

        // Edges
        if (span.edges?.length > 0) {
          html += `<div class="span-edges">`;
          span.edges.forEach(e => {
            const targetTitle = e.targetBookTitle || 'same book';
            const snippet = e.targetSnippet ? ': "' + escapeHtml(e.targetSnippet.substring(0, 80)) + '..."' : '';
            html += `<a class="edge-link" data-book="${e.targetBookId || ''}" data-page="${e.targetPage || ''}">`;
            html += `${e.relationshipType} → ${targetTitle}, p.${e.targetPage || '?'}${snippet}`;
            html += `</a>`;
          });
          html += `</div>`;
        }

        card.innerHTML = html;
        contentEl.appendChild(card);
      }

      // Wire clickable links
      contentEl.querySelectorAll('.edge-link[data-book]').forEach(link => {
        link.addEventListener('click', () => {
          const bk = link.dataset.book;
          const pg = link.dataset.page;
          if (bk && pg) window.location.href = `/reader/${bk}/page/${pg}`;
        });
      });

      // Add span visual indicators in the reader
      addSpanMarks(spans);

    } catch (err) {
      contentEl.innerHTML = `<div class="metadata-empty"><p>Failed to load metadata: ${err.message}</p></div>`;
    }
  }

  function escapeHtml(s) {
    return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ─── VISUAL SPAN MARKS IN READER ──────────────────────────────

  function addSpanMarks(spans) {
    clearSpanMarks();
    readerContent.classList.add('metadata-active');
  }

  function clearSpanMarks() {
    readerContent.classList.remove('metadata-active');
  }
})();
