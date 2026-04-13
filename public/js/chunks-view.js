/**
 * Chunks reader mode — metadata-forward view.
 *
 * Layout per page:
 *   ┌─ Page N · M chunks ─────────────────────────────────────┐
 *   │ ┌─ #idx narrative · 3 spans ──────────────────────────┐ │
 *   │ │ [tag] [tag] [tag]                                   │ │
 *   │ │                                                     │ │
 *   │ │ Span text with LaTeX intact \(c_{ij}=0\). ;;        │ │
 *   │ │                                                     │ │
 *   │ │ (on ;; click: inline panel appears here, tabs       │ │
 *   │ │  Tags | Edges, ranked by confidence z → a)          │ │
 *   │ │                                                     │ │
 *   │ │ Second span text. ;;                                │ │
 *   │ │ Third span text. ;;                                 │ │
 *   │ └─────────────────────────────────────────────────────┘ │
 *   └─────────────────────────────────────────────────────────┘
 *
 * Rules:
 *   - Every span ends with a clickable ';;' — even single-sentence
 *     spans — so the user always has a consistent click target.
 *   - Multi-sentence spans ALSO get ';;' substituted for their
 *     intermediate sentence terminators (server side), but the
 *     primary click target is the trailing ';;'.
 *   - Clicking ';;' toggles an inline detail panel immediately
 *     below the span's line. Only one panel is open at a time
 *     per chunk; clicking another span's ';;' moves the panel.
 *   - The panel has two tabs: Tags and Edges. Default is Tags
 *     (small, cheap). Edges are ranked by confidence (z → a).
 *   - Edge rows show: confidence letter badge, relationship,
 *     direction arrow, target book title (resolved server-side),
 *     target page, and a short text preview.
 *
 * FUTURE: when opened from Pages mode, render single-page; when
 * opened from Scroll/PDF, render scroll-all-pages. Currently
 * always scroll-all-pages per Jony's interim preference.
 */
(function () {
  'use strict';

  const STATE = { current: null };

  // ─── Tiny DOM helper ──────────────────────────────────────
  function el(tag, attrs, children) {
    const n = document.createElement(tag);
    if (attrs) {
      for (const k of Object.keys(attrs)) {
        if (k === 'className') n.className = attrs[k];
        else if (k === 'style') n.setAttribute('style', attrs[k]);
        else if (k === 'html') n.innerHTML = attrs[k];
        else if (k === 'onClick') n.addEventListener('click', attrs[k]);
        else if (k.startsWith('data-') || k === 'id' || k === 'title' || k === 'href' || k === 'target') n.setAttribute(k, attrs[k]);
        else n.setAttribute(k, attrs[k]);
      }
    }
    if (children != null) {
      for (const c of [].concat(children)) {
        if (c == null || c === false) continue;
        n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
      }
    }
    return n;
  }

  // ─── Confidence visualization ─────────────────────────────
  function confIdx(letter) {
    if (!letter) return -1;
    const c = letter.toLowerCase().charCodeAt(0) - 'a'.charCodeAt(0);
    return (c >= 0 && c <= 25) ? c : -1;
  }
  function confPct(letter) {
    const i = confIdx(letter);
    return i < 0 ? '' : Math.round(((i + 1) / 26) * 100) + '%';
  }
  function confBand(letter) {
    const i = confIdx(letter);
    if (i >= 18) return 'high';   // s-z
    if (i >= 10) return 'mid';    // k-r
    return 'low';                  // a-j
  }

  // ─── Escape text for innerHTML injection that preserves LaTeX ─
  // MathJax scans TEXT nodes for \(...\) and $...$, but if we
  // want to interleave element boundaries inside prose we need
  // innerHTML — which requires us to escape HTML special chars
  // while leaving LaTeX delimiters alone. This is a narrow
  // escape: &, <, > only.
  function htmlEscape(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // ─── Render one span's prose with intra-span ;; separators.
  // Server has already replaced internal sentence periods with
  // ';;' when safe (no LaTeX). We just need to render the prose
  // and make the ';;' tokens visually the same as the trailing
  // end-of-span marker — both are display-only, both are inert
  // (the clickable one is the trailing marker added by the
  // parent render).
  function spanProseHtml(text) {
    const escaped = htmlEscape(text);
    // Turn any ;; that appears in the span text into styled
    // (non-clickable) marks so they match the trailing one.
    return escaped.replace(/;;/g, '<span class="cv-inner-sep">;;</span>');
  }

  // ─── Inline detail panel ──────────────────────────────────
  // Toggled under the span row when ';;' is clicked.
  let openPanelKey = null;
  function detailKey(chunkId, spanId) { return `${chunkId}::${spanId}`; }

  function renderTagsBlock(span) {
    const wrap = el('div', { className: 'cv-detail-tags' });
    const chips = [];
    if (span.role) chips.push(el('span', { className: 'cv-chip cv-chip-role' }, [span.role]));
    if (span.searchClass) chips.push(el('span', { className: 'cv-chip cv-chip-class' }, ['class ' + span.searchClass]));
    if (span.gapType) chips.push(el('span', { className: 'cv-chip cv-chip-gap' }, ['gap: ' + span.gapType]));
    for (const t of (span.contextTags || [])) {
      chips.push(el('span', { className: 'cv-chip cv-chip-ctx' }, [t]));
    }
    if (chips.length === 0) {
      wrap.appendChild(el('div', { className: 'cv-detail-empty' }, ['(no tags on this span)']));
    } else {
      for (const c of chips) wrap.appendChild(c);
    }
    return wrap;
  }

  function renderEdgesBlock(edges) {
    const wrap = el('div', { className: 'cv-detail-edges' });
    if (!edges || edges.length === 0) {
      wrap.appendChild(el('div', { className: 'cv-detail-empty' }, ['(no edges on this span)']));
      return wrap;
    }
    // Build a /reader URL for an edge. Lands in PAGES mode
    // (single-page fetch, <1s) at the exact target page so
    // the user sees the cited passage immediately instead of
    // waiting for the full book to stream in scroll mode. The
    // ?highlight=... query parameter is picked up by the
    // reader's applyHighlightToVisible() machinery which
    // wraps the matching text node in a citation-callout-box
    // and scrolls it into view. Strips LaTeX delimiters from
    // the preview so the whitespace/case-normalized matcher
    // can find the text. URL-length-safe: capped at 200 chars.
    function readerUrlFor(e) {
      if (!e.targetBookId || !e.targetPage) return '#';
      const q = (e.targetPreview || '')
        .replace(/\\\(|\\\)/g, '')
        .replace(/\\\[|\\\]/g, '')
        .replace(/\$/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 200);
      const params = new URLSearchParams();
      if (q) params.set('highlight', q);
      params.set('mode', 'pages');
      return `/reader/${e.targetBookId}/page/${e.targetPage}?${params.toString()}`;
    }

    for (const e of edges) {
      const url = readerUrlFor(e);
      const row = el('a', {
        className: 'cv-edge',
        href: url,
        target: '_blank',
        title: `${e.relationship} · conf ${e.confidence} (${confPct(e.confidence)})${e.method ? ' · ' + e.method : ''}`,
      }, [
        el('span', { className: 'cv-edge-conf cv-conf-' + confBand(e.confidence) }, [e.confidence || '?']),
        el('span', { className: 'cv-edge-rel' }, [e.relationship || 'unknown']),
        el('span', { className: 'cv-edge-arrow' }, [e.direction === 'in' ? '←' : '→']),
        el('span', { className: 'cv-edge-target' }, [
          el('span', { className: 'cv-edge-book' }, [
            e.targetBookTitle || '(unknown book)',
          ]),
          el('span', { className: 'cv-edge-page' }, ['p.' + (e.targetPage != null ? e.targetPage : '?')]),
        ]),
        el('span', { className: 'cv-edge-preview' }, [e.targetPreview || '']),
      ]);
      // Intercept the click: if the split-reader global is
      // available on this page, open the target in the split
      // iframe (instant, no tab, stays in the current reader
      // context). Otherwise fall back to the plain link —
      // cmd/ctrl-click and middle-click still open in a new
      // tab as usual because the handler bails on modified
      // clicks.
      row.addEventListener('click', function (ev) {
        if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.button !== 0) return;
        if (typeof window.__openSplitReader !== 'function') return;
        ev.preventDefault();
        if (window.__isSplitReaderOpen && window.__isSplitReaderOpen()) {
          window.__updateSplitReader(url);
        } else {
          window.__openSplitReader(url);
        }
      });
      wrap.appendChild(row);
    }
    return wrap;
  }

  function makeDetailPanel(chunk, span) {
    const panel = el('div', {
      className: 'cv-detail',
      'data-span-id': span.spanId,
    });

    // Tabs
    const tabs = el('div', { className: 'cv-detail-tabs' });
    const tagsTab = el('button', { className: 'cv-tab active', type: 'button' }, [
      'Tags', el('span', { className: 'cv-tab-count' }, [String((span.contextTags || []).length + (span.role ? 1 : 0))]),
    ]);
    const edgesTab = el('button', { className: 'cv-tab', type: 'button' }, [
      'Edges', el('span', { className: 'cv-tab-count' }, [String((span.edges || []).length)]),
    ]);
    tabs.appendChild(tagsTab);
    tabs.appendChild(edgesTab);
    panel.appendChild(tabs);

    // Body containers
    const tagsBody = renderTagsBlock(span);
    const edgesBody = renderEdgesBlock(span.edges || []);
    edgesBody.style.display = 'none';
    panel.appendChild(tagsBody);
    panel.appendChild(edgesBody);

    tagsTab.addEventListener('click', (ev) => {
      ev.stopPropagation();
      tagsTab.classList.add('active');
      edgesTab.classList.remove('active');
      tagsBody.style.display = '';
      edgesBody.style.display = 'none';
    });
    edgesTab.addEventListener('click', (ev) => {
      ev.stopPropagation();
      edgesTab.classList.add('active');
      tagsTab.classList.remove('active');
      edgesBody.style.display = '';
      tagsBody.style.display = 'none';
    });

    return panel;
  }

  function closeAnyOpenDetail(chunkEl) {
    const existing = chunkEl.querySelector('.cv-detail');
    if (existing) existing.remove();
    chunkEl.querySelectorAll('.cv-sep.active').forEach(s => s.classList.remove('active'));
  }

  function toggleDetail(chunkEl, chunk, span, sepEl) {
    const key = detailKey(chunk.chunkId, span.spanId);
    const isOpen = openPanelKey === key;

    // Always close any existing detail in this chunk first.
    closeAnyOpenDetail(chunkEl);

    if (isOpen) {
      openPanelKey = null;
      return;
    }

    const panel = makeDetailPanel(chunk, span);
    // Insert right after the span's row element (which is
    // sepEl.parentElement — the .cv-span-row).
    const row = sepEl.closest('.cv-span-row');
    if (row && row.parentElement) {
      row.parentElement.insertBefore(panel, row.nextSibling);
    } else {
      chunkEl.appendChild(panel);
    }
    sepEl.classList.add('active');
    openPanelKey = key;

    // Typeset any LaTeX in the edge previews.
    if (window.MathJax && MathJax.typesetPromise) {
      MathJax.typesetPromise([panel]).catch(() => {});
    }
  }

  // ─── Render a GROUP of overlapping spans as one prose row ─
  //
  // When multi-concept decomposition gives us N spans covering
  // the same sentence range, we want ONE prose render followed
  // by N clickable ;; markers. Each ;; opens its own span's
  // detail panel. This is the fix for the "same sentence
  // appears N times" visual bug from the first quality-sweep
  // run.
  //
  // If the group has only one span, behavior matches the old
  // single-span render (one prose body + one trailing ;;).
  function renderSpanGroup(chunk, spans, chunkEl) {
    if (!spans || spans.length === 0) return document.createTextNode('');
    const first = spans[0];
    const row = el('div', { className: 'cv-span-row' });

    // Render the prose once, from the first span's text.
    const prose = el('span', { className: 'cv-span-text' });
    prose.innerHTML = spanProseHtml(first.renderedText || '');
    row.appendChild(prose);

    // Cluster of span markers: one ;; per span in the group.
    // The first is the "primary" and opens on full prose click;
    // subsequent ones open only their own span.
    const cluster = el('span', { className: 'cv-sep-cluster' });
    for (let i = 0; i < spans.length; i++) {
      const s = spans[i];
      const firstTag = (s.contextTags || [])[0] || s.role || 'span';
      const sep = el('span', {
        className: 'cv-sep',
        'data-span-id': s.spanId,
        title: firstTag + ' — click for tags / edges',
      }, [';;']);
      sep.addEventListener('click', (ev) => {
        ev.stopPropagation();
        toggleDetail(chunkEl, chunk, s, sep);
      });
      cluster.appendChild(sep);
      // Tiny visible label under each ;; so the user sees WHICH
      // concept each marker corresponds to. This is a faint
      // helper — hover works for the full title.
      const label = el('span', { className: 'cv-sep-label' }, [firstTag]);
      cluster.appendChild(label);
    }
    row.appendChild(cluster);

    // Clicking the prose itself opens the first span's panel —
    // keeps the original "click anywhere on the row" affordance.
    prose.addEventListener('click', (ev) => {
      const sel = window.getSelection();
      if (sel && sel.toString().length > 0) return;
      ev.stopPropagation();
      const firstSep = cluster.querySelector('.cv-sep');
      if (firstSep) toggleDetail(chunkEl, chunk, first, firstSep);
    });

    return row;
  }

  // ─── Render one span row (legacy, kept for compatibility) ─
  function renderSpanRow(chunk, span, chunkEl) {
    const row = el('div', { className: 'cv-span-row', 'data-span-id': span.spanId });

    // Prose (LaTeX-preserving via innerHTML).
    const prose = el('span', { className: 'cv-span-text' });
    prose.innerHTML = spanProseHtml(span.renderedText || '');
    row.appendChild(prose);

    // Trailing clickable ;; — the primary hit target.
    const sep = el('span', {
      className: 'cv-sep',
      'data-span-id': span.spanId,
      title: 'Click for tags / edges',
    }, [';;']);
    sep.addEventListener('click', (ev) => {
      ev.stopPropagation();
      toggleDetail(chunkEl, chunk, span, sep);
    });
    row.appendChild(sep);

    // Also make the prose clickable — whole span is a hit target,
    // but only the trailing ;; gets the "active" styling.
    prose.addEventListener('click', (ev) => {
      // Don't toggle if the user was selecting text.
      const sel = window.getSelection();
      if (sel && sel.toString().length > 0) return;
      ev.stopPropagation();
      toggleDetail(chunkEl, chunk, span, sep);
    });

    return row;
  }

  // Produce a normalized preview string for a chunk, suitable for the
  // reader's whitespace/case-insensitive highlight matcher. Strips LaTeX
  // delimiters and collapses whitespace. Capped at 200 chars to fit in
  // a URL query. Identical normalization to readerUrlFor() above.
  function chunkPreview(text) {
    return (text || '')
      .replace(/\\\(|\\\)/g, '')
      .replace(/\\\[|\\\]/g, '')
      .replace(/\$/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 200);
  }

  // ─── Render one chunk card ────────────────────────────────
  function renderChunk(c) {
    // Stash a normalized preview on the element so the scroll-spy can
    // emit it as the "currently visible chunk" when the user scrolls,
    // and reader.js can seed it as pendingHighlight when the user
    // switches to pages or scroll mode mid-book.
    const chunkEl = el('div', {
      className: 'cv-chunk',
      'data-chunk-id': c.chunkId,
      'data-chunk-preview': chunkPreview(c.sourceText || ''),
      'data-chunk-page': String(c.pageNumber || ''),
    });

    // Header. The PRIMARY label is "chunk #N" because the user's
    // mental model is "chunks" first. Structural type only shows
    // as a chip when it's NOT the default 'narrative' — theorem,
    // definition, proof, example, etc. get a small badge. A
    // 6-char suffix of the chunk's Mongo _id is appended so the
    // user always has a unique handle on the chunk for DB lookups.
    const shortId = c.chunkId ? c.chunkId.slice(-6) : '';
    const totalEdges = (c.spans.reduce((a, s) => a + (s.edges || []).length, 0)
                       + (c.chunkLevelEdges || []).length);
    const headerChildren = [
      el('span', { className: 'cv-chunk-label' }, ['chunk']),
      el('span', { className: 'cv-chunk-idx' }, [`#${c.chunkIndex != null ? c.chunkIndex : '?'}`]),
      shortId ? el('span', { className: 'cv-chunk-shortid', title: 'last 6 of Mongo _id' }, [shortId]) : null,
      el('span', { className: 'cv-chunk-meta' }, [
        `${c.spans.length} span${c.spans.length !== 1 ? 's' : ''}`,
      ]),
      totalEdges > 0
        ? el('span', { className: 'cv-chunk-meta cv-chunk-meta-edges' }, [
            `${totalEdges} edge${totalEdges !== 1 ? 's' : ''}`,
          ])
        : null,
      c.hasMissingProof ? el('span', { className: 'cv-chunk-flag' }, ['⚠ missing proof']) : null,
    ];
    const header = el('div', { className: 'cv-chunk-header' }, headerChildren);

    // Structural-type chip only when it's NOT 'narrative'.
    // Narrative is the default unmarked state (most chunks) —
    // surfacing it every time was noise. Theorems, definitions,
    // proofs etc. remain visually distinct via this chip.
    if (c.structuralType && c.structuralType !== 'narrative' && c.structuralType !== 'unknown') {
      header.appendChild(el('span', { className: 'cv-chunk-type-chip', 'data-type': c.structuralType }, [c.structuralType]));
    }
    chunkEl.appendChild(header);

    // Tag row (context + concept tags)
    if ((c.contextTags || []).length > 0 || (c.conceptTags || []).length > 0) {
      const tagRow = el('div', { className: 'cv-chunk-tagrow' });
      for (const t of (c.contextTags || [])) tagRow.appendChild(el('span', { className: 'cv-chip cv-chip-ctx' }, [t]));
      for (const t of (c.conceptTags || [])) tagRow.appendChild(el('span', { className: 'cv-chip cv-chip-concept' }, [t]));
      chunkEl.appendChild(tagRow);
    }

    // Body: stacked span rows, grouped by overlapping sentence
    // range. When multi-concept decomposition produces N spans
    // that all cover the same sentence(s), we render the text
    // ONCE as a cv-span-row and attach ALL N spans' clickable
    // ';;' markers to that row. Otherwise the reader sees the
    // same sentence repeated N times and thinks it's a bug.
    const body = el('div', { className: 'cv-chunk-body' });
    if (c.spans.length === 0) {
      // No spans — render raw chunk text as read-only prose.
      const row = el('div', { className: 'cv-span-row cv-span-row-empty' });
      const prose = el('span', { className: 'cv-span-text' });
      prose.innerHTML = spanProseHtml(c.sourceText || '');
      row.appendChild(prose);
      body.appendChild(row);
    } else {
      // Group consecutive spans by sentence range.
      const groups = [];
      for (const s of c.spans) {
        const key = `${s.sentenceStart ?? 0}-${s.sentenceEnd ?? 0}`;
        const last = groups[groups.length - 1];
        if (last && last.key === key) {
          last.spans.push(s);
        } else {
          groups.push({ key, spans: [s] });
        }
      }
      for (const g of groups) {
        body.appendChild(renderSpanGroup(c, g.spans, chunkEl));
      }
    }
    chunkEl.appendChild(body);

    // Chunk-level edges — collapsible "open edges" strip showing
    // how many edges aren't yet attributed to a specific span.
    if (c.chunkLevelEdges && c.chunkLevelEdges.length > 0) {
      const synthSpan = {
        spanId: '__chunk__',
        contextTags: [],
        role: null,
        searchClass: null,
        gapType: null,
        edges: c.chunkLevelEdges,
      };
      const chunkEdgeRow = el('div', { className: 'cv-chunk-edges-row' }, [
        el('span', { className: 'cv-chunk-edges-label' }, [
          `${c.chunkLevelEdges.length} chunk-level edge${c.chunkLevelEdges.length !== 1 ? 's' : ''}`,
        ]),
        el('button', {
          className: 'cv-chunk-edges-toggle',
          type: 'button',
        }, ['show']),
      ]);
      const btn = chunkEdgeRow.querySelector('.cv-chunk-edges-toggle');
      let shown = false;
      let panel = null;
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        if (shown) {
          if (panel) panel.remove();
          btn.textContent = 'show';
          shown = false;
          return;
        }
        panel = makeDetailPanel(c, synthSpan);
        panel.classList.add('cv-detail-chunk');
        // Start on Edges tab for the chunk-level list — that's
        // what the button is really for.
        const tabs = panel.querySelectorAll('.cv-tab');
        if (tabs[1]) tabs[1].click();
        chunkEdgeRow.parentElement.insertBefore(panel, chunkEdgeRow.nextSibling);
        btn.textContent = 'hide';
        shown = true;
        if (window.MathJax && MathJax.typesetPromise) {
          MathJax.typesetPromise([panel]).catch(() => {});
        }
      });
      chunkEl.appendChild(chunkEdgeRow);
    }

    return chunkEl;
  }

  // ─── Main loader: scroll-all-pages ────────────────────────
  async function load(bookId, anchorPageNumber, container) {
    if (!container) return;
    const totalPages = (window.__READER__ && window.__READER__.totalPages) || 1;

    container.innerHTML =
      '<div class="cv-loading">Loading chunks for all ' + totalPages +
      ' page' + (totalPages !== 1 ? 's' : '') + '…</div>';

    try {
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

      const totalChunks = results.reduce((a, r) => a + (r.chunkCount || 0), 0);
      container.appendChild(el('div', { className: 'cv-summary' }, [
        `${totalPages} page${totalPages !== 1 ? 's' : ''} · ${totalChunks} chunk${totalChunks !== 1 ? 's' : ''}`,
      ]));

      for (const pv of results) {
        const section = el('section', {
          className: 'cv-page-section',
          'data-page': String(pv.pageNumber),
          id: `cv-page-${pv.pageNumber}`,
        });
        section.appendChild(el('div', { className: 'cv-page-header' }, [
          el('span', { className: 'cv-page-num' }, [`Page ${pv.pageNumber}`]),
          el('span', { className: 'cv-page-count' }, [
            pv.error ? 'error: ' + pv.error : `${pv.chunkCount || 0} chunk${(pv.chunkCount || 0) !== 1 ? 's' : ''}`,
          ]),
        ]));

        if (pv.error) {
          section.appendChild(el('div', { className: 'cv-error' }, ['Failed: ' + pv.error]));
        } else if ((pv.chunkCount || 0) === 0) {
          section.appendChild(el('div', { className: 'cv-empty' }, [
            '(no chunks — vision/span processing incomplete, or nothing on this page)',
          ]));
        } else {
          for (const c of pv.chunks) section.appendChild(renderChunk(c));
        }
        container.appendChild(section);
      }

      if (window.MathJax && MathJax.typesetPromise) {
        MathJax.typesetPromise([container]).catch(() => {});
      }

      const anchor = document.getElementById(`cv-page-${anchorPageNumber}`);
      if (anchor) anchor.scrollIntoView({ behavior: 'auto', block: 'start' });

      // Scroll-spy: dispatch a `cv-page-change` event on the
      // container as the user scrolls past page sections. The
      // reader's setMode() uses this to keep R.currentPage in
      // sync so switching modes never drops the user back to
      // page 1. Activation zone matches the scroll-spy in
      // reader.js: top 30% of viewport.
      setupChunkScrollSpy(container);
    } catch (err) {
      console.error('chunks-view load failed:', err);
      container.innerHTML = '<div class="cv-error">Failed to load chunks: ' + (err.message || err) + '</div>';
    }
  }

  function jumpTo(pageNumber) {
    const anchor = document.getElementById(`cv-page-${pageNumber}`);
    if (anchor) anchor.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  let _cvSpy = null;
  // Current focus within the chunks view. Updated by the scroll-spy;
  // consumed by reader.js when the user switches view modes so scroll
  // or pages mode can land at the same page AND highlight the same
  // chunk in the familiar dismissable callout box.
  const CURRENT = { pageNumber: null, chunkPreview: null, chunkId: null };

  function pickTopChunkOnPage(section, scrollRoot) {
    const chunks = section.querySelectorAll('.cv-chunk');
    if (!chunks.length) return null;
    const rootRect = scrollRoot ? scrollRoot.getBoundingClientRect() : { top: 0 };
    // Activation line: upper 30% of the viewport, matching the reader
    // scroll-spy. Pick the last chunk whose top has crossed that line.
    const activation = rootRect.top + Math.max(40, (window.innerHeight * 0.3));
    let chosen = null;
    chunks.forEach(function (c) {
      const r = c.getBoundingClientRect();
      if (r.top <= activation) chosen = c;
    });
    return chosen || chunks[0];
  }

  function setupChunkScrollSpy(container) {
    if (_cvSpy) { _cvSpy.disconnect(); _cvSpy = null; }
    const sections = container.querySelectorAll('.cv-page-section');
    if (!sections.length || !('IntersectionObserver' in window)) return;
    const scrollRoot = container.closest('.reader-main') || null;
    _cvSpy = new IntersectionObserver(function (entries) {
      const hits = entries.filter(e => e.isIntersecting);
      if (!hits.length) return;
      hits.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      const chosenSection = hits[hits.length - 1].target;
      const pg = parseInt(chosenSection.getAttribute('data-page') || '', 10);
      if (!pg) return;
      const chunkEl = pickTopChunkOnPage(chosenSection, scrollRoot);
      CURRENT.pageNumber = pg;
      CURRENT.chunkPreview = chunkEl ? chunkEl.getAttribute('data-chunk-preview') : null;
      CURRENT.chunkId = chunkEl ? chunkEl.getAttribute('data-chunk-id') : null;
      container.dispatchEvent(new CustomEvent('cv-page-change', {
        detail: {
          pageNumber: pg,
          chunkPreview: CURRENT.chunkPreview,
          chunkId: CURRENT.chunkId,
        },
        bubbles: true,
      }));
    }, {
      root: scrollRoot,
      rootMargin: '0px 0px -70% 0px',
      threshold: 0,
    });
    sections.forEach(s => _cvSpy.observe(s));
  }

  function getCurrentFocus() {
    return { pageNumber: CURRENT.pageNumber, chunkPreview: CURRENT.chunkPreview, chunkId: CURRENT.chunkId };
  }

  window.GydeChunksView = { load, jumpTo, STATE, getCurrentFocus };
})();
