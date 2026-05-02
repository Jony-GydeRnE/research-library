# 2× Metadata + Edge Quality — Plan

**Date:** 2026-05-01
**Author:** CC, in response to Jony's "we need it to be 200% better"
**Companion to:** `reports/2026-05-01/session-catchup-and-recommendation.md` (the macro picture) and `Vision/Updates:read-me:to-dos/ai-to-do.md` (the executive list).

---

## The honest framing

Current quality is invisible. We have one benchmark (Rodina, 81 items, Tier B 67.9% / Tier C 24.7%). We have no tag-level ground truth, no edge-precision audit, no calibration check on confidence letters, no judge model actually running (the file `prompts/judge-rating.txt` is a 4-line placeholder). The span-generation prompt is already rich (`prompts/span-generation-full.txt` — `:=` rules, decomposition rules, Ld/Lv/Lp typed gaps, role disambiguation, ~15 worked examples). The funnel is at ~92–94% precision. So the system is **not bad**. It is **uninstrumented**. You cannot 2× something you cannot measure on enough axes to know which knob to turn.

So step 1 of "200% better" is **establish a real baseline along multiple axes**. Step 2 is the loops that move each axis. The five tracks below are the moves I think actually matter, ordered by leverage.

---

## What "200% better" should mean, concretely

We commit to baselines and 2× targets across six axes. Numbers below are placeholders until the baseline run executes.

| Axis | What it measures | Baseline (today) | 2× target |
|---|---|---|---|
| **Tier B (Rodina benchmark)** | exact target page hit, ±2 source window, any relationship | 67.9% (post topology shift; was 76.5% pre-regen) | **90%+** |
| **Tier C (Rodina benchmark)** | strict + non-`annotates` relationship | 24.7% (Fix 3 not yet validated post-quota) | **60%+** |
| **Edge precision (sampled)** | random sample of N=200 edges, manually rated correct vs wrong | unmeasured (estimated 92% from old funnel sample of 13) | **≥96% on rated sample** |
| **Tag specificity score (judge)** | judge model rates N=50 random chunks 0–9 against rubric | unmeasured (judge not running) | **mean ≥7, p10 ≥5** |
| **Coverage** | % chunks with ≥1 outgoing edge; % L-tagged chunks with matching note | partially measured | **80% chunks with edges; 60% L-tags matched** |
| **Synonym collapse rate** | % surface forms that resolve to a non-trivial canonical | partially measured | **≥85% of high-frequency surface forms hit a canonical** |

A 2× target is meaningful only when all six are reported together — moving Tier B to 90% is pointless if it tanks edge precision.

---

## Track 1 — Close the measurement gap (1 session)

This is the foundation for everything else. Without it, we are guessing.

**1.1 Populate `prompts/judge-rating.txt`.** Six-axis rubric, each 0–3:
- Tag specificity (broad-topic flag vs concept-level)
- Tag normalization (uses canonical form vs surface drift)
- Role accuracy (definition vs background vs claim, with the `:=` rule respected)
- Gap detection (Ld/Lv/Lp coverage on substantive unjustified claims)
- Declarative-tag precision (no false p/q/r/s on tangentially-related targets)
- Search-class accuracy (S without suffix, L/I/B with suffix, no spurious B on cited claims)

Total: 0–18. Map to 0–9 for compatibility with `config/pipeline.js qualityThreshold`.

**1.2 Build `services/judgeService.js`.** Already specified in `ai-to-do.md` as "Quality judge for tags + edges." Sample N=50 chunks per book per week (or on every ingestion), score against the rubric, write to a new `QualityScore` document (model already exists in `models/QualityScore.js`). Trigger session-prompt re-injection when book mean drops below threshold (already specified in pipeline.js).

**1.3 Build the Quality Dashboard.** A new EJS page (`views/admin/quality.ejs`, route `/admin/quality`) that surfaces:
- Per-book: chunk count, span count, edge count (incoming / outgoing), L-tag count, mean judge score, last sample date
- Library-wide histograms: tag frequency (Pareto curve), edge confidence distribution (a–z), relationship-type distribution (proves / assumes / etc), L-tag type distribution (Ld / Lv / Lp)
- "Dead vocabulary" — tags appearing on >5 chunks with 0 outgoing edges
- "Suspicious chunks" — high cosine to a canonical concept they don't tag (>0.85 to a known canonical's mean embedding, but no such tag on this chunk)
- "Hub concepts" — tags participating in >20 edges (load-bearing — invest tagging effort here)
- Judge score time series per book
- Benchmark history per saved benchmark file

Mostly Mongo aggregations. ~250 lines new code, no new infrastructure.

**1.4 Edge precision audit script.** `scripts/audit-edges.js`: sample N=200 random edges stratified by relationship type and confidence bucket, write each as a `(source_chunk, target_chunk, claimed_relationship, claimed_confidence)` row to a CSV. Opus reads each row, returns `correct | borderline | wrong + reason`. Compute precision per bucket. ~$1.50 per audit. Repeatable monthly.

**Pass criteria for Track 1:** the dashboard renders the six axes from real data, judge has scored ≥3 books, edge audit has rated ≥200 edges with bucket-level precision broken out.

---

## Track 2 — Close the feedback loop (1 session)

Once we measure, we feed observed errors back into the prompts and the data.

**2.1 Failure mining from the 81-item benchmark.** The 25 PARTIAL + WRONG_TARGET cases are existing labeled negative examples. For each: extract the (notes chunk, expected Rodina chunk, actual Rodina chunk hit) triple. Rewrite as a few-shot in `prompts/edge-pick.txt` with the format "Given source chunk X and these candidates, pick Y, NOT Z, because [reason]." This is a one-time injection of 25 hard cases that the picker has historically gotten wrong.

**2.2 Round-trip validation.** For each existing edge: hide the relationship letter, prompt LLM "given these two chunks, what relationship?" — measure agreement with original. Edges where round-trip disagrees are flagged for human review (or auto-demoted by 2 confidence letters). Output: a "stale edges" page in the admin dashboard.

**2.3 Promote successful patterns into the prompt.** When the judge or audit finds a pattern of correct calls (e.g., the recently-shipped `:=` rule catches 95% of definitions in handwritten notes), explicitly cite that as a positive example in the prompt. The prompt already has worked examples; we just keep adding the proven-effective ones.

**2.4 Auto-promote vibes.** From the agent vision: when a new book is ingested, every open vibe is re-checked against the new graph. Build a sweep job (`services/vibeSweepService.js` — TBD scaffolding) that runs after every ingestion. Out of scope for v1, but worth designing the data model now so vibes start being collected from Phase B forward.

---

## Track 3 — Discover hidden quality issues (1 session)

These are scans that surface defects the current pipeline cannot see.

**3.1 Embedding-based tag drift detector.** For each pair of tags (T1, T2): compute mean cosine of chunks tagged T1 vs T2. If mean cosine > 0.85 and no taxonomy entry collapses them → propose merge (write to a `TaxonomyProposal` queue). Human approves in the dashboard. ~30 minutes of human review per scan.

**3.2 Dead vocabulary report.** Tags appearing on >5 chunks with 0 outgoing edges. Either: (a) backfill edges (run funnel against likely targets), (b) merge into an existing canonical, or (c) demote to "topic" rather than "concept" (stop using as edge anchor).

**3.3 Coverage gap report.** For each book: list of L-tagged spans with no matching note across the entire library. These are the prioritized targets for the crawler / for "missing knowledge" reporting.

**3.4 Citation-resolution tracker.** Per `JONY MUST READ EDIT` in `ai-to-do.md`: every citation in any book should auto-create an edge to a chunk OR a null Book record. Today this is not implemented end-to-end. Track:
- Citations detected
- Citations resolved to a real chunk in-library
- Citations parked as null Book metadata
- Citations dropped (orphan, no metadata)

Goal: zero in the "dropped" bucket.

---

## Track 4 — Multi-pass + ensemble (1 session)

Spending more compute per chunk where it matters.

**4.1 Two-pass span generation.** First pass: cheap (current single Opus/GPT-4o call). Judge samples 1 in 10. If score < 7: second pass with the first-pass output AND the critique injected. Same architecture as the figure judge loop already shipped (`services/figureService.js cropWithJudgeLoop`). Reuses the judge-rating prompt from Track 1.1.

**4.2 Ensemble picker for high-stakes edges.** Edges flagged "high stakes" (book pair is project-pinned, source span has L-tag confidence ≥ s, or target chunk is a hub concept with >20 edges) get a second picker call from a different model (e.g., gpt-4o-mini AND Sonnet 4.6). Only ship if both agree. Trades ~50% recall for ~+3 pp precision on the high-stakes subset.

**4.3 Opus auditor on top-3 picks.** Already in `ai-to-do.md` as a queued architecture item. The picker returns top-3 candidates; Opus rates each in detail and selects. ~$0.005 per audit. Activate selectively (high-stakes edges, or low-confidence picks).

---

## Track 5 — Graph-level checks (½ session)

Properties of the global graph that aren't visible chunk-by-chunk.

**5.1 Confidence calibration.** Bucket edges by reported confidence letter (a–z). For each bucket, compute precision from the audit (Track 1.4). Ideal: bucket means align with the letter's nominal probability (a≈4%, z≈100%). If `Yz` edges are 96% correct but `Yp` edges are 89% correct, the picker is roughly calibrated. If `Yp` edges are 60% correct, the picker is overconfident at mid-range and needs prompt adjustment.

**5.2 Inferential-distance probes.** For pairs of concepts a domain expert says are "1 hop apart" (e.g., `bcfw_shift` and `bcfw_recursion_relation`, `factorization_residues` and `unitarity`), compute graph distance. If actual graph distance > 2, the graph is missing direct edges. Backfill via funnel or surface as candidates.

**5.3 Cut-set / chokepoint analysis.** From the philosopher-agent doc: nodes through which many paths must pass. Compute betweenness centrality on the edge graph. Top-20 betweenness chunks are the "load-bearing" concepts of the library — those deserve the deepest quality investment (best tags, most curated edges, highest-confidence canonical definitions).

---

## Track 6 — Rodina + nuclear cross-domain validation (1 session, after others)

The 200% target is meaningful only if it generalizes beyond the corpus we tuned on.

**6.1 Hold out 1–2 Rodina notes (e.g. files 16, 17, 18 — the new ones).** Don't use them in any prompt-tuning. Once Tracks 1–5 are running, ingest them and measure how the dashboard scores them out-of-the-box. Fresh-eyes test.

**6.2 Seed 5–10 nuclear anchor docs** in a separate collection. Run the same pipeline. Measure: tag specificity (does the model invent reasonable nuclear-engineering tags?), role-tag accuracy (does it correctly identify regulatory `shall` / `should` / `may` modalities, design-basis events, etc.?), edge precision on the cross-document edges. If tag quality drops sharply on nuclear vs physics, we need a per-domain taxonomy seed (Track 6.3).

**6.3 Per-domain taxonomy seeds.** Curated starter dictionary per domain: physics already has one in `models/CanonicalDefinition` (~250 concepts). Nuclear seed: NRC glossary + 10 CFR chapter titles + ASME III headings (~100 concepts). Business seed: case-study-style concept set TBD.

---

## What this means for the executive to-do

The TOP of the executive list becomes "Tracks 1 + 2 first," not "Phase A flip first." Reasoning: Phase A traversing a low-quality graph amplifies bad edges and builds user trust on false paths. Once Tracks 1 + 2 are running, we have:
- A judge scoring metadata weekly
- An edge-precision audit script
- A quality dashboard surfacing six axes
- Failure mining feeding back into prompts

Then we flip Phase A on the Rodina collection. The agent's surfaced paths become the highest-bar quality test (did this path actually answer the question?). That signal feeds Track 1 / 2 too.

---

## Cost estimate

Per session:
- Track 1: ~$5 in judge sampling + audit run (200 edges × $0.025 ≈ $5)
- Track 2: $0 (in-prompt + re-running existing pipelines)
- Track 3: ~$2 for embedding-based scans (mostly local)
- Track 4: variable per chunk, conservatively +30% on Phase 2 ingestion cost
- Track 5: $0 (graph algorithms over MongoDB)
- Track 6: ~$15 (full nuclear seed ingestion at 5–10 docs)

Total to establish baseline + first 2× pass: **≤$50**. Rounds to zero.

---

## What I am NOT proposing

- A new model. Same Claude / GPT models, same embedding model. Quality wins come from feedback loops, not model swaps.
- A schema migration. Existing models (`Chunk`, `Span`, `Edge`, `QualityScore`, `CanonicalDefinition`) cover everything. Maybe one new collection for `TaxonomyProposal` and one for `EdgeAudit`.
- Rebuilding the funnel. The funnel is fine. We're auditing its output and feeding the failures back, not replacing it.
- Manual review at scale. Human review is reserved for the dashboard's flagged items (suspicious chunks, taxonomy proposals, low-confidence edges) — maybe 15 min/day max.

---

## The honest answer to "how do we know our tags are good?"

We don't, today. The judge isn't running. The prompt is good in the abstract but no per-chunk rating pipes back into a quality score. After Track 1 ships, "good" is defined by:

1. Mean judge score per book (≥ 7 / 9 = good).
2. Edge-audit precision per confidence bucket (matching nominal letter probability).
3. Coverage (≥ 80% chunks with edges, ≥ 60% L-tags matched to notes).
4. Synonym collapse rate (≥ 85% high-frequency surface forms canonicalized).
5. Tier B / C benchmark on Rodina (and eventually a sister benchmark on nuclear).
6. Inferential-distance probes on hand-labeled "should be 1 hop apart" pairs.

If any of these slip below threshold, the dashboard surfaces it and Track 2's feedback loop responds. **That is the closed-loop quality system.** No closed loop = no measurable quality. The 200% number lives or dies on whether this loop runs.
