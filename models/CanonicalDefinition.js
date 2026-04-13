const mongoose = require('mongoose');

/**
 * CanonicalDefinition — per-concept dictionary mapping a
 * normalized concept tag (e.g. "tree_amplitudes") to the chunk
 * that canonically defines it in the library.
 *
 * Built by canonicalDefinitionService.buildCanonicalDictionary
 * as a pure DB sweep. Consumed by
 * canonicalDefinitionService.linkSpansToCanonicalDefinitions to
 * emit `uses_definition` edges from every tagged span to its
 * canonical definition — no LLM, no cosine, pure lookup.
 *
 * This is the "once tagged, always tagged" mechanism: if
 * "tree_amplitudes" has a canonical definition, every future
 * span with contextTag "tree_amplitudes" gets a free edge to
 * it on the next link sweep. When a canonical definition
 * improves (a better definition chunk is found in a later
 * book), re-running the sweep regenerates the edges idempotently.
 *
 * A given concept gets AT MOST ONE canonical definition. When
 * multiple candidates exist across the library, the service
 * picks the best by a preference hierarchy:
 *   1. structuralType = 'definition' (strongest — the whole
 *      chunk IS a definition block from structural annotations)
 *   2. span role = 'definition' (one span in the chunk is
 *      explicitly defining the concept)
 *   3. contextTag endsWith '_definition' (weakest — the tag
 *      itself signals the definition without a role)
 * Within the same tier, earlier-page chunks win (textbooks
 * define foundational material up front).
 */
const canonicalDefinitionSchema = new mongoose.Schema({
  // The concept this entry defines. Always lowercased snake_case
  // matching the contextTag / conceptTag conventions.
  concept: { type: String, required: true, unique: true, index: true },

  // The chunk that defines it.
  definitionChunkId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chunk',
    required: true,
  },

  // Optional: the specific span inside the chunk that carries
  // the definition role. Preferred target for span-level edges.
  definitionSpanId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Span',
    default: null,
  },

  // The book that contains the definition — denormalized so
  // the linker can fill in fromBookId/toBookId on generated
  // edges without a second query.
  definitionBookId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Book',
    required: true,
  },

  // How this definition was identified. Higher-preference
  // sources beat lower-preference ones when two chunks
  // compete for the same concept.
  source: {
    type: String,
    enum: ['structural', 'role', 'tag'],
    required: true,
  },

  // Always 'z' for canonical lookups — the mapping is
  // mechanical, not inferred.
  confidence: { type: String, default: 'z' },

  // Re-ingestion auditing. If a later sweep finds a strictly
  // better candidate, it updates the row and bumps these.
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

canonicalDefinitionSchema.index({ definitionBookId: 1 });
canonicalDefinitionSchema.index({ source: 1 });

canonicalDefinitionSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('CanonicalDefinition', canonicalDefinitionSchema);
