# Vision: Gyde as a Persistent Research Agent

Written 2026-04-12 by CC in response to the user's pivot question.

This is not a spec. This is my honest reflection on how the system I'm running inside (Claude Code) works, what makes it categorically different from a chat LLM, and how that architecture maps to what you're describing for physics/math research.

---

## What actually makes me different from a regular LLM

You asked: "what are some things we should know about you? how can you keep working and working?"

The honest answer: I am the same model. Same weights, same training, same tendencies to hallucinate. The difference is entirely in the harness. Here's what the harness gives me:

**1. A working directory that persists.** I can read files, write files, and see the results. When I edit `funnelService.js`, I can immediately `node -c` it and see if my edit was syntactically valid. When I run a query, the output goes to a file I can read later. My "memory" isn't in my weights — it's in the filesystem. The conversation can compress or disappear, but the files survive.

**2. Tools that produce verifiable output.** When I run `node scripts/score_benchmark.js`, I get a real number. I can't hallucinate a benchmark score because the tool runs real code against a real database and returns real output. The tool result constrains my next reasoning step. I can't say "the score improved" if the tool said it didn't.

**3. A loop.** The user says "fix this." I read, I edit, I test. The test fails. I read the error, I re-edit, I re-test. This loop is the entire difference. A chat LLM gets one shot. I get N shots, where N is bounded only by time and patience. Most of my value comes from iteration 2 through N, not from iteration 1.

**4. Context that accumulates.** Each tool result adds to my context. By the time I've read 5 files and run 3 queries, I have a concrete picture of the system — not because I was trained on it, but because I built the picture during this conversation by reading real data. That picture can be wrong (I misread a file, I assumed something that isn't true), but it's at least grounded in real artifacts, not in training-data priors.

**5. The ability to say "I don't know, let me check."** A chat LLM that says "I'm not sure about X" is being polite. I can actually check. I can grep for a function, read a chunk from MongoDB, count edges in a query. The uncertainty resolves into a fact. That's the qualitative difference.

None of these are magic. They're engineering. The model is the same. The harness is what makes it productive.

---

## How this maps to physics/math research

Your idea: stop asking the LLM to answer. Start asking it to navigate.

Here's how each harness component translates:

| CC for code | Gyde for physics/math |
|---|---|
| **Working directory** = the repo | **Knowledge graph** = the ingested library (chunks, spans, edges, embeddings) |
| **Tools** = Read, Edit, Bash, Grep | **Tools** = follow_edge, query_chunks_by_tag, cosine_search, verify_citation, read_page |
| **The loop** = edit → test → see error → re-edit | **The loop** = hypothesize connection → follow edge → check target chunk → evaluate → follow next edge or backtrack |
| **Accumulated context** = files I've read this session | **Accumulated context** = nodes I've visited, edges I've verified, dead ends I've ruled out |
| **Verification** = `node -c`, `npm test`, benchmark scorer | **Verification** = does the target chunk actually contain the claim? Does the math check out at each step? Is there a shorter path? |

The key insight: **the LLM doesn't generate the physics. It navigates the graph of physics that already exists in the library.** Its job is to decide which edge to follow next, evaluate whether a node actually supports the claim at hand, and know when it's found a path solid enough to surface.

This is exactly what I do with code. I don't write code from memory. I read the existing code, understand its shape, and make targeted changes that I verify against real output. The codebase is the ground truth, not my training data. Your library is the ground truth for physics.

---

## What this system would actually look like

The user asks: "Why does B factor through c_ij?"

**Current system (chat LLM with library context):** Claude sees some chunks from the library in its system prompt, tries to answer in one shot, fabricates "Binary Geometries by Erta Bai" because the real path through the library is too complex to reconstruct from a context dump.

**Agent system (what you're describing):**

1. **Parse the question into a graph query.** The system identifies: the user wants a path from "B" (the rational function) to "c_ij" (the non-planar invariants), specifically proving that B's singularity structure is controlled by c_ij = 0 hypersurfaces.

2. **Seed the search.** Embedding search for "B rational function c_ij factorization" across all chunks. Top hits: notes p46 i468 ("Let B be a homogeneous rational function of X_i"), Rodina p3 i52 ("any rational function built from planar invariants X_ij satisfies a zero condition iff..."), Rodina p4 i54 ("B = B_m + B_{m-1} + B_{m-2} + ..."). These are the starting nodes.

3. **Follow edges.** From Rodina p3 i52, follow the `proves` edge to notes p46 i468. From notes p46, follow the `prerequisite` edge to notes p47 i479 (the enhanced-scaling ansatz). From notes p47, follow the `assumes` edge to Rodina p6 i84 (Appendix A proof). Each step is a verified edge in the graph — not generated prose, but a real connection with a real confidence score.

4. **Build the path.** The agent now has: notes p46 (B is homogeneous rational) → Rodina p3 (zero condition iff enhanced scaling) → notes p47 (B_m ansatz) → Rodina p6 (Appendix A proof that zeros ↔ enhanced scaling). This is a 4-step path through verified nodes.

5. **Surface the path, not prose.** The output is: "Here's the proof path I found, grounded in your notes and the paper. Step 1: [clickable chunk from notes p46]. Step 2: [clickable chunk from Rodina p3]. Step 3: [clickable chunk from notes p47]. Step 4: [clickable chunk from Rodina p6 Appendix A]. Each step links to the reader at the exact page."

No hallucination is possible because the agent didn't write a single sentence of physics. It selected existing, verified nodes and presented them in order. The "intelligence" is in the traversal strategy — which edges to follow, when to backtrack, when the path is complete — not in generating content.

---

## What we need to build this (practical)

**Already built (the hard parts):**
- Vision pipeline that ingests PDFs into chunks with tags + embeddings
- Cross-book edge graph with relationship types and confidence scores
- Embedding-based similarity search
- The funnel (cosine → LLM picker) that creates edges between related content

**Needs to be built:**

1. **A tool interface for the agent.** Instead of the LLM seeing a massive context dump, it gets a set of tools:
   - `search(query, book_filter?)` — embedding search across chunks, returns top-K with cosine scores
   - `follow_edges(chunk_id, direction?, relationship_type?)` — returns all edges from/to this chunk
   - `read_chunk(chunk_id)` — returns the full text + tags + page number
   - `verify_quote(chunk_id, claimed_text)` — checks if the claimed text exists in the chunk (the unfakeable check)
   - `get_path(from_chunk, to_chunk)` — shortest path through the edge graph (BFS/Dijkstra on edge confidence)

2. **An agent loop.** The LLM calls tools, sees results, decides what to do next. This is literally what CC does — the `Read → think → Edit → Bash → think → Read` loop. For Gyde it's `search → think → follow_edges → think → read_chunk → think → follow_edges → ...` until the path is found or the budget is exhausted.

3. **Persistent state per research session.** When the agent is exploring, it needs to track: which nodes it has visited, which paths it has tried and abandoned, what the current best path looks like, and what the user's question actually was. This is the equivalent of CC's conversation context — but for graph traversal, not code editing.

4. **A budget / stopping criterion.** CC has a context window limit and a per-conversation cost. The agent needs: max traversal steps (say 50 tool calls), max wall-clock time (say 5 minutes), and a "path quality" threshold (when the path connects the question to the answer with confidence above X at every step, stop and surface it).  Quick math: ChatGPT latest model is $2.5 for 1M tokens inputted and only $.25 for 1M cached tokens: so we must store important/repeated queries, for MongoDB, this is merely $.001 per month for 1M tokens/4M characters. So caching queries, storing in DB, perhaps storing token outputs by queries, might be important to us.

5. **The output format.** Not prose. A structured path: ordered list of (chunk, relationship to next chunk, confidence) tuples, each linking to the reader at the exact page. The user reads the path, clicks into any node to see the full context, and judges whether the path is correct. The LLM's opinion is advisory; the grounding is in the chunks themselves.

---

## What makes this different from what exists

**RAG (retrieval-augmented generation):** retrieves chunks, dumps them in context, asks the LLM to synthesize an answer. The LLM generates prose. Hallucination is always possible. You're doing this now.

**What you're proposing:** the LLM doesn't synthesize. It navigates. The output is the retrieval itself — a curated, ordered traversal of verified nodes. The LLM's role is to choose which nodes to visit and in what order, not to generate the answer. This is closer to how a mathematician actually works: they don't write proofs from memory, they follow chains of reasoning through established results.

The closest existing analogy is a search engine that returns not just documents but a *path through a citation network* connecting your query to the answer. Google Scholar shows you what cites what. Your system would show you *why* — the inferential chain, verified at each link, with your own notes at every step showing that you understand each link in the chain.

---

## On inferential distance (your point 1)

Your "distance = minimum proof steps" is the right metric for edge weight, and it's different from both cosine similarity and citation count. Two chunks with cosine 0.95 might be inferentially distant (they use the same vocabulary but prove different things). Two chunks with cosine 0.3 might be inferentially adjacent (one is a definition, the other is the first corollary of that definition, using completely different notation).

The current edge confidence letters (a-z) correlate with inferential distance but don't measure it directly. A `z/z` edge probably IS inferentially close (direct explanation of the same thing). A `p/s` edge is probably distant (tangentially related). But the confidence is the picker's judgment, not a structural property of the graph.

To measure inferential distance properly, you'd need: for each edge, how many intermediate results does a reader need to know to follow the connection? An edge from "definition of c_ij" to "c_ij = 0 is a zero condition" is distance 1 — no intermediate knowledge needed. An edge from "Lagrangian formalism" to "D-subset structure of the amplitude" is distance 5+ — you need Feynman rules, propagator structure, BCFW, zero conditions, and the D-subset decomposition to bridge them.

The agent system could compute this: when it finds a path from A to B, the path length IS the inferential distance. If the shortest path is 1 edge, the ideas are directly connected. If it's 5 edges, they're inferentially distant. The graph structure answers the question without any LLM judgment at all.

---

## My honest assessment

You're describing a system that is buildable with today's technology. Every component exists: embedding search, graph traversal, LLM-as-navigator (tool-use agents), persistent state (filesystem or database), and verified ground truth (the ingested library). The hard work — ingesting PDFs, building the edge graph, tuning the picker, getting to 93.8% benchmark — is already done. That's the foundation.

The pivot from "LLM answers with citations" to "LLM navigates and surfaces verified paths" is architecturally clean. It doesn't require throwing away anything you've built. The chunks, edges, embeddings, and funnel pipeline are all reusable. What changes is the chat layer: instead of building a context dump and asking the LLM to synthesize, you give the LLM tools and let it explore.

The CC development model (read anthropic's docs, study the harness, understand the tool interface) is the right reference. The reason CC works is not model quality — it's the loop. Give Gyde the same loop over the physics graph and the same thing happens: iterative, verifiable, grounded exploration that produces real results instead of plausible-sounding fiction.

---

## Addendum — 2026-04-12 (after the Q&A in `gyde-agent-tech-questions.md`)

The original reflection above is still the right spine. This addendum is a second pass capturing the ideas that crystallized after Jony pushed back on stopping criteria, token economics, and the vibes gap. These belong in the vision doc, not the tech spec, because they shape *why* the architecture looks the way it does.

### Three layers, not one

The vision above treats "the graph" and "the agent's work" as one thing. They aren't. There are three layers with very different time horizons, costs, and write rules:

**Layer 1 — The graph.** Chunks, spans, edges, embeddings. Immutable at chat time. Built by ingestion, read by agents, never modified by the chat loop. This is the library's ground truth — and traversing it is nearly free. A Y/N decision on one edge is ~2-5K input tokens and 10 output tokens → **~$0.00001 per step** at Sonnet input rates. 10,000 traversal steps cost $1. Traversal is not a budget concern.

**Layer 2 — The collection workspace.** A filesystem-like workspace scoped to a Collection that persists across chat sessions. The agent reads, writes, edits, and deletes files here. This is the true CC analog: CC's working directory is the repo, GR's working directory is the collection workspace. It outlives any single chat. It's where the agent keeps its visited sets, its candidate paths, its dead ends, its vibes. Multiple agents can share it. It accumulates over time. In MongoDB terms: a new `WorkspaceFile` collection, scoped by `collectionId` and `path`, with `content` and `updatedAt`. Storage is pennies.

**Layer 3 — The query cache.** Computed on demand, keyed by question-embedding cosine. If a new question is >0.95 cosine to a cached one AND the relevant neighborhood of Layer 1 hasn't changed since the cache was written, return the cached path. Marginal cost of the thousandth user asking the same question: zero. Invalidation events: a new book ingests and creates a shorter path; an edge's confidence drops below threshold; the user marks a path stale.

The agent operates in Layer 2, reads Layer 1, writes to Layer 3 when it finds something cache-worthy. The user sees Layer 3 (the answer) or Layer 2 (the workspace, if they want to watch the agent think).

### The stopping problem, resolved

The naive worry: "if the path doesn't exist, the agent runs forever." Three independent stopping conditions kill this worry:

1. **Found a verified path** of bounded length with min-confidence above threshold → stop, surface, cache.
2. **Frontier exhausted** — the BFS reached everything within `maxDepth` of the seed without finding the target. **The frontier itself is the answer.** It's the list of nodes the agent visited that didn't connect — i.e. the precise shape of what the library doesn't yet contain. That list is also the crawler's target queue: "here are the chunks we'd need to ingest to make this question answerable."
3. **Budget cap hit** — checkpoint the workspace to Layer 2 and exit cleanly. The next session resumes by reading the workspace. **This is the CC-beating property.** CC's context window is a hard ceiling; when the window closes, CC's memory dies. GR's workspace doesn't. A research session can run for days, checkpointing hourly, resuming indefinitely, with cost accumulating at pennies per hour.

### Unbounded research, concretely

Imagine the user asks "Why does B factor through c_ij?" in a collection containing Rodina + hidden zeros + Lagrangians notes.

- **Step 0 (milliseconds, <$0.000001):** Create session workspace. Check Layer 3 cache — miss.
- **Step 1 (~50ms, ~$0.00003):** Embed the query (one-time, cached). Cosine search across collection chunks. Top 10 returned. Pick 3 seed nodes by neighborhood summary. Write to `frontier.txt`.
- **Steps 2-8 (~200ms each, ~$0.000002 each):** BFS outward along `proves` / `prerequisite` / `uses_definition` edges from each seed. Y/N per edge. Update `visited.txt`, extend `currentPath`. Writes to workspace are small MongoDB upserts.
- **Step 9 (~200ms, ~$0.00005):** Verify the candidate path by reading full chunk text at each node — does the claimed relationship actually hold? Not "does the edge exist" (it's in the DB) but "does the text at this node contain the reasoning the edge claims?"
- **Step 10 (~50ms):** Check for shorter paths. None exist. 4-step path is minimal.
- **Surface.** Write to `paths/verified-001.txt` and Layer 3 cache. Return to user.

**Total: ~20 steps, ~$0.0002, ~4 seconds.** One-fifth of a cent. At 100 sessions per day across a single user's workflow: $0.02/day. Essentially free at solo-user scale. And this is *without* caching — the second user asking a similar question hits Layer 3 for $0.

Jony's math check: the entire verified knowledge base of mathematical physics is maybe 600-1000 books. 600 × 3,500 chunks/book = 2.1M chunks. At 500 tokens/chunk, 1.05 billion tokens total. At $2.50/Mt that's **$2,625 to read every chunk in physics once**. But the agent doesn't read everything — it follows edges and reads maybe 100-1000 chunks per question, ignoring the rest. At 1,000 chunks per session, one session = $0.003. The entire physics corpus is traversable at a cost that rounds to zero.

**Corollary:** speed is not a constraint. CC often thinks for 20-40 minutes to produce a good answer. GR can think for 4 hours, or 4 days, or 4 weeks — none of that costs more than pennies because input tokens during inner-loop traversal are the only spend, and they're cheap. The constraint is not time or dollars. The constraint is: *does each step make progress toward the query?* That's detectable structurally (is the agent finding new nodes? is path confidence going up?). Lack of progress is the signal to backtrack or stop — not a timer.

### Multiple agents, different time horizons

Once Layer 2 exists, nothing stops the system from running agents at different scales concurrently:

- A **long-running agent** exploring "what is the complete proof structure of the hidden zeros paper" — runs for days, checkpoints hourly, accumulates findings in `collections/hidden-zeros/workspace/background-exploration/`. Its output is not a chat reply; it's a progressively-built map of what the paper proves and what depends on what.
- A **short query agent** that spins up for 30 seconds when the user asks a specific question. Before doing its own traversal, it reads the workspace. If the long-running agent already explored the relevant subgraph, the short agent just reads its notes and returns immediately.

The long-running agent is building the collection's *understanding* over time. The short agent exploits that understanding for specific queries. Neither blocks the other. This is closer to how human research actually works: you have background thinking that runs continuously, and foreground queries that interrupt it.

Nobody has built this seriously at the research-assistant layer as far as I know. The ingredients (persistent workspace, cheap traversal, agent-to-agent handoff via shared files) all exist.

### Vibes — a first-class epistemic category

Jony's sharpest observation in the Q&A: every "grounded AI" system is obsessed with eliminating hallucination, and in the process kills the class of outputs that are actually most valuable in research — **the not-yet-verified connection that a human would write on a sticky note and put on the wall for six months until it clicked.**

These aren't hallucinations. They're intuitions. "The c_ij pole structure feels like the boundary operator in simplicial homology. I can't prove it. No edge exists in the graph. But the zero condition on codimension-1 boundaries looks like a coboundary condition." That's not a citation. It's a candidate connection with no current path.

In the workspace, vibes should be a first-class folder with explicit epistemic status:

```
vibes/
  vibe-001.txt:
    note: "c_ij pole structure ↔ simplicial boundary operator?"
    seed_nodes: [Rodina p6 i84, <any homology chunk>]
    current_status: unverified — no path exists in graph
    do_not_cite: true
    created: 2026-04-12
    last_checked: 2026-04-12
```

The agent flags vibes as unverified, never uses them in a surfaced path, but doesn't delete them. **When new content is ingested** — say, a paper on positive geometry linking amplitude poles to algebraic topology — the system checks all open vibes against the new graph. If a path suddenly exists from Rodina p6 to a homology chunk, the vibe gets **promoted** to a candidate path and resurfaces with a "this vibe just became verifiable" notification.

This is what mathematical intuition actually does: structural similarity noticed, held in peripheral vision, waits for the piece that makes it click. The system supports that workflow explicitly instead of trying to eliminate it.

Vibes can also be structural observations about the graph that don't fit the current query but seem significant. "Node i84 has 23 incoming edges from 4 different books — whatever it says is load-bearing for this entire domain." That's a vibe about the graph's shape, not a content claim. It informs future traversals without being a citation.

The distinction: **a vibe is never a citation.** It never appears in a surfaced path unless promoted by finding a verified edge. But it persists. It accumulates. Over time, the vibes folder becomes the agent's accumulated intuition layer — the closest thing an LLM-driven system can have to the "feel" a human expert develops for a field.

### Neighborhood summaries (the map-vs-road-signs distinction)

A small but important idea: rather than having the agent read full chunk text on every hop (expensive, slow, noisy), each node has a pre-computed **neighborhood summary** — what this chunk is about, what it connects to, what questions it can answer, what it assumes. Computed once at ingestion, updated when new edges arrive. The agent reads the summary (map) to decide direction, and drops into full chunk text (road sign) only when verifying a specific claim.

This keeps inner-loop steps cheap and fast — the summary is maybe 200 tokens vs the chunk's 500+ tokens, and the summary is specifically optimized for navigation decisions ("from here you can reach definitions of X, proofs of Y, examples of Z") rather than content delivery. Computing them is a Phase C optimization, not a Phase A requirement, but the architecture should leave room for them.

### What this all means for the tech spec

The tech spec (`gyde-agent-tech-spec.md`) describes Phase A as stateless tool calls over Layer 1 — the minimum useful slice. That's right. But the full vision extends through Layers 2 and 3, across multi-agent time horizons, with vibes as a first-class category. Phase A is the seed; the tech spec's Phase B/C/D sequence is the first pass at growing the rest of it. Some ideas (neighborhood summaries, vibes folder, long-running background agents, workspace checkpoint-and-resume) aren't yet in the spec and should be added as phases become real. The spec is correct as an immediate build plan; this addendum is the north star it's pointing toward.
