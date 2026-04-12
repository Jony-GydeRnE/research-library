/**
 * chunkViewService — data layer for the "Chunks" reader mode.
 *
 * Returns, for one page:
 *   - the chunks on that page
 *   - each chunk's spans (using span.spanText directly — no
 *     sentence re-splitting, so LaTeX delimiters stay intact)
 *   - tags per span and per chunk
 *   - edges touching each span/chunk, with the target book
 *     resolved to its real title, de-duplicated by
 *     (direction, relationship, targetChunkId), sorted by
 *     confidence descending (z best → a worst)
 */

const Chunk = require('../models/Chunk');
const Span = require('../models/Span');
const Edge = require('../models/Edge');
const Book = require('../models/Book');

// Confidence letter -> 0..25 index. a=0 (worst), z=25 (best).
// Matches compressionService.fractionToConfidence.
function confIndex(letter) {
  if (typeof letter !== 'string' || letter.length === 0) return -1;
  const c = letter.toLowerCase().charCodeAt(0) - 'a'.charCodeAt(0);
  return (c >= 0 && c <= 25) ? c : -1;
}

// Intra-span sentence separator: turn "A. B. C." into "A;; B;; C."
// Only runs on raw text that DOESN'T contain LaTeX delimiters,
// so a multi-sentence prose span gets ;; between sentences while
// an equation-heavy span is left alone.
function substituteSemicolons(text) {
  if (!text || typeof text !== 'string') return text || '';
  // Skip if the span has LaTeX — splitting is too risky.
  if (/\\\(|\\\[|\$/.test(text)) return text;
  const parts = text.split(/(?<=[.!?])\s+/);
  if (parts.length <= 1) return text;
  const out = [];
  for (let i = 0; i < parts.length; i++) {
    if (i === parts.length - 1) out.push(parts[i]);
    else out.push(parts[i].replace(/[.!?]\s*$/, '') + ';;');
  }
  return out.join(' ');
}

function previewText(s, n = 140) {
  if (!s) return '';
  const clean = String(s).replace(/\s+/g, ' ').trim();
  return clean.length <= n ? clean : clean.slice(0, n - 1) + '…';
}

async function getPageChunkView(bookId, pageNumber) {
  const chunks = await Chunk.find({ bookId, pageNumber })
    .sort({ chunkIndex: 1, _id: 1 })
    .lean();

  if (chunks.length === 0) {
    return { bookId: String(bookId), pageNumber, chunkCount: 0, chunks: [] };
  }

  // Load all spans referenced by these chunks.
  const allSpanIds = chunks.flatMap(c => c.spanIds || []);
  const spans = allSpanIds.length > 0
    ? await Span.find({ _id: { $in: allSpanIds } }).lean()
    : [];
  const spanMap = new Map(spans.map(s => [String(s._id), s]));

  // Pull every edge touching any chunk or span on this page.
  const chunkIds = chunks.map(c => c._id);
  const edgesRaw = await Edge.find({
    $or: [
      { fromChunkId: { $in: chunkIds } },
      { toChunkId: { $in: chunkIds } },
      { fromSpanId: { $in: allSpanIds } },
    ],
  }).lean();

  // Collect BOTH book sides of every edge so the lookup never
  // falls back to "unknown book" because we only fetched one side.
  const allBookIds = new Set();
  for (const e of edgesRaw) {
    if (e.fromBookId) allBookIds.add(String(e.fromBookId));
    if (e.toBookId)   allBookIds.add(String(e.toBookId));
  }
  const books = allBookIds.size > 0
    ? await Book.find({ _id: { $in: [...allBookIds] } }).select('_id title author').lean()
    : [];
  const bookMap = new Map(books.map(b => [String(b._id), b]));

  // Resolve target-chunk previews.
  const allChunkIds = new Set();
  for (const e of edgesRaw) {
    if (e.fromChunkId) allChunkIds.add(String(e.fromChunkId));
    if (e.toChunkId)   allChunkIds.add(String(e.toChunkId));
  }
  const targetChunks = allChunkIds.size > 0
    ? await Chunk.find({ _id: { $in: [...allChunkIds] } })
        .select('_id bookId pageNumber sourceText rawText structuralType').lean()
    : [];
  const targetChunkMap = new Map(targetChunks.map(c => [String(c._id), c]));

  // Index edges by span and chunk so each span's detail panel can
  // pull the right edges.
  const edgesBySpan = new Map();   // spanId -> edges
  const edgesByChunk = new Map();  // chunkId -> edges
  for (const e of edgesRaw) {
    if (e.fromSpanId) {
      const k = String(e.fromSpanId);
      if (!edgesBySpan.has(k)) edgesBySpan.set(k, []);
      edgesBySpan.get(k).push(e);
    }
    if (e.fromChunkId) {
      const k = String(e.fromChunkId);
      if (!edgesByChunk.has(k)) edgesByChunk.set(k, []);
      edgesByChunk.get(k).push(e);
    }
    if (e.toChunkId && String(e.toChunkId) !== String(e.fromChunkId)) {
      const k = String(e.toChunkId);
      if (!edgesByChunk.has(k)) edgesByChunk.set(k, []);
      edgesByChunk.get(k).push(e);
    }
  }

  // Format one edge relative to a "self" chunk (whichever chunk
  // we're rendering the edge FROM). The other side becomes the
  // target we show to the user.
  const formatEdge = (e, selfChunkId) => {
    const fromStr = String(e.fromChunkId || '');
    const toStr   = String(e.toChunkId || '');
    const selfIsFrom = fromStr === String(selfChunkId);
    const otherChunkId = selfIsFrom ? toStr : fromStr;
    const otherBookId  = String(selfIsFrom ? (e.toBookId || '') : (e.fromBookId || ''));
    const targetBook = bookMap.get(otherBookId);
    const t = targetChunkMap.get(otherChunkId);
    return {
      edgeId: String(e._id),
      direction: selfIsFrom ? 'out' : 'in',
      relationship: e.relationshipType,
      confidence: e.confidence || 'a',
      relevance: e.relevance || null,
      method: e.method,
      targetChunkId: otherChunkId,
      targetBookId: otherBookId,
      targetBookTitle: targetBook?.title || null,
      targetBookAuthor: targetBook?.author || null,
      targetPage: t?.pageNumber ?? null,
      targetStructuralType: t?.structuralType ?? null,
      targetPreview: previewText(t?.sourceText || t?.rawText || '', 160),
    };
  };

  // De-duplicate edges within a chunk's edge list. Two edges are
  // duplicates if they point from/to the same target with the
  // same relationship and direction. Keep the highest-confidence
  // instance.
  const dedupEdges = (edges) => {
    const best = new Map();
    for (const e of edges) {
      const key = `${e.direction}|${e.relationship}|${e.targetChunkId}`;
      const existing = best.get(key);
      if (!existing || confIndex(e.confidence) > confIndex(existing.confidence)) {
        best.set(key, e);
      }
    }
    return [...best.values()].sort((a, b) => confIndex(b.confidence) - confIndex(a.confidence));
  };

  // Build chunk rows.
  const out = [];
  for (const c of chunks) {
    const orderedSpans = (c.spanIds || [])
      .map(id => spanMap.get(String(id)))
      .filter(Boolean)
      .sort((a, b) => (a.sentenceStart || 0) - (b.sentenceStart || 0));

    const renderedSpans = [];
    for (const s of orderedSpans) {
      // Use span.spanText directly — it's already the right
      // sliced text with LaTeX delimiters intact. Fall back to
      // a slice of chunk.sourceText only as a last resort.
      let text = s.spanText || '';
      if (!text) text = (c.sourceText || c.rawText || '').trim();
      text = substituteSemicolons(text);

      const rawEdges = (edgesBySpan.get(String(s._id)) || []).map(e => formatEdge(e, c._id));
      const dedupedSpanEdges = dedupEdges(rawEdges);

      renderedSpans.push({
        spanId: String(s._id),
        sentenceStart: s.sentenceStart,
        sentenceEnd: s.sentenceEnd,
        role: s.role || null,
        contextTags: s.contextTags || [],
        searchClass: s.searchClass || 'N',
        searchConfidence: s.searchConfidence || null,
        gapType: s.gapType || null,
        renderedText: text,
        edges: dedupedSpanEdges,
      });
    }

    // Chunk-level edges (edges where fromSpanId is empty or the
    // span isn't among the chunk's own spans — e.g. funnel LLM
    // edges written only with chunkId).
    const chunkSpanSet = new Set(renderedSpans.map(rs => rs.spanId));
    const chunkLevelRaw = (edgesByChunk.get(String(c._id)) || [])
      .filter(e => {
        if (!e.fromSpanId) return true;
        return !chunkSpanSet.has(String(e.fromSpanId));
      })
      .map(e => formatEdge(e, c._id));
    let chunkLevelEdges = dedupEdges(chunkLevelRaw);

    // Single-span attribution. If a chunk has exactly one span,
    // every "chunk-level" edge must structurally belong to that
    // one span — there's no other span for it to belong to. The
    // funnel simply writes fromChunkId without bothering to set
    // fromSpanId, but the meaning is unambiguous. Merge them
    // into the span's edges and drop the separate chunk-level
    // row for these chunks. For multi-span chunks we keep the
    // chunk-level row so the user can still inspect edges whose
    // span attribution is genuinely unknown.
    if (renderedSpans.length === 1 && chunkLevelEdges.length > 0) {
      const merged = dedupEdges([...renderedSpans[0].edges, ...chunkLevelEdges]);
      renderedSpans[0].edges = merged;
      chunkLevelEdges = [];
    }

    out.push({
      chunkId: String(c._id),
      chunkIndex: c.chunkIndex ?? null,
      structuralType: c.structuralType || c.chunkType || null,
      contextTags: c.contextTags || [],
      conceptTags: c.conceptTags || [],
      sourceText: c.sourceText || c.rawText || '',
      wordCount: c.wordCount || null,
      hasMissingProof: !!c.hasMissingProof,
      chunkLevelEdges,
      spans: renderedSpans,
    });
  }

  return {
    bookId: String(bookId),
    pageNumber: Number(pageNumber),
    chunkCount: out.length,
    chunks: out,
  };
}

module.exports = { getPageChunkView, substituteSemicolons };
