const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const tick = () => new Promise(resolve => setImmediate(resolve));

function readerFixture(fetchPage) {
  const ids = ['readerScrollContent', 'readerOriginal', 'readerPdfScroll', 'readerChunksSingle',
    'currentPageNum', 'pageIndicator', 'headerPrevBtn', 'headerNextBtn', 'pageJump', 'readerChunksContent'];
  const dom = new JSDOM(`<main id="readerMain"><div id="readerContent" data-page="1"><p>Page one</p></div>
    <img id="originalPageImg">${ids.map(id => `<div id="${id}"></div>`).join('')}
    <a class="page-link" data-page="2"></a><a class="page-link" data-page="3"></a></main>`,
  { url: 'http://localhost/reader/test/page/1?embed=1', runScripts: 'outside-only' });
  const w = dom.window;
  w.__READER__ = { bookId: 'test', currentPage: 1, totalPages: 3 };
  w.fetch = fetchPage;
  w.HTMLElement.prototype.scrollIntoView = function() {};
  w.eval(fs.readFileSync(path.join(__dirname, '../public/js/reader.js'), 'utf8'));
  return dom;
}

test('returning from PDF to HTML loads the actual selected page', async () => {
  const dom = readerFixture(async url => ({ ok: true, json: async () => ({ htmlContent: `<p>${url}</p>` }) }));
  try {
    const w = dom.window;
    w.__readerSetMode('pdf');
    w.document.querySelector('[data-page="2"].page-link').click();
    await tick();
    assert.equal(w.__READER__.currentPage, 2);
    w.__readerSetMode('pages');
    await tick();
    assert.equal(w.document.getElementById('readerContent').dataset.page, '2');
    assert.match(w.document.getElementById('readerContent').textContent, /page\/2/);
    assert.equal(new URL(w.location.href).searchParams.get('embed'), '1');
  } finally { dom.window.close(); }
});

test('late page responses cannot overwrite a newer navigation', async () => {
  const pending = new Map();
  const dom = readerFixture(url => new Promise(resolve => pending.set(url, resolve)));
  try {
    const w = dom.window;
    w.document.querySelector('[data-page="2"].page-link').click();
    w.document.querySelector('[data-page="3"].page-link').click();
    pending.get('/reader/test/api/page/3')({ ok: true, json: async () => ({ htmlContent: '<p>Page three</p>' }) });
    await tick();
    pending.get('/reader/test/api/page/2')({ ok: true, json: async () => ({ htmlContent: '<p>Page two</p>' }) });
    await tick();
    assert.equal(w.__READER__.currentPage, 3);
    assert.equal(w.document.getElementById('readerContent').textContent, 'Page three');
  } finally { dom.window.close(); }
});
