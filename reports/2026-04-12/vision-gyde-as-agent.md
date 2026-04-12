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

4. **A budget / stopping criterion.** CC has a context window limit and a per-conversation cost. The agent needs: max traversal steps (say 50 tool calls), max wall-clock time (say 5 minutes), and a "path quality" threshold (when the path connects the question to the answer with confidence above X at every step, stop and surface it).

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
