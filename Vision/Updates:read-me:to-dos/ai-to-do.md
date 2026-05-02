# ai-to-do.md

Backend / pipeline / data-quality / LLM routing / edges / cost / figures / notes rewrite.
UI / reader / split-screen items live in `ui-to-do.md`.

Add new items at the bottom of their priority bucket. Cross out and move to "Recently shipped" when they land. Keep file paths + function names on every item so future sessions can grep to the right place.

---

## 🚀 EXECUTIVE PRIORITIES (2026-05-01 — these supersede earlier "DO NOW" sequences when in conflict)

Top-line goal Jony stated 2026-05-01: **metadata + edges 200% better**. The order below is calibrated to that goal. Quality measurement comes BEFORE Phase A flip because flipping the agent on a low-quality graph amplifies bad edges. Companion analysis: `reports/2026-05-01/metadata-edge-quality-2x-plan.md`. Macro picture: `reports/2026-05-01/session-catchup-and-recommendation.md`.

Each item carries a one-line acceptance criterion so we know when it ships.

### EX-0. Backfill the 33 Lagrangians-notes pages through Phase 2 (chunks/spans/embeddings/edges)
- **Action:** `node -e "require('./services/spanService').generateSpansForBook('69d9ce81aa83b8b11c1837dd')"` then re-run note-match.
- **Acceptance:** notes book span count rises past 1137 (current); edge count to Rodina rises; reprocess does not surface new errors.
- **Cost / time:** ~5–10 min compute, ~$0.50.

### EX-1. Re-run note→paper match pass to validate Fix 2 + Fix 3
- **Action:** the resume command in `reports/2026-04-13/data-quality-session-results.md` and `update.md` 2026-04-11 entry. Score Tier A / B / C after.
- **Acceptance:** Tier B ≥ 85%, Tier C ≥ 50% (forecast from 2026-04-11). Relationship-type histogram no longer 100% `annotates`.
- **Quota:** verified restored 2026-05-01.

### EX-2. Pad `prompts/notes-rewrite.txt` past 1024 tokens to enable cache hits
- **Action:** add stricter citation rules + LaTeX rules + grounding rules. Re-run a 3-page test batch and watch `cache_read_input_tokens > 0` on calls 2/3.
- **Acceptance:** `cr > 0` on subsequent calls within 5-min window; quality not regressed on the rewrite preview.

### EX-3. Ingest Rodina notes 14–18 (Jony manually uploads first, then Phase 2 pipeline)
- **Action:** Jony uploads the 5 new PDFs (`14. encroaching-locality-proof`, `15. Pattern-Structures in Zeroes-Chords`, `16. Cyclic shifts of zeroes`, `17. Hidden zeroes and non local interactions correspondance`, `18. d subset rigorous proof`) through the `/upload` UI. CC then runs span generation + note matching + benchmark scoring.
- **Acceptance:** all 5 books appear at status='ready'; new notes contribute outgoing edges to Rodina; benchmark item count grows or coverage improves.

---

### EX-4. Quality measurement infrastructure — Track 1 of `metadata-edge-quality-2x-plan.md`

**This is the load-bearing item for the 2× goal. Without measurement, every other change is a guess.**

- **EX-4a. Populate `prompts/judge-rating.txt`** with the six-axis rubric (tag specificity / normalization / role accuracy / gap detection / declarative-tag precision / search-class accuracy). Each 0–3, total mapped to 0–9 to match `config/pipeline.js qualityThreshold`.
- **EX-4b. Build `services/judgeService.js`.** Sample N=50 chunks per book per ingestion; write `QualityScore` documents; trigger session-prompt re-injection on threshold breach. Spec already in `Vision.md` §4.2 and `to-do.md` Architecture/Phase 3 bucket.
- **EX-4c. Build the Quality Dashboard** at `views/admin/quality.ejs` + route. Surfaces six axes per book and library-wide histograms. Detailed spec: §1.3 of the 2× plan.
- **EX-4d. Edge precision audit script** `scripts/audit-edges.js`. Stratified sample of 200 edges → Opus rates each → precision per confidence bucket. ~$1.50 per run, monthly. Spec: §1.4 of the 2× plan.
- **Acceptance:** dashboard renders the six axes from real data; judge has scored ≥3 books; edge audit has rated 200 edges with bucket-level precision. Establishes the BASELINE for the 2× targets.

### EX-5. Quality feedback loop — Track 2 of `metadata-edge-quality-2x-plan.md`

- **EX-5a. Failure mining from the 81-item benchmark.** Convert the 25 PARTIAL + WRONG cases into negative examples in `prompts/edge-pick.txt`.
- **EX-5b. Round-trip validation pass.** Hide relationship letter on existing edges, re-classify, flag disagreements. Output: stale-edges page in admin dashboard.
- **EX-5c. Promote validated patterns into the prompt** when audit finds consistent wins.
- **Acceptance:** Tier B improves by ≥ 5pp without dropping precision more than 1pp.

### EX-6. Hidden-defect scans — Track 3 of `metadata-edge-quality-2x-plan.md`

- **EX-6a. Embedding-based tag drift detector.** Tag pairs with mean-cosine > 0.85 propose merges via a new `TaxonomyProposal` queue, human approves in dashboard.
- **EX-6b. Dead vocabulary report.** Tags on >5 chunks with 0 outgoing edges → backfill / merge / demote.
- **EX-6c. Coverage gap report.** L-tagged spans across all books with no matching note → crawler queue.
- **EX-6d. Citation-resolution tracker.** Implement the `JONY MUST READ EDIT` from this file: every citation auto-creates an edge to a chunk OR a null Book record with as much metadata as the bibliography exposes. Track resolved / parked / dropped buckets. Goal: zero in `dropped`.
- **Acceptance:** taxonomy proposal queue has ≥ 10 actionable merges; coverage report exists; citation `dropped` count ≤ 2% of total citations.

---

### EX-7. Flip Phase A graph tools on for the Rodina collection (per-collection feature flag)

Phase A is already in the codebase, toggled off (`d791cf4`, `32d5e41`). Flip becomes meaningful AFTER EX-4/5/6 because the agent traverses the audited graph, not the raw one.

- **Action:** add a `Collection.useGraphTools` boolean. Gate the tools array in `claudeService.streamResponse`. Build path renderer in `views/chat.ejs` (steps with chunk previews + relationship arrows + click-to-reader). Per-collection toggle in collection settings.
- **Acceptance:** asking "Why does B factor through c_ij?" in a Rodina-collection chat produces a structured 3-5 step path with all real chunk IDs; UI renders clickable steps; audit confirms zero hallucinated bookIds.

### EX-8. Construct a Rodina-domain Phase A path-quality benchmark

- **Action:** 20 hand-labeled questions with known-correct paths. Compare agent-surfaced paths to ground truth.
- **Acceptance:** ≥ 80% agreement on first-hop choice; ≥ 60% agreement on full-path content.

### EX-9. Cross-domain validation — Nuclear track

- **Action:** create `Nuclear compliance` collection with custom AI instructions; ingest 5–10 NRC anchor docs; run pipeline; compare per-axis quality dashboard scores against Rodina baseline; identify domain-specific tag types needed (regulatory modalities `shall`/`should`/`may`, design-basis events, CFR section structure).
- **Acceptance:** quality dashboard scores nuclear corpus within 30% of physics on the six axes; if it does not, build a per-domain taxonomy seed (Track 6.3 of the 2× plan).

### EX-10. (Horizon — do not start until EX-7 is stable) Phase B persistent traversal state + collection workspace

Spec: `reports/2026-04-12/gyde-agent-tech-spec.md` Phase B. Adds the `TraversalSession` model, dead-end logging, and the per-collection workspace where vibes live.

---

## 🎯 Architecture decisions locked in 2026-04-10 (DO NOW sequence)

Two decisions, locked. Everything else (prompt caching, fine-tuning, specialist agents, full retrieval system) is deferred until edge count proves these work.

**Decision 1 — DIRECTION REVERSAL (notes→paper is primary).** Paper→notes is open-world search (needle in a haystack of fuzzy handwriting). Notes→paper is closed-world: every notes chunk is GUARANTEED to be explaining *something* in the paper, so the question becomes "which of ~80 paper chunks?" — small clean target space. Architecture:
- **Primary pass:** for every notes chunk, funnel against the source paper's chunks. Always produces an edge.
- **Secondary pass:** for paper L-tagged chunks left UNCOVERED by the primary pass, run paper→notes funnel to try to fill them. **JONY EDIT: note that in the notes themselves, chunks of derivations should be tagged (group level/not span level) as a 'derivation', then mapping paper L-tagged chunks to notes has a target.**
- **Bonus output:** the list of paper chunks that NO note covers = "gaps in your understanding" = crawler targets.
- **JONY MUST READ EDIT:** every citation in any book must automatically get a span or chunk with edges at the span or chunk or (likely) both level(s).  Citations must be taken as "something is missing here that needs to be read to get better understanding here, so lets go find that thing cause that is our job". The edge must point to something, so if we don't have the book, let it point to an empty/null node that only has basic metadata needed to uniquely specify the book, and even more if possible (maybe the bibliography says page 143-- that would be GOLD for us cause we'd know exactly where to go to build this bridge.
- Cost: ~$0.10 per notes upload (down from $0.13 bidirectional). Costs never include JONY EDITS whether they effect cost or not.
- File: `services/noteIngestionService.js matchNotesToSourceBooks`.

**Decision 2 — EXAMPLE LIBRARY (Phase 1: hardcoded few-shots only).** Don't build the retrieval system yet. Pick 8-10 representative examples from `notes-paper-rodina-example.md` and HARDCODE them into the span generation prompts as few-shot examples. Full retrieval system (`services/exampleLibrary.js` with embedding lookup) is Phase 4, only built once we prove the hardcoded version moves L-tag count from 38 → 70+.

**DO NOW (in order):**
1. ⏳ Add 8-10 examples from `notes-paper-rodina-example.md` to `prompts/span-generation-full.txt` and `prompts/span-generation-short.txt`
2. ⏳ Regenerate Rodina spans (`generateSpansForBook(rodinaId)`) — target: **70+ L-tags** (currently 38)
3. ⏳ Implement direction reversal in `services/noteIngestionService.js matchNotesToSourceBooks`
4. ⏳ User re-uploads Lagrangians notes with toggle ON
5. ⏳ Run notes→paper funnel via kebab → "Link to source book"
6. ⏳ Score against the 81-item benchmark in `notes-paper-rodina-example.md`

---

## 🔥 High priority — fires

- [ ] 🟡 **Notes-rewrite prompt-cache miss (new 2026-04-13).** The `notes-rewrite.txt` system prompt is ~600 tokens, below Anthropic's 1024-token cache minimum, so `cache_control: ephemeral` is silently ignored. Live batch on the Lagrangians book confirms `cache_read_input_tokens=0` and `cache_creation_input_tokens=0` on every call. The Opus/Sonnet routing lever IS working (most prereq pages routed to Sonnet 4.6, expected ~5x cost reduction vs Opus-only) but the caching lever is not. **Fix options (in order of preference):** (a) pad the system prompt to >1024 tokens with stricter citation + LaTeX rules — probably improves quality too; (b) move the cache boundary to a big cached user block containing the rules + a stable top-100-Rodina-chunks ground_truth dump; (c) accept the miss and rely on routing alone. File: `prompts/notes-rewrite.txt` + `scripts/rewrite-notes-pages-batch.js` rewriteOnePage(). Verify with a 3-page test batch — look for `cr>0` on calls 2 and 3.

- [ ] 🟡 **Chunk / span / embedding / edge generation for 33 newly-filled pages (new 2026-04-13).** `fill-missing-pages.js` added Page documents with htmlContent + rawText for the 33 pages that the original vision burst dropped on the Lagrangians notes book (`69d9ce81aa83b8b11c1837dd`). The Phase 2 pipeline has not been re-run on that book, so those 33 pages have no chunks, no spans, no embeddings, and no note-citation edges into Rodina. Action: `node -e "require('./services/spanService').generateSpansForBook('69d9ce81aa83b8b11c1837dd')"` then re-run `noteIngestionService.matchNotesToSourceBooks` to populate the new edges. Will meaningfully change the edge count and the rewrite-pipeline retrieval quality for future re-runs.

- [ ] 🟡 **Verify Opus-routed rewrite pages actually emit `[[cite]]` tags (new 2026-04-13).** The Opus/Sonnet router promotes pages with Rodina-native vocabulary (BCFW, Tr(φ³), amplitude, etc.) to Opus. Those pages SHOULD be where real citations land, since they're the bridge pages the router thinks matter. Need to eyeball pages 18, 20, 24 (or whatever Opus-routed set the batch produced) in the rewrite preview once batch `bqbzu9v9v` completes. If those pages still emit zero citations, the bottleneck is retrieval quality (top-12 Rodina chunks aren't finding the matching passages) not the model.

- [ ] 🟡 **Fix 2: Rodina p1 candidate-pool exclusion (Root cause #2).** CODE COMPLETE, AWAITING QUOTA RE-RUN. Fraction-threshold bib-page detector (60%) now in `services/funnelService.js resolveSpanThroughFunnel` + `services/noteIngestionService.js matchNotesToSourceBooks`. Data-level validation (no API): Rodina p1 is 2/22 = 9% bib-like under the new rule (kept, including `[definition] lagrangian_formalism`), p8 = 75% (correctly excluded), p9 = 100% (correctly excluded). Pre-patch single-chunk rule nuked all of p1. Run `scripts/score_benchmark.js` after the next quota-restored match pass; expected Tier B jump 62 → 71-73.

- [ ] 🟡 **Fix 3: Notes-source relationship prompt collapse (Root cause #3).** CODE COMPLETE, AWAITING QUOTA RE-RUN. `prompts/edge-pick.txt` now has a "NOTES-SOURCE SPECIAL RULE" section forbidding `n` (annotates) and mapping target-chunk structural type → relationship letter: `[definition]`→`d` (uses_definition), `[theorem]`/`[proof]`→`p` (proves), `[narrative]`/`[example]`→`r` (prerequisite), with `m` for explicit missing-proof gaps and `s` as fallback. `services/funnelService.js pickAndClassify` injects `SOURCE_KIND: notes` and the rule text only when `sourceBook.kind === 'notes'`. Decoder (`funnelService.decodePickVerdict` → `compressionService.letterToRelationship`) already accepts all 5 letters. Expected Tier C jump 20 → 50+ once the match re-runs under the new prompt.

- [ ] 🟡 **Notes vision quality loop spec (v2 pipeline) needs 8 open-question answers before build.** File: `reports/Notes rewrite and vision/notes-vision-quality-loop-spec.md §14`. Pipeline shape: Opus vision LaTeX-first → Puppeteer render → Sonnet judge → critique-retry until accuracy ≥0.95 or 3 attempts. Questions include Puppeteer vs mathjax-node for rendering, Sonnet vs Opus for judge, whole-book first-attempt fallback on token truncation, best-effort accuracy floor, kebab wording, force-accept per-page flag, reuse existing PNGs. Spec is buildable once answered. Target pain: handwritten notes black-box equation wrappers + every-equation-on-its-own-line failure mode.

- [ ] 🟡 **Figure judge loop v2 open questions.** Current v1 loop ships at Rodina avg score 84 (p2:92 / p4:72 / p7f1:90 / p7f2:82). Two refinements under consideration, awaiting Jony sign-off:
  1. **Re-calibrate judge prompt** to reward monotonic improvement — when a previous iteration had 9 lines of body text above and the current has 4, score should rise (p4 failure mode: scores flat at 72 despite objective progress). File: `services/figureJudge.js SYSTEM_PROMPT`.
  2. **Ship-last-if-monotonic** — if the verdict trail shows `extra_lines_above` decreasing across attempts, ship the LAST crop instead of the max-score crop. Replaces "trust the score" with "trust the trajectory." File: `services/figureService.js cropWithJudgeLoop()` best-rect selection.
  Either should push p4 to 85+ without new architecture. Spec: `reports/Notes rewrite and vision/figure-judge-loop-spec.md`.

- [ ] 🟡 **Figure bbox bottom-leak on complex multi-diagram figures (partial, may be resolved).** Prompt v2 (commit `b8f763b`) + pdfjs-derived bottom-anchor (`6122481`) + strict-column search (`0ea61c3`) + judge loop (`957da30`) stack together to fix most Rodina cases. Still worth verifying on longer Rodina (58-page) S₁/S₂ appendix figures. Run `FIGURE_JUDGE=1 node scripts/reprocess-figures.js 69d6622b12ac83f9752b4ca9 all-with-figs` and eyeball results before archiving.

- [ ] 🟡 **Page 8 FIG. 4 (neighbor diagrams) produces no bbox.** Historically vision declined to localize under the old prompt and fell back per the "If you genuinely cannot localize, omit data-bbox" escape hatch. Recent judge-loop runs on short Rodina have produced bboxes for all figures; verify the issue is resolved in a full reprocess.

- [ ] **Chat persistence bug: 2 replies but only 1 saved.** Chats `69d94830...` and `69d9489c...` each persisted only 1 assistant message even though the user got two AI replies. The "Continue" / regenerate path is dropping the second response. Investigate `app.post '/api/chat/:chatId/respond'` and `app.post '/api/chat/:chatId/message'` in `server.js`, plus the streaming-completion handler in `services/claudeService.js streamResponse()`.

- [ ] **Stale agenda job watchdog.** Books stuck at processingProgress=25% after computer sleep have no auto-recovery. Manual "Resume / reprocess" kebab works (`controllers/booksController.js` + `views/files.ejs`) but should auto-fire on stuck state. Action: add a periodic check in `services/jobService.js` that finds Jobs in 'running' state with `startedAt > 30 min ago` and either marks them failed or re-enqueues them.

- [ ] **Highlight → metadata panel: resolve concept to span (data half).** Jony selected "BCFW shift" in Rodina abstract, clicked metadata, got "no metadata generated for this passage". Root cause is the panel does exact text/offset matching, not concept-normalized lookup. The data-quality half is span concept normalization at ingestion time so future highlights find a match. UI half lives in `ui-to-do.md`. Files: `services/taxonomyService.js`, `services/spanService.js`.

---

## 🛠 Medium priority — edges / models / picker

- [ ] **Edge false-positive filter.** Waiting for real test data from a post-`c0a8284` chat. Once user reports actual false positives in a fresh chat (not the hallucinated ones from `69d94d05`), tighten `services/edgeResolverService.js findBestTargetChunk()` floor logic at line ~280.

- [ ] **Marginal edge confidence demotion.** Edges where overlap=1 AND text-keyword bonus is the dominant score component should be demoted to confidence `j` or lower. Same file as above.

- [ ] **Picker model upgrade if mini keeps misfiring after rejection + page context + cosine floor.** Current picker: `gpt-4o-mini` via `EDGE_PICKER_MODEL`. If the post-2026-04-11-late run still shows classical-mechanics notes landing on amplitude proofs or `rodina p7 i104`-style magnet chunks hoarding edges, swap to the latest flagship ChatGPT model (e.g. `gpt-5-mini` or `gpt-5` — check OpenAI pricing/TPM tradeoffs at that time). Env var is the only change: `EDGE_PICKER_MODEL=<newmodel>`. A/B against `scripts/score_benchmark.js` before committing.

---

## 🏗 Architecture / Phase 3 (queued for the next big build)

- [ ] **Raw LLM line storage for audit / replay.** Currently we store materialized chunks/spans (the substituted long-form data). User wants the RAW LLM output lines preserved so if quality regresses we can re-derive the chunks deterministically without re-running the LLM. Schema: new collection `LLMOutput` with fields `bookId`, `pageNumber`, `chunkIndex`, `model`, `promptHash`, `outputLines: [String]`, `timestamp`. The chunk/span derivation becomes a pure function of the raw output. At chat time, the renderer substitutes the raw output back into long-form using the local IDs. Storage win: ~10x reduction (raw is ~30 tokens per chunk vs ~200-500 tokens per materialized chunk). Files: new `models/LLMOutput.js`, modifications to `services/spanService.js` to log outputs, modifications to `services/chunkService.js` to derive chunks lazily.

- [ ] **Token-substring rule for raw tag overlap (lexical resolver only — funnel handles this via embeddings).** The funnel in `services/funnelService.js` already bridges `mnlsm` ↔ `nlsm` via cosine similarity, but the legacy `services/edgeResolverService.js` lexical resolver still has the gap. Add a 4-char substring overlap check there if we keep the lexical pathway around. Otherwise just retire the lexical resolver once the funnel is the default for all chats.

- [ ] **Quality judge for tags + edges.** Periodic Opus call that samples N chunks/edges and rates quality on the a-z scale. Below threshold → trigger re-ingestion. Already specified in `config/pipeline.js` (`JUDGE_MODEL`, `JUDGE_SAMPLE_RATE`, `JUDGE_RESET_THRESHOLD`) but no service implements it. New file: `services/judgeService.js`.

- [ ] **Funnel auditor pass on top-3 verdicts.** GPT-4o picker is fast/cheap but occasionally picks a section narrative chunk over a more bullseye theorem/remark chunk (Edge 1 conjecture: should be Book 2 p49 ansatz remark, GPT-4o picked p3 narrative). Add an optional Opus auditor that re-classifies the top-3 GPT-4o picks for high-stakes chats. Files: `services/funnelService.js` — add a `useAuditor: true` opt that runs Opus on the top-3, picks the highest combined score.

- [ ] **Switch chats to use funnel edges instead of lexical edges.** Currently the chat's `cross_book_edges` block in `services/claudeService.js getAllCrossBookEdges()` reads ALL edges (`method: any`). The funnel writes `method='llm'` and the lexical resolver writes `method='lexical'`. Right now both show up. Decision needed: prefer LLM edges, or merge by source span (LLM wins where both exist), or surface both kinds in the chat with a method tag. File: `services/claudeService.js getAllCrossBookEdges()`.

- [ ] **Hard 26-chunk session cap for chunk-index alphabetic encoding (per user idea).** The compression service already supports `a..z` indexing, but the funnel passes up to 12 candidates per call. Bump to 25 (the full a..y range, leaving z for safety) once the picker prompt is robust enough. Document in `Vision.md` and the prompt files.

---

## 📋 Low priority — features and polish

- [ ] **Process geometric-background through span pipeline.** Resume worked (book is at 80/80 pages) but no spans/chunks/embeddings yet, so G/W [31] still has no body target. Action: `node -e "require('./services/spanService').generateSpansForBook('69d8d5c796edcecf348ff519')"`. Will auto-trigger note re-matching via the post-chain in `services/spanService.js generateSpansForBook` (added in 8f8a7b7).

- [ ] **Notes ingestion live test.** Backend ready (`services/noteIngestionService.js`). Action: upload one of the 50 PDFs in `Hidden Zero Personal Notes/`, link to Rodina via the new "Link to source book" kebab item (added 8f8a7b7), verify the alert reports a reasonable edge count.

- [ ] **Upload speed.** Vision pipeline takes 10-30 min for a 60-page book. Target: pre-render all PNGs in parallel via Swift, then send all vision requests through a 60 RPM rate-limited queue. Current code: `services/visionService.js renderPageToImage()` and the batching loop in `services/spanService.js`.

- [ ] **arXiv crawler.** Crawl referenced papers from cited bib entries in `Book.bibEntries[]`. Activate from inside a collection.

- [ ] **Multi-tier prompt system.** User has examples to share. Current single-tier: `prompts/span-generation-full.txt` and `prompts/span-generation-short.txt`.

---

## ✅ Recently shipped (move here once stable, then prune after a few sessions)

- ✅ **Figure judge loop v1 + decay amplifier + asymmetric clamp + floor guard** (`957da30`, `8d62448`, 2026-04-14). Sonnet 4.6 vision judge critiques each crop with structured JSON (`extra_lines_above/below`, `clipped_above/below`, `extra_px_left/right`, `score`), deterministic delta-application loop refines the rectangle up to 3 iterations, decaying amplifier [2.5x, 1.5x, 1.0x] across attempts, shrink cap 40% / grow cap 50%, min 60px floor guard. Env-gated behind `FIGURE_JUDGE=1`. Rodina avg score 84 on 4 figures, one correctly-abandoned hallucinated bbox.

- ✅ **Silent-page-drop auto-recovery** (`9f7009e`, 2026-04-13). Lagrangians notes book had pageCount=65 but only 32 Page docs in Mongo because the original parallel vision burst saturated gpt-4o TPM (30k/min), pages 27-65 hit 429s that were logged to ErrorLog but never retried. Two-part fix: (a) one-shot repair script `scripts/fill-missing-pages.js` that serially re-runs vision on every `page-N.png` that has no Page record — ran in 350s, 33/33 repaired; (b) permanent `reconcilePages()` helper in `services/jobService.js` that runs at the end of the `generate-html` job right before the book transitions to status='ready'. Future uploads self-heal.

- ✅ **Fix 1: Reprocess 24 empty notes pages from 429 TPM.** Done 2026-04-11. Vision 24/24 in 248s, spans 967, chunks 643 (up from 406), 638 notes→Rodina edges (up from 265). Tier B 52/81 → **62/81 = 76.5%** (+12.3 pts), Tier C unchanged at 20/81 (blocked by Fix 3).

- ✅ **Notes-rewrite pipeline v1** (`9f7009e`, 2026-04-13) — new `prompts/notes-rewrite.txt`, `scripts/rewrite-notes-page.js` (iterate), `scripts/rewrite-notes-pages-batch.js` (batch with Opus/Sonnet routing on Rodina-native vocab). Pivots notes ingestion from "transcribe page verbatim" to "rewrite page in Rodina's voice with grounded citations". First page 1 preview rendered cleanly with reorganized Lagrangian→EL→Noether→functionals→field-theory flow. Full 65-page batch ran in 32m 52s at $7.01 total.

- ✅ **Phase 3 funnel: embeddings + cosine + GPT-4o pickAndClassify** (`9de7d57`) — `services/funnelService.js`, `services/compressionService.js`, `prompts/edge-pick.txt`. 18 LLM edges with real relationship type variety (proves 2, assumes 15, equivalent 1). Edges 3, 10, 12 all fixed.

- ✅ **Edge resolver: typeBoost gating + direct-tag-string match bonus** (`41df88d`) — Lexical resolver: 13 edges, 12/13 correct = 92%.

- ✅ **Edge dedup + anti-hallucination rule** (`c0a8284`) — 16 → 15 edges, 0 duplicates remaining; BASE_PROMPT now forbids inventing bookIds.

- ✅ **Cross-book edges high-priority block in chat** (`842796f`) — fixes the hallucination root cause; AI now sees all real edges in `<cross_book_edges>` regardless of per-book metadata truncation.

- ✅ **Notes ingestion backend** (`8f8a7b7`) — `services/noteIngestionService.js`, `Book.kind`/`linkedBookIds`, kebab "Link to source book".

- ✅ **Synonym normalization layer** (`52431c5`) — `services/taxonomyService.js`, concept-based tag matching.

- ✅ **Bibliography column-aware extraction** (`a7102ed`) — pdfjs-dist replaces pdf-parse for 2-column bib pages.
