const mongoose = require('mongoose');

// a-z scale: each letter ≈ 3.84% increment
// For edge classification OUTPUT: confidence a=most confident, z=least confident
// For search-class tags on SPANS: confidence a≈4%, z≈100%
// These are inverted — see config/pipeline.js for mapping if needed

const edgeSchema = new mongoose.Schema({
  fromChunkId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chunk' },
  fromSpanId: { type: mongoose.Schema.Types.ObjectId, ref: 'Span' },
  toChunkId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chunk' },
  toSpanId: { type: mongoose.Schema.Types.ObjectId, ref: 'Span' },
  fromBookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book' },
  toBookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book' },
  relationshipType: {
    type: String,
    enum: ['proves', 'assumes', 'contradicts', 'extends',
           'prerequisite', 'equivalent', 'uses_definition', 'missing_proof']
  },
  confidence: String,   // single letter a-z (a=most confident)
  relevance: String,    // single letter a-z
  method: {
    type: String,
    enum: ['lexical', 'embedding', 'llm', 'manual']
  },
  resolved: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

edgeSchema.index({ fromBookId: 1 });
edgeSchema.index({ toBookId: 1 });

module.exports = mongoose.model('Edge', edgeSchema);
