const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const tick = () => new Promise(resolve => setImmediate(resolve));
function fixture(fetch) {
  const dom = new JSDOM('<div class="reader-wrapper"><div><div id="readerMain"></div></div></div>',
    { url: 'http://localhost/', runScripts: 'outside-only' });
  const w = dom.window;
  w.__READER__ = { bookId: 'book', currentPage: 2 };
  w.MathJax = { typesetClear() {}, typesetPromise: async () => {} };
  w.fetch = fetch;
  w.eval(fs.readFileSync(path.join(__dirname, '../public/js/notes-panel.js'), 'utf8'));
  return dom;
}
test('a failed note save preserves the draft and never claims Saved', async () => {
  const dom = fixture(async () => Response.json({ error: 'Database unavailable' }, { status: 500 }));
  try {
    const w = dom.window, doc = w.document;
    w.__openNotesPanel();
    doc.getElementById('notesTextarea').value = 'Keep my research';
    doc.getElementById('notesSaveBtn').click();
    await tick();
    assert.match(doc.getElementById('notesStatus').textContent, /Failed/);
    assert.equal(doc.getElementById('notesTextarea').style.display, '');
    assert.equal(doc.getElementById('notesTextarea').value, 'Keep my research');
  } finally { dom.window.close(); }
});
test('a new note stays anchored to the page where it was opened', async () => {
  let body;
  const dom = fixture(async (url, options) => { if (url === '/api/notes') body = JSON.parse(options.body); return Response.json({ _id: 'saved' }); });
  try {
    const w = dom.window;
    w.__openNotesPanel('Source quote', 'highlight');
    w.__READER__.currentPage = 8;
    w.document.getElementById('notesTextarea').value = 'About page two';
    w.document.getElementById('notesSaveBtn').click();
    await tick();
    assert.equal(body.pageNumber, 2);
  } finally { dom.window.close(); }
});
test('a slow note load cannot replace a newly opened note', async () => {
  let resolveFirst;
  const dom = fixture(url => url.endsWith('/first') ? new Promise(resolve => { resolveFirst = resolve; })
    : Promise.resolve(Response.json({ _id: 'second', content: 'Second note', title: 'Second' })));
  try {
    const w = dom.window;
    const first = w.__openNotesPanelWithId('first');
    await w.__openNotesPanelWithId('second');
    resolveFirst(Response.json({ _id: 'first', content: 'Stale first', title: 'First' }));
    await first;
    assert.equal(w.document.getElementById('notesTextarea').value, 'Second note');
  } finally { dom.window.close(); }
});
