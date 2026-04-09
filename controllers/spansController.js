const Span = require('../models/Span');
const Chunk = require('../models/Chunk');
const Edge = require('../models/Edge');
const Book = require('../models/Book');

exports.getIntersectingSpans = async (req, res) => {
  try {
    const { bookId, pageNumber } = req.query;
    if (!bookId || !pageNumber) return res.status(400).json({ error: 'bookId and pageNumber required' });

    const spans = await Span.find({ bookId, pageNumber: parseInt(pageNumber) })
      .sort({ sentenceStart: 1 }).lean();

    // Enrich each span with chunk data and edges
    const enriched = [];
    for (const span of spans) {
      const entry = { ...span };

      if (span.chunkId) {
        const chunk = await Chunk.findById(span.chunkId)
          .select('chunkIndex structuralType contextTags sourceText pageNumber').lean();
        entry.chunk = chunk;

        // Find edges from/to this chunk
        const edges = await Edge.find({
          $or: [{ fromChunkId: span.chunkId }, { toChunkId: span.chunkId }]
        }).select('relationshipType confidence relevance fromChunkId toChunkId fromBookId toBookId').lean();

        // Enrich edges with book titles and chunk snippets
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
