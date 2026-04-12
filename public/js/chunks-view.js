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
  //
  // FUTURE BEHAVIOR (not yet implemented — tracked as TODO):
  // Chunks view should inherit the presentation of the mode it
  // was opened FROM. If the user was in Pages mode and clicks
  // Chunks, chunks should render as a single-page view mirroring
  // Pages. If the user was in Scroll or PDF mode and clicks
  // Chunks, chunks should render as a scroll-of-all-pages. This
  // makes the Chunks mode feel like a metadata skin over the
  // chosen reading layout rather than a separate UI.
  //
  // FOR NOW the user asked for the scrolling variant only.
  // Chunks mode always renders all pages sequentially with a
  // page-number anchor between each. The current page is
  // scrolled into view on first load so the Prev/Next arrows
  // still feel like navigation. Mode switches don't change the
  // current page or remove highlights — they're handled by
  // reader.js setMode() and the DOM of the other modes stays
  // mounted but hidden.
  async function load(bookId, anchorPageNumber, container) {
    if (!container) return;
    const totalPages = (window.__READER__ && window.__READER__.totalPages) || 1;

    container.innerHTML = '<div class="cv-loading">Loading chunks for all ' + totalPages + ' page' + (totalPages !== 1 ? 's' : '') + '…</div>';

    try {
      // Fetch all page-chunk views in parallel. For big books
      // this is ~totalPages concurrent reads; each hits a
      // single Mongo query chain (Chunk+Span+Edge+Book). Same
      // pattern the scroll mode uses for HTML pages.
      const pageNums = [];
      for (let i = 1; i <= totalPages; i++) pageNums.push(i);

      const results = await Promise.all(
        pageNums.map(async (n) => {
          try {
            const res = await fetch(`/reader/${bookId}/api/page/${n}/chunks`);
            if (!res.ok) return { pageNumber: n, error: 'HTTP ' + res.status, chunks: [], chunkCount: 0 };
            return await res.json();
          } catch (err) {
            return { pageNumber: n, error: err.message || String(err), chunks: [], chunkCount: 0 };
          }
        })
      );

      STATE.current = results;
      container.innerHTML = '';

      // Top summary
      const totalChunks = results.reduce((a, r) => a + (r.chunkCount || 0), 0);
      container.appendChild(el('div', { className: 'cv-summary' }, [
        `${totalPages} page${totalPages !== 1 ? 's' : ''} · ${totalChunks} chunk${totalChunks !== 1 ? 's' : ''} total`,
      ]));

      // Emit each page as a labeled section.
      for (const pageView of results) {
        const pageSection = el('section', {
          className: 'cv-page-section',
          'data-page': String(pageView.pageNumber),
          id: `cv-page-${pageView.pageNumber}`,
        });

        pageSection.appendChild(el('div', { className: 'cv-page-header' }, [
          el('span', { className: 'cv-page-num' }, [`Page ${pageView.pageNumber}`]),
          el('span', { className: 'cv-page-count' }, [
            pageView.error
              ? `error: ${pageView.error}`
              : `${pageView.chunkCount || 0} chunk${(pageView.chunkCount || 0) !== 1 ? 's' : ''}`,
          ]),
        ]));

        if (pageView.error) {
          pageSection.appendChild(el('div', { className: 'cv-error' }, [
            'Failed to load chunks for this page: ' + pageView.error,
          ]));
        } else if ((pageView.chunkCount || 0) === 0) {
          pageSection.appendChild(el('div', { className: 'cv-empty' }, [
            '(no chunks — vision/span processing may not have completed, or this page has no extractable content)',
          ]));
        } else {
          for (const c of pageView.chunks) {
            pageSection.appendChild(renderChunk(c, openSpanPopover, onEdgeClickNavigate));
          }
        }
        container.appendChild(pageSection);
      }

      // Typeset LaTeX everywhere in the chunks view.
      if (window.MathJax && MathJax.typesetPromise) {
        MathJax.typesetPromise([container]).catch(() => {});
      }

      // Scroll the current page into view so the user lands
      // where they were when they opened Chunks mode.
      const anchor = document.getElementById(`cv-page-${anchorPageNumber}`);
      if (anchor) {
        // Use 'auto' not 'smooth' — on first load a smooth
        // scroll fights the DOM mount and flashes.
        anchor.scrollIntoView({ behavior: 'auto', block: 'start' });
      }
    } catch (err) {
      console.error('chunks-view load failed:', err);
      container.innerHTML = '<div class="cv-error">Failed to load chunks: ' + (err.message || err) + '</div>';
    }
  }

  // Jump an already-loaded chunks view to a specific page's
  // section. Used by reader.js goToPage so Prev/Next arrows
  // scroll through the existing chunks-view DOM instead of
  // re-fetching everything.
  function jumpTo(pageNumber) {
    const anchor = document.getElementById(`cv-page-${pageNumber}`);
    if (anchor) anchor.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  window.GydeChunksView = { load, jumpTo, closePopover, STATE };
})();
