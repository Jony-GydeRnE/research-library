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
    panel.style.left = sbw + 'px';
    panel.style.width = panelWidth + 'px';
    // Divider sits at the right edge of the panel. Make the visible line
    // thin but the hit area wide (see CSS ::before).
    divider.style.left = (sbw + panelWidth - 3) + 'px';
    // Push the chat view right by exactly the reader panel's width.
    // (.app-main is a flex child after .app-sidebar — it already starts at
    // the sidebar's right edge, so we only add the panel width as margin.)
    document.body.style.setProperty('--chat-split-left', panelWidth + 'px');
  }

  function open(url) {
    ensureCreated();
    isOpen = true;
    document.body.classList.add('chat-split-open');
    panel.style.display = 'flex';
    divider.style.display = 'block';
    apply();
    if (url) iframe.src = url;
  }

  function update(url) {
    if (!isOpen) return false;
    if (url) iframe.src = url;
    return true;
  }

  function close() {
    isOpen = false;
    document.body.classList.remove('chat-split-open');
    if (panel) panel.style.display = 'none';
    if (divider) divider.style.display = 'none';
    if (iframe) iframe.src = 'about:blank';
    document.body.style.removeProperty('--chat-split-left');
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
      var r = (e.clientX - sbw) / available;
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
