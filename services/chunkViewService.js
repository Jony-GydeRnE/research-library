/**
 * chunkViewService — supplies the "Chunks" reader mode with the
 * metadata-forward view of a page: chunks, spans, tags, edges.
 *
 * The regular Pages / Scroll / PDF modes render content. This
 * mode renders METADATA — the user sees how the ingestion
 * pipeline sliced the page so they can evaluate chunk boundaries,
 * tag quality, and edge quality without opening the database.
 *
 * Shape returned by getPageChunkView(bookId, pageNumber):
 * {
 *   bookId, pageNumber,
 *   chunks: [
 *     {
 *       chunkId, chunkIndex, structuralType, contextTags,
 *       conceptTags, sourceText, wordCount, hasMissingProof,
 *       spans: [
 *         {
 *           spanId, sentenceStart, sentenceEnd, role,
 *           contextTags, searchClass, searchConfidence, gapType,
 *           // renderedText: the span text with intermediate
 *           // sentence periods replaced by ';;' (clickable in UI).
 *           // The final period is kept so visually the span ends
 *           // on a real terminator.
 *           renderedText,
 *           // edges fromSpanId OR fromChunkId of the parent chunk,
 *           // ranked by confidence descending (z best -> a worst).
 *           edges: [
 *             { edgeId, direction, relationship, confidence,
 *               relevance, method, targetChunkId, targetBookId,
 *               targetBookTitle, targetPage, targetPreview }
 *           ]
 *         }
 *       ]
 *     }
 *   ]
 * }
 */

const Chunk = require('../models/Chunk');
const Span = require('../models/Span');
const Edge = require('../models/Edge');
const Book = require('../models/Book');

// ─── Sentence splitter ──────────────────────────────────────────
// Lookbehind on sentence terminators followed by whitespace. This
// is deliberately simple - false splits on "Dr." or "e.g." are
// acceptable noise for a metadata-inspection view. The goal is
// visual chunk boundaries, not NLP-grade sentence tokenization.
function splitSentences(text) {
  if (!text || typeof text !== 'string') return [];
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return [];
  const parts = normalized.split(/(?<=[.!?])\s+/);
  return parts.map(s => s.trim()).filter(Boolean);
}

// ─── Rendered-text builder ─────────────────────────────────────
// Take a list of sentences belonging to one span and join them
// with ';;' in place of intermediate sentence terminators. Keep
// the last sentence's trailing period/punctuation as-is.
//
//   ["The quick brown fox.", "It jumps over.", "The lazy dog."]
//     -> "The quick brown fox;; It jumps over;; The lazy dog."
//
// If the span covers 0 or 1 sentence, nothing to substitute.
function renderSpanSentences(sentences) {
  if (!sentences || sentences.length === 0) return '';
  if (sentences.length === 1) return sentences[0];
  const out = [];
  for (let i = 0; i < sentences.length; i++) {
    const s = sentences[i];
    if (i === sentences.length - 1) {
      out.push(s);
    } else {
      // Strip trailing terminator and append ';;'
      out.push(s.replace(/[.!?]\s*$/, '') + ';;');
    }
  }
  return out.join(' ');
}

// ─── Confidence letter -> numeric weight for sorting ──────────
// z is best (100%), a is worst (~4%). We want descending sort,
// so return the alphabetic index (a=0, z=25) and sort reverse.
function confIndex(letter) {
  if (typeof letter !== 'string' || letter.length === 0) return -1;
  const c = letter.toLowerCase().charCodeAt(0) - 'a'.charCodeAt(0);
  return (c >= 0 && c <= 25) ? c : -1;
}

// ─── Main: assemble the view for one page ─────────────────────
async function getPageChunkView(bookId, pageNumber) {
  const chunks = await Chunk.find({ bookId, pageNumber })
    .sort({ chunkIndex: 1, _id: 1 })
    .lean();

  if (chunks.length === 0) {
    return { bookId: String(bookId), pageNumber, chunks: [] };
  }

  // Load all spans for these chunks in one shot.
  const allSpanIds = chunks.flatMap(c => c.spanIds || []);
  const spans = allSpanIds.length > 0
    ? await Span.find({ _id: { $in: allSpanIds } })
        .sort({ sentenceStart: 1 })
        .lean()
    : [];
  const spanMap = new Map(spans.map(s => [String(s._id), s]));

  // Load all edges that touch any of these chunks (as source or
  // target). This is a single query so the common case is fast.
  const chunkIds = chunks.map(c => c._id);
  const edgesRaw = await Edge.find({
    $or: [
      { fromChunkId: { $in: chunkIds } },
      { toChunkId: { $in: chunkIds } },
      // Also pick up edges keyed by fromSpanId for the spans of
      // these chunks — the funnel writes fromSpanId for cross-book
      // llm edges but NOT always fromChunkId, so the chunkId-only
      // query misses them.
      { fromSpanId: { $in: allSpanIds } },
    ],
  }).lean();

  // Resolve target books for previews.
  const targetBookIds = [...new Set(edgesRaw.map(e =>
    String(e.toBookId || e.fromBookId || '')
  ).filter(Boolean))];
  const books = await Book.find({ _id: { $in: targetBookIds } })
    .select('_id title').lean();
  const bookMap = new Map(books.map(b => [String(b._id), b.title]));

  // Resolve target chunk previews.
  const targetChunkIds = [...new Set(edgesRaw.flatMap(e =>
    [String(e.toChunkId || ''), String(e.fromChunkId || '')]
  ).filter(Boolean))];
  const targetChunks = await Chunk.find({ _id: { $in: targetChunkIds } })
    .select('_id bookId pageNumber sourceText rawText structuralType')
    .lean();
  const targetChunkMap = new Map(targetChunks.map(c => [String(c._id), c]));

  // Build an index of edges keyed by spanId and chunkId so each
  // span in the rendered view can look up its own edges.
  const edgesBySpan = new Map();
  const edgesByChunk = new Map();
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
    if (e.toChunkId) {
      const k = String(e.toChunkId);
      if (!edgesByChunk.has(k)) edgesByChunk.set(k, []);
      edgesByChunk.get(k).push(e);
    }
  }

  const previewText = (s, n = 140) => {
    if (!s) return '';
    const clean = String(s).replace(/\s+/g, ' ').trim();
    return clean.length <= n ? clean : clean.slice(0, n - 1) + '…';
  };

  const formatEdge = (e, selfChunkId) => {
    const selfIsFrom = String(e.fromChunkId) === String(selfChunkId);
    const otherChunkId = selfIsFrom ? e.toChunkId : e.fromChunkId;
    const otherBookId = selfIsFrom ? e.toBookId : e.fromBookId;
    const t = targetChunkMap.get(String(otherChunkId));
    return {
      edgeId: String(e._id),
      direction: selfIsFrom ? 'out' : 'in',
      relationship: e.relationshipType,
      confidence: e.confidence,
      relevance: e.relevance,
      method: e.method,
      targetChunkId: String(otherChunkId || ''),
      targetBookId: String(otherBookId || ''),
      targetBookTitle: bookMap.get(String(otherBookId)) || null,
      targetPage: t?.pageNumber ?? null,
      targetStructuralType: t?.structuralType ?? null,
      targetPreview: previewText(t?.sourceText || t?.rawText || '', 160),
    };
  };

  const sortByConfidence = (a, b) => confIndex(b.confidence) - confIndex(a.confidence);

  // Build chunk rows.
  const out = [];
  for (const c of chunks) {
    const sourceText = c.sourceText || c.rawText || '';
    const chunkSentences = splitSentences(sourceText);

    // Spans ordered by sentenceStart. Sequentially claim sentences
    // from chunkSentences in proportion to each span's sentence
    // range. If we run out of chunk sentences (because the span
    // range spans multiple chunks on the page, or the splitter
    // miscounted), the remaining spans get the leftover text.
    const chunkSpans = (c.spanIds || [])
      .map(id => spanMap.get(String(id)))
      .filter(Boolean)
      .sort((a, b) => (a.sentenceStart || 0) - (b.sentenceStart || 0));

    // Global (page) index -> local (chunk) index offset. We only
    // care about the delta: span N starts `spanN.sentenceStart -
    // firstSpan.sentenceStart` sentences from the chunk start.
    const firstStart = chunkSpans.length > 0 ? (chunkSpans[0].sentenceStart || 0) : 0;

    const renderedSpans = [];
    for (const s of chunkSpans) {
      const localStart = Math.max(0, (s.sentenceStart || 0) - firstStart);
      const localEnd   = Math.max(localStart, (s.sentenceEnd || 0) - firstStart);
      const slice = chunkSentences.slice(localStart, localEnd);
      const renderedText = renderSpanSentences(
        slice.length > 0 ? slice : [s.spanText || '']
      );

      // Edges: prefer spanId-keyed, fall back to chunk-level
      // edges attributed to this chunk.
      const spanEdges = (edgesBySpan.get(String(s._id)) || [])
        .map(e => formatEdge(e, c._id))
        .sort(sortByConfidence);

      renderedSpans.push({
        spanId: String(s._id),
        sentenceStart: s.sentenceStart,
        sentenceEnd: s.sentenceEnd,
        role: s.role || null,
        contextTags: s.contextTags || [],
        searchClass: s.searchClass || 'N',
        searchConfidence: s.searchConfidence || null,
        gapType: s.gapType || null,
        renderedText,
        edges: spanEdges,
      });
    }

    // Chunk-level edges (edges stored without fromSpanId).
    const chunkLevelEdges = (edgesByChunk.get(String(c._id)) || [])
      // Filter out edges that are already attributed to one of
      // this chunk's spans - avoid double-counting in the UI.
      .filter(e => {
        if (!e.fromSpanId) return true;
        return !renderedSpans.some(rs => rs.spanId === String(e.fromSpanId));
      })
      .map(e => formatEdge(e, c._id))
      .sort(sortByConfidence);

    out.push({
      chunkId: String(c._id),
      chunkIndex: c.chunkIndex ?? null,
      structuralType: c.structuralType || c.chunkType || null,
      contextTags: c.contextTags || [],
      conceptTags: c.conceptTags || [],
      sourceText,
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

module.exports = { getPageChunkView, splitSentences, renderSpanSentences };
