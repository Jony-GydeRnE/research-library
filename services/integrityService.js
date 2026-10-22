/** Read-only structural audit. Does not judge mathematical correctness. */
const Book = require('../models/Book');
const Page = require('../models/Page');
const Chunk = require('../models/Chunk');
const Span = require('../models/Span');
const Edge = require('../models/Edge');
const CanonicalDefinition = require('../models/CanonicalDefinition');

async function auditIntegrity({ exampleLimit = 10 } = {}) {
  const [books, pages, chunks, spans, edges, definitions] = await Promise.all([
    Book.find().select('_id status pageCount').lean(),
    Page.find().select('_id bookId pageNumber visionProcessed chunkIds spanIds').lean(),
    Chunk.find().select('_id bookId pageNumber sentenceStart sentenceEnd spanIds prevChunkId nextChunkId mergedInto qualityRepairStatus').lean(),
    Span.find().select('_id bookId pageNumber chunkId sentenceStart sentenceEnd replacedBy qualityRepairStatus resolved resolvedBy').lean(),
    Edge.find().select('_id fromBookId toBookId fromChunkId toChunkId fromSpanId toSpanId method confidence resolved').lean(),
    CanonicalDefinition.find().select('_id definitionBookId definitionChunkId definitionSpanId').lean(),
  ]);
  const map = rows => new Map(rows.map(row => [String(row._id), row]));
  const bookMap = map(books), chunkMap = map(chunks), spanMap = map(spans), edgeMap = map(edges);
  const issues = {};
  const add = (kind, row, detail = {}) => {
    const group = issues[kind] ||= { count: 0, examples: [] };
    group.count++;
    if (group.examples.length < exampleLimit) group.examples.push({ id: String(row._id), ...detail });
  };
  const check = (row, field, target, kind, required = false) => {
    if (!row[field] && !required) return;
    if (!target.has(String(row[field]))) add(kind, row, { field, reference: row[field] ? String(row[field]) : null });
  };
  const activeChunk = c => !['merged', 'replaced'].includes(c.qualityRepairStatus);
  const validRange = r => Number.isInteger(r.sentenceStart) && Number.isInteger(r.sentenceEnd) && r.sentenceStart >= 1 && r.sentenceEnd >= r.sentenceStart;

  const pageGroups = new Map();
  for (const p of pages) {
    check(p, 'bookId', bookMap, 'page_missing_book', true);
    if (!Number.isInteger(p.pageNumber) || p.pageNumber < 1) add('page_invalid_number', p);
    const key = `${p.bookId}:${p.pageNumber}`;
    if (pageGroups.has(key)) add('duplicate_page_number', p, { firstPageId: String(pageGroups.get(key)._id) });
    else pageGroups.set(key, p);
    for (const [field, target] of [['chunkIds', chunkMap], ['spanIds', spanMap]]) {
      for (const id of p[field] || []) {
        const item = target.get(String(id));
        if (!item) add('page_missing_' + field, p, { reference: String(id) });
        else if (String(item.bookId) !== String(p.bookId) || item.pageNumber !== p.pageNumber) {
          add('page_wrong_' + field, p, { reference: String(id) });
        }
      }
    }
  }
  for (const c of chunks) {
    check(c, 'bookId', bookMap, 'chunk_missing_book', true);
    check(c, 'prevChunkId', chunkMap, 'chunk_missing_neighbor');
    check(c, 'nextChunkId', chunkMap, 'chunk_missing_neighbor');
    check(c, 'mergedInto', chunkMap, 'chunk_missing_merge_target');
    if (!activeChunk(c)) continue;
    if (!pageGroups.has(`${c.bookId}:${c.pageNumber}`)) add('chunk_missing_page', c);
    if (!validRange(c)) add('chunk_invalid_sentence_range', c);
    for (const id of c.spanIds || []) {
      const s = spanMap.get(String(id));
      if (!s) { add('chunk_missing_span', c, { reference: String(id) }); continue; }
      if (String(s.chunkId) !== String(c._id)) add('chunk_span_owner_mismatch', c, { spanId: String(id) });
      if (String(s.bookId) !== String(c.bookId)) add('chunk_span_book_mismatch', c, { spanId: String(id) });
      if (s.pageNumber !== c.pageNumber) add('chunk_span_page_mismatch', c, { spanId: String(id) });
      if (s.pageNumber === c.pageNumber && validRange(s) && validRange(c) &&
          (s.sentenceStart < c.sentenceStart || s.sentenceEnd > c.sentenceEnd)) add('chunk_excludes_span_range', c, { spanId: String(id) });
    }
  }
  for (const s of spans) {
    check(s, 'bookId', bookMap, 'span_missing_book', true);
    check(s, 'chunkId', chunkMap, 'span_missing_chunk');
    check(s, 'resolvedBy', edgeMap, 'span_missing_resolution_edge');
    if (s.qualityRepairStatus !== 'replaced' && !pageGroups.has(`${s.bookId}:${s.pageNumber}`)) add('span_missing_page', s);
    if (!validRange(s)) add('span_invalid_sentence_range', s);
    for (const id of s.replacedBy || []) if (!spanMap.has(String(id))) add('span_missing_replacement', s, { reference: String(id) });
  }
  for (const e of edges) {
    for (const side of ['from', 'to']) {
      check(e, side + 'BookId', bookMap, 'edge_missing_book', true);
      check(e, side + 'ChunkId', chunkMap, 'edge_missing_chunk', true);
      check(e, side + 'SpanId', spanMap, 'edge_missing_span');
      const c = chunkMap.get(String(e[side + 'ChunkId']));
      if (c && String(c.bookId) !== String(e[side + 'BookId'])) add('edge_chunk_book_mismatch', e, { side });
      if (c && !activeChunk(c)) add('edge_targets_retired_chunk', e, { side });
      const span = spanMap.get(String(e[side + 'SpanId']));
      if (span && String(span.chunkId) !== String(e[side + 'ChunkId'])) add('edge_span_chunk_mismatch', e, { side });
    }
    if (!/^[a-z]$/.test(e.confidence || '')) add('edge_invalid_confidence', e);
    // These methods cannot safely be normalized without knowing the
    // historical writer/version. Report them instead of flipping scores.
    if (['lexical', 'embedding', 'note-citation'].includes(e.method)) add('edge_confidence_provenance_review', e, { method: e.method });
  }
  for (const d of definitions) {
    check(d, 'definitionBookId', bookMap, 'definition_missing_book', true);
    check(d, 'definitionChunkId', chunkMap, 'definition_missing_chunk', true);
    check(d, 'definitionSpanId', spanMap, 'definition_missing_span');
    const c = chunkMap.get(String(d.definitionChunkId));
    if (c && String(c.bookId) !== String(d.definitionBookId)) add('definition_chunk_book_mismatch', d);
  }
  const readiness = books.filter(b => b.status !== 'pending-citation').map(b => {
    const bp = pages.filter(p => String(p.bookId) === String(b._id));
    const have = new Set(bp.map(p => p.pageNumber));
    const missingPages = [];
    for (let n = 1; n <= (b.pageCount || 0); n++) if (!have.has(n)) missingPages.push(n);
    return { bookId: String(b._id), status: b.status, expectedPages: b.pageCount || 0,
      actualPages: have.size, visionPages: new Set(bp.filter(p => p.visionProcessed).map(p => p.pageNumber)).size,
      missingPages, chunks: chunks.filter(c => String(c.bookId) === String(b._id) && activeChunk(c)).length,
      spans: spans.filter(s => String(s.bookId) === String(b._id) && s.qualityRepairStatus !== 'replaced').length };
  });
  return { generatedAt: new Date().toISOString(), readOnly: true,
    caveat: 'A live concurrent ingestion can change records between queries. Run against a consistent backup for migration decisions. Structural validity does not establish semantic correctness.',
    totals: { books: books.length, pages: pages.length, chunks: chunks.length, spans: spans.length, edges: edges.length, definitions: definitions.length },
    issues, readiness };
}

module.exports = { auditIntegrity };
