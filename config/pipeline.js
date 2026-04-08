module.exports = {
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
  maxPagesPerJob: 50
};
