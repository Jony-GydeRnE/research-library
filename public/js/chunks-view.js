/**
 * Chunks view — metadata-forward reader mode.
 *
 * Shows, for the current page:
 *   - one block per chunk (bordered card, header with structural
 *     type / tags / concept tags / span count / edge count)
 *   - each chunk's spans rendered inline, with intermediate
 *     sentence periods replaced by clickable ';;' separators
 *   - clicking ';;' (or the compact [i] badge next to a span)
 *     opens a popover showing the span's tags and all outgoing
 *     edges ranked by confidence
 *   - chunk-level edges (funnel writes cross-book llm edges at
 *     the chunk level, not always the span level) shown as a
 *     collapsed row below each chunk
 *
 * No external framework — just vanilla DOM. State is kept on
 * window.GydeChunksView for debugging.
 */
(function () {
  'use strict';

  const STATE = {
    current: null,   // last-loaded view payload
    popover: null,   // active popover element
  };

  // ─── Helpers ──────────────────────────────────────────────
  function el(tag, attrs, children) {
    const n = document.createElement(tag);
    if (attrs) {
      for (const k of Object.keys(attrs)) {
        if (k === 'className') n.className = attrs[k];
        else if (k === 'style') n.setAttribute('style', attrs[k]);
        else if (k.startsWith('data-')) n.setAttribute(k, attrs[k]);
        else if (k === 'html') n.innerHTML = attrs[k];
        else if (k === 'onClick') n.addEventListener('click', attrs[k]);
        else n.setAttribute(k, attrs[k]);
      }
    }
    if (children) {
      for (const c of [].concat(children)) {
        if (c == null || c === false) continue;
        n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
      }
    }
    return n;
  }

  function confColor(letter) {
    if (!letter) return 'var(--r-text-muted)';
    const c = letter.toLowerCase().charCodeAt(0) - 'a'.charCodeAt(0);
    // a (0)   -> red-ish
    // m (12)  -> amber
    // z (25)  -> green
    if (c >= 18) return '#3fb86c';   // high confidence (s-z)
    if (c >= 10) return '#d6a040';   // medium (k-r)
    return '#c66';                    // low (a-j)
  }

  function pct(letter) {
    if (!letter) return '';
    const c = letter.toLowerCase().charCodeAt(0) - 'a'.charCodeAt(0);
    if (c < 0 || c > 25) return '';
    return Math.round(((c + 1) / 26) * 100) + '%';
  }

  // Render a span's text with ';;' separators as clickable spans.
  // The whole span text is wrapped in a data-span-id span so any
  // click inside fires the popover too.
  function renderSpanInline(s, onSepClick) {
    // Split on ;; but KEEP the separators.
    const parts = s.renderedText.split(/(;;)/);
    const nodes = parts.map((p, idx) => {
      if (p === ';;') {
        return el('span', {
          className: 'cv-sep',
          'data-span-id': s.spanId,
          title: 'Click for tags and edges',
          onClick: (e) => { e.stopPropagation(); onSepClick(e, s); },
        }, [';;']);
      }
      return document.createTextNode(p);
    });
    const wrap = el('span', {
      className: 'cv-span',
      'data-span-id': s.spanId,
      onClick: (e) => { onSepClick(e, s); },
    }, nodes);
    // Attach a compact [i] badge AFTER the span text so even
    // single-sentence spans (which have no ;; inside) still have
    // something clickable.
    wrap.appendChild(
      el('sup', {
        className: 'cv-badge',
        'data-span-id': s.spanId,
        title: 'Span metadata',
        onClick: (e) => { e.stopPropagation(); onSepClick(e, s); },
      }, [`[${s.searchClass || 'N'}${s.edges && s.edges.length ? '·' + s.edges.length : ''}]`])
    );
    return wrap;
  }

  // Build a single chunk card.
  function renderChunk(c, onSpanClick, onEdgeClick) {
    const header = el('div', { className: 'cv-chunk-header' }, [
      el('span', { className: 'cv-chunk-idx' }, [`#${c.chunkIndex != null ? c.chunkIndex : '?'}`]),
      el('span', { className: 'cv-chunk-type' }, [c.structuralType || 'unknown']),
      el('span', { className: 'cv-chunk-count' }, [`${c.spans.length} span${c.spans.length !== 1 ? 's' : ''}`]),
      c.hasMissingProof
        ? el('span', { className: 'cv-chunk-flag', title: 'Span flagged a missing proof' }, ['⚠ missing proof'])
        : null,
    ]);

    // Tags row
    const tags = el('div', { className: 'cv-chunk-tags' }, [
      ...(c.contextTags || []).map(t => el('span', { className: 'cv-tag cv-tag-ctx' }, [t])),
      ...(c.conceptTags || []).map(t => el('span', { className: 'cv-tag cv-tag-concept' }, [t])),
    ]);

    // Body: spans rendered inline with ;; separators.
    const body = el('div', { className: 'cv-chunk-body' });
    for (let i = 0; i < c.spans.length; i++) {
      if (i > 0) body.appendChild(document.createTextNode(' '));
      body.appendChild(renderSpanInline(c.spans[i], onSpanClick));
    }
    if (c.spans.length === 0 && c.sourceText) {
      body.appendChild(document.createTextNode(c.sourceText));
    }

    // Chunk-level edges (if any) — collapsible row.
    const edgeRowChildren = [];
    if (c.chunkLevelEdges && c.chunkLevelEdges.length > 0) {
      edgeRowChildren.push(
        el('div', { className: 'cv-chunk-edges-label' }, [
          `Chunk-level edges (${c.chunkLevelEdges.length}) — ranked by confidence:`,
        ])
      );
      for (const e of c.chunkLevelEdges) {
        edgeRowChildren.push(renderEdgeRow(e, onEdgeClick));
      }
    }
    const edgeRow = edgeRowChildren.length > 0
      ? el('div', { className: 'cv-chunk-edges' }, edgeRowChildren)
      : null;

    return el('div', { className: 'cv-chunk', 'data-chunk-id': c.chunkId }, [
      header,
      (c.contextTags.length + c.conceptTags.length) > 0 ? tags : null,
      body,
      edgeRow,
    ]);
  }

  function renderEdgeRow(e, onClick) {
    const conf = e.confidence || '?';
    const row = el('div', {
      className: 'cv-edge-row',
      onClick: () => onClick && onClick(e),
    }, [
      el('span', {
        className: 'cv-edge-conf',
        style: `background:${confColor(conf)};`,
        title: `confidence ${conf} (${pct(conf)})`,
      }, [conf]),
      el('span', { className: 'cv-edge-rel' }, [e.relationship || 'unknown']),
      el('span', { className: 'cv-edge-arrow' }, [e.direction === 'in' ? '←' : '→']),
      el('span', { className: 'cv-edge-target' }, [
        (e.targetBookTitle || '(unknown book)').slice(0, 40),
        ' p.', String(e.targetPage ?? '?'),
      ]),
      el('span', { className: 'cv-edge-preview' }, [e.targetPreview || '']),
    ]);
    return row;
  }

  // ─── Popover ──────────────────────────────────────────────
  function closePopover() {
    if (STATE.popover) {
      STATE.popover.remove();
      STATE.popover = null;
    }
  }

  function openSpanPopover(evt, span) {
    closePopover();
    const pop = el('div', { className: 'cv-popover' });

    // Header
    pop.appendChild(el('div', { className: 'cv-popover-header' }, [
      el('span', { className: 'cv-popover-title' }, [`Span ${span.sentenceStart}-${span.sentenceEnd}`]),
      el('span', { className: 'cv-popover-class' }, [`class: ${span.searchClass || 'N'}${span.gapType ? ' / ' + span.gapType : ''}`]),
      el('button', { className: 'cv-popover-close', onClick: closePopover }, ['×']),
    ]));

    // Tags tab content
    const tagsBlock = el('div', { className: 'cv-popover-section' });
    tagsBlock.appendChild(el('div', { className: 'cv-popover-label' }, ['Tags']));
    if ((span.contextTags || []).length === 0 && !span.role) {
      tagsBlock.appendChild(el('div', { className: 'cv-popover-empty' }, ['(no tags)']));
    } else {
      const tagWrap = el('div', { className: 'cv-tag-wrap' });
      if (span.role) tagWrap.appendChild(el('span', { className: 'cv-tag cv-tag-role' }, [span.role]));
      for (const t of (span.contextTags || [])) {
        tagWrap.appendChild(el('span', { className: 'cv-tag cv-tag-ctx' }, [t]));
      }
      tagsBlock.appendChild(tagWrap);
    }
    pop.appendChild(tagsBlock);

    // Edges block
    const edgesBlock = el('div', { className: 'cv-popover-section' });
    edgesBlock.appendChild(el('div', { className: 'cv-popover-label' }, [
      `Edges (${(span.edges || []).length}) — ranked by confidence`,
    ]));
    if ((span.edges || []).length === 0) {
      edgesBlock.appendChild(el('div', { className: 'cv-popover-empty' }, [
        '(no span-level edges — check the chunk-level edges row below this chunk)',
      ]));
    } else {
      for (const e of span.edges) {
        edgesBlock.appendChild(renderEdgeRow(e, onEdgeClickNavigate));
      }
    }
    pop.appendChild(edgesBlock);

    document.body.appendChild(pop);

    // Position near the click
    const x = evt.clientX || 0;
    const y = evt.clientY || 0;
    const pw = pop.offsetWidth;
    const ph = pop.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const left = Math.min(Math.max(8, x - pw / 2), vw - pw - 8);
    const top = (y + ph + 12 > vh) ? Math.max(8, y - ph - 12) : y + 12;
    pop.style.left = left + 'px';
    pop.style.top = top + 'px';

    STATE.popover = pop;
  }

  function onEdgeClickNavigate(e) {
    if (!e.targetBookId || !e.targetPage) return;
    const url = `/reader/${e.targetBookId}/page/${e.targetPage}`;
    window.open(url, '_blank');
  }

  // Close popover on outside click
  document.addEventListener('click', (e) => {
    if (!STATE.popover) return;
    if (!STATE.popover.contains(e.target)) closePopover();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closePopover();
  });

  // ─── Main load ────────────────────────────────────────────
  async function load(bookId, pageNumber, container) {
    if (!container) return;
    container.innerHTML = '<div class="cv-loading">Loading chunks for page ' + pageNumber + '…</div>';
    try {
      const res = await fetch(`/reader/${bookId}/api/page/${pageNumber}/chunks`);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      STATE.current = data;

      container.innerHTML = '';

      const summary = el('div', { className: 'cv-summary' }, [
        `Page ${data.pageNumber} — ${data.chunkCount} chunk${data.chunkCount !== 1 ? 's' : ''}`,
      ]);
      container.appendChild(summary);

      if (data.chunkCount === 0) {
        container.appendChild(el('div', { className: 'cv-empty' }, [
          'No chunks for this page yet. Either vision/span processing has not completed, or the page has no extractable content.',
        ]));
        return;
      }

      for (const c of data.chunks) {
        container.appendChild(renderChunk(c, openSpanPopover, onEdgeClickNavigate));
      }

      // If the page has equations, typeset them so LaTeX in
      // chunk bodies renders the same as in pages mode.
      if (window.MathJax && MathJax.typesetPromise) {
        MathJax.typesetPromise([container]).catch(() => {});
      }
    } catch (err) {
      console.error('chunks-view load failed:', err);
      container.innerHTML = '<div class="cv-error">Failed to load chunks: ' + (err.message || err) + '</div>';
    }
  }

  window.GydeChunksView = { load, closePopover, STATE };
})();
