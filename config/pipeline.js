module.exports = {
  // ─── Phase 1 settings (still in use) ─────────────────────────
  chunkTargetTokens: 400,
  chunkOverlapTokens: 50,
  missingProofPhrases: [
    'it is obvious', 'clearly', 'it can be shown',
    'it follows easily', 'one can verify', 'trivially'
  ],
  maxPagesPerJob: 50,

  // ─── VISION PROCESSING ───────────────────────────────────────
  VISION_MODEL: process.env.VISION_MODEL || 'gpt-4o',
  VISION_BATCH_SIZE: 20,
  VISION_TEMPERATURE: 0.1,

  // ─── SPAN GENERATION ─────────────────────────────────────────
  SPAN_MODEL: process.env.SPAN_MODEL || 'gpt-4o',
  SPAN_MAX_SENTENCES_PER_CALL: 30,
  SPAN_TEMPERATURE: 0.3,
  SPAN_PROMPT_FULL: 'prompts/span-generation-full.txt',
  SPAN_PROMPT_SHORT: 'prompts/span-generation-short.txt',
  SPAN_SESSION_RESET_THRESHOLD: 6,
  SPAN_JUDGE_SAMPLE_RATE: 10,
  SPAN_SESSION_MAX_CHUNKS: 200,

  // ─── CHUNK DERIVATION ────────────────────────────────────────
  CHUNK_MAX_SPANS: 3,
  CHUNK_SPLIT_ON_DECLARATIVE: true,
  CHUNK_SPLIT_ON_SEARCH_CLASS: true,

  // ─── METADATA EXTRACTION ─────────────────────────────────────
  METADATA_MODEL: process.env.NANO_MODEL || 'gpt-4o-mini',
  METADATA_TEMPERATURE: 0.2,
  METADATA_MAX_TOPICS: 5,
  METADATA_MAX_CONCEPTS: 5,

  // ─── EMBEDDINGS ──────────────────────────────────────────────
  EMBEDDING_MODEL: 'text-embedding-3-small',
  EMBEDDING_DIMENSIONS: 1536,

  // ─── QUALITY MONITORING ──────────────────────────────────────
  JUDGE_MODEL: process.env.JUDGE_MODEL || 'claude-opus-4-6',
  JUDGE_SAMPLE_RATE: 10,
  JUDGE_RESET_THRESHOLD: 6,

  // ─── CHAT CONTEXT ────────────────────────────────────────────
  CHAT_CONTEXT_BUDGET: 60000,
  CHAT_MODEL: 'claude-sonnet-4-20250514',
  CHAT_STREAMING: true,
  CHAT_MAX_HISTORY: 20,

  // ─── FUTURE: EDGE CLASSIFICATION (Phase 3) ───────────────────
  EDGE_MODEL: process.env.EDGE_MODEL || 'claude-opus-4-6',
  EDGE_STOPPING_CONFIDENCE: 't',
  EDGE_MAX_COMPARISONS: 5,
  EDGE_NANO_ESCALATION: 'm',
  CANDIDATE_CEILING_I: 5,
  CANDIDATE_CEILING_S: 20,
  CANDIDATE_CEILING_B: 20,
  SIMILAR_BOOKS_LIMIT: 10,
  OPUS_TOP_K: 5,
  TRANSITIVE_MAX_DEPTH_ASSUMES: 3,
  TRANSITIVE_MAX_DEPTH_EXTENDS: 5,
  TRANSITIVITY_JOB_INTERVAL: '1 hour',
};
