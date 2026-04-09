const Span = require('../models/Span');
const Chunk = require('../models/Chunk');
const Edge = require('../models/Edge');
const Book = require('../models/Book');
const Page = require('../models/Page');

/**
 * Split text into sentences and track character offsets for each.
 * Returns [{ index, text, charStart, charEnd }]
 */
function splitSentences(rawText) {
  if (!rawText) return [];
  const parts = rawText.split(/(?<=\.)\s+|\n\n+/);
  const sentences = [];
  let charPos = 0;

  for (let i = 0; i < parts.length; i++) {
    const text = parts[i].trim();
    if (!text) continue;
    const charStart = rawText.indexOf(text, charPos);
    const charEnd = charStart + text.length;
    sentences.push({ index: sentences.length + 1, text, charStart, charEnd });
    charPos = charEnd;
  }

  return sentences;
}

exports.getIntersectingSpans = async (req, res) => {
  try {
    const { bookId, pageNumber, startOffset, endOffset } = req.query;
    if (!bookId || !pageNumber) return res.status(400).json({ error: 'bookId and pageNumber required' });

    const pn = parseInt(pageNumber);
    const hlStart = startOffset !== undefined ? parseInt(startOffset) : null;
    const hlEnd = endOffset !== undefined ? parseInt(endOffset) : null;

    // Load page rawText for sentence splitting
    const page = await Page.findOne({ bookId, pageNumber: pn }).select('rawText').lean();
    const sentences = splitSentences(page?.rawText || '');

    // Load all spans for this page
    const allSpans = await Span.find({ bookId, pageNumber: pn })
      .sort({ sentenceStart: 1 }).lean();

    // For each span, compute its character range and extract spanText
    const spansWithText = allSpans.map(span => {
      // Find sentences covered by this span
      const coveredSentences = sentences.filter(
        s => s.index >= span.sentenceStart && s.index <= span.sentenceEnd
      );
      const spanText = coveredSentences.map(s => s.text).join(' ');
      const spanCharStart = coveredSentences.length > 0 ? coveredSentences[0].charStart : 0;
      const spanCharEnd = coveredSentences.length > 0 ? coveredSentences[coveredSentences.length - 1].charEnd : 0;

      return { ...span, spanText, spanCharStart, spanCharEnd };
    });

    // Filter: only spans intersecting the highlight's character range
    let filtered;
    if (hlStart !== null && hlEnd !== null) {
      filtered = spansWithText.filter(s => s.spanCharEnd > hlStart && s.spanCharStart < hlEnd);
    } else {
      // No offsets provided — return all spans
      filtered = spansWithText;
    }

    // Enrich with chunk data and edges
    const enriched = [];
    for (const span of filtered) {
      const entry = { ...span };

      if (span.chunkId) {
        const chunk = await Chunk.findById(span.chunkId)
          .select('chunkIndex structuralType contextTags pageNumber').lean();
        entry.chunk = chunk;

        const edges = await Edge.find({
          $or: [{ fromChunkId: span.chunkId }, { toChunkId: span.chunkId }]
        }).select('relationshipType confidence relevance fromChunkId toChunkId fromBookId toBookId').lean();

        for (const edge of edges) {
          const targetChunkId = edge.fromChunkId?.toString() === span.chunkId.toString()
            ? edge.toChunkId : edge.fromChunkId;
          const targetBookId = edge.fromBookId?.toString() === bookId
            ? edge.toBookId : edge.fromBookId;

          if (targetChunkId) {
            const tc = await Chunk.findById(targetChunkId).select('sourceText pageNumber chunkIndex').lean();
            edge.targetSnippet = tc?.sourceText?.substring(0, 150) || '';
            edge.targetPage = tc?.pageNumber;
          }
          if (targetBookId) {
            const tb = await Book.findById(targetBookId).select('title').lean();
            edge.targetBookTitle = tb?.title;
            edge.targetBookId = targetBookId;
          }
        }
        entry.edges = edges;
      }

      enriched.push(entry);
    }

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
