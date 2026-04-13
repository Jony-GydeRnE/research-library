# Data Quality — Focus for this session

Written 2026-04-13. **This is the working list for the data-quality-focused session.** UI / images / chat-UX items are deliberately excluded — they are logged in `Vision/Updates:read-me:to-dos/to-do.md` under the "UI / Images session bucket". The two sessions run in parallel on the same repo; data-quality work must stay concept-focused and avoid touching rendering / reader / split-screen code.

The foundational principle guiding everything below:

> **The same concept produces the same span metadata anywhere it appears.**
>
> "BCFW shift", "BCFW shifts", "Britto-Cachazo-Feng-Witten shifts", "the BCFW shifts" — all resolve to ONE canonical span record with ONE set of tags, ONE definition edge, ONE pointer to whichever chunk (notes or paper) authoritatively defines it. Highlight any surface form anywhere in the library → see the same metadata. That is the foundational layer. Context nuances are a layer on top.

---

## The single test that defines "done"

Highlight "BCFW shift" in the Rodina abstract. Click metadata. Expect to see:
1. ✅ The concept recognized as a span
2. ✅ `definition` role or `Ld` gap marker
3. ✅ At least one `uses_definition` edge pointing to Jony's Lagrangians notes where BCFW is defined (via `:=` or prose definition)
4. ✅ The definition text rendered FROM the scroll/HTML version of those notes, not from the PDF source (this last bullet is UI work — excluded from this session but tracked so the data plumbing supports it)

Every item in §1 below removes one reason the test currently fails.

---

## §1. Priority ladder — what to do in order

### 🔥 P0 — Foundations for the "same span everywhere" principle

#### P0.1 — Synonym-aware canonical definition lookup
**Why.** Diagnosed 2026-04-13 in `reports/Cost analysis/cost-analysis.md` §6.1. `CanonicalDefinition.findOne({ concept: tag })` does exact string matching. `taxonomyService.areSynonyms('bcfw_shifts', 'bcfw_shift')` returns `true` — the synonym infrastructure exists. It just isn't wired into the canonical lookup.

**Fix** (~30 lines in `services/canonicalDefinitionService.js`):
- On BUILD: before inserting a `CanonicalDefinition`, normalize the concept via `taxonomyService.normalize()` so all synonyms collapse to one row.
- On LINK: before `findOne({ concept: tag })`, try `taxonomy.normalize(tag)`; if that misses, walk the taxonomy's synonym list for `tag` and try each.
- Return the first hit. Cache per-lookup within the link sweep so we don't normalize the same tag repeatedly.

**Cost.** $0. Pure DB + in-memory.

**How we know it worked.** Rerun the canonical link sweep library-wide. Expect >300 edges (baseline 754 at exact-match, plus the delta from synonym matches). For chunk #14 specifically: re-check whether `bcfw_shifts`, `non_adjacent_shifts` now have at least one outgoing `uses_definition` edge.

---

#### P0.2 — Regenerate spans on the Lagrangians notes book
**Why.** 33 pages were backfilled on 2026-04-13 by `scripts/fill-missing-pages.js` but span generation was never re-run. Those 33 pages have Page docs + htmlContent + rawText but zero spans, zero concept tags, zero participation in the edge graph. Until they do, `bcfw_shifts` / `hidden_zeros` / `non_adjacent_shifts` can never be canonicalized from the notes — the source material doesn't exist at the span layer.

**Fix** (one command):
```bash
node -e "require('./services/spanService').generateSpansForBook('69d9ce81aa83b8b11c1837dd').then(r => console.log(r))"
```

**Cost.** ~$0.52 at GPT-4o span-gen rates. 65 pages.

**Dependencies.** None. Can run in parallel with anything else.

**After this runs.** The notes book should have ~900-1200 spans (up from 967 at last count but spread across 41 pages instead of 65). Re-run P0.1's canonical link phase to pick up the new definition-tagged spans.

---

#### P0.3 — `:=` definition detector for notes
**Why.** Jony explicitly flagged this: "in notes, we must look for `:=` cuz colon equal means definition". Handwritten mathematical notes use `:=` as the canonical "is defined as" operator, and the current span prompt doesn't treat it specially. Result: Jony's notes DO contain `BCFW shift := p_i → p_i + zq, p_j → p_j - zq` (or similar) somewhere, but because the prompt sees it as "equation" not "definition", it gets role `equation` or `background` instead of `definition`, and the canonical lookup never picks it up as the definition chunk.

**Fix.** Two parts:
1. **Prompt edit** in `prompts/span-generation-full.txt` and `prompts/span-generation-short.txt`: add a rule under ROLE DISAMBIGUATION — "Any sentence containing `:=` or `\equiv` or `\mathrel{\mathop:}=` is a DEFINITION. Role = `definition`. Extract the left-hand side as the context tag. Example: `BCFW shift := p_i + zq` → role=definition, contextTag=bcfw_shift."
2. **Post-processing backfill** in `services/canonicalDefinitionService.js`: during the build sweep, if a span's `spanText` contains `:=` AND the span's role is not already `definition`, upgrade it at BUILD TIME (don't mutate the span — just add it as a tier-0 candidate for canonical extraction). This catches notes that were already ingested under the old prompt without needing a full regeneration.

**Cost.** $0 for the backfill. The prompt change only affects future regenerations.

---

#### P0.4 — Run the first quality sweep pass on Rodina
**Why.** The sweep exists (`scripts/sweep-book.js`) and has been validated on a single chunk. Needs a full-book run to find all 31 Pattern 1 / 7 Pattern 2 / 1 Pattern 3 bad chunks and produce the surgical repairs. Until it runs, all the other work is theoretical — we don't know the actual distribution of bad-chunk outcomes, can't tune prompts on real failures, and can't measure the lift on the benchmark.

**Fix.**
```bash
# first the free dry-run to confirm candidate counts are stable
node scripts/sweep-book.js --book 69d5dd60c826b8392d57012d --detect-only

# then a capped run to spot-check outputs live before committing
node scripts/sweep-book.js --book 69d5dd60c826b8392d57012d --limit 5

# if spot-check looks good, full sweep
node scripts/sweep-book.js --book 69d5dd60c826b8392d57012d
```

**Cost.** Full Rodina sweep estimate: **~$1.05**. The `--limit 5` probe is ~$0.15.

**Dependencies.** Should run AFTER P0.1 (synonym lookup) so the canonical piggyback in the sweep actually finds matches. Can run BEFORE or AFTER P0.2 — doesn't depend on notes spans. Should run before P0.3 or afterward either is fine.

**After this runs.** Inspect the QualitySweepJob row for the stats block. Expect Pattern 1 to produce 5x span count on ~20-30 chunks. Expect canonical hits to jump from 1 (chunk #14 baseline) to dozens. Expect `Book.missingDefinitions` to accumulate ~30-50 new crawler-target concepts that aren't yet defined anywhere.

---

### 🟡 P1 — The "span once, same metadata everywhere" mechanism (new concept)

#### P1.1 — `ConceptSpan` collection — a normalized span catalog
**Why.** Right now every appearance of BCFW shift in Rodina produces a NEW `Span` document with its own ObjectId. Every appearance in the notes produces another. The edge graph tries to glue them together via the funnel but it's O(N²) matching and still produces per-instance spans with potentially-divergent tags. The user's insight is to stop per-instance span creation for repeat concepts and introduce a concept-level layer above Span:

```
ConceptSpan { concept: String (canonical), canonicalChunkId: ObjectId,
              definitionSpanId: ObjectId, tags: [String], gapType: String,
              description: String, createdAt: Date, updatedAt: Date }
```

Each `Span` document then carries a `conceptSpanId` pointing at the concept-level row. When Jony highlights "BCFW shift", the metadata lookup resolves the highlighted text → taxonomy normalize → ConceptSpan → rendered metadata, regardless of WHICH `Span` the user's click happened to hit.

**Fix.** Multi-step, build in order:
1. Schema: new `models/ConceptSpan.js` (~40 lines, nullable on existing Spans). No migration.
2. Service: `services/conceptSpanService.js` with `upsertForConcept(concept, candidateChunk)` that builds a ConceptSpan from the first canonical-definition chunk it sees for that concept (uses P0.1's canonical lookup). Idempotent — re-running replaces the description if a better candidate is found.
3. Span back-link: on ingestion (spanService) and on quality sweep (qualitySweepService), after computing a span's contextTags, call `conceptSpanService.upsertForConcept()` for each tag and set `span.conceptSpanId = <returned row>._id`.
4. Lookup: a new `services/conceptSpanService.resolveFromText(text)` that normalizes the text via `taxonomyService` and returns the best ConceptSpan match. This is the function the metadata panel (UI session) will call.

**Cost.** $0 for the schema + service. Re-running span generation to populate `conceptSpanId` on existing spans is ~$0.52 for notes + ~$2 for the rest of the library (~$2.52 total).

**Alternative (lighter, faster to ship).** Skip the new collection entirely and just add the `resolveFromText()` function that does: (a) taxonomy.normalize(text), (b) `CanonicalDefinition.findOne({ concept })`, (c) return canonical chunk's tags + the definition chunk. This gives us the user-visible behavior without a new schema. The full ConceptSpan collection can come later if the need for per-concept state beyond what CanonicalDefinition provides becomes real.

**Recommendation.** Start with the alternative (cost: $0, maybe 50 lines). Ship it, live-test the highlight flow, then decide whether the fuller ConceptSpan model is needed.

---

#### P1.2 — Highlight-text-to-span resolver (API only — UI wires it up separately)
**Why.** The metadata panel currently does exact-offset matching. Even with ConceptSpan available, the lookup needs to accept a free-form highlighted string. The resolver is pure DB/normalization and lives in the data layer.

**Fix.** New endpoint `GET /api/metadata/resolve?text=<highlighted>` (or add to an existing metadata route). Returns:
```json
{
  "text": "BCFW shift",
  "normalizedConcept": "bcfw_shift",
  "synonyms": ["bcfw_shifts", "britto_cachazo_feng_witten_shifts"],
  "spanCount": 18,       // how many spans carry this concept library-wide
  "canonicalDefinition": { "chunkId", "bookId", "page", "preview", "confidence" },
  "edgesOut": [ ... ],  // ranked edges from any span with this concept
  "edgesIn": [ ... ]
}
```

The endpoint's business logic lives in `services/conceptSpanService.resolveFromText()` from P1.1.

**Cost.** $0. Pure DB.

**Dependencies.** P0.1 (synonym lookup must work), P1.1 (resolveFromText function).

---

### 🟠 P2 — Notes-first edge generation

#### P2.1 — Rewrite-after-metadata ordering for notes
**Why.** Jony's insight: "the LLM that writes the notes should maybe begin to write AFTER the notes are converted to latex (or concurrently), so that the LLM that creates the source notes can see the edges/spans/chunks before they write up the notes and they can 'keep in mind' which parts of the notes are context for which parts of the paper, and 'solve the puzzle' of scattered notes."

Today the order is: rewrite → chunks/spans → edges → (maybe re-rewrite). That means the rewrite LLM operates blind to the graph structure; it guesses which concepts are bridges. A smarter order: vision → spans → chunks → edges → rewrite, so the rewrite sees the full graph of what the page already connects to and produces narrative that explicitly threads those bridges.

**Fix.** Re-order the Agenda job chain in `services/jobService.js` for notes books:
```
Old: vision → html-rewrite → (metadata pipeline: spans → chunks → edges)
New: vision → (metadata pipeline: spans → chunks → edges) → html-rewrite
```

The rewrite prompt gets a new input block called `<existing_graph>` containing: chunk list for this page, edge list for this page, canonical definitions this page's concepts link to. Rewrite is instructed to preserve those bridges in its prose.

**Cost.** No additional API cost — same number of calls, just reordered. Quality upside is the main gain.

**Caveat.** This is a pipeline reorder, not a prompt swap. Test on ONE notes page before re-running on the whole book. Rollback is `git revert`.

---

#### P2.2 — Direction reversal (notes→paper funnel primary) — already decided 2026-04-10
**Why.** Already locked in the existing to-do's "Architecture decisions" section. Paper→notes is open-world search; notes→paper is closed-world (every notes chunk is explaining SOMETHING in the paper, question is which of ~80 paper chunks). Architecture:
- Primary pass: for every notes chunk, funnel against the source paper's chunks. Always produces an edge.
- Secondary pass: for paper L-tagged chunks left UNCOVERED by the primary pass, run paper→notes to try to fill.
- Bonus: the list of paper chunks NO note covers = gaps in understanding = crawler targets.

**Status.** Not yet implemented. File: `services/noteIngestionService.js matchNotesToSourceBooks`.

**Cost.** ~$0.10 per notes upload (down from $0.13 bidirectional).

---

#### P2.3 — Rerun notes→paper funnel on the Lagrangians book
**After P0.2 (span regen) and P2.2 (direction reversal) ship**, rerun the matcher so the 33 previously-blank pages contribute edges.

```bash
node -e "require('./services/noteIngestionService').matchNotesToSourceBooks('69d9ce81aa83b8b11c1837dd').then(r => console.log(JSON.stringify(r.perSourceStats, null, 2)))"
```

**Expected.** Edge count should jump to ~900-1100 (from current 638). Benchmark Tier B should reach ~90+% (from 76.5%). Tier C should reach ~50+% (from 24.7%) — the two blocked Fixes (2 and 3 in the existing to-do) were waiting for this rerun.

---

### 🟢 P3 — Validation + measurement

#### P3.1 — Rerun the 81-item Rodina benchmark
**Why.** Current score: Tier B 62/81 = 76.5%, Tier C 20/81 = 24.7%. Targets from prior decisions: Tier B 70+, Tier C 50+. After P0-P2 ship we need to know whether we hit the targets.

**Fix.**
```bash
TW=0 NW=2 node scripts/score_benchmark.js | head -25
TW=0 NW=2 STRICT_REL=1 node scripts/score_benchmark.js | head -25
```

Save to `reports/2026-04-13/benchmark-after-quality-sweep.md`.

**Cost.** $0. Pure local.

---

#### P3.2 — Highlight-metadata end-to-end test
**The foundational test from the top of this doc.** After everything above ships:
1. Open Rodina in the reader
2. Highlight "BCFW shift" in the abstract
3. Click metadata (once the UI session wires up the resolver)
4. See: role `definition`, at least one `uses_definition` edge, target a notes page, preview of the definition text.

If any of those four items is missing, go back to §1 and identify the gap. The test is binary — pass or fail, nothing in between.

---

### 🔵 P4 — Deferred until P0-P3 prove out (backlog)

These are the items that might matter but shouldn't compete with P0-P3 this session.

- **Full ConceptSpan collection** (vs the lightweight resolver from P1.1 alternative) — build if the lightweight version isn't enough.
- **Raw LLM line storage** for deterministic chunk re-derivation (existing to-do, architecture item).
- **Quality judge service** — the periodic Opus sampling that's been in `config/pipeline.js` for a while but never implemented.
- **Funnel auditor pass on top-3 verdicts** — existing to-do.
- **Picker model upgrade** — swap `gpt-4o-mini` for flagship if the post-sweep benchmark still shows misfires.
- **Prompt caching on the quality sweep and chat paths** — biggest remaining cost lever per `cost-analysis.md` §4.1. Expected ~15-40% reduction on those call sites. Not quality — cost.
- **Multi-tier prompt system** for span generation — existing to-do, user has examples to share.
- **Edge false-positive filter tightening** — waiting for real post-sweep data.

---

## §2. Run order for this session

The right order minimizes wasted re-runs:

1. **P0.1** — synonym-aware canonical lookup (code change, $0, ~30 min)
2. **P0.2** — notes span regen (~$0.52, ~3-5 min runtime, can start in background)
3. **P0.3** — `:=` definition detector, post-processing backfill half only ($0, ~15 min)
4. **P0.4** — Rodina quality sweep, `--detect-only` first then `--limit 5` for spot-check, then full (~$1.05, ~5 min)
5. **P2.3** — rerun notes→paper funnel now that notes have full-book spans (~$0.10)
6. **P1.1 alternative** — lightweight `resolveFromText()` service + endpoint ($0, ~45 min)
7. **P3.1** — benchmark rerun ($0)
8. Commit + push after each step, not batched. Commit messages get detailed per CLAUDE.md standing order.

Total session cost estimate: **~$1.67**. Total wall-clock: ~2-3 hours.

---

## §3. What this session deliberately does NOT touch

- Figure bbox bottom-leak / page 7 / page 8 / page 2 — logged under UI/Images bucket in `to-do.md`.
- Notes vision quality loop v2 pipeline (Puppeteer + judge) — spec-only, waiting on 8 open questions in `reports/Notes rewrite and vision/notes-vision-quality-loop-spec.md §14`.
- Chunks view rendering (span-group cluster, mode inheritance).
- Metadata panel UI wiring — the data-layer resolver from P1.1/P1.2 exists, but clicking the panel and rendering the result lives in the UI session.
- Split-screen reader, chat continuation, kebab actions, add-to-collection bug.
- Quality sweep kebab + stats modal block.
- Any work on `public/js/*`, `views/*.ejs`, `public/css/*`.

---

## §4. The vision

> "When I ask for metadata, I must see the definition in the Scroll version of my notes, not the PDF version, because the PDF is source notes, not AI-generated and thus messy. The Scroll notes ARE the source notes, only enhanced, so that the narrative is clear and logical and each time span/chunk/edge exists inside of the PDF source notes, we must show it inside of the Scroll version."

This session builds the data-layer plumbing to support that vision. The graph must be correct before the UI can render it correctly. When a user highlights "BCFW shift" in Rodina and clicks metadata, the following chain must succeed:

```
highlighted text
  → taxonomy.normalize()
  → CanonicalDefinition lookup (with synonym expansion)
  → canonical chunk (in Lagrangians notes)
  → its page's scroll-rewrite htmlContent
  → render definition inline in popup
```

Every step of that chain is broken today. P0.1 fixes the synonym expansion. P0.2 populates the definitions at the span layer. P0.3 teaches the prompt to RECOGNIZE the definitions. P0.4 surfaces them via the quality sweep piggyback. P1.1 provides the lookup function. P1.2 exposes it as an API. P3.2 is the single binary test.

After this session, the data supports the vision. The UI session then ties it together.
