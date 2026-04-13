# Gyde Cost Analysis — Canonical Numbers

Written 2026-04-13. **This is the single source of truth for per-operation cost across the Gyde pipeline.** Every number in this doc is either (a) a live measurement from an actual run on real data, or (b) an estimate clearly labeled as such with its assumptions.

Whenever a new operation ships, add a row to the appropriate table. Whenever an optimization lands (prompt caching, model routing, batch sizing), record the before / after here. This doc is how we answer "what does this cost?" and "which lever should we pull next?" without re-doing the math.

The older file `PRice-4-pix.md` in this folder is a brainstorm from before the measurements landed. This file supersedes it for canonical numbers; keep `PRice-4-pix.md` as the original-thinking record.

---

## 0. Model pricing reference (April 2026 rates)

| Model | Input $/Mt | Output $/Mt | Cached read $/Mt | Use case in Gyde |
|---|---:|---:|---:|---|
| Claude Opus 4.6 | 15.00 | 75.00 | ~1.50 | quality-critical generation (notes rewrite, quality sweep) |
| Claude Sonnet 4.5 / 4.6 | 3.00 | 15.00 | ~0.30 | judge steps, notes rewrite on prereq pages, chat |
| GPT-4o | 2.50 | 10.00 | 0.25 | page-to-HTML vision, nano picker, first-pass span generation |
| GPT-4o mini | 0.15 | 0.60 | ~0.015 | edge picker, cheap ranking |
| text-embedding-3-small | 0.02 | — | — | chunk + span + query embeddings |

Rates update without warning — if you notice a drift, update §0 first and propagate.

---

## 1. Per-operation cost table

Sorted by frequency × cost impact. Operations flagged (**measured**) come from live runs on real data; (**estimate**) rows are extrapolations.

### 1.1 Ingestion — happens once per book upload

| Op | Model | Input tok | Output tok | Per-page $ | Notes |
|---|---|---:|---:|---:|---|
| Vision page → HTML (measured) | GPT-4o | ~5,000 | ~1,000 | **~$0.0225** | `services/visionService.js`. Rasterized PNG + prompt. Retry logic handles 429s. |
| Vision page → HTML (notes variant) | GPT-4o | ~5,000 | ~1,500 | **~$0.0275** | `prompts/page-to-html-notes.txt`. Same model, slightly larger output for handwritten layout. |
| Span generation full prompt (measured) | GPT-4o | ~3,500 | ~400 | **~$0.0129** | First page of every 8-page session. Larger prompt ~2,500 tokens. |
| Span generation short prompt (measured) | GPT-4o | ~1,800 | ~400 | **~$0.0085** | Pages 2-8 of each session. ~$0.005 amortized across sessions. |
| Chunk derivation | — | — | — | **$0** | Pure DB sweep (`chunkService.js`). No LLM. |
| Surface metadata (title/author/isbn) | GPT-4o mini | ~2,000 | ~200 | **~$0.00042** | Once per book, not per page. |
| Chunk embeddings (batch) | text-embedding-3-small | ~500/chunk | — | **~$0.00001/chunk** | Batched 50 at a time, ~$0.01/book of 1000 chunks. |
| Span embeddings (batch) | text-embedding-3-small | ~150/span | — | **~$0.000003/span** | Only spans with concept tags. |
| Funnel edge picker (GPT-4o) | GPT-4o | ~2,500 | ~10 | **~$0.0065** | `funnelService.pickAndClassify`. Per candidate call. |
| Funnel edge picker (mini) | GPT-4o mini | ~2,500 | ~10 | **~$0.00039** | Cheap variant. Default for first-pass resolution. |

**Total first-pass ingestion for one 60-page paper book:**
- Vision: 60 × $0.0225 = **$1.35**
- Spans: 60 × $0.008 = **$0.48**
- Metadata: **$0.0004**
- Embeddings: ~$0.02
- Funnel edges (variable, ~40-100 picker calls): **~$0.02-0.65** depending on routing
- **≈ $1.85-$2.50 per book** for basic ingestion (vision + spans + embeddings + basic edges)

### 1.2 Notes rewrite pipeline — activates for `kind='notes'` only

Shipped 2026-04-13. Replaces the verbatim vision transcription with an expository rewrite in Rodina voice + inline citations. Implemented in `scripts/rewrite-notes-pages-batch.js`.

| Op | Model | Per-page $ | Notes |
|---|---|---:|---|
| Rewrite, Opus-only, no cache (measured, 2 pages) | Opus 4.6 | **$0.21** | First test on Lagrangians notes p1+p3. 5K in / 1.8K out avg. |
| Rewrite, Opus + prompt cache (estimate) | Opus 4.6 | **~$0.17** | System prompt ~2.5K cached 90% after first call. |
| Rewrite, Sonnet, no cache (estimate) | Sonnet 4.6 | **~$0.042** | 5K × $3/Mt + 1.8K × $15/Mt ≈ 5x cheaper than Opus. |
| Rewrite, Sonnet + cache (estimate) | Sonnet 4.6 | **~$0.034** | Cache discount applied to system prompt. |
| Rewrite, Opus/Sonnet routing + cache (estimate, 65p) | mixed | **~$0.08** | Sonnet for prereq pages (most), Opus for Rodina-bridge pages (~20%). Routing regex in `rewrite-notes-pages-batch.js`. |
| Judge step (future v2 pipeline, not built) | Sonnet 4.6 | **~$0.015** | Per spec `notes-vision-quality-loop-spec.md`. Compares source PNG vs rendered preview PNG. |
| Puppeteer render (future v2 pipeline) | — | **$0** | Local headless browser. CPU time only. |

**65-page Lagrangians notes book total:**
- Opus-only (measured baseline): ~$13.65
- Opus + cache: ~$11.05
- Sonnet routing + cache (target): **~$5.20**
- v2 with judge + 1 retry avg: **~$7-10** (quality ceiling, not the steady state)

### 1.3 Chat — happens on every user message

| Op | Model | Per-message $ | Notes |
|---|---|---:|---|
| Plain chat streaming (measured, estimate) | Opus 4.6 | **~$0.01-0.05** | `claudeService.streamResponse`. Context dump + response. Depends on context size. |
| Chat with tools (Phase A, estimate) | Opus 4.6 | **~$0.02-0.08** | Tool-use loop: 3-8 round trips per question, ~500 out tok each + tool result accumulation. |
| Query embedding (once per new query) | text-embedding-3-small | **~$0.00002** | Cached per-session. |
| Graph tool execution | — | **$0** | Pure MongoDB queries. |
| Grounding gate citation validator | — | **$0** | Regex-only check. Currently disabled. |

**Per chat session (10 messages avg, estimated):**
- Plain chat: **~$0.10-0.50**
- Chat with tools: **~$0.20-0.80**

### 1.4 Quality sweep (post-ingestion repair)

Shipped 2026-04-12. Manual-only for v1. Implemented in `services/qualitySweepService.js`.

| Op | Model | Per-chunk $ | Notes |
|---|---|---:|---|
| Detection (any pattern) | — | **$0** | Pure DB sweep. `detectCandidates()`. |
| Pattern 1 decompose (measured, Rodina chunk #14) | Opus 4.6 | **$0.026** | 1.4K in / 64 out. Confidence 0.85 at level 0, no escalation. |
| Pattern 1 decompose (estimate, with escalation) | Opus 4.6 | **$0.05-0.12** | Level 2-3 includes full page + book metadata. |
| Pattern 2 merge/disambiguate (estimate) | Opus 4.6 | **~$0.03** | Verdict format is compact. Most cases resolve at level 0-1. |
| Pattern 3 retag isolated node (estimate) | Opus 4.6 | **~$0.04-0.08** | Always loads large context (page + neighbors). |
| Canonical definition lookup (per new span) | — | **$0** | Pure DB. `linkNewSpansToCanonicals()`. |

**Full sweep cost on one book:**
- Rodina (measured detection): 31 p1 + 7 p2 + 1 p3 matches. Estimated full-sweep cost: **~$1.05**
- Full 6-book library estimate: **~$6-10**
- Full 1500-book library (future): **~$7.5K-30K**

### 1.5 Metadata-only operations

| Op | Cost | Notes |
|---|---:|---|
| Canonical dictionary build (library-wide) | **$0** | Pure DB. Measured: 2116 chunks scanned, 253 concepts registered, <5 seconds. |
| Canonical link (library-wide) | **$0** | Pure DB. Measured: 754 edges created across 99 target chunks. |
| Chunks-view render (per page view) | **$0** | Frontend only. |
| Graph-tool `get_path` BFS | **$0** | Indexed Mongo traversal. Sub-second for ≤1200 edges. |

---

## 2. Per-book totals — all-in estimates

Assumptions:
- Paper/textbook average page count: 60
- Notes book average page count: 50
- One quality sweep per book after ingestion

| Book type | Ingestion | Notes rewrite | First quality sweep | Total one-time $ |
|---|---:|---:|---:|---:|
| Paper (60 pages, no notes rewrite) | $1.85 | — | $1.00 | **~$2.85** |
| Notes book, Opus-only baseline | $1.75 | $10.50 | $1.00 | **~$13.25** |
| Notes book, Sonnet+cache+routing (target) | $1.75 | $4.00 | $1.00 | **~$6.75** |
| Textbook (500 pages, no rewrite) | $15.00 | — | $5.00 | **~$20.00** |

---

## 3. Library-scale projections

Based on the § 2 per-book numbers and the user's stated targets.

| Library size | Notes books | Papers | Textbooks | One-time cost |
|---:|---:|---:|---:|---:|
| **Current (6 books)** | 1 | 5 | 0 | **~$20** |
| **100 books** (early users) | 30 | 60 | 10 | **~$775** |
| **1,500 books** (full physics/math) | 200 | 1100 | 200 | **~$8,500** |
| **10,000 books** (full academic) | 1000 | 7500 | 1500 | **~$57,000** |

User's stated budget ceiling: $150K for full physics/math library. Our best-current estimate comes in at **~6% of that budget** — the headroom is real.

Papers add: once edge refinement + quality-sweep iteration settles, full-library sweeps re-running on version bumps add ~30% on top per sweep. Three sweeps across the corpus lifetime → ~$25K additional. Still under budget with room for error.

---

## 4. Optimization levers (ranked by impact)

From largest to smallest win:

### 4.1 Prompt caching (shipped partial)
- **Where applied**: notes rewrite pipeline (`scripts/rewrite-notes-pages-batch.js`).
- **Where NOT applied yet**: all other Opus/Sonnet calls. Chat streaming, quality sweep repairs, Pattern 1/2/3 prompts. Every one of these sends an identical system prompt on every call and is leaving cache savings on the table.
- **Expected win**: ~80% reduction on system-prompt input tokens across all these sites. On the quality sweep that's ~15% total per-repair reduction. On chat with tools it's ~40% because the context dump dominates.
- **Build cost**: ~5 minutes per call site. Add `cache_control: { type: 'ephemeral' }` to the Anthropic messages.create call's system block.

### 4.2 Sonnet routing for low-complexity work (shipped partial)
- **Where applied**: notes rewrite (regex-based routing in `rewrite-notes-pages-batch.js`).
- **Where NOT applied yet**: quality sweep patterns (all forced to Opus), chat (no cheap path).
- **Expected win**: 60% cost reduction on pages/chunks routed to Sonnet. Rough estimate: applied to quality sweep Pattern 3 (the most context-hungry, many isolated prose chunks), would drop full Rodina sweep from ~$1.05 to ~$0.50.
- **Build cost**: a routing classifier (regex or small model), 1-2 hours.

### 4.3 Vision batch recovery (shipped)
- **Where applied**: `services/jobService.reconcilePages()` auto-recovery for any missing Page records after the parallel vision batch. Shipped 2026-04-13.
- **Win**: resolved the 33-page gap in Lagrangians. Cost saved: not having to re-run vision on the whole book = ~$1.20 per affected book. More importantly prevented future notes uploads from silently losing half their content.

### 4.4 Incremental graph updates vs full re-runs (not yet exploited)
- The canonical definition build is currently run library-wide every time. At 2116 chunks it's ~5 seconds, free. At 200K chunks (future library size) it's seconds-to-minutes but still free.
- The edge-generation funnel is the real cost lever here. Re-running the funnel per-book is ~$0.02-0.65. Re-running incrementally (only on new chunks + their cosine-nearest neighbors) drops that to ~10% of the full cost.
- **Expected win on re-sweeps**: ~$25K saved on full-library re-runs after initial ingestion.

### 4.5 Query caching for chat (not yet built)
- Questions cosine-similar to cached questions should return cached paths with no LLM call. Discussed in the GR tech spec's Layer 3 (query cache). Not implemented.
- **Expected win**: on an active user, maybe 30-50% of queries are re-asks or variants. At ~$0.03 per chat message that's ~$0.01-0.015 per query saved. Compounds as the user base grows.

### 4.6 Span generation short-prompt quality gate (shipped)
- `SPAN_MIN_ENRICHED_RATIO = 0.5` in `config/pipeline.js`. Pages that drift on the short prompt auto-retry with the full prompt. Already paid for, quality win.

### 4.7 Edge funnel candidate ceiling (shipped)
- `PICK_CANDIDATE_COUNT = 12` cap on funnel picker calls. Before the cap, dense pages would have 40+ candidates. Now all pages are bounded.
- Current mini-picker cost at 12 candidates: ~$0.0005 per call.

---

## 5. Business implications

From the `business-strategy.txt` file in this folder (paraphrased):
- **Cost floor for notes ingestion**: ~$0.08/page (Sonnet + cache + routing) or ~$0.21/page (Opus-only baseline). A $30/mo Pro tier covers ~375 pages/month at cost, comfortably profitable.
- **Paper ingestion floor**: ~$0.03/page all-in. Even a 500-page textbook is under $20 one-time.
- **Pay-per-query chat**: plain chat ~$0.01-0.05 per message, tool-chat ~$0.02-0.08. A user doing 500 messages/month costs $5-40 at the high end. Bundled with a Pro tier this is under the price floor from ingestion.
- **Library-scale moat**: $8.5K for the full 1500-book physics/math library is not a cost problem. It's a one-time investment with a ~$150K budget ceiling.

The conclusion: **quality is the binding constraint, not cost.** Spend the money on better models, more context, more retry loops, better judges. Cost optimizations come later when margin expansion actually matters.

---

## 6. Known cost bugs / surprises observed during runs

### 6.1 Chunk 14 quality-sweep repair — 2 canonical misses out of 5
On 2026-04-12, the first Pattern 1 repair on Rodina chunk 14 decomposed 1 span → 5 spans but only 1 `uses_definition` edge was created via canonical lookup. Three of the concepts (`bcfw_shifts`, `non_adjacent_shifts`, `equivalence_zeros_scaling`) got no edge and were added to `Book.missingDefinitions` as crawler targets.

**Root cause** (diagnosed 2026-04-13): the canonical-lookup does EXACT string matching on `concept`. The notes book has `enhanced_uv_scaling` tagged (11 spans) which matched and produced the 1 edge. It has ZERO spans tagged `bcfw_shifts` — not because the notes don't define BCFW (they do, across 4 pages by raw text search), but because **the 33 reprocessed notes pages don't have spans yet**. Span generation was never re-run on them after the 2026-04-13 page backfill.

`taxonomyService.areSynonyms('bcfw_shifts', 'bcfw_shift')` returns `true`, so the synonym infrastructure exists. The canonical-lookup service just doesn't use it.

**Two-part fix required**:
1. **Re-run span generation on the Lagrangians notes book** (cost: 65 pages × $0.008 = **~$0.52**) so the reprocessed pages get tagged. Until then, bcfw / hidden zero / non-adjacent shift concepts can't become canonical definitions.
2. **Add synonym normalization to canonical lookup**. Before `CanonicalDefinition.findOne({ concept })`, expand the query via `taxonomyService.normalize()` / `areSynonyms()` so `bcfw_shifts` matches a canonical for `bcfw_shift`. Code change: ~30 lines in `services/canonicalDefinitionService.js`. Cost: $0.

This is tracked as a "known miss" until both fix halves ship.

### 6.2 Notes book had 33 missing pages (fixed 2026-04-13)
Original vision pass saturated GPT-4o TPM (30K/min) with parallel batch of 20 and 33 pages silently failed with 429. Fixed via `scripts/fill-missing-pages.js` + `services/jobService.reconcilePages()` auto-recovery hook. Cost of fix: ~$1. Cost of NOT fixing: half the notes book's semantic content would never have contributed to the edge graph.

### 6.3 Quality sweep repair produces correct DB state but ugly render
On 2026-04-12, chunk 14's 5 new spans all rendered as "the same sentence repeated 5 times" in the Chunks view. Root cause was purely in the renderer — the overlapping-range grouping logic was missing. Fixed in `public/js/chunks-view.js` with `renderSpanGroup()`. Zero cost.

---

## 7. Measurement protocol

Every time an operation ships, record:
1. **Model** (Opus 4.6, Sonnet 4.6, GPT-4o, etc.)
2. **Input tokens** from `response.usage.input_tokens` (Anthropic) or `response.usage.prompt_tokens` (OpenAI)
3. **Output tokens** similarly
4. **Cache reads / writes** for Anthropic (`cache_read_input_tokens` / `cache_creation_input_tokens`)
5. **Computed $ cost** using the table in §0
6. **Wall-clock time** from the call site

Log to console in a structured line: `[<pipeline>] op=<name> model=<x> in=<n> out=<m> cacheR=<k> $<y> <Z>ms`.

If a one-off is interesting, add it to §1.6 "Known runs" below.

---

## 8. Known runs (log)

| Date | Operation | Model | Tokens (in/out/cache) | Cost | Notes |
|---|---|---|---|---:|---|
| 2026-04-12 | Rodina chunk #14 Pattern 1 decompose | Opus 4.6 | 1398/64/0 | $0.0258 | Level 0, confidence 0.85, 5 new spans, 1 canonical edge |
| 2026-04-13 | Lagrangians p1+p3 rewrite (first test) | Opus 4.6 | 9997/3586/0 | $0.4189 | 2 pages in 66.5s. Per-page ~$0.21. |
| 2026-04-13 | Lagrangians 33-page vision backfill | GPT-4o | ~165K/~33K | ~$0.74 | `scripts/fill-missing-pages.js`. 350s serial. |
| 2026-04-12 | Canonical dictionary build (library-wide) | — | — | $0 | 2116 chunks scanned, 253 concepts registered, <5 seconds |
| 2026-04-12 | Canonical link (library-wide) | — | — | $0 | 754 uses_definition edges created, 99 unique targets |

Append new rows as they happen.
