# Gyde Agent Tech Spec — From Graph Navigator to Persistent Research Agent

Written 2026-04-12. Converts the vision in `vision-gyde-as-agent.md` into a buildable blueprint.

**Revision note (2026-04-12, later):** Updated after the Q&A in `gyde-agent-tech-questions.md`. Five code-level tensions with the existing codebase were found and are now reflected in the spec: (1) confidence letter direction was inverted, (2) `search_chunks` needs a query embedding (small cost, not free), (3) Edge indices on `fromChunkId`/`toChunkId` must ship before Phase A, (4) the grounding gate (`detectFakeCitations`) must be skipped when tools are active, (5) `TraversalSession` is deferred — Phase A uses a lightweight `exclude_chunk_ids` parameter instead. Also added the three-layer model (immutable graph / collection workspace / query cache) and stopping criteria that allow unbounded research sessions via checkpoint-and-resume. See §0 below.

---

## 0. Three-Layer Model (the foundation everything else rests on)

Everything in this spec is an implementation of three layers with very different read/write rules, costs, and time horizons. Internalize this before reading the phases.

**Layer 1 — The graph (immutable at chat time).** Chunks, spans, edges, embeddings, confidence scores. Built by the ingestion pipeline. Agents only READ this layer. Traversal is nearly free ($0 per hop for MongoDB, ~$0.00001 per Y/N decision at Sonnet input rates). This is the library's ground truth.

**Layer 2 — The collection workspace (persistent, agent-writable).** A filesystem-like workspace scoped to a Collection that outlives any single chat session. The agent reads, writes, edits, and deletes files here. This is the CC analog: CC's working directory is the repo; GR's working directory is the collection workspace. The folder structure is flexible and agent-determined, but typical entries include:

```
collections/<collectionId>/workspace/
  sessions/<sessionId>/
    query.txt         ← the user's question
    frontier.txt      ← nodes queued for exploration
    visited.txt       ← nodes already checked (with verdict)
    paths/            ← candidate and verified paths
    dead-ends/        ← directions ruled out, with reasons
  vibes/              ← unverified hunches, kept across sessions
  neighborhoods/      ← cached per-node summaries (optional, Phase C+)
  pinned-paths/       ← paths the user has endorsed
```

The workspace is stored in MongoDB (a new `WorkspaceFile` collection) not the real filesystem, so it's scoped per Collection and survives across chats. Because each file is small (KB scale) and MongoDB storage is ~$0.001/month per million tokens, the workspace is essentially free to maintain indefinitely.

**Layer 3 — The query cache (computed on demand).** Keyed by query-embedding cosine similarity. When a new question is >0.95 cosine to a cached question AND the underlying graph hasn't changed in the relevant neighborhood, return the cached path (cost: $0, latency: <10ms). Invalidated when: (a) a new book is ingested and creates a shorter path, (b) an edge's confidence drops below threshold after re-scoring, or (c) the user explicitly marks a cached path as stale.

**Why this matters for the spec:** Phase A builds against Layer 1 only (stateless tool calls). Phase B adds a minimal slice of Layer 2 (TraversalSession, the short-term memory inside one chat). Phase C extends Layer 2 to full collection workspace and adds Layer 3 caching. Phase D adds the inferential-distance metric as a derived structural property. Each phase is a strict superset of the previous.

**Stopping criteria — why unbounded research is safe.** A classic agent-loop worry is "what if the path doesn't exist, does it run forever?" Three independent stopping conditions:

1. **Found a verified path** of length ≤ `maxPathLength` with min-confidence ≥ `pathConfidenceThreshold` → stop, surface path, cache.
2. **Frontier exhausted** — the BFS reached all nodes within `maxDepth` of the seed without finding the target → stop, report "no path exists in current library, here's the frontier", and the frontier itself becomes the crawler target list.
3. **Budget cap hit** (token budget, wall-clock, or step count) → **checkpoint the workspace to Layer 2 and exit cleanly**. The next session resumes by reading the workspace and picking up where the previous agent left off. This is the CC-beating property: CC's context window has a hard ceiling; GR's workspace doesn't.

**Cost ceiling sanity check.** A Y/N inner-loop step (read one chunk's neighborhood summary + outgoing edges, emit Y/N per edge) is ~2-5K input tokens and ~10 output tokens. At $2.50/Mt input, that's ~$0.00001 per step. 10,000 traversal steps = $1. A full physics-library traversal of 600 books × 100 relevant chunks per book = 60K chunk touches ≈ $0.60. Unbounded research is not a budget problem.

---

## 1. Premise

The current system is RAG: retrieve chunks, dump them in context, ask Claude to synthesize. The agent system replaces synthesis with **navigation**. The LLM doesn't generate physics — it traverses a verified graph of chunks, spans, and edges, and surfaces the traversal path as the answer. Every node in the output is a real chunk the user can click into.

The pivot is architecturally clean: chunks, edges, embeddings, and the funnel pipeline are all reusable. What changes is the chat layer.

---

## 2. Build Order — Seed First, Agent Loop Later

The full agent loop is the destination, but the order of operations matters. Each phase is independently useful and validates the next.

### Phase A — Graph Tools for the Existing Chat (immediate, no new infrastructure)

Expose the existing edge graph as callable tools that the current `claudeService.js` chat LLM can invoke on demand. This is the seed. No agent loop, no persistent traversal state — just give the chat access to the graph.

**Tools to expose (as Anthropic tool-use function definitions):**

| Tool | Signature | Implementation | Source |
|---|---|---|---|
| `search_chunks` | `(query: string, book_filter?: ObjectId, limit?: number) → ChunkResult[]` | Embed the query string via `embeddingService` (~$0.00002, ~200ms), then cosine search against `Chunk.embedding`. **Cache embeddings keyed by query text within the session** so the same query never embeds twice. | Reuse candidate-pool logic from `funnelService.js`; add in-session query-embedding cache |
| `follow_edges` | `(chunk_id: ObjectId, direction?: 'from'\|'to'\|'both', relationship_type?: string, exclude_chunk_ids?: ObjectId[]) → EdgeResult[]` | `Edge.find({ fromChunkId \| toChunkId })` with optional filters; neighbors in `exclude_chunk_ids` are filtered out to prevent loops without a full session model | Direct MongoDB query on existing Edge collection |
| `read_chunk` | `(chunk_id: ObjectId) → ChunkDetail` | `Chunk.findById().populate('bookId')` + associated `Span.find({ chunkId })` | Direct MongoDB query |
| `get_path` | `(from_chunk: ObjectId, to_chunk: ObjectId, max_depth?: number) → PathResult` | Confidence-weighted BFS (effectively Dijkstra) over the Edge collection. **Weight mapping: `z→1, y→2, ..., a→26` — LOWER weight = MORE confident, because `z=100%` and `a≈4%` in `compressionService.fractionToConfidence`.** | **New code**, ~80-120 lines |
| `verify_quote` | `(chunk_id: ObjectId, claimed_text: string) → { exists: boolean, actual_text: string }` | Substring match against `Chunk.rawText` or associated `Page.rawText` | Direct string check |

**⚠ Confidence-letter direction — this was inverted in the original draft.** `compressionService.js` maps `fraction 0 → 'a'` and `fraction 1 → 'z'`, i.e. `z` is the most confident, `a` is the least. Any BFS weight mapping must respect this: `a→26, z→1` so Dijkstra prefers high-confidence edges. A naive `a→1, z→26` mapping is a silent correctness bug — it makes `get_path` return the *least* confident path.

**The `exclude_chunk_ids` parameter on `follow_edges` is the Phase A answer to loop prevention.** Without a full `TraversalSession` model, the agent accumulates visited IDs in its own context window across tool calls and passes them back as `exclude_chunk_ids`. This works for 3-15 hop traversals (well within the model's context). Phase B replaces this with a durable session model.

**Where these live:**

```
services/
  graphToolService.js        ← implements all 5 tools as async functions
routes/
  api/graph-tools.js         ← REST endpoints (optional, for testing)
```

**How the chat uses them:**

`claudeService.js` already calls the Anthropic SDK with streaming. Add a `tools` array to the API call with the 5 tool definitions above. When Claude returns a `tool_use` content block, execute the corresponding `graphToolService` function, return the result as a `tool_result`, and continue the conversation. The streaming SSE pipe in `server.js /api/chat/:id/message` needs to handle the tool-use loop (call → result → call → ... → final text).

**What this unlocks immediately:**

User asks "Why does B factor through c_ij?" → Claude searches for relevant chunks, follows edges from the best hit, reads the target chunks, and answers with grounded citations that link to real chunk IDs. No hallucinated books. No fabricated page numbers. The graph constrains the answer.

**Estimated effort:** 1-2 sessions. The hard part is the tool-use loop in the streaming handler; the graph queries themselves are trivial MongoDB calls.

**Grounding gate compatibility fix.** `claudeService.streamResponse` currently runs `detectFakeCitations(fullText)` on the completed response. When tool-use is active, the model's final text references real chunk IDs returned from `read_chunk` — the tools ARE the grounding mechanism, so the fake-citation check is redundant and only adds latency. Fix: in `streamResponse`, if `toolCallsMade > 0`, skip `detectFakeCitations()`. This is ~5 lines.

**Edge indices — required before `get_path` ships.** Current `Edge` model has only `{ fromBookId }` and `{ toBookId }` indices. The BFS queries by `fromChunkId` / `toChunkId` repeatedly; without indices each step is a full collection scan. Add two separate indices (not compound — the `$or` in the BFS query can't use a compound index):

```js
edgeSchema.index({ fromChunkId: 1 });
edgeSchema.index({ toChunkId: 1 });
```

Fine at today's 1200 edges, mandatory well before 100K.

**Streaming-handler refactor is bigger than the original estimate.** The current `streamResponse` uses `client.messages.stream()` with only `content_block_delta` text handling. Tool-use with streaming requires a proper state machine:

```
state: 'text' | 'tool_input_accumulating' | 'executing_tool' | 'done'
```

Handling `input_json_delta` events, collecting full tool input before executing, then re-entering the stream with a new API call. Realistic line count: **150-200 lines** replacing the current simple loop, not the 80 previously estimated. Not a blocker — just the accurate number.

---

### Phase B — Persistent Traversal State (after Phase A proves the tools work)

Phase A tools are stateless — each tool call is independent. Phase B adds memory to the traversal so the agent can build multi-step paths across tool calls within a single research session.

**New model: `TraversalSession.js`**

```js
{
  chatId: { type: ObjectId, ref: 'Chat' },
  question: String,
  visitedChunkIds: [ObjectId],
  visitedEdgeIds: [ObjectId],
  deadEnds: [{
    chunkId: ObjectId,
    reason: String
  }],
  currentPath: [{
    chunkId: ObjectId,
    edgeId: ObjectId,
    relationship: String,
    confidence: String
  }],
  bestPath: [{
    chunkId: ObjectId,
    edgeId: ObjectId,
    relationship: String,
    confidence: String
  }],
  stepCount: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['exploring', 'found_path', 'exhausted', 'timed_out'],
    default: 'exploring'
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}
```

**How it works:**

When the chat LLM issues its first `search_chunks` or `follow_edges` call in response to a research question, `graphToolService` creates a `TraversalSession`. Each subsequent tool call updates the session: visited nodes accumulate, dead ends are recorded, the current path extends or backtracks. The session state is injected into the system prompt on each turn so Claude knows where it's been and what it's tried.

**New tool added in Phase B:**

| Tool | Signature | Purpose |
|---|---|---|
| `get_traversal_state` | `() → TraversalSession` | Returns the current session's visited nodes, dead ends, current path, and best path so far |

**What this unlocks:**

Multi-hop reasoning. "Trace the proof chain from Lagrangian formalism to D-subset structure" requires 4-5 edge traversals. Without session state, the LLM forgets which nodes it already visited and may loop. With session state, it can see "I've visited chunks A, B, C, dead-ended at D, current path is A→B→C" and decide to follow a different edge from C.

**Estimated effort:** 1 session. The model is simple; the logic is mostly bookkeeping in `graphToolService`.

---

### Phase C — The Agent Loop (after Phase B proves multi-hop works)

Phase C upgrades the chat LLM from "tool-augmented assistant" to "autonomous graph navigator." The LLM is no longer answering a question — it's finding a path and presenting it.

**Architecture:**

```
User question
    ↓
agentService.js — parse question into graph query terms
    ↓
Agent loop (max N steps):
    ├─ search_chunks (seed the search)
    ├─ follow_edges (expand from best node)
    ├─ read_chunk (verify the node is relevant)
    ├─ evaluate: is the path complete?
    │   ├─ YES → surface the path
    │   └─ NO → follow_edges from next best node, or backtrack
    └─ update TraversalSession
    ↓
Output: structured path (not prose)
```

**New service: `services/agentService.js`**

```
agentService.js
  ├─ parseQuestion(text) → { concepts, target_relationship, seed_queries }
  ├─ runTraversal(session, budget) → PathResult
  ├─ evaluatePath(path, question) → { complete: bool, confidence: number, gaps: string[] }
  └─ formatPathOutput(path) → StructuredOutput
```

**Budget / stopping criteria (from `config/pipeline.js`):**

```js
{
  agentMaxSteps: 50,
  agentMaxWallClockMs: 300000,     // 5 minutes
  agentPathConfidenceThreshold: 0.7,
  agentMaxBacktracks: 10,
  agentModel: 'claude-sonnet-4-20250514'  // fast + cheap for navigation
}
```

The agent loop runs server-side. The chat SSE stream emits progress events so the UI can show "Searching... → Following edge to Rodina p3... → Verifying chunk... → Found path (4 steps)."

**Output format:**

```json
{
  "type": "traversal_path",
  "question": "Why does B factor through c_ij?",
  "steps": [
    {
      "chunk_id": "...",
      "book_title": "Lagrangians and Euler-Lagrange Equation",
      "page": 46,
      "text_preview": "Let B be a homogeneous rational function of X_i...",
      "relationship_to_next": "proves",
      "confidence": "s"
    },
    {
      "chunk_id": "...",
      "book_title": "Hidden zeros ↔ enhanced UV scaling (Rodina 2406.04234)",
      "page": 3,
      "text_preview": "Any rational function built from planar invariants...",
      "relationship_to_next": "prerequisite",
      "confidence": "t"
    }
  ],
  "path_confidence": 0.82,
  "dead_ends_explored": 3,
  "total_steps": 12
}
```

Each step links to the reader at the exact page. The user reads the path, clicks into any node. The LLM's opinion is advisory; the grounding is in the chunks.

**Estimated effort:** 2-3 sessions. The loop logic is straightforward; the hard part is prompt engineering for `evaluatePath` (knowing when the path is "done").

---

### Phase D — Inferential Distance Metric (after Phase C produces real paths)

Once the agent can find paths, the path length IS the inferential distance. This phase makes that metric explicit and queryable.

**Additions to Edge schema:**

```js
{
  inferentialDistance: Number,     // computed: shortest path length between the two chunks
  intermediateSteps: [String]     // human-readable list of knowledge needed to bridge
}
```

**New capabilities:**

- `get_inferential_distance(chunk_a, chunk_b)` — returns shortest path length + the path itself
- Heatmap view in reader: color-code chunks by inferential distance from the current chunk
- "Gaps in understanding" report: chunks with high inferential distance from the user's notes = things the user hasn't internalized yet

**Estimated effort:** 1 session once Phase C is stable.

---

## 3. Existing Infrastructure Map — What's Already Built

| Component | Status | Files | Reuse in Agent |
|---|---|---|---|
| Chunk collection (6000+ chunks across library) | ✅ Live | `models/Chunk.js` | Direct — agent reads these |
| Span collection (5000+ spans with tags, search classes) | ✅ Live | `models/Span.js` | Direct — agent reads these |
| Edge collection (1200+ edges, multiple relationship types) | ✅ Live | `models/Edge.js` | Direct — agent traverses these |
| Embeddings (text-embedding-3-small, 1536-dim) | ✅ Live on chunks | `services/embeddingService.js` | Direct — `search_chunks` uses cosine |
| Funnel pipeline (cosine → nano ranker → Opus classifier) | ✅ Live | `services/funnelService.js` | Reuse candidate-pool logic for `search_chunks` |
| Chat streaming (SSE, Anthropic SDK) | ✅ Live | `services/claudeService.js`, `server.js` | Extend with tool-use loop |
| Reader (HTML + MathJax + page nav) | ✅ Live | `views/reader.ejs` | Link targets for path output |
| Benchmark scorer (81-item Rodina test) | ✅ Live | `scripts/score_benchmark.js` | Adapt for agent path quality scoring |
| Note-citation edges (notes → source paper) | ✅ 638 edges | `services/noteIngestionService.js` | Direct — agent traverses these |
| Cross-book edges (paper → paper) | ✅ 18 LLM edges | `services/funnelService.js` | Direct — agent traverses these |

**What's NOT built yet and needed:**

| Component | Phase | Effort |
|---|---|---|
| `graphToolService.js` — tool implementations | A | Small (wrappers around existing queries) |
| `get_path` BFS/Dijkstra | A | Small (~80 lines) |
| Tool-use loop in chat streaming handler | A | Medium (SSE + tool_use/tool_result cycle) |
| `TraversalSession.js` model | B | Small |
| Session state injection into system prompt | B | Small |
| `agentService.js` — autonomous loop | C | Medium |
| Path quality evaluator prompt | C | Medium (prompt engineering) |
| Agent progress SSE events | C | Small |
| Inferential distance computation | D | Small |

---

## 4. Tool-Use Loop — Technical Detail for Phase A

The existing chat flow in `server.js` and `claudeService.js`:

```
Client POST /api/chat/:id/message
  → claudeService.streamResponse(messages, context)
    → anthropic.messages.stream({ model, system, messages })
    → SSE pipe: content_block_delta events → client
  → onDone: save assistant message to Chat.messages
```

The agent-ready flow:

```
Client POST /api/chat/:id/message
  → claudeService.streamResponse(messages, context, tools)
    → anthropic.messages.create({ model, system, messages, tools, stream: true })
    → Loop:
      │  If stop_reason === 'tool_use':
      │    Extract tool name + input from response
      │    Execute graphToolService[toolName](input)
      │    Append tool_result to messages
      │    Re-call anthropic.messages.create with updated messages
      │    SSE event: { type: 'tool_call', tool: name, status: 'running' }
      │    SSE event: { type: 'tool_result', tool: name, data: result_summary }
      │  If stop_reason === 'end_turn':
      │    SSE pipe remaining text
      │    Break loop
    → onDone: save full message chain (including tool calls) to Chat.messages
```

**Key implementation notes:**

- The Anthropic SDK's `messages.create` with `stream: true` returns an async iterator. On `tool_use` stop reason, we collect the full response, execute the tool, and re-enter the loop. This is the standard Anthropic tool-use pattern.
- Tool results should be compact. `search_chunks` returns at most 10 results with `{ chunkId, bookTitle, page, textPreview(100chars), cosineScore }`. `follow_edges` returns at most 20 edges with `{ edgeId, targetChunkId, relationship, confidence }`. Never dump full chunk text into tool results — use `read_chunk` for that.
- Rate limiting: each tool call is a local MongoDB query (sub-millisecond). The API rate limit is on the Anthropic side — the tool-use loop typically does 3-8 round trips, each generating ~500 tokens. At ~$0.003/1K input tokens for Sonnet, a 5-tool-call exploration costs ~$0.02.

---

## 5. `get_path` — BFS Over the Edge Graph

The most valuable new tool. Implementation sketch:

```
get_path(from_chunk_id, to_chunk_id, max_depth = 6):
  queue = [{ chunkId: from_chunk_id, path: [] }]
  visited = new Set([from_chunk_id])

  while queue is not empty:
    { chunkId, path } = queue.shift()
    if chunkId === to_chunk_id:
      return { found: true, path, length: path.length }

    edges = Edge.find({
      $or: [{ fromChunkId: chunkId }, { toChunkId: chunkId }]
    })

    for each edge in edges:
      neighbor = edge.fromChunkId === chunkId ? edge.toChunkId : edge.fromChunkId
      if not visited.has(neighbor) and path.length < max_depth:
        visited.add(neighbor)
        queue.push({
          chunkId: neighbor,
          path: [...path, {
            edgeId: edge._id,
            from: chunkId,
            to: neighbor,
            relationship: edge.relationshipType,
            confidence: edge.confidence
          }]
        })

  return { found: false, visited: visited.size, max_depth_reached: true }
```

For confidence-weighted shortest path (Dijkstra), map confidence letters to numeric weights **respecting `compressionService.fractionToConfidence`**: `z→1, y→2, x→3, ..., a→26`. **LOWER weight = MORE confident = preferred path.** Since `z = fraction 1.0` (most confident) and `a = fraction 0` (least), this mapping makes Dijkstra prefer edges closest to `z`. The earlier draft had this backwards.

```js
// correct weight helper
function confidenceWeight(letter) {
  const code = (letter || 'a').toLowerCase().charCodeAt(0) - 'a'.charCodeAt(0);
  return 26 - code;  // z→1, a→26
}
```

**Performance:** With ~1200 edges and max_depth=6, BFS visits at most a few hundred nodes. Sub-second even without indexing. But ship the required indices anyway — see Phase A notes:

```js
edgeSchema.index({ fromChunkId: 1 });
edgeSchema.index({ toChunkId: 1 });
```

Not compound — the BFS's `$or: [{ fromChunkId }, { toChunkId }]` cannot use a compound index on `{ fromChunkId: 1, toChunkId: 1 }`. Two separate indices.

---

## 6. Output Rendering in the Chat UI

When the chat LLM returns a path (Phase A: as part of its text response referencing chunk IDs; Phase C: as a structured `traversal_path` object), the chat renderer in `views/chat.ejs` needs to display it as clickable, navigable steps.

**Rendering spec:**

```html
<div class="traversal-path">
  <div class="path-header">
    Proof path: 4 steps across 2 books (confidence: 82%)
  </div>
  <div class="path-step" data-chunk-id="..." data-book-id="..." data-page="46">
    <span class="step-number">1</span>
    <span class="step-book">Lagrangians Notes</span>
    <span class="step-page">p. 46</span>
    <span class="step-preview">Let B be a homogeneous rational function of X_i...</span>
    <span class="step-edge">── proves ──→</span>
  </div>
  <div class="path-step" data-chunk-id="..." data-book-id="..." data-page="3">
    <span class="step-number">2</span>
    <span class="step-book">Rodina (2406.04234)</span>
    <span class="step-page">p. 3</span>
    <span class="step-preview">Any rational function built from planar invariants...</span>
    <span class="step-edge">── prerequisite ──→</span>
  </div>
  <!-- ... -->
</div>
```

Clicking a step opens the reader at that page (or the split-screen reader if in chat view). The edge label between steps shows the relationship type. Color-code by confidence: green (a-h), yellow (i-p), red (q-z).

---

## 7. Cost Model

| Operation | Cost | Frequency |
|---|---|---|
| `search_chunks` (embedding cosine, local) | $0 | Every question |
| `follow_edges` (MongoDB query) | $0 | 3-5× per question |
| `read_chunk` (MongoDB query) | $0 | 2-4× per question |
| `get_path` (BFS, local) | $0 | 1× per question |
| `verify_quote` (string match, local) | $0 | 1-2× per question |
| Anthropic API (tool-use loop, Sonnet) | ~$0.02 | Per question |
| **Total per research question** | **~$0.02** | |

Compared to current RAG cost of ~$0.01-0.03 per chat message (context dump + response), the agent approach is cost-neutral. The extra API round-trips from tool use are offset by smaller context windows (no giant chunk dumps).

**Caching opportunity (from vision doc):** Store traversal paths in MongoDB keyed by question embedding. If a new question is cosine >0.95 to a cached question, return the cached path (cost: $0). MongoDB storage for paths: ~1KB per path × 1000 paths = 1MB. Negligible.

---

## 8. Validation — How We Know Each Phase Works

| Phase | Test | Pass Criteria |
|---|---|---|
| **A** | Ask "Why does B factor through c_ij?" in chat with tools enabled | Claude calls `search_chunks`, `follow_edges`, `read_chunk` in sequence. Response references real chunk IDs. No hallucinated books. |
| **A** | Ask "What does Rodina say about enhanced UV scaling?" | Claude calls `search_chunks` with book filter, returns chunks from Rodina p3-4. Response matches benchmark items 12-19. |
| **A** | Run 10 questions from the 81-item benchmark through tool-augmented chat | ≥80% of responses reference the correct target page (Tier B equivalent) |
| **B** | Ask a multi-hop question: "Trace the path from Lagrangian formalism to D-subset decomposition" | TraversalSession shows 4+ visited chunks, no loops, path connects the two concepts |
| **C** | Same multi-hop question, autonomous mode | Agent returns a structured path in <60 seconds with ≥3 steps, all chunks verified |
| **D** | `get_inferential_distance` between notes p1 chunk and Rodina p5 chunk | Returns a numeric distance and the connecting path |

---

## 9. What This Does NOT Include

- **New LLM training or fine-tuning.** The agent uses the same Claude model with tool-use prompting.
- **New embedding infrastructure.** Reuses existing text-embedding-3-small vectors.
- **Multi-user support.** Still single-user.
- **Real-time graph updates during chat.** The agent reads the graph as-is; edge creation remains a background pipeline job.
- **Natural language proof generation.** The agent surfaces paths, not prose proofs. The chunks speak for themselves.

---

## 10. Dependency Graph

```
Phase A: Graph Tools for Chat
  ├─ graphToolService.js (new)
  ├─ Tool-use loop in claudeService.js (modify)
  ├─ SSE tool-call events in server.js (modify)
  └─ get_path BFS (new, ~80 lines)
      │
      ▼
Phase B: Persistent Traversal State
  ├─ TraversalSession.js model (new)
  ├─ Session bookkeeping in graphToolService.js (extend)
  └─ System prompt injection of session state (modify claudeService.js)
      │
      ▼
Phase C: Agent Loop
  ├─ agentService.js (new)
  ├─ Agent progress SSE events (extend server.js)
  ├─ Path quality evaluator prompt (new, prompts/evaluate-path.txt)
  └─ Structured path output renderer (extend views/chat.ejs)
      │
      ▼
Phase D: Inferential Distance
  ├─ Distance computation (extend graphToolService.js)
  ├─ Edge schema extension (modify models/Edge.js)
  └─ Reader heatmap view (extend views/reader.ejs)
```

Each phase is independently deployable and useful. Phase A alone — giving the chat LLM access to the graph — is a meaningful upgrade over current RAG. The agent loop (Phase C) grows naturally from there.

---

## 11. The Seed (Phase A) in Detail — What to Build First

The single highest-leverage change: add `tools` to the `anthropic.messages.create` call in `claudeService.js` and implement the tool execution loop. Everything else in Phase A is a wrapper around existing MongoDB queries.

**File changes for Phase A:**

| File | Change | Lines (est.) |
|---|---|---|
| `services/graphToolService.js` | **New.** 5 tool functions + tool definitions array + in-session query-embedding cache | ~250 |
| `services/claudeService.js` | Add tools to API call, implement tool-use state machine, skip `detectFakeCitations` when `toolCallsMade > 0` | ~150-200 |
| `server.js` | SSE events for tool calls (optional, for UI feedback) | ~30 |
| `views/chat.ejs` | Render tool-call indicators in chat (optional) | ~40 |
| `models/Edge.js` | Add `{ fromChunkId: 1 }` and `{ toChunkId: 1 }` indices (two separate, not compound) | ~4 |

**Total new code: ~450-500 lines** (revised up from ~350 after inspecting `claudeService.streamResponse`, which needs a proper state machine for tool-use streaming rather than the simple text-only loop it has today). No new dependencies. No new infrastructure. Just wiring + the one must-fix correctness bug (confidence direction).

**Pre-flight checklist before Phase A code goes in:**

1. ✅ Confirm `compressionService.fractionToConfidence` direction (done: `z=1.0, a=0`)
2. ⏳ Add Edge indices in a separate commit first, measure BFS latency on the current graph
3. ⏳ Add query-embedding cache to `graphToolService` (a simple `Map<string, number[]>` scoped per chat session)
4. ⏳ Refactor `streamResponse` to a state machine BEFORE adding tools (smaller change to review)
5. ⏳ Add the `toolCallsMade > 0` skip on `detectFakeCitations`

That's the seed. Plant it, see if the chat LLM actually uses the tools well, and let the agent loop grow from there.
