/**
 * Split-screen chat panel for the reader.
 * Opens on the right side with a draggable divider.
 */
(() => {
  const R = window.__READER__;
  const readerMain = document.getElementById('readerMain');
  const panel = document.getElementById('splitChatPanel');
  const divider = document.getElementById('splitDivider');
  const inputBar = document.querySelector('.reader-wrapper > .input-bar');
  const toggleBtn = document.getElementById('splitToggleBtn');
  const closeBtn = document.getElementById('splitCloseBtn');
  const quoteBlock = document.getElementById('splitChatQuote');
  const quoteText = document.getElementById('splitQuoteText');
  const messagesEl = document.getElementById('splitChatMessages');
  const chatInput = document.getElementById('splitChatInput');
  const chatSendBtn = document.getElementById('splitChatSendBtn');

  let isOpen = false;
  let chatId = null;
  let highlightContext = null;
  let sending = false;
  let splitRatio = parseFloat(localStorage.getItem('gyde-split-ratio')) || 0.6;

  // ─── OPEN / CLOSE ─────────────────────────────────────────────

  function openPanel(highlight) {
    highlightContext = highlight || null;
    chatId = null;
    messagesEl.innerHTML = '';
    sending = false;

    if (highlightContext) {
      quoteText.textContent = highlightContext;
      quoteBlock.style.display = '';
    } else {
      quoteBlock.style.display = 'none';
    }

    isOpen = true;
    panel.style.display = 'flex';
    divider.style.display = '';
    if (inputBar) inputBar.style.display = 'none';
    applySplitRatio();
    chatInput.focus();
  }

  function closePanel() {
    isOpen = false;
    panel.style.display = 'none';
    divider.style.display = 'none';
    if (inputBar) inputBar.style.display = '';
    readerMain.style.flex = '';
    readerMain.style.width = '';
  }

  function applySplitRatio() {
    readerMain.style.flex = 'none';
    readerMain.style.width = (splitRatio * 100) + '%';
    panel.style.width = ((1 - splitRatio) * 100 - 0.3) + '%';
  }

  toggleBtn.addEventListener('click', () => {
    if (isOpen) closePanel();
    else openPanel(null);
  });

  closeBtn.addEventListener('click', closePanel);

  // Expose for highlights.js
  window.__openSplitChat = openPanel;

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
    const container = readerMain.parentElement;
    const rect = container.getBoundingClientRect();
    let ratio = (e.clientX - rect.left) / rect.width;
    ratio = Math.max(0.3, Math.min(0.8, ratio));
    splitRatio = ratio;
    localStorage.setItem('gyde-split-ratio', ratio);
    applySplitRatio();
  });

  document.addEventListener('mouseup', () => {
    if (dragging) {
      dragging = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
  });

  // ─── CHAT MESSAGING ───────────────────────────────────────────

  function addMsg(role, html) {
    const div = document.createElement('div');
    div.className = 'split-msg split-msg-' + role;
    div.innerHTML = html;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return div;
  }

  function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function formatMsg(text) {
    var blocks = text.split(/\n\n+/);
    return blocks.map(function(b) {
      b = b.trim();
      if (!b) return '';
      if (/^\\\[/.test(b) && /\\\]$/.test(b)) return '<div style="margin:0.4em 0;text-align:center;">' + b + '</div>';
      var lines = b.split('\n').map(function(l) {
        // Preserve LaTeX, escape rest
        var r = '', i = 0;
        while (i < l.length) {
          if (l[i] === '\\' && (l[i+1] === '(' || l[i+1] === '[')) {
            var cl = l[i+1] === '(' ? '\\)' : '\\]';
            var end = l.indexOf(cl, i+2);
            if (end !== -1) { r += l.substring(i, end + cl.length); i = end + cl.length; continue; }
          }
          if (l[i] === '&') r += '&amp;'; else if (l[i] === '<') r += '&lt;'; else if (l[i] === '>') r += '&gt;'; else r += l[i];
          i++;
        }
        r = r.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        return r;
      });
      return '<p style="margin:0 0 0.4em;">' + lines.join('<br>') + '</p>';
    }).join('');
  }

  async function sendMessage() {
    var text = chatInput.value.trim();
    if (!text || sending) return;
    sending = true;
    chatInput.value = '';
    chatInput.disabled = true;

    addMsg('user', escapeHtml(text));

    // Create chat if first message
    if (!chatId) {
      try {
        var res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: text,
            context: 'reader',
            bookId: R.bookId,
            pageNumber: R.currentPage,
            highlightText: highlightContext || undefined,
          }),
        });
        var data = await res.json();
        chatId = data.chatId;
      } catch (e) {
        addMsg('assistant', '<span style="color:#e55;">Failed to create chat</span>');
        sending = false;
        chatInput.disabled = false;
        return;
      }
      // Stream the response for the just-created chat
      streamResponse('/api/chat/' + chatId + '/respond', 'POST');
    } else {
      // Send to existing chat
      streamResponse('/api/chat/' + chatId + '/message', 'POST', { message: text });
    }
  }

  function streamResponse(url, method, body) {
    var assistantDiv = addMsg('assistant', '<span style="color:var(--app-text-muted);font-style:italic;">Thinking...</span>');
    var opts = { method: method, headers: { 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);

    fetch(url, opts).then(function(response) {
      var reader = response.body.getReader();
      var decoder = new TextDecoder();
      var fullText = '';
      var started = false;

      function read() {
        reader.read().then(function(result) {
          if (result.done) {
            sending = false;
            chatInput.disabled = false;
            chatInput.focus();
            if (window.MathJax && MathJax.typesetPromise) {
              MathJax.typesetPromise([assistantDiv]).catch(function(){});
            }
            return;
          }
          decoder.decode(result.value, { stream: true }).split('\n').forEach(function(line) {
            line = line.trim();
            if (!line.startsWith('data: ')) return;
            try {
              var d = JSON.parse(line.substring(6));
              if (d.type === 'chunk') {
                if (!started) { assistantDiv.innerHTML = ''; started = true; }
                fullText += d.text;
                assistantDiv.innerHTML = formatMsg(fullText);
                messagesEl.scrollTop = messagesEl.scrollHeight;
              } else if (d.type === 'error') {
                assistantDiv.innerHTML = '<span style="color:#e55;">' + escapeHtml(d.error) + '</span>';
              }
            } catch(e) {}
          });
          read();
        });
      }
      read();
    }).catch(function() {
      assistantDiv.innerHTML = '<span style="color:#e55;">Network error</span>';
      sending = false;
      chatInput.disabled = false;
    });
  }

  chatSendBtn.addEventListener('click', sendMessage);
  chatInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
})();
