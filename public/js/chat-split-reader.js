/**
 * Split-screen reader panel for the chat view.
 *
 * Lets a chat page open a book/page in a resizable reader iframe on the right,
 * without leaving the chat. Called from citation link clicks in chat.ejs.
 *
 * Exposes:
 *   window.__openSplitReader(url)   — open (or update) the panel with the given reader URL
 *   window.__updateSplitReader(url) — update the iframe src if the panel is already open
 *   window.__isSplitReaderOpen()    — bool
 *   window.__closeSplitReader()     — close the panel
 */
(function () {
  var panel = null;
  var iframe = null;
  var divider = null;
  var isOpen = false;
  // Fraction of viewport width occupied by the reader panel (right side).
  var ratio = parseFloat(localStorage.getItem('gyde-chat-split-ratio'));
  if (!isFinite(ratio) || ratio < 0.25 || ratio > 0.75) ratio = 0.5;

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
  }

  function apply() {
    var pct = ratio * 100;
    panel.style.width = pct + '%';
    divider.style.right = 'calc(' + pct + '% - 3px)';
    document.body.style.setProperty('--chat-split-right', pct + '%');
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
  }

  function setupDrag() {
    var dragging = false;
    divider.addEventListener('mousedown', function (e) {
      dragging = true;
      e.preventDefault();
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    });
    document.addEventListener('mousemove', function (e) {
      if (!dragging) return;
      var w = window.innerWidth;
      var r = (w - e.clientX) / w;
      if (r < 0.25) r = 0.25;
      if (r > 0.75) r = 0.75;
      ratio = r;
      localStorage.setItem('gyde-chat-split-ratio', String(r));
      apply();
    });
    document.addEventListener('mouseup', function () {
      if (dragging) {
        dragging = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    });
  }

  window.__openSplitReader = open;
  window.__updateSplitReader = update;
  window.__closeSplitReader = close;
  window.__isSplitReaderOpen = function () { return isOpen; };
})();
