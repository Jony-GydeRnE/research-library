const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const tick = () => new Promise(resolve => setImmediate(resolve));

function fixture(fetch) {
  const ids = ['readerMain', 'splitChatPanel', 'splitDivider', 'splitToggleBtn', 'splitCloseBtn',
    'splitChatQuote', 'splitQuoteText', 'splitChatMessages', 'splitChatSendBtn'];
  const dom = new JSDOM(ids.map(id => `<div id="${id}"></div>`).join('') + '<input id="splitChatInput">',
    { url: 'http://localhost/', runScripts: 'outside-only' });
  const w = dom.window;
  w.__READER__ = { bookId: 'fixture', currentPage: 1 };
  w.fetch = fetch;
  w.TextDecoder = TextDecoder;
  const helper = path.join(__dirname, '../public/js/sse.js');
  if (fs.existsSync(helper)) w.eval(fs.readFileSync(helper, 'utf8'));
  w.eval(fs.readFileSync(path.join(__dirname, '../public/js/split-chat.js'), 'utf8'));
  return dom;
}

test('split chat handles byte-split SSE and displays the saved final reply', async () => {
  const payload = 'data: ' + JSON.stringify({ type: 'chunk', text: 'Draft α' }) + '\n\n' +
    'data: ' + JSON.stringify({ type: 'done', text: 'Saved final α' }) + '\n\n';
  const bytes = new TextEncoder().encode(payload);
  const dom = fixture(async url => url === '/api/chat' ? Response.json({ chatId: 'chat' }) : new Response(new ReadableStream({
    start(controller) { for (const byte of bytes) controller.enqueue(Uint8Array.of(byte)); controller.close(); },
  })));
  try {
    const w = dom.window;
    w.__openSplitChat(null);
    w.document.getElementById('splitChatInput').value = 'Question';
    w.document.getElementById('splitChatSendBtn').click();
    await tick(); await tick();
    assert.equal(w.document.querySelector('.split-msg-assistant').textContent, 'Saved final α');
    assert.equal(w.document.getElementById('splitChatInput').disabled, false);
  } finally { dom.window.close(); }
});

test('reopening a tool-enabled chat renders text messages and keeps math HTML inert', async () => {
  const dom = fixture(async () => Response.json({ messages: [
    { role: 'assistant', kind: 'tool', content: [{ type: 'tool_use' }] },
    { role: 'assistant', kind: 'text', content: '\\[<img src=x>\\]' },
  ] }));
  try {
    const w = dom.window;
    await w.__openSplitChatWithId('chat');
    const messages = w.document.getElementById('splitChatMessages');
    assert.doesNotMatch(messages.textContent, /Failed to load/);
    assert.equal(messages.querySelectorAll('.split-msg').length, 1);
    assert.equal(messages.querySelectorAll('img').length, 0);
    assert.match(messages.textContent, /<img src=x>/);
  } finally { dom.window.close(); }
});
