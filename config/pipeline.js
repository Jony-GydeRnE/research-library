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
  SPAN_MAX_SENTENCES_PER_CALL: 60,
  SPAN_TEMPERATURE: 0.3,
  SPAN_PROMPT_FULL: 'prompts/span-generation-full.txt',
  SPAN_PROMPT_SHORT: 'prompts/span-generation-short.txt',
  // Force a session reset (i.e. re-inject the FULL prompt) after this many
  // pages have been processed with the short prompt. Previously this was
  // 200 which meant the session never reset for any book in the library,
  // so the full prompt was only seen once on page 1 and every subsequent
  // page got the 3-line short prompt — the LLM stopped emitting tags,
  // role, and search-class after chunk 1-2. 8 pages is short enough that
  // the full prompt is re-seen frequently on any real book but long
  // enough to amortize the extra tokens.
  SPAN_SESSION_MAX_PAGES: 8,
  // Quality gate: a page's output is considered "drift" if fewer than
  // this fraction of its parsed spans carry ANY metadata (contextTags,
  // role, declarativeTags, or searchClass != N). Pages that fail the
  // gate are automatically retried once with the full prompt. 0.5 means
  // "at least half the spans must carry something" — a loose floor that
  // catches total format collapse without penalizing pages that legitimately
  // have a lot of connective narrative.
  SPAN_MIN_ENRICHED_RATIO: 0.5,
  // If a page returns 0 parsed spans (the LLM output was empty, the
  // parser rejected every line, or the page is all noise), retry once
  // with the full prompt before giving up. Was previously silent — the
  // page was just skipped, contributing to 14-33% coverage.
  SPAN_RETRY_ON_EMPTY: true,

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
  CHAT_MODEL: 'claude-opus-4-6',
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
