/**
 * Split-screen reader panel for the chat view.
 *
 * Layout: [ app sidebar | READER (fixed) | divider | chat view (right) ]
 *
 * The reader iframe is docked to the middle of the screen, immediately right
 * of the app sidebar. The chat view stays anchored on the right side.
 * Triggered from citation link clicks in chat.ejs.
 *
 * Exposes:
 *   window.__openSplitReader(url)   — open (or update) the panel
 *   window.__updateSplitReader(url) — update the iframe src if already open
 *   window.__isSplitReaderOpen()    — bool
 *   window.__closeSplitReader()     — close the panel
 */
(function () {
  var panel = null;
  var iframe = null;
  var divider = null;
  var isOpen = false;
  // Dock mode: 'middle' = traditional chat split (panel between sidebar
  // and chat content — original behavior). 'right' = reader split (panel
  // docked to the right edge; outer reader content stays flush against
  // its own sidebar on the left). Auto-detected from the DOM on open:
  // if the calling page has .reader-wrapper we dock right so Rodina's
  // sidebar doesn't get sandwiched away from Rodina's content.
  var dockMode = 'middle';
  // Sidebar state restore-on-close. When open() fires we force-collapse
  // the outer app sidebar so both readers have equal real estate and no
  // sidebar bleeds into the middle of the layout. The user's original
  // collapsed-vs-open preference is captured here and restored on close().
  // In reader context we DO NOT force-collapse the outer sidebar —
  // right-docking means Rodina's sidebar stays next to Rodina's content
  // as intended.
  var priorSidebarCollapsed = null;

  // Fraction of the non-sidebar width occupied by the reader panel.
  // Using a new storage key — the old key stored a right-docked ratio that
  // doesn't map 1:1 onto the new middle layout.
  var ratio = parseFloat(localStorage.getItem('gyde-chat-split-ratio-v2'));
  if (!isFinite(ratio) || ratio < 0.25 || ratio > 0.8) ratio = 0.55;

  function getSidebarWidth() {
    var sb = document.querySelector('.app-sidebar');
    if (!sb) return 0;
    return sb.getBoundingClientRect().width;
  }

  // Force both the outer app sidebar AND the split iframe's inner
  // sidebar closed by default whenever split opens. User rule: "when
  // split is open I want to see both notes, not sidebars. I can open
  // sidebars if I want." We do this by (a) adding `.collapsed` to the
  // outer sidebar and (b) appending sidebar=collapsed to the iframe URL
  // so reader.ejs inline script picks it up and collapses its own
  // sidebar before any paint.
  function forceOuterSidebarCollapsed() {
    var sb = document.querySelector('.app-sidebar');
    if (!sb) return;
    if (priorSidebarCollapsed === null) {
      priorSidebarCollapsed = sb.classList.contains('collapsed');
    }
    sb.classList.add('collapsed');
  }
  function restoreOuterSidebar() {
    var sb = document.querySelector('.app-sidebar');
    if (!sb) return;
    if (priorSidebarCollapsed === false) sb.classList.remove('collapsed');
    priorSidebarCollapsed = null;
  }
  function ensureCollapsedQuery(url) {
    if (!url) return url;
    // Ensure both ?sidebar=collapsed and ?embed=1 are present. embed=1
    // is what reader.ejs reads to add the .reader-embed body class,
    // which strips the inner app-sidebar + input bar so the popup is
    // a focused, no-chrome view of just the cited book.
    if (!/[?&]sidebar=/.test(url)) {
      url = url + (url.indexOf('?') >= 0 ? '&' : '?') + 'sidebar=collapsed';
    }
    if (!/[?&]embed=/.test(url)) {
      url = url + '&embed=1';
    }
    return url;
  }

  function ensureCreated() {
    if (panel) return;

    panel = document.createElement('div');
    panel.className = 'chat-split-reader';
    panel.style.display = 'none';
    panel.innerHTML =
      '<div class="chat-split-reader-header">' +
        '<span class="chat-split-reader-title">Reader</span>' +
        '<div class="chat-split-reader-actions">' +
          '<button class="chat-split-reader-btn" data-action="open-tab" title="Open in new tab">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>' +
          '</button>' +
          '<button class="chat-split-reader-btn" data-action="close" title="Close reader">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
          '</button>' +
        '</div>' +
      '</div>' +
      '<iframe class="split-reader-iframe" src="about:blank" title="Reader"></iframe>';
    document.body.appendChild(panel);

    iframe = panel.querySelector('iframe');
    panel.querySelector('[data-action="close"]').addEventListener('click', close);
    panel.querySelector('[data-action="open-tab"]').addEventListener('click', function () {
      if (iframe && iframe.src && iframe.src !== 'about:blank') {
        window.open(iframe.src, '_blank', 'noopener');
      }
    });

    divider = document.createElement('div');
    divider.className = 'chat-split-reader-divider';
    divider.style.display = 'none';
    document.body.appendChild(divider);
    setupDrag();

    // Recompute layout on window resize and whenever the app sidebar's
    // collapsed state changes.
    window.addEventListener('resize', function () { if (isOpen) apply(); });
    var sb = document.querySelector('.app-sidebar');
    if (sb && 'MutationObserver' in window) {
      new MutationObserver(function () { if (isOpen) apply(); })
        .observe(sb, { attributes: true, attributeFilter: ['class', 'style'] });
      // Also watch for the width transition to finish.
      sb.addEventListener('transitionend', function (e) {
        if (e.propertyName === 'width' && isOpen) apply();
      });
    }
  }

  function apply() {
    var sbw = getSidebarWidth();
    var available = Math.max(0, window.innerWidth - sbw);
    var panelWidth = Math.round(ratio * available);
    if (dockMode === 'right') {
      // Panel docks against the right edge of the window. Outer
      // content (reader-wrapper) keeps its native left flush against
      // the sidebar; we push its right edge in by the panel width via
      // --chat-split-right.
      panel.style.left = (window.innerWidth - panelWidth) + 'px';
      panel.style.right = '0px';
      panel.style.width = panelWidth + 'px';
      divider.style.left = (window.innerWidth - panelWidth - 3) + 'px';
      document.body.style.setProperty('--chat-split-right', panelWidth + 'px');
      document.body.style.removeProperty('--chat-split-left');
    } else {
      // Middle dock — chat context. Panel sits between the app
      // sidebar and the outer chat content, pushing chat right.
      panel.style.left = sbw + 'px';
      panel.style.right = 'auto';
      panel.style.width = panelWidth + 'px';
      divider.style.left = (sbw + panelWidth - 3) + 'px';
      document.body.style.setProperty('--chat-split-left', panelWidth + 'px');
      document.body.style.removeProperty('--chat-split-right');
    }
  }

  function open(url) {
    ensureCreated();

    // HARD RULE: never more than 2 panes on screen. Before we open
    // this split, close every other side-panel / split-panel that
    // might already be visible. That includes:
    //   - The in-reader split-chat panel (public/js/split-chat.js)
    //   - The metadata side panel (public/js/metadata-panel.js)
    //   - The notes side panel (public/js/notes-panel.js)
    // Each exposes its own close hook; we call whichever is present.
    closeOtherPanels();

    // If already open, just update the target URL in-place — don't
    // re-trigger the layout dance, don't spawn a second level.
    if (isOpen) {
      if (url) iframe.src = ensureCollapsedQuery(url);
      return;
    }

    isOpen = true;
    // Auto-detect dock mode: if the calling page has .reader-wrapper
    // (the reader view), dock the split panel to the RIGHT so the
    // outer reader's sidebar stays next to its own content. Otherwise
    // (chat / files-notebook) stay with the legacy middle dock.
    dockMode = document.querySelector('.reader-wrapper') ? 'right' : 'middle';
    document.body.classList.toggle('chat-split-dock-right', dockMode === 'right');
    // Any time a split opens: the outer sidebar collapses by default.
    // Applies to BOTH dock modes — the hard rule is "never more than
    // 2 panes, and no side panels bleeding into the layout when we
    // transition into split".
    forceOuterSidebarCollapsed();
    document.body.classList.add('chat-split-open');
    panel.style.display = 'flex';
    divider.style.display = 'block';
    apply();
    if (url) iframe.src = ensureCollapsedQuery(url);
  }

  // Close any other side panels / splits that might be visible.
  // Called at the top of open() to enforce the "max 2 panes" rule.
  //
  // Each panel module (split-chat.js, metadata-panel.js,
  // notes-panel.js) sets inline flex/width styles on #readerMain
  // when it opens, and its own close function is what RESETS those
  // styles. If we just hide the panel via display:none without
  // calling its close function, the reader stays squeezed. So this
  // helper prefers the exposed close functions when available and
  // falls back to a hard reset of the inline styles for safety.
  function closeOtherPanels() {
    // In-reader split-chat (split-chat.js) — uses the hidden
    // splitToggleBtn click handler which calls closePanel().
    var chatPanel = document.getElementById('splitChatPanel');
    if (chatPanel && chatPanel.style.display && chatPanel.style.display !== 'none') {
      var chatToggle = document.getElementById('splitToggleBtn');
      if (chatToggle) chatToggle.click();
    }
    // Metadata panel.
    if (typeof window.__closeMetadataPanel === 'function') {
      try { window.__closeMetadataPanel(); } catch (e) {}
    }
    // Notes panel.
    if (typeof window.__closeNotesPanel === 'function') {
      try { window.__closeNotesPanel(); } catch (e) {}
    }
    // Defensive hard reset: even if the close functions above
    // missed something (older cached JS, panel not yet loaded,
    // etc), wipe the inline styles that would keep readerMain
    // squeezed. These are the only inline properties any of the
    // panels set.
    var readerMain = document.getElementById('readerMain');
    if (readerMain) {
      readerMain.style.flex = '';
      readerMain.style.width = '';
    }
    var inputBar = document.querySelector('.reader-wrapper > .input-bar');
    if (inputBar) inputBar.style.display = '';
    var divider = document.getElementById('splitDivider');
    if (divider && divider.style.display !== 'none') divider.style.display = 'none';
    // Also hide any leftover .split-chat-panel siblings directly
    // in case their own close() didn't fire.
    var leftoverPanels = document.querySelectorAll('.split-chat-panel');
    leftoverPanels.forEach(function (p) {
      if (p.style.display && p.style.display !== 'none') {
        p.style.display = 'none';
      }
    });
  }

  function update(url) {
    if (!isOpen) return false;
    if (url) iframe.src = ensureCollapsedQuery(url);
    return true;
  }

  function close() {
    isOpen = false;
    document.body.classList.remove('chat-split-open');
    document.body.classList.remove('chat-split-dock-right');
    if (panel) panel.style.display = 'none';
    if (divider) divider.style.display = 'none';
    if (iframe) iframe.src = 'about:blank';
    document.body.style.removeProperty('--chat-split-left');
    document.body.style.removeProperty('--chat-split-right');
    restoreOuterSidebar();
  }

  function setupDrag() {
    var dragging = false;
    divider.addEventListener('mousedown', function (e) {
      dragging = true;
      e.preventDefault();
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      // While dragging, disable pointer events on the iframe so the mouse
      // moves track reliably (otherwise the iframe eats the mousemove).
      if (iframe) iframe.style.pointerEvents = 'none';
    });
    document.addEventListener('mousemove', function (e) {
      if (!dragging) return;
      var sbw = getSidebarWidth();
      var available = Math.max(1, window.innerWidth - sbw);
      var r;
      if (dockMode === 'right') {
        // Right-docked: dragging LEFT makes the panel wider. Ratio is
        // the fraction of available width the panel occupies, so it's
        // (window.innerWidth - clientX) / available.
        r = (window.innerWidth - e.clientX) / available;
      } else {
        r = (e.clientX - sbw) / available;
      }
      if (r < 0.25) r = 0.25;
      if (r > 0.8) r = 0.8;
      ratio = r;
      localStorage.setItem('gyde-chat-split-ratio-v2', String(r));
      apply();
    });
    document.addEventListener('mouseup', function () {
      if (dragging) {
        dragging = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        if (iframe) iframe.style.pointerEvents = '';
      }
    });
  }

  window.__openSplitReader = open;
  window.__updateSplitReader = update;
  window.__closeSplitReader = close;
  window.__isSplitReaderOpen = function () { return isOpen; };
})();
