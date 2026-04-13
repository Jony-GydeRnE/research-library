const mongoose = require('mongoose');

// a-z scale: each letter ≈ 3.84% increment.
// Confidence direction matches compressionService.fractionToConfidence:
//   z = ~100% confident (best), a = ~3.85% confident (worst).
// The edge-pick prompt (prompts/edge-pick.txt) teaches the picker
// this same direction ("z (~100%) unambiguous, u (~80%) strong, ...").
// IMPORTANT for get_path / graphToolService: Dijkstra weights must be
// `z → 1, a → 26` so the lower-weight / shortest path through the
// graph is the one with the highest confidence edges.

const edgeSchema = new mongoose.Schema({
  fromChunkId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chunk' },
  fromSpanId: { type: mongoose.Schema.Types.ObjectId, ref: 'Span' },
  toChunkId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chunk' },
  toSpanId: { type: mongoose.Schema.Types.ObjectId, ref: 'Span' },
  fromBookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book' },
  toBookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book' },
  relationshipType: {
    type: String,
    // 'annotates' = a notes-PDF chunk anchors to a source-paper
    //   chunk discussing the same idea. Created by
    //   noteIngestionService when a notes-kind Book is linked to
    //   one or more source books.
    enum: ['proves', 'assumes', 'contradicts', 'extends',
           'prerequisite', 'equivalent', 'uses_definition',
           'missing_proof', 'annotates']
  },
  confidence: String,   // single letter a-z (a=most confident)
  relevance: String,    // single letter a-z
  method: {
    type: String,
    // 'note-citation'     = produced by noteIngestionService via
    //   concept-overlap (synonym layer) + embedding cosine ranking.
    //   Always paired with relationshipType='annotates'.
    // 'canonical-lookup'  = produced by canonicalDefinitionService.
    //   Pure dictionary sweep — every span with contextTag X gets
    //   a uses_definition edge to the chunk that canonically
    //   defines X. Zero LLM calls. Confidence always 'z' because
    //   the lookup is mechanical.
    enum: ['lexical', 'embedding', 'llm', 'manual', 'note-citation', 'canonical-lookup']
  },
  resolved: { type: Boolean, default: false },
  // Other Span IDs from the SAME source book that also point at
  // this target chunk but lost the dedup tiebreak. The primary
  // edge is rendered to the user; relatedSpanIds is the long tail
  // a UI can fetch to show "N other passages in this book also
  // cite this target". Empty when there were no duplicates.
  relatedSpanIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Span' }],
  createdAt: { type: Date, default: Date.now }
});

edgeSchema.index({ fromBookId: 1 });
edgeSchema.index({ toBookId: 1 });
// Graph-tool BFS traversal indices (Phase A — gyde-agent).
// get_path and follow_edges repeatedly query
//   Edge.find({ $or: [{ fromChunkId }, { toChunkId }] })
// to find neighbors of a chunk. Two separate indices, NOT a compound
// index — the `$or` query cannot use `{ fromChunkId:1, toChunkId:1 }`.
edgeSchema.index({ fromChunkId: 1 });
edgeSchema.index({ toChunkId: 1 });

module.exports = mongoose.model('Edge', edgeSchema);
