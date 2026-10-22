const test = require('node:test');
const assert = require('node:assert/strict');
const { load, query } = require('./helpers/load.cjs');
const compression = require('../services/compressionService');

test('classification accepts the compact contract and rejects prose/unknown relationships', () => {
  assert.equal(compression.decodeClassification('pzz')[0].relationship, 'proves');
  assert.equal(compression.decodeClassification(' P Z Z ')[0].confidence, 'z');
  for (const invalid of ['Certainly this proves it', 'zzz', 'pzz extra', 'pzz!']) {
    assert.equal(compression.decodeClassification(invalid).length, 0, invalid);
  }
});

test('picker never converts explanatory prose into a semantic edge', async () => {
  class OpenAI { constructor() {
    this.chat = { completions: { create: async () => ({ choices: [{
      message: { content: 'Certainly, the third passage is relevant.' }, finish_reason: 'stop',
    }] }) } };
  } }
  const funnel = load('services/funnelService.js', { openai: OpenAI }, {
    process: { env: { OPENAI_API_KEY: 'test-only' } },
  });
  const candidates = Array.from({ length: 4 }, (_, i) => ({ chunk: { _id: String(i), sourceText: 'text' }, cosine: 0.7 }));
  const result = await funnel.pickAndClassify({ spanText: 'claim' }, {}, {}, candidates);
  assert.ok(result.error, 'invalid response must be an error, not a decoded edge');
  assert.equal(result.chunk, undefined);
});

test('strict classifier cannot invent a verdict when no model is configured', async () => {
  const funnel = load('services/funnelService.js');
  const result = await funnel.classifyEdge({}, {}, {}, {});
  assert.ok(result.error);
  assert.equal(result.relationship, undefined);
});

test('cosine fallback preserves the ranked candidate shape', async () => {
  const funnel = load('services/funnelService.js', { './embeddingService': { embed: async () => null } });
  const chunk = { _id: 'candidate', sourceText: 'a passage' };
  const ranked = await funnel.cosineRank({ spanText: 'source' }, [chunk]);
  assert.equal(ranked[0].chunk, chunk);
  assert.equal(ranked[0].cosine, null);
});

function graphFixture() {
  // Cheapest route to X is S-A-X (2 hops), but that leaves no hop
  // for T. The more expensive S-X-T route still fits the 2-hop cap.
  const edges = [
    { _id: 'sa', fromChunkId: 'S', toChunkId: 'A', confidence: 'z', relationshipType: 'assumes' },
    { _id: 'ax', fromChunkId: 'A', toChunkId: 'X', confidence: 'z', relationshipType: 'assumes' },
    { _id: 'sx', fromChunkId: 'S', toChunkId: 'X', confidence: 'a', relationshipType: 'assumes' },
    { _id: 'tx', fromChunkId: 'T', toChunkId: 'X', confidence: 'z', relationshipType: 'proves' },
  ];
  return load('services/graphToolService.js', {
    '../models/Edge': { find: filter => query(edges.filter(e => filter.$or.some(f => Object.entries(f).every(([k, v]) => e[k] === v)))) },
    '../models/Chunk': { find: () => query([]), findById: id => query({ _id: id, sourceText: 'a real passage' }) },
    '../models/Book': { find: () => query([]) },
    './embeddingService': { embed: async () => null },
  });
}

test('weighted graph search preserves shorter routes under a hop cap', async () => {
  const result = await graphFixture().get_path({ from_chunk: 'S', to_chunk: 'T', max_depth: 2 });
  assert.equal(result.found, true);
  assert.equal(result.length, 2);
  assert.equal(result.total_weight, 27);
  assert.deepEqual(Array.from(result.edges, e => e.edge_id), ['sx', 'tx']);
});

test('undirected traversal retains the actual direction of a proves edge', async () => {
  const result = await graphFixture().get_path({ from_chunk: 'X', to_chunk: 'T', max_depth: 1 });
  assert.equal(result.edges[0].edge_from_chunk_id, 'T');
  assert.equal(result.edges[0].edge_to_chunk_id, 'X');
  assert.equal(result.edges[0].traversed_reverse, true);
});

test('blank text is not a verified quotation', async () => {
  const result = await graphFixture().verify_quote({ chunk_id: 'S', claimed_text: ' \n ' });
  assert.ok(result.error);
});

function chatFixture() {
  class Anthropic { constructor() {
    this.messages = { stream: async () => ({
      async *[Symbol.asyncIterator]() { yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'answer' } }; },
      finalMessage: async () => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'answer' }] }),
    }) };
  } }
  const emptyModel = { find: () => query([]) };
  const doubles = { '@anthropic-ai/sdk': Anthropic, './graphToolService': { TOOL_DEFINITIONS: [] } };
  for (const model of ['Book', 'Collection', 'Page', 'Chunk', 'Span', 'Edge', 'Note', 'Highlight']) {
    doubles['../models/' + model] = emptyModel;
  }
  return load('services/claudeService.js', doubles);
}

for (const useTools of [false, true]) {
  test(`chat waits for durable completion (tools=${useTools})`, async () => {
    let saved = false;
    await chatFixture().streamResponse({ messages: [] }, () => {}, async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
      saved = true;
    }, { useTools });
    assert.equal(saved, true);
  });
  test(`save failure propagates once (tools=${useTools})`, async () => {
    let calls = 0;
    await assert.rejects(chatFixture().streamResponse({ messages: [] }, () => {}, async () => {
      calls++;
      throw new Error('save failed');
    }, { useTools }), /save failed/);
    assert.equal(calls, 1);
  });
}
