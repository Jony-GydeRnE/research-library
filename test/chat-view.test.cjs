const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ejs = require('ejs');
const { JSDOM } = require('jsdom');
const tick = () => new Promise(resolve => setImmediate(resolve));
function fixture(messages, booksMap, fetch) {
  // Render the real chat template. Shared layout has separate page scripts.
  const template = fs.readFileSync(path.join(__dirname, '../views/chat.ejs'), 'utf8')
    .replace(/<%- include\([^\n]+\) %>/g, '');
  const html = ejs.render(template, { chat: { _id: 'fixture', messages }, booksMap });
  const dom = new JSDOM(html, { url: 'http://localhost/chat/fixture', runScripts: 'outside-only' });
  dom.window.fetch = fetch;
  dom.window.TextDecoder = TextDecoder;
  dom.window.eval(fs.readFileSync(path.join(__dirname, '../public/js/sse.js'), 'utf8'));
  for (const script of dom.window.document.querySelectorAll('script:not([src])')) dom.window.eval(script.textContent);
  return dom;
}

test('saved chat content cannot terminate the script or inject citation HTML', () => {
  const payload = '</script><img id="injected" src=x>';
  const dom = fixture([{ role: 'assistant', content: payload + '\n\n' +
    '[[cite bookId="book" page="1"]]Quote[[/cite]]\n\n' +
    '[[cite bookId="book" page="<img src=x>"]]Invalid[[/cite]]' }],
    { book: { title: 'Title" onmouseover="alert(1)' } });
  try {
    const doc = dom.window.document;
    assert.equal(doc.querySelectorAll('img').length, 0);
    assert.match(doc.querySelector('.chat-message-content').textContent, /<\/script>/);
    const citation = doc.querySelector('a.chat-cite');
    assert.equal(citation.getAttribute('onmouseover'), null);
    assert.equal(doc.querySelectorAll('a.chat-cite').length, 1);
    assert.equal(doc.querySelectorAll('.chat-cite-missing').length, 1);
  } finally { dom.window.close(); }
});

test('main chat displays the persisted final reply and recovers from interrupted streams', async () => {
  let request = 0;
  const dom = fixture([], {}, async () => {
    request++;
    const events = request === 1 ? [ { type: 'chunk', text: 'Draft' }, { type: 'done', text: 'Saved α' } ]
      : [ { type: 'chunk', text: 'Incomplete' } ];
    return new Response(events.map(e => 'data: ' + JSON.stringify(e) + '\r\n\r\n').join(''));
  });
  try {
    const doc = dom.window.document;
    for (const question of ['First', 'Second']) {
      doc.getElementById('chatInput').value = question;
      doc.getElementById('chatSendBtn').click();
      await tick(); await tick();
      assert.equal(doc.getElementById('chatInput').disabled, false);
    }
    const replies = doc.querySelectorAll('.chat-message-assistant .chat-message-content');
    assert.equal(replies[0].textContent, 'Saved α');
    assert.match(replies[1].textContent, /ended before the reply was saved/);
  } finally { dom.window.close(); }
});
