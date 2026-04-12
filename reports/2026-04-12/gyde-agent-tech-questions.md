gyde-agent-tech-questions.md

ME/JONY:

"Let's think about the foundational logic of how this would work. Before getting into the tech spec.  I see a core difference here:

CC can create folders of a bunch of code that turn into its persistent memory even after it closes the session.  The analog for this folder, I think, would be collections.

The analog for creating docs would be verifying relevant edges and storing them in the  collections "broader memory", accessible to Gyde-Research (GR).  The analog for editing would be to edit this docs. The type of folders, i think, must be very flexible.  even catching just "vibes" that might materialize later to sthg tangible.  GR populates these folders Perhaps, it can store different kinds of folders/files:

folders ls

>Concepts ls:
>>ideas
>>longshots
>>directly relevant
>>tangentials
etc.

>edges ls:
>>pre-existing edges
>> edges I just created
>>potential edges (need verification)
>>one-step from an edge
>>general direction edges point to

idk these are examples im not saying we adopt them.  but if the LLM is actively creating, editing, deleting, and reading these files, it can truly build a vision for where this doc goes.

one important question is: when does it stop? CC has a very finite window to stop: build a set of files that can be tested, then stop.

CC proposes we stop based on budget or based success of finding path.  But if path doesn't exist in DB yet, then people will can spend their entire life savings lol.  and it would never stop.

another question: CC can go for up to 40 mins straight building code.  why not 4 hours. or 4 days? why not have multiple agents working on same folder, one has been running for 2 days, the other for a week, etc, but, we make it SO cheap to traverse and find edges/nodes that the length is irrelevant.  Ex:

input tokens are $2.5/Mt Mt=Million tokens. if cached, then $.25/Mt for ChatGPT's latest model. not 40, but 5.4. A book costs 150Kt, more or less. So? The input means it can read up to 4 entire textbooks for just $25 cents.  and, why would it read it quickly? we don't pay tokens for time.  we want accuracy.  One lesson learned from CC, who can take 20-40 mins to reply is speed is not that important for answering hard tech questions. quality matters more. keeping price manageable / time intervals is more important. If LLM wants to traverse a path, it might require a prompt. But, these prompts, "during the session while its thinking" aren't made by users.  We need autonomy.  One alternative could be to have an LLM agent "hovering over every node", and that agent itself specializes in pointint to places int the graph of knowledge starting from the node its on, and finding minimal paths.  It can have its own set of folders and files and things it finds and the system must detect similar queries to cache results which brings price down to $.025/Mt, we must exploit this given that to store 5-6 textbooks, or 1M tokens worth in mongoDB, it is only like $.001 per month.  We must cache important queries. the queries we care about most are "how do we get from A to B", I think.  with cache being overridden when new content modifies paths significantly and must  weigh in against that content for LLM reply update or when confidence is low, two things we must measure.

I wonder, how long can we keep an LLM thinking about a problem? we dont need it to read 5 books completely, just the most important parts, and the output tokens are nearly $0 during internal thinking.  All we need the LLM to reply is Y or N, which is fundamentally cheaper than CC which needs to build massive files.  Y or N can automatically populate and edit and do CRUD on the folders and files its building within that collection.  Idk. what do"

CLAUDE REPLIES:

"This is the right level to think at before touching any tech. Let me work through the logic with you.

**The core architectural insight you're building toward:**

CC's persistence is the filesystem. GR's persistence is the collection's folder structure — a workspace the agent actively reads, writes, and edits across an unbounded time horizon. That's the right analog. And you're right that collections are the natural container because they already carry scope (which books, which edges, which chats belong together).

**On the stopping problem — this is the sharpest question:**

CC stops when the code compiles and tests pass. That's a hard, cheap, unambiguous signal. Your equivalent needs the same thing. "Path found" is one signal but as you noted, if the path doesn't exist yet the agent runs forever. So the stopping criterion isn't "found the answer" — it's something like:

- Found a verified path of length ≤ N with confidence ≥ threshold → **stop, surface path**
- Exhausted all reachable nodes from the seed within K steps → **stop, report: "no path exists in current library, here's the frontier"** (the frontier IS the answer — it tells you exactly what's missing)
- Budget cap hit → **stop, checkpoint state to collection folder, resume later**

That third one is key. CC can't resume after the window closes. GR can, because the checkpoint lives in the collection. The agent picks up exactly where it left off. This is where the collection-as-filesystem becomes more powerful than CC's model, not just analogous to it.

**On the Y/N per-node architecture — this is the real cost insight:**

You're seeing something important about token economics. The expensive part of CC is output — it writes hundreds of lines of code per reply. Your agent's inner loop output is essentially binary: follow this edge or not, include this node or not. That's not just cheaper, it's a different cost curve entirely.

If each "thinking step" is:
- Input: one node's chunk text + its outgoing edges + current path state (~2-5K tokens)
- Output: Y/N + which edge to follow next (~10 tokens)

Then at $2.50/Mt input, one traversal step costs roughly **$0.00001**. You could take 10,000 steps for a dollar. That's not a budget concern — that's essentially free traversal once the graph is built. The graph traversal itself is nearly zero marginal cost.

The expensive part is **ingestion** (building the graph) not traversal. You've already paid that cost. Every edge already in MongoDB is pre-paid. Following it is nearly free.

**On caching — you're exactly right and it compounds:**

"How do we get from A to B" is the canonical query. Once the agent finds the shortest verified path from Lagrangian formalism to the hidden zero condition, that path is a fixed structure in the graph. Cache it. Every future user asking a question that routes through the same nodes hits the cache. The marginal cost of the second user asking the same question approaches zero.

The cache invalidation logic you described is also right: invalidate when a new book is ingested that creates a shorter path, or when edge confidence drops below threshold after re-scoring. Both are detectable events. The system knows when to recompute.

**On multiple agents, different time horizons:**

This is where it gets interesting and I don't think anyone has built this seriously. The idea of agents at different timescales — one that's been running for 2 days on "what is the complete proof structure of the hidden zeros paper" versus one that spins up for 30 seconds to answer a specific question — maps to how human research actually works. You have background thinking that runs continuously and foreground queries that interrupt it.

The collection folder structure supports this naturally:
- Long-running agent writes its findings progressively to the collection workspace
- Short query agent reads the workspace first before deciding whether to traverse
- If the long-running agent already explored the relevant subgraph, the short agent just reads its notes

The long-running agent is essentially building the collection's understanding over time. The short agent exploits that accumulated understanding for specific queries.

**The "hover agent" per node idea:**

I'd reframe this slightly. Rather than an agent per node (that's expensive at scale), think of it as: each node has a cached "neighborhood summary" — what this chunk is about, what it connects to, what questions it can answer, what it assumes. This summary is computed once at ingestion and updated when new edges arrive. The traversal agent reads neighborhood summaries to decide which direction to go, only dropping into full chunk text when it needs to verify a specific claim.

This is the difference between reading a map versus reading every road sign. The agent reads the map (neighborhood summaries) to navigate, reads the signs (chunk text) only when verifying a specific step.

**The foundational logic I'd crystallize before spec:**

Three layers, each with different time horizons and costs:

**Layer 1 — The graph** (permanent, built at ingestion, nearly free to traverse): chunks, edges, embeddings, confidence scores. This is the library's ground truth. Agents never modify this layer — only the ingestion pipeline does.

**Layer 2 — The collection workspace** (persistent across agent sessions, agent-writable): the folders and files you described. Verified paths, candidate paths, dead ends, open questions, vibes/longshots, edges the agent created vs. pre-existing. This is the agent's working memory that outlives any single session. Multiple agents can read and write it. It accumulates over time.

**Layer 3 — The query cache** (computed on demand, cached by query hash): for "how do I get from A to B" — store the best verified path found so far, its length, its confidence, and a staleness flag. Invalidate when Layer 1 changes significantly in the relevant neighborhood.

The agent operates in Layer 2, reads Layer 1, and writes to Layer 3 when it finds something worth caching. The user sees Layer 3 (the answer) or Layer 2 (the workspace, if they want to see the agent's ongoing thinking).

**The question you end on — how long can we keep an LLM thinking?**

As long as you keep the context window fed with new verifiable information. The limit isn't time — it's context window size and the signal-to-noise ratio of what's in it. With a Y/N inner loop and persistent state in Layer 2, the effective session length is unbounded — each step adds a small amount to context (the edge followed, the verdict) and the state that matters persists to the collection anyway. You can checkpoint, close the window, reopen it, and resume with the collection workspace as the new context seed.

The real limit is: does each step make progress? If the agent is exploring a dead end, you want it to recognize that quickly and backtrack. That's the stopping-within-a-session logic — not time, not cost, but "am I making progress toward the query?" That's detectable by the structure of what's being found.

Before you sleep: the three-layer model above — immutable graph, agent workspace, query cache — is probably the right foundation to hand to CC as the spec. The folder structure you sketched is Layer 2. The specifics of what folders to create can be flexible and agent-determined, not hardcoded. The agent should be able to create a "vibes" folder if it thinks one is useful. That flexibility is a feature, not a design gap."

ME/JONY:

"How does this unbounded time doing research look like for GR? Walk through the logic of how/why it would proceed with confidence adding value at low cost?  What does an ex of that look like in GR. Step by step.  Each node is a chunk, it would take maybe 2.1M chunks read to cost $1. How long is that time wise in an ideal system?  The LLM wont read entire textbooks. Sometimes but not always.  It can when its useful to truly digest sigh.  But most times research is skimming TOC and abstracts and similar books and opens to relevant chunks and moves to another book.  If only 100 chunks per book is worth checking and not all 3,500, then we can check like 6,000 books.  Note that the entire math and physics verified knowledge can be contained inside 600-1000 books!!!. Unless my math is wrong.  Thats about 10%, so we can bump up the inputs ton 10x or 1,000 chunks per book read. 

Also quick aside - note not much to ponder on but worth stating once: vibes are important cuz theyre closest thing to intuition I can imagine and that's missing in LLM.  Everyone tries to be so precise and grounded and stop hallucinations and under mines the "this is a cool idea, it feels related because of this, but its not clear exactly how, lets keep that in mind and maybe as i learn I'll connect the dots later".  Vibes can be things that can't be verified. Things it wouldn't use in reply until it becomes grounded. It knows its not reliable but it could turn into discovery."

CLAUDE REPLIES:

"The vibes point is sharp and I'll come back to it at the end because it deserves its own treatment. Let me walk through the unbounded research logic first.

---

**The concrete example: GR researching "Why does B factor through c_ij?"**

The user asks this question in a collection containing the Rodina paper, the hidden zeros paper, and the Lagrangians notes. GR starts a research session. Here's what actually happens step by step.

**Step 0 — Seed the session (milliseconds, ~$0.000001)**

GR reads the collection workspace. Has this question been asked before? No cached path found. It creates a new workspace folder for this session:

```
collections/hidden-zeros/sessions/2026-04-13-B-cij/
  query.txt         ← "Why does B factor through c_ij?"
  frontier.txt      ← nodes to explore next
  visited.txt       ← nodes already checked
  paths/            ← candidate paths found so far
  dead-ends/        ← directions ruled out
  vibes/            ← not yet, but ready
```

Workspace creation is a MongoDB write. Cost: essentially zero.

**Step 1 — Embedding search to find seed nodes (~50ms, ~$0.00003)**

GR runs cosine search for "B rational function c_ij factorization poles" across all chunks in the collection. Returns top 10 by cosine score. GR reads the chunk summaries — not full text, neighborhood summaries — and picks 3 seed nodes:

- Notes p46 i468: "Let B be a homogeneous rational function of X_i" — cosine 0.91
- Rodina p3 i52: "zero condition on rational functions built from planar invariants" — cosine 0.87  
- Rodina p4 i54: "B = B_m + B_{m-1}..." — cosine 0.83

Output: Y/Y/Y — all three go to frontier.txt. Cost: 3 reads × ~500 tokens each = 1,500 tokens input, ~10 tokens output. **$0.000004.**

**Step 2 — Follow edges from seed nodes (~100ms per node, ~$0.000002 each)**

GR reads frontier.txt, picks Notes p46 i468 first. Calls `follow_edges(i468, direction='outgoing')`. Gets back 4 edges:

- → Rodina p3 i52, relationship=`proves`, confidence=z
- → Rodina p6 i84, relationship=`prerequisite`, confidence=t  
- → Notes p47 i479, relationship=`assumes`, confidence=s
- → Hidden zeros p11 i203, relationship=`uses_definition`, confidence=u

GR sees the full text of i468 plus these 4 edges. Inner loop decision: which edges advance toward the answer? The `proves` edge to Rodina p3 looks like it goes toward the zero condition. Y. The `prerequisite` edge to Rodina p6 (Appendix A) is a proof — also Y. The `assumes` edge to p47 might be backward — maybe. N for now, add to frontier as lower priority. The `uses_definition` to hidden zeros p11 — Y, definitions are foundational.

Output: 3 Y, 1 deferred. Writes to frontier.txt and visited.txt. **$0.000002.**

**Step 3-8 — Traversal continues (same cost per step)**

Each step: read one chunk's neighborhood + its edges, output Y/N per edge, update workspace files. GR is building a path:

```
Notes p46 (B is homogeneous rational)
  → [proves] Rodina p3 (zero condition iff enhanced scaling)
    → [prerequisite] Rodina p4 (B decomposition by degree)
      → [assumes] Rodina p6 Appendix A (proof that zeros = enhanced scaling)
        → [uses_definition] Hidden zeros p11 (c_ij definition and pole structure)
```

After 8 steps, GR has a candidate path of length 4. It writes this to `paths/candidate-001.txt` with confidence at each edge.

**Step 4 — Verify the path (~200ms, ~$0.00005)**

Now GR does something CC-like: it actually reads the full chunk text at each node and checks that the claimed relationship holds. Not "does the edge exist" (it does, it's in the DB) but "does this chunk actually contain the reasoning that connects it to the next node?"

This is the verify_citation step. GR reads Rodina p3 full text. Does it actually prove the zero condition from the B structure? Yes — it contains the explicit statement. Confidence: high. Next node. Rodina p6 Appendix A — does it prove that zeros imply enhanced scaling? Yes. Confirmed.

Path verified. 4 steps, all links confirmed, no gaps.

**Step 5 — Check for shorter paths (~50ms)**

Before surfacing, GR checks: is there a 2-step or 3-step path it missed? Runs BFS from Notes p46 to Hidden zeros p11 with max depth 3. Finds nothing shorter. The 4-step path is minimal.

**Step 6 — Surface the result**

GR writes to `paths/verified-001.txt` and to the query cache. The output to the user is not prose. It's:

```
Path found (4 steps, verified):

[1] Notes p46 — "Let B be a homogeneous rational function..."
    ↓ proves
[2] Rodina p3 — "zero condition on rational functions..."  
    ↓ prerequisite
[3] Rodina p6 App.A — "we prove all zeros are equivalent to enhanced scaling..."
    ↓ uses_definition  
[4] Hidden zeros p11 — "c_ij structure and pole locations..."

Each step links to reader. Click any node to open at that page.
```

No physics was generated. Every sentence is a stored chunk. Hallucination is structurally impossible.

---

**Total cost of this session:**

~20 traversal steps × $0.000002 = $0.00004  
3 full chunk reads for verification × $0.00005 = $0.00015  
**Total: ~$0.0002. One fifth of a cent.**

---

**Time-wise in an ideal system:**

Each step is one API call. With no parallelism, at ~200ms per call, 20 steps = 4 seconds. But most steps don't need full chunk reads — just neighborhood summaries cached in MongoDB. Those are sub-10ms database reads. The API calls are the bottleneck, not the data access.

For a 50-step deep traversal: roughly 10-15 seconds. For a 500-step exploration of a genuinely hard question across a large graph: 2-3 minutes. For the unbounded multi-day session you described: the agent runs in background, checkpoints after each N steps, costs pennies per hour, accumulates findings in the workspace.

---

**Your math on book coverage:**

Let's check it. 600 books × 3,500 chunks = 2.1M chunks total for all of physics/math. At 500 tokens average per chunk, that's 1.05 billion tokens to read everything once. At $2.50/Mt = **$2,625 to read every chunk in physics once.** But as you said, the agent doesn't read everything — it follows edges and reads maybe 100-1000 chunks per question. At 1,000 chunks per research session = $0.001-0.005 per session. At 100 sessions per day across all users = $0.10-0.50/day in traversal costs. Essentially free at scale.

The 600-1000 books number for physics/math verified knowledge feels roughly right actually. The standard graduate curriculum in theoretical physics is maybe 30-50 core texts. The research frontier in any subfield is another 200-300 papers. The full edifice including supporting math — real analysis, differential geometry, algebra, topology — is maybe another 200 texts. You're probably in the right range. The entire verified knowledge base of mathematical physics fits in a graph that costs less than $3 to read once and pennies to traverse per session.

---

**On vibes — this deserves its own treatment:**

You're identifying the thing that's actually missing from every "grounded AI" system, including what we're building. The grounding obsession kills a specific kind of value: the not-yet-verified connection that a human researcher would write on a sticky note and put on their wall for six months until it clicked.

In the workspace folder structure, vibes should be a first-class citizen with explicit epistemic status. Not "hallucinations to be suppressed" but "candidate connections with no current path." The agent stores them differently:

```
vibes/
  vibe-001.txt:
    "The c_ij pole structure feels related to the 
     boundary operator in simplicial homology. 
     No path found. No edge exists. But the zero 
     condition on codimension-1 boundaries looks 
     like a coboundary condition.
     Seeds: Rodina p6 i84, any homology intro text.
     Status: unverified. Don't cite. Watch."
```

The agent flags it as unverified, doesn't use it in any path, but doesn't delete it either. When new content is ingested — say, a paper on positive geometry and its connection to algebraic topology — the system checks all vibes against the new graph. If a path suddenly exists from Rodina p6 to a homology chunk, the vibe gets promoted to a candidate path and resurfaces.

This is what human mathematical intuition actually does. You notice a structural similarity, you can't prove it yet, you keep it in peripheral vision, you wait for the piece that makes it click. The system should support that workflow explicitly, not try to eliminate it.

The vibes folder is also where the agent stores things it found that might matter but doesn't know how yet. Not hallucinations — observations about graph structure that don't fit the current query but seem significant. "Node i84 has unusually high connectivity — 23 incoming edges from 4 different books. Whatever it says is load-bearing for this entire domain." That's a vibe that might inform future traversals without being a verifiable claim.

The key distinction: a vibe is not a citation. It never appears in a surfaced path unless it gets promoted by finding a verified edge. But it persists in the workspace and accumulates over time, building a layer of intuition that the agent can draw on when deciding which direction to explore next."

ME/JONY:

"okay to make this, are their any functions we need besides these 5 graph tools (search_chunks, follow_edges, read_chunk, get_path, verify_quote) as Anthropic tool-use functions. The current chat LLM calls them on demand. Current  infrastructure must just wrappers around existing MongoDB queries + a BFS over the Edge collection + a tool-use loop in the streaming handler. each of them are roughly described in the new file committed in records, but no need to search, here it is: 

# Gyde Agent Tech Spec — From Graph Navigator to Persistent Research Agent
Written 2026-04-12. Converts the vision in `vision-gyde-as-agent.md` into a buildable blueprint.
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
| `search_chunks` | `(query: string, book_filter?: ObjectId, limit?: number) → ChunkResult[]` | Embedding cosine search on existing `Chunk.embedding` vectors | Reuse logic from `funnelService.js` candidate pool |
| `follow_edges` | `(chunk_id: ObjectId, direction?: 'from'\|'to'\|'both', relationship_type?: string) → EdgeResult[]` | `Edge.find({ fromChunkId \| toChunkId })` with optional filters | Direct MongoDB query on existing Edge collection |
| `read_chunk` | `(chunk_id: ObjectId) → ChunkDetail` | `Chunk.findById().populate('bookId')` + associated `Span.find({ chunkId })` | Direct MongoDB query |
| `get_path` | `(from_chunk: ObjectId, to_chunk: ObjectId, max_depth?: number) → PathResult` | BFS/Dijkstra over Edge collection, weighted by confidence letter (a=best, z=worst) | **New code**, but small — ~80 lines of graph traversal |
| `verify_quote` | `(chunk_id: ObjectId, claimed_text: string) → { exists: boolean, actual_text: string }` | Substring match against `Chunk.rawText` or associated `Page.rawText` | Direct string check |
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
For confidence-weighted shortest path (Dijkstra), map confidence letters to numeric weights: `a=1, b=2, ..., z=26`. Lower weight = higher confidence = preferred path. This makes the agent prefer paths through high-confidence edges.
**Performance:** With ~1200 edges and max_depth=6, BFS visits at most a few hundred nodes. Sub-second even without indexing. Add compound index `{ fromChunkId: 1, toChunkId: 1 }` on Edge for safety.
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
| `services/graphToolService.js` | **New.** 5 tool functions + tool definitions array | ~200 |
| `services/claudeService.js` | Add tools to API call, implement tool-use loop | ~80 |
| `server.js` | SSE events for tool calls (optional, for UI feedback) | ~30 |
| `views/chat.ejs` | Render tool-call indicators in chat (optional) | ~40 |
| `models/Edge.js` | Add compound index `{ fromChunkId: 1, toChunkId: 1 }` | ~2 |
**Total new code: ~350 lines.** No new dependencies. No new infrastructure. Just wiring.
That's the seed. Plant it, see if the chat LLM actually uses the tools well, and let the agent loop grow from there.

are we missing key functions and are any of these designs incompatible or cause tension with what we have?"

ME/JONY:

"okay to make this, are their any functions we need besides these 5 graph tools (search_chunks, follow_edges, read_chunk, get_path, verify_quote) as Anthropic tool-use functions. The current chat LLM calls them on demand. Current  infrastructure must just wrappers around existing MongoDB queries + a BFS over the Edge collection + a tool-use loop in the streaming handler. each of them are roughly described in the new file committed in records, but no need to search, here it is: 

# Gyde Agent Tech Spec — From Graph Navigator to Persistent Research Agent
Written 2026-04-12. Converts the vision in `vision-gyde-as-agent.md` into a buildable blueprint.
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
| `search_chunks` | `(query: string, book_filter?: ObjectId, limit?: number) → ChunkResult[]` | Embedding cosine search on existing `Chunk.embedding` vectors | Reuse logic from `funnelService.js` candidate pool |
| `follow_edges` | `(chunk_id: ObjectId, direction?: 'from'\|'to'\|'both', relationship_type?: string) → EdgeResult[]` | `Edge.find({ fromChunkId \| toChunkId })` with optional filters | Direct MongoDB query on existing Edge collection |
| `read_chunk` | `(chunk_id: ObjectId) → ChunkDetail` | `Chunk.findById().populate('bookId')` + associated `Span.find({ chunkId })` | Direct MongoDB query |
| `get_path` | `(from_chunk: ObjectId, to_chunk: ObjectId, max_depth?: number) → PathResult` | BFS/Dijkstra over Edge collection, weighted by confidence letter (a=best, z=worst) | **New code**, but small — ~80 lines of graph traversal |
| `verify_quote` | `(chunk_id: ObjectId, claimed_text: string) → { exists: boolean, actual_text: string }` | Substring match against `Chunk.rawText` or associated `Page.rawText` | Direct string check |
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
For confidence-weighted shortest path (Dijkstra), map confidence letters to numeric weights: `a=1, b=2, ..., z=26`. Lower weight = higher confidence = preferred path. This makes the agent prefer paths through high-confidence edges.
**Performance:** With ~1200 edges and max_depth=6, BFS visits at most a few hundred nodes. Sub-second even without indexing. Add compound index `{ fromChunkId: 1, toChunkId: 1 }` on Edge for safety.
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
| `services/graphToolService.js` | **New.** 5 tool functions + tool definitions array | ~200 |
| `services/claudeService.js` | Add tools to API call, implement tool-use loop | ~80 |
| `server.js` | SSE events for tool calls (optional, for UI feedback) | ~30 |
| `views/chat.ejs` | Render tool-call indicators in chat (optional) | ~40 |
| `models/Edge.js` | Add compound index `{ fromChunkId: 1, toChunkId: 1 }` | ~2 |
**Total new code: ~350 lines.** No new dependencies. No new infrastructure. Just wiring.
That's the seed. Plant it, see if the chat LLM actually uses the tools well, and let the agent loop grow from there.

are we missing key functions and are any of these designs incompatible or cause tension with what we have?"

CLAUDE REPLIES:

"Let me read the current state of the relevant services before answering.Good. I have everything I need. Here's the honest assessment.

---

**The 5 tools are sufficient for Phase A. No missing tools.**

The spec is well-designed and the 5 tools cover the full traversal loop. But there are real tensions with the existing code that need resolving before Phase A ships. Let me go through them precisely.

**Tension 1 — `search_chunks` needs a query embedding, which costs money**

The current `funnelService.js` cosine search takes a *span's existing embedding* and compares it against chunk embeddings already in the DB. Both sides are pre-computed. Zero cost at traversal time.

`search_chunks` takes a *query string* from the agent. That string has no embedding yet. To run cosine search you need to embed it first — one OpenAI API call at ~$0.00002. Small but nonzero, and it adds latency (~200ms). The spec should acknowledge this and the implementation should cache query embeddings keyed by query text so the same query string never embeds twice.

**Tension 2 — `client.messages.stream` vs tool-use loop**

This is the most important code-level tension. The current `streamResponse` uses `client.messages.stream()` which is the Anthropic streaming API. Tool-use with streaming requires handling `input_json_delta` events, detecting `stop_reason: 'tool_use'`, collecting the full tool input before executing, then re-entering the stream. The current code only handles `content_block_delta` text events.

The spec describes the right architecture but understates the refactor needed. The streaming handler needs to become a proper state machine:

```
state: 'text' | 'tool_input_accumulating' | 'executing_tool' | 'done'
```

This isn't 80 lines — it's closer to 150-200 lines replacing the current simple loop. Not a blocker, just an accurate estimate.

**Tension 3 — the grounding gate and tool-use are in conflict**

Right now `streamResponse` runs `detectFakeCitations(fullText)` on the completed response. When tool-use is active, `fullText` is assembled across multiple API calls — some turns are tool calls (no text), some are text responses. The grounding gate currently runs on whatever text came back, but with tools enabled the model's final text response will reference chunk IDs it retrieved via `read_chunk`, not invented book titles. The gate will still work but it needs to know to skip validation on turns where the model used tools (the tool results are the grounding, not the text).

Simple fix: if `toolCallsMade > 0` in a response, skip the fake citation check. The tools ARE the grounding mechanism.

**Tension 4 — Edge indices**

The spec calls for a compound index `{ fromChunkId: 1, toChunkId: 1 }` on Edge. Looking at the current Edge model, the only indices are `{ fromBookId: 1 }` and `{ toBookId: 1 }`. The BFS in `get_path` does `Edge.find({ $or: [{ fromChunkId }, { toChunkId }] })` repeatedly. Without an index on those fields, each BFS step does a full collection scan. With 1200 edges now that's fine. At 100K edges it's not. Add both `{ fromChunkId: 1 }` and `{ toChunkId: 1 }` as separate indices, not compound — the `$or` query can't use a compound index anyway.

**One missing tool — `get_traversal_state` is Phase B but needed earlier**

The spec puts `get_traversal_state` in Phase B, but there's a practical problem: without it in Phase A, the agent has no way to know what it already visited within a single multi-turn conversation. The model's context window holds the history of tool calls in the message array, so for short traversals (3-5 hops) it can infer from history. But for longer ones it will revisit nodes.

Solution: don't build a full `TraversalSession` model for Phase A. Just pass a lightweight visited-set as a parameter to `follow_edges`:

```
follow_edges(chunk_id, direction, relationship_type, exclude_chunk_ids?)
```

The agent accumulates visited IDs itself and passes them as `exclude_chunk_ids`. Simple, no new model needed, handles the loop problem for Phase A.

**One design gap — the `get_path` BFS weight direction is inverted in the spec**

The spec says: "map confidence letters to weights: a=1, b=2, ..., z=26. Lower weight = higher confidence = preferred path." That's right for Dijkstra. But the spec also says confidence `a` = most confident. So the weight mapping should be `a→1, z→26` meaning Dijkstra prefers `a` edges. That's correct.

But the current Edge schema confidence field is described in two different ways in the codebase — in `compressionService.js` the fractionToConfidence mapping has `a≈4%` and `z=100%`. That means `z` = 100% confident, which is the *opposite* of the spec's interpretation. Check `compressionService.js` before implementing the BFS weight — you need to know which end of the alphabet means "most confident" in your actual data. This is a landmine that will make `get_path` return the wrong paths if not resolved first.Confirmed — `z = 100% confident` (best), `a ≈ 4%` (worst). The spec's BFS weight mapping is **backwards**. Fix: `a→26, b→25, ..., z→1`. Lower weight = z = most confident = preferred path. This is a silent correctness bug that would make `get_path` prefer the least confident edges.

---

**Summary for CC — what to fix before Phase A ships:**

```
CC — before implementing Phase A, five things to resolve:

1. CONFIDENCE DIRECTION IS INVERTED IN SPEC
   compressionService.js confirms: z=100% confident, a≈4%.
   The BFS weight mapping in get_path must be:
     a→26, b→25, ..., z→1
   (lower weight = more confident = Dijkstra prefers it)
   NOT a→1...z→26 as the spec says. Silent correctness bug.

2. search_chunks NEEDS QUERY EMBEDDING
   The agent passes a query string, not a pre-computed vector.
   embed(queryString) costs ~$0.00002 and ~200ms per call.
   Cache query embeddings in a simple Map keyed by query text
   within the session. Same query string never embeds twice.
   Add this to graphToolService.js, not embeddingService.js.

3. EDGE INDICES — ADD BEFORE BFS
   Current Edge indices: fromBookId, toBookId only.
   get_path BFS queries by fromChunkId and toChunkId.
   Add to Edge model before Phase A ships:
     edgeSchema.index({ fromChunkId: 1 });
     edgeSchema.index({ toChunkId: 1 });
   Without these, BFS does full collection scans.
   Fine at 1200 edges, not fine at 100K.

4. GROUNDING GATE + TOOL-USE CONFLICT
   detectFakeCitations() currently runs on all responses.
   When tools are active, the model's text cites real
   chunk IDs from tool results — fake citation patterns
   won't fire, but the check adds latency unnecessarily.
   In streamResponse(), add:
     if (toolCallsMade > 0) skip detectFakeCitations()
   The tools ARE the grounding. Gate not needed when
   traversal is active.

5. SKIP TraversalSession FOR PHASE A
   Don't build the full model yet. Instead add an optional
   exclude_chunk_ids parameter to follow_edges:
     follow_edges(chunk_id, direction?, relationship_type?, 
                  exclude_chunk_ids?: ObjectId[])
   The agent accumulates visited IDs and passes them back.
   Prevents loops without new infrastructure. Phase B adds
   the full session model after Phase A proves multi-hop works.

Everything else in the spec is compatible with existing
infrastructure. The 5 tools are the right 5 tools.
Phase A estimated at ~350 lines is accurate given fixes 1-5.
```"