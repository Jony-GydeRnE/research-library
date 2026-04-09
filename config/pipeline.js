module.exports = {
  // ─── Phase 1 settings (still in use) ─────────────────────────
  chunkTargetTokens: 400,
  chunkOverlapTokens: 50,
  qualityJudgeSampleRate: 0.1,
  qualityThreshold: 6,
  missingProofPhrases: [
    'it is obvious', 'clearly', 'it can be shown',
    'it follows easily', 'one can verify', 'trivially'
  ],
  crossBookEdgeCandidateTopK: 20,
  crossBookEdgeLLMTopK: 5,
  metadataModel: 'gpt-4.1-nano',
  judgeModel: 'claude-opus-4-6',
  embeddingModel: 'text-embedding-3-small',
  maxPagesPerJob: 50,

  // ─── Phase 2: Vision processing ──────────────────────────────
  VISION_PAGES_BATCH_SIZE: 5,

  // ─── Phase 2: Span generation ────────────────────────────────
  SPAN_SESSION_RESET_THRESHOLD: 6,   // Judge score 0-9; below this triggers session reset
  SPAN_JUDGE_SAMPLE_RATE: 10,        // Judge every Nth chunk
  SPAN_SESSION_MAX_CHUNKS: 200,      // Max chunks before forced session reset

  // ─── Phase 2: Embeddings ─────────────────────────────────────
  EMBEDDING_MODEL: 'text-embedding-3-small',
  EMBEDDING_DIMENSIONS: 1536,

  // ─── Phase 3: Edge resolution (define now, use later) ────────
  STOPPING_CONFIDENCE: 't',          // ~77% on a-z scale
  MAX_COMPARISONS_PER_SPAN: 5,
  NANO_ESCALATION_THRESHOLD: 'm',
  CANDIDATE_CEILING_I: 5,
  CANDIDATE_CEILING_S: 20,
  CANDIDATE_CEILING_B: 20,
  SIMILAR_BOOKS_LIMIT: 10,
  OPUS_TOP_K: 5,
  TRANSITIVE_MAX_DEPTH_ASSUMES: 3,
  TRANSITIVE_MAX_DEPTH_EXTENDS: 5,
  TRANSITIVITY_JOB_INTERVAL: '1 hour',

  // ─── Chat context ────────────────────────────────────────────
  CHAT_CONTEXT_BUDGET: 8000,
  CHAT_MODEL: 'claude-opus-4-6',
  CHAT_STREAMING: true,
  CHAT_MAX_HISTORY: 20,
};
