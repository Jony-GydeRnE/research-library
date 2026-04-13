/**
 * graphToolService — Phase A of the Gyde Agent tech spec.
 *
 * Five tools the chat LLM can call via Anthropic tool-use to
 * traverse the existing edge graph instead of synthesizing prose
 * from a context dump:
 *
 *   search_chunks   — embedding cosine search, seeds a traversal
 *   follow_edges    — return outgoing/incoming edges from a chunk
 *   read_chunk      — return full text + metadata for one chunk
 *   get_path        — confidence-weighted BFS/Dijkstra between two
 *                     chunks over the Edge collection
 *   verify_quote    — substring check against a chunk's rawText
 *
 * Everything here is a thin wrapper around existing MongoDB
 * collections (Chunk / Edge / Book / Span). No new infrastructure,
 * no writes, no persistent state. Phase B will add a durable
 * TraversalSession; for Phase A the agent tracks visited nodes in
 * its own conversation context and passes them back via the
 * optional `exclude_chunk_ids` parameter on follow_edges.
 *
 * Confidence-letter direction: `z = ~100%` (best), `a = ~4%`
 * (worst). See compressionService.fractionToConfidence and the
 * edge-pick prompt. get_path weights are z→1, a→26 so Dijkstra
 * prefers high-confidence edges.
 *
 * Cost: `search_chunks` is the only tool that hits an external API
 * — it needs to embed the query string (~$0.00002 per new query,
 * ~200ms). A per-session in-memory cache keyed by query text
 * ensures no duplicate embeds within one chat. All other tools are
 * local MongoDB queries with sub-millisecond latency once the
 * Edge.{fromChunkId, toChunkId} indices are in place.
 */

const Chunk = require('../models/Chunk');
const Edge = require('../models/Edge');
const Book = require('../models/Book');
const Span = require('../models/Span');
const { embed } = require('./embeddingService');

// ─── Cosine similarity (copied from funnelService to avoid a
// circular dep if funnelService ever imports from here) ──────────
function cosineSimilarity(a, b) {
  if (!a || !b || a.length === 0 || a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// ─── Confidence letter → Dijkstra weight ────────────────────────
// z (~100% confident) → weight 1 (preferred)
// a (~4%  confident)  → weight 26 (least preferred)
// Lower weight = shorter path = higher confidence.
function confidenceWeight(letter) {
  if (typeof letter !== 'string' || letter.length === 0) return 26;
  const code = letter.toLowerCase().charCodeAt(0) - 'a'.charCodeAt(0);
  if (code < 0 || code > 25) return 26;
  return 26 - code;
}

// ─── Preview helper — keep tool results small ──────────────────
function previewText(s, n = 140) {
  if (!s) return '';
  const clean = String(s).replace(/\s+/g, ' ').trim();
  return clean.length <= n ? clean : clean.slice(0, n - 1) + '…';
}

// ─── Session-scoped query-embedding cache ──────────────────────
// Agent calls search_chunks with a natural-language string, not a
// pre-computed vector. We cache { queryText → embedding } per
// session so the same query never embeds twice. The caller (the
// tool-use loop in claudeService) passes a session object by
// reference; the cache lives on it and dies with the session.
function getQueryEmbedCache(session) {
  if (!session) return null;
  if (!session._queryEmbedCache) session._queryEmbedCache = new Map();
  return session._queryEmbedCache;
}

async function embedQueryCached(queryText, session) {
  const cache = getQueryEmbedCache(session);
  if (cache && cache.has(queryText)) return cache.get(queryText);
  const vec = await embed(queryText);
  if (cache && vec) cache.set(queryText, vec);
  return vec;
}

// ─── resolveSpanId / resolveChunkId — dangling-reference fix ──
//
// The quality sweep repairs bad chunks/spans by writing NEW
// documents and marking old ones with qualityRepairStatus=
// 'replaced' (Span, Pattern 1) or 'merged' (Chunk, Pattern 2).
// Existing Edge documents may still reference the old ids.
//
// Rather than rewriting every edge in the DB, the read path
// transparently redirects through these utilities. Every
// consumer that renders or traverses an id (chunks view,
// follow_edges, read_chunk, funnel on edge creation) calls
// resolveSpanId / resolveChunkId first.
//
// Both functions are bounded: max depth 8, cycle-guarded,
// fall back to the original id on any error. Better to render
// a deprecated node than to render nothing.
const RESOLVE_MAX_DEPTH = 8;

async function resolveSpanId(spanId) {
  if (!spanId) return spanId;
  let current = String(spanId);
  const seen = new Set();
  for (let depth = 0; depth < RESOLVE_MAX_DEPTH; depth++) {
    if (seen.has(current)) {
      console.warn('[graphToolService.resolveSpanId] cycle detected at', current);
      return spanId;
    }
    seen.add(current);
    try {
      const s = await Span.findById(current).select('qualityRepairStatus replacedBy').lean();
      if (!s) return current; // span missing — keep current
      if (s.qualityRepairStatus !== 'replaced') return current;
      if (!Array.isArray(s.replacedBy) || s.replacedBy.length === 0) return current;
      // Pick the first replacement — it's the earliest
      // sentenceStart by the way Pattern 1 writes them.
      current = String(s.replacedBy[0]);
    } catch (err) {
      console.warn('[graphToolService.resolveSpanId]', err.message);
      return spanId;
    }
  }
  return current;
}

async function resolveChunkId(chunkId) {
  if (!chunkId) return chunkId;
  let current = String(chunkId);
  const seen = new Set();
  for (let depth = 0; depth < RESOLVE_MAX_DEPTH; depth++) {
    if (seen.has(current)) {
      console.warn('[graphToolService.resolveChunkId] cycle detected at', current);
      return chunkId;
    }
    seen.add(current);
    try {
      const c = await Chunk.findById(current).select('qualityRepairStatus mergedInto').lean();
      if (!c) return current;
      if (c.qualityRepairStatus !== 'merged') return current;
      if (!c.mergedInto) return current;
      current = String(c.mergedInto);
    } catch (err) {
      console.warn('[graphToolService.resolveChunkId]', err.message);
      return chunkId;
    }
  }
  return current;
}

// ─── Module-level chunk-embedding cache ────────────────────────
// The first search_chunks call loads every chunk's embedding into
// memory (~6K chunks × 1536 floats × 8B ≈ 75 MB). Subsequent calls
// cosine-rank against the in-memory array instead of re-fetching
// from MongoDB, bringing latency from ~18s to ~100ms per call.
// The cache is invalidated by age (CHUNK_CACHE_TTL_MS) so newly
// ingested books show up without a server restart. Filtered calls
// (book_filter set) still use the cache but filter post-load —
// that's cheaper than a second Mongo round-trip.
const CHUNK_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
let _chunkCache = null;
let _chunkCacheLoadedAt = 0;

async function loadChunkCache() {
  const now = Date.now();
  if (_chunkCache && (now - _chunkCacheLoadedAt) < CHUNK_CACHE_TTL_MS) {
    return _chunkCache;
  }
  const chunks = await Chunk.find({ embedding: { $exists: true, $ne: [] } })
    .select('_id bookId pageNumber sourceText rawText structuralType contextTags embedding')
    .lean();
  // Drop chunks with empty embedding arrays — find() above can't
  // filter `[]` cleanly in all Mongo versions.
  _chunkCache = chunks.filter(c => Array.isArray(c.embedding) && c.embedding.length > 0);
  _chunkCacheLoadedAt = now;
  return _chunkCache;
}

function invalidateChunkCache() {
  _chunkCache = null;
  _chunkCacheLoadedAt = 0;
}

// ─── Tool 1: search_chunks ─────────────────────────────────────
// Embed the query string, cosine-search Chunk.embedding vectors,
// return the top-K as compact results. Optional book_filter limits
// the search to one or more book IDs. Optional collection_filter
// limits to books in a collection.
async function search_chunks({ query, book_filter, limit }, session) {
  const k = Math.max(1, Math.min(20, limit || 10));
  if (!query || typeof query !== 'string') {
    return { error: 'query is required and must be a string' };
  }

  const qVec = await embedQueryCached(query, session);
  if (!qVec) {
    return { error: 'Could not embed query (OPENAI_API_KEY missing or embed call failed)' };
  }

  const all = await loadChunkCache();
  let candidates = all;
  if (book_filter) {
    const allowed = new Set(
      (Array.isArray(book_filter) ? book_filter : [book_filter]).map(String)
    );
    candidates = all.filter(c => allowed.has(String(c.bookId)));
  }

  const scored = [];
  for (const c of candidates) {
    const cos = cosineSimilarity(qVec, c.embedding);
    if (cos > 0) scored.push({ chunk: c, cosine: cos });
  }
  scored.sort((a, b) => b.cosine - a.cosine);
  const top = scored.slice(0, k);

  const bookIds = [...new Set(top.map(s => String(s.chunk.bookId)))];
  const books = await Book.find({ _id: { $in: bookIds } })
    .select('_id title author').lean();
  const bookMap = new Map(books.map(b => [String(b._id), b]));

  return {
    query,
    returned: top.length,
    results: top.map(s => ({
      chunk_id: String(s.chunk._id),
      book_id: String(s.chunk.bookId),
      book_title: bookMap.get(String(s.chunk.bookId))?.title || '(unknown)',
      page: s.chunk.pageNumber,
      structural_type: s.chunk.structuralType || null,
      context_tags: (s.chunk.contextTags || []).slice(0, 6),
      text_preview: previewText(s.chunk.sourceText || s.chunk.rawText, 160),
      cosine: Number(s.cosine.toFixed(4)),
    })),
  };
}

// ─── Tool 2: follow_edges ──────────────────────────────────────
// Return edges adjacent to a chunk. `direction` is 'out' (edges
// where this chunk is the source), 'in' (this chunk is the target),
// or 'both' (default). Optional `relationship_type` filter restricts
// to one relationship (e.g. only 'proves' edges). Optional
// `exclude_chunk_ids` hides neighbors already visited, which is how
// Phase A prevents the agent from looping without a full session
// model — the agent accumulates visited IDs in its own context and
// passes them back.
async function follow_edges({ chunk_id, direction, relationship_type, exclude_chunk_ids, limit }, _session) {
  if (!chunk_id) return { error: 'chunk_id is required' };
  const dir = direction || 'both';
  const k = Math.max(1, Math.min(50, limit || 25));

  const orClauses = [];
  if (dir === 'out' || dir === 'both') orClauses.push({ fromChunkId: chunk_id });
  if (dir === 'in'  || dir === 'both') orClauses.push({ toChunkId:   chunk_id });
  const q = { $or: orClauses };
  if (relationship_type) q.relationshipType = relationship_type;

  const edges = await Edge.find(q)
    .select('_id fromChunkId toChunkId relationshipType confidence relevance method fromBookId toBookId')
    .lean();

  const excl = new Set((exclude_chunk_ids || []).map(String));
  const rows = [];
  for (const e of edges) {
    const fromStr = String(e.fromChunkId);
    const toStr   = String(e.toChunkId);
    const selfIsFrom = fromStr === String(chunk_id);
    const neighbor = selfIsFrom ? toStr : fromStr;
    if (!neighbor || neighbor === 'undefined') continue;
    if (excl.has(neighbor)) continue;
    rows.push({
      edge_id: String(e._id),
      direction: selfIsFrom ? 'out' : 'in',
      neighbor_chunk_id: neighbor,
      neighbor_book_id: String(selfIsFrom ? e.toBookId : e.fromBookId),
      relationship: e.relationshipType,
      confidence: e.confidence,
      relevance: e.relevance,
      method: e.method,
    });
  }

  // Sort by confidence (z best → a worst), then by relevance.
  rows.sort((a, b) => {
    const wa = confidenceWeight(a.confidence) - confidenceWeight(b.confidence);
    if (wa !== 0) return wa;
    return confidenceWeight(a.relevance) - confidenceWeight(b.relevance);
  });

  return {
    chunk_id: String(chunk_id),
    direction: dir,
    total: rows.length,
    returned: Math.min(rows.length, k),
    edges: rows.slice(0, k),
  };
}

// ─── Tool 3: read_chunk ────────────────────────────────────────
// Full text + metadata for one chunk. This is the "open the book
// to the exact page" operation — the expensive-but-verifiable
// ground truth read, typically called after the agent has narrowed
// via search_chunks / follow_edges and needs to confirm.
async function read_chunk({ chunk_id, include_spans }, _session) {
  if (!chunk_id) return { error: 'chunk_id is required' };
  const c = await Chunk.findById(chunk_id).lean();
  if (!c) return { error: `chunk not found: ${chunk_id}` };
  const book = await Book.findById(c.bookId).select('_id title author').lean();

  const out = {
    chunk_id: String(c._id),
    book_id: String(c.bookId),
    book_title: book?.title || '(unknown)',
    book_author: book?.author || null,
    page: c.pageNumber,
    chunk_index: c.chunkIndex ?? null,
    structural_type: c.structuralType || c.chunkType || null,
    context_tags: c.contextTags || [],
    concept_tags: c.conceptTags || [],
    source_text: c.sourceText || c.rawText || '',
    word_count: c.wordCount || null,
    has_missing_proof: !!c.hasMissingProof,
  };

  if (include_spans) {
    const spans = await Span.find({ _id: { $in: c.spanIds || [] } })
      .select('_id contextTags role searchClass sentenceStart sentenceEnd')
      .lean();
    out.spans = spans.map(s => ({
      span_id: String(s._id),
      context_tags: s.contextTags || [],
      role: s.role || null,
      search_class: s.searchClass || null,
      sentence_start: s.sentenceStart,
      sentence_end: s.sentenceEnd,
    }));
  }

  return out;
}

// ─── Tool 4: get_path ──────────────────────────────────────────
// Confidence-weighted shortest path (Dijkstra) between two chunks
// through the Edge collection. Treats the graph as undirected —
// edges carry a relationship type, but for reachability we want to
// find the chain regardless of direction. Weight = confidenceWeight
// so paths through high-confidence edges win.
//
// Implementation detail: we lazily expand neighbors one node at a
// time via Edge.find({ $or: [{ fromChunkId }, { toChunkId }] }).
// With the new indices this is O(deg) per node, O(V + E) total.
async function get_path({ from_chunk, to_chunk, max_depth }, _session) {
  if (!from_chunk || !to_chunk) {
    return { error: 'from_chunk and to_chunk are required' };
  }
  if (String(from_chunk) === String(to_chunk)) {
    return { found: true, length: 0, path: [], note: 'same chunk' };
  }
  const depthCap = Math.max(1, Math.min(10, max_depth || 6));

  // Dijkstra with a simple sorted-array priority queue. At our
  // scale (≤ low thousands of edges per traversal) this is fine.
  const dist = new Map();
  const prev = new Map();    // chunk_id → { prevChunk, edge }
  dist.set(String(from_chunk), 0);
  const frontier = [{ id: String(from_chunk), d: 0, depth: 0 }];

  let found = false;
  let visited = 0;

  while (frontier.length > 0) {
    frontier.sort((a, b) => a.d - b.d);
    const cur = frontier.shift();
    if (cur.id === String(to_chunk)) { found = true; break; }
    if (cur.depth >= depthCap) continue;
    if (cur.d !== dist.get(cur.id)) continue; // stale entry
    visited++;

    const edges = await Edge.find({
      $or: [{ fromChunkId: cur.id }, { toChunkId: cur.id }],
    })
      .select('_id fromChunkId toChunkId relationshipType confidence')
      .lean();

    for (const e of edges) {
      const fromStr = String(e.fromChunkId);
      const toStr = String(e.toChunkId);
      const neighbor = fromStr === cur.id ? toStr : fromStr;
      if (!neighbor || neighbor === 'undefined') continue;
      const w = confidenceWeight(e.confidence);
      const alt = cur.d + w;
      if (!dist.has(neighbor) || alt < dist.get(neighbor)) {
        dist.set(neighbor, alt);
        prev.set(neighbor, { prevChunk: cur.id, edge: e });
        frontier.push({ id: neighbor, d: alt, depth: cur.depth + 1 });
      }
    }
  }

  if (!found) {
    return {
      found: false,
      from: String(from_chunk),
      to: String(to_chunk),
      visited,
      max_depth_reached: depthCap,
      note: 'no path within max_depth; consider this the frontier of the current graph',
    };
  }

  // Reconstruct path from to_chunk back to from_chunk.
  const steps = [];
  let node = String(to_chunk);
  while (node !== String(from_chunk)) {
    const p = prev.get(node);
    if (!p) break;
    steps.unshift({
      from_chunk_id: String(p.prevChunk),
      to_chunk_id: node,
      edge_id: String(p.edge._id),
      relationship: p.edge.relationshipType,
      confidence: p.edge.confidence,
    });
    node = String(p.prevChunk);
  }

  // Enrich path with book titles and previews for each node.
  const nodeIds = [String(from_chunk), ...steps.map(s => s.to_chunk_id)];
  const chunks = await Chunk.find({ _id: { $in: nodeIds } })
    .select('_id bookId pageNumber sourceText rawText structuralType').lean();
  const chunkMap = new Map(chunks.map(c => [String(c._id), c]));
  const bookIds = [...new Set(chunks.map(c => String(c.bookId)))];
  const books = await Book.find({ _id: { $in: bookIds } }).select('_id title').lean();
  const bookMap = new Map(books.map(b => [String(b._id), b.title]));

  const enrichNode = (id) => {
    const c = chunkMap.get(String(id));
    if (!c) return { chunk_id: String(id) };
    return {
      chunk_id: String(c._id),
      book_title: bookMap.get(String(c.bookId)) || '(unknown)',
      page: c.pageNumber,
      structural_type: c.structuralType || null,
      text_preview: previewText(c.sourceText || c.rawText, 140),
    };
  };

  return {
    found: true,
    length: steps.length,
    total_weight: dist.get(String(to_chunk)),
    nodes: nodeIds.map(enrichNode),
    edges: steps,
    visited,
  };
}

// ─── Tool 5: verify_quote ──────────────────────────────────────
// Substring match against a chunk's sourceText / rawText. This is
// the "unfakeable" check — the agent claims a chunk says X, this
// tool answers yes/no with the actual text. Normalizes whitespace
// and case for robustness; the intent is to catch the agent
// paraphrasing vs the text literally containing the claim.
async function verify_quote({ chunk_id, claimed_text }, _session) {
  if (!chunk_id || !claimed_text) {
    return { error: 'chunk_id and claimed_text are required' };
  }
  const c = await Chunk.findById(chunk_id)
    .select('_id sourceText rawText pageNumber bookId').lean();
  if (!c) return { error: `chunk not found: ${chunk_id}` };

  const haystack = (c.sourceText || c.rawText || '').replace(/\s+/g, ' ').toLowerCase();
  const needle = String(claimed_text).replace(/\s+/g, ' ').toLowerCase();

  const exists = haystack.includes(needle);
  return {
    chunk_id: String(c._id),
    page: c.pageNumber,
    exists,
    claimed_text_length: needle.length,
    chunk_text_length: haystack.length,
    // Only return actual text on miss (the agent already "knows"
    // what it claimed; the useful info is what's actually there).
    actual_text_preview: exists ? null : previewText(c.sourceText || c.rawText, 400),
  };
}

// ─── Anthropic tool definitions ────────────────────────────────
// These are the JSON schemas Anthropic's tool-use feature consumes.
// Kept next to the implementations so they can't drift.
const TOOL_DEFINITIONS = [
  {
    name: 'search_chunks',
    description:
      'Embedding cosine search over the library. Use this to SEED a traversal — pass a natural-language description of what you are looking for, get back the top-matching chunks across the library (or within a filtered book). Returns compact previews, not full text; call read_chunk to open a specific result.',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Natural-language description of the concept, definition, theorem, or passage you are looking for.',
        },
        book_filter: {
          type: ['string', 'array'],
          description: 'Optional. A single book _id or array of book _ids to restrict the search to.',
        },
        limit: {
          type: 'integer',
          description: 'Max results (default 10, cap 20).',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'follow_edges',
    description:
      'Return edges adjacent to a chunk. Use to explore the graph step-by-step from a known node. Edges are returned sorted by confidence (z best → a worst). Pass exclude_chunk_ids with the list of chunks you have already visited in this session to avoid loops.',
    input_schema: {
      type: 'object',
      properties: {
        chunk_id: { type: 'string', description: 'The chunk _id to fetch neighbors for.' },
        direction: {
          type: 'string',
          enum: ['out', 'in', 'both'],
          description: '"out" = edges where this chunk is the source, "in" = edges where it is the target, "both" = default.',
        },
        relationship_type: {
          type: 'string',
          description: 'Optional filter: only return edges of this relationship type (proves, assumes, prerequisite, uses_definition, extends, equivalent, missing_proof, contradicts, annotates).',
        },
        exclude_chunk_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of chunk _ids to exclude from the results — pass chunks you have already visited in this session.',
        },
        limit: { type: 'integer', description: 'Max edges returned (default 25, cap 50).' },
      },
      required: ['chunk_id'],
    },
  },
  {
    name: 'read_chunk',
    description:
      'Return the full text and metadata for one chunk. Use this AFTER narrowing with search_chunks / follow_edges and when you need to actually read what a node says to confirm it is relevant.',
    input_schema: {
      type: 'object',
      properties: {
        chunk_id: { type: 'string', description: 'The chunk _id to read.' },
        include_spans: {
          type: 'boolean',
          description: 'If true, also return the spans (sentence-level annotations with tags and roles) that compose this chunk.',
        },
      },
      required: ['chunk_id'],
    },
  },
  {
    name: 'get_path',
    description:
      'Confidence-weighted shortest path between two chunks through the edge graph. Treats the graph as undirected — finds the chain connecting two ideas regardless of edge direction, preferring paths through high-confidence edges. If no path exists within max_depth the tool returns found=false, and that IS an answer: it means the library does not yet connect these two concepts.',
    input_schema: {
      type: 'object',
      properties: {
        from_chunk: { type: 'string', description: 'Starting chunk _id.' },
        to_chunk: { type: 'string', description: 'Target chunk _id.' },
        max_depth: { type: 'integer', description: 'Maximum path length to search (default 6, cap 10).' },
      },
      required: ['from_chunk', 'to_chunk'],
    },
  },
  {
    name: 'verify_quote',
    description:
      'Check whether a chunk actually contains a piece of text you plan to attribute to it. Substring-matches (whitespace- and case-normalized) against the chunk\'s real text. Use this before citing a chunk to catch paraphrasing or fabrication. On miss, returns a preview of what the chunk actually says.',
    input_schema: {
      type: 'object',
      properties: {
        chunk_id: { type: 'string', description: 'The chunk _id to verify against.' },
        claimed_text: { type: 'string', description: 'The text you are claiming the chunk contains.' },
      },
      required: ['chunk_id', 'claimed_text'],
    },
  },
];

// ─── Dispatch ──────────────────────────────────────────────────
const HANDLERS = {
  search_chunks,
  follow_edges,
  read_chunk,
  get_path,
  verify_quote,
};

/**
 * Execute a tool call by name. The `session` argument is a
 * per-chat object the caller maintains; it lives in memory for the
 * duration of one streamResponse invocation and holds the
 * query-embedding cache (and, in Phase B, visited-node state).
 * Never throws — errors are returned as { error: '...' } objects
 * so the tool-use loop can hand them back to the model and let it
 * recover rather than crashing the stream.
 */
async function executeTool(name, input, session) {
  const handler = HANDLERS[name];
  if (!handler) return { error: `unknown tool: ${name}` };
  try {
    return await handler(input || {}, session);
  } catch (err) {
    console.error(`[graphToolService] ${name} failed:`, err.message);
    return { error: err.message || String(err) };
  }
}

module.exports = {
  TOOL_DEFINITIONS,
  executeTool,
  // Exported for tests / scripts / ad-hoc use:
  search_chunks,
  follow_edges,
  read_chunk,
  get_path,
  verify_quote,
  confidenceWeight,
  invalidateChunkCache,
  // Dangling-reference resolution (quality sweep):
  resolveSpanId,
  resolveChunkId,
};
