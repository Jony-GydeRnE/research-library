# Quality Sweep — Post-Ingestion Metadata Repair (Spec)

Written 2026-04-12. **Spec only — no code yet.** Review this before CC builds anything. It describes a background job that finds bad nodes (chunks / spans / edges) already in MongoDB and repairs them in place, with no re-ingestion, no vision re-run, no user action required.

---

## 0. Philosophy

**Surgery, not re-ingestion.** The PDFs are already processed. Pages are rendered. Spans and chunks exist. The user should never have to re-upload or re-trigger anything to get better metadata. If the system produced a bad span, a bad chunk, or a missing edge, the system finds it and fixes it in place. The repair writes new Span/Chunk/Edge documents to MongoDB and optionally deprecates the bad ones, all in the same transaction. The PDF and the Page.htmlContent are never touched.

**Quality over cost.** The repair loop uses the strongest available LLM (Opus) on every call. Original ingestion uses a fast cheap model (GPT-4o) for throughput. Repair is a surgical second pass, not a bulk operation, and it gets the best model. At library scale (1,500 books) a post-ingestion sweep is still trivially cheap — under $10K total per the user's own math — so there is no reason to optimize for cost at this layer.

**Idempotent by design.** Every repair operation is safe to re-run. Each repaired chunk and each repaired span gets a `qualitySweepAt` timestamp. The sweeper skips anything already processed within a configurable window (default: never re-process unless the version is bumped). Manual re-triggers bump the version. Crash-restart is free — the job picks up where it left off.

**Separated edge layers preserved.** Chunk-level edges and span-level edges are kept distinct, exactly as they are today. Some edges genuinely belong to a whole chunk (an assertion that spans multiple sentences, a dense math derivation where no single sentence carries the load). Others belong to a specific concept span (a definition reference, a cited theorem). The repair pipeline respects that distinction and writes edges at the correct layer. **It never flattens chunk edges into span edges or vice versa.**

---

## 1. Three Repair Patterns (detection + strategy)

Each pattern has a detector (a cheap MongoDB query that lists candidate chunks) and a repair strategy (an Opus call with specific context). Patterns are independent — a chunk can be matched by multiple patterns in the same sweep, but each repair runs sequentially so later repairs see the earlier repair's output.

### Pattern 1 — Dense 1-span chunks (multi-concept decomposition)

**Symptom.** "Tree amplitudes are rational functions of Lorentz invariant dot products of momenta." — one span, multiple distinct concepts jammed into a flat `contextTags` array.

**Detector.**
```
chunk.spans.length === 1 AND (
  chunk.contextTags.length >= 3                    // multiple tags already
  OR
  chunk.sourceText.match(/\b(and|of|with|for)\b.*\b(and|of|with|for)\b/) // "X of Y of Z" style
  OR
  chunk.wordCount > 25                              // dense single span
)
AND chunk.spans[0].spanText does NOT contain ':='  // definition of the form "X := ..."
AND NOT already repaired at current sweep version
```

**Repair strategy.**
1. Pull the chunk's single span and its `spanText`.
2. Pull **base context**: the 2 chunks before + 2 chunks after on the same page.
3. Call Opus with the **multi-concept decomposition prompt** (new file: `prompts/repair-decompose.txt`). The prompt shows the worked example from `span-generation-full.txt` §MULTI-CONCEPT DECOMPOSITION and asks Opus to emit new DSL lines for the single sentence, one concept per line.
4. Parse Opus's output with the existing `parseSpanOutput()` from `spanService.js` — zero new parser code.
5. If Opus produces multiple spans, **write new Span documents** for each one, all pointing at the same chunk. Mark the original span as deprecated (`qualityRepairStatus: 'replaced'`, `replacedBy: [newSpanIds]`) so old references still resolve but queries can filter by status.
6. **Re-derive the chunk** from its new spans using `chunkService.generateChunksForBook()` but scoped to just this chunk's page. The chunk's `contextTags` (union of new span tags), `searchClasses`, `hasUnresolvedSpans`, `sourceText`, `wordCount` all get recomputed. The chunk's `_id` is preserved.
7. **Piggyback canonical lookup** (see §4).
8. Mark the chunk `qualitySweepAt: now`, `qualitySweepVersion: N`, `qualityRepairApplied: ['p1-decompose']`.

**Escalation.** If Opus's output is empty, syntactically invalid, or produces only 1 span again (i.e., refuses to decompose), **escalate context**: retry with 5 chunks on each side, then the full page text, then the page + immediate neighbors from prev/next page. After three escalations the chunk is marked `qualityRepairStatus: 'pattern-1-unrepairable'` and skipped on future sweeps until the version bumps. This avoids infinite loops on stubborn cases.

### Pattern 2 — Orphaned / dangling chunks (broken pronoun references)

**Symptom.** "These novel perspectives have revealed surprising structures..." — chunk starts with a pronoun, antecedent is in the previous chunk or the previous page.

**Detector.**
```
chunk.sourceText starts with
  /^\s*(these|this|that|those|it|they|them|such|the following|hence|thus|therefore|consequently)/i
AND chunk.structuralType NOT IN ('theorem', 'definition', 'proof')
AND Edge.count({ toChunkId: chunk._id }) === 0   // no incoming edges
AND NOT already repaired at current sweep version
```

The chunker's new anaphor-merge rule (2026-04-12) catches many of these at ingestion time. Pattern 2 exists to catch the stragglers — orphans at page boundaries (where the chunker can't merge across pages), and orphans that slipped through because the ingestion happened before the chunker fix.

**Repair strategy.**
1. Pull the chunk and its **base context**: previous chunk, this chunk, next chunk. Include previous chunk even if it's on the previous page.
2. Call Opus with the **merge-or-disambiguate prompt** (new file: `prompts/repair-anaphor.txt`). Prompt asks Opus to decide:
   - **MERGE**: if the chunk is a continuation of its predecessor, return the merged span list for the combined chunk. Opus also identifies what the pronoun refers to.
   - **DISAMBIGUATE**: if the chunk is NOT a continuation, return a clarification — the pronoun's referent as a new contextTag (e.g., add `novel_perspectives_bcfw_zeros` as a tag so the chunk is no longer anchored only to a dangling pronoun).
3. On **MERGE**: create a new Chunk document with the combined spans. Mark the two source chunks as `qualityRepairStatus: 'merged'`, `mergedInto: newChunkId`. Any existing edges referencing either old chunk get a new parallel edge to the merged chunk (old edges stay for backwards compat; the new edges are the canonical ones).
4. On **DISAMBIGUATE**: update the chunk's spans with the new tags Opus produced. The chunk ID stays the same. Existing edges stay.
5. Mark the chunk (or merged chunk) `qualitySweepAt: now`, `qualitySweepVersion: N`, `qualityRepairApplied: ['p2-merge']` or `['p2-disambiguate']`.

**Cross-page special case.** If the chunk is at the top of a page and the previous chunk is on the previous page, the chunker can't merge them (the schema forbids cross-page chunks). Pattern 2's MERGE path *can* create a cross-page merged chunk by writing a new Chunk document with a special flag `crossesPages: [prevPageNum, thisPageNum]`. This is the first time the schema has a cross-page chunk; it needs a small addition to `Chunk.js` (nullable field, no migration required).

**Escalation.** If Opus is uncertain (returns a confidence lower than threshold 0.6 for MERGE), escalate to include the full page text of both pages. If still uncertain, mark as `qualityRepairStatus: 'pattern-2-uncertain'` and skip. Never auto-merge below threshold — false merges corrupt data.

### Pattern 3 — Isolated nodes (no tags, no edges)

**Symptom.** Chunk has no concept tags (or only generic `['narrative']`) AND zero edges in either direction. These are the dark matter of the graph — they exist in the DB but contribute nothing to the edge network.

**Detector.**
```
(chunk.contextTags.length === 0
 OR (chunk.contextTags.length <= 1 AND only generic tags))
AND Edge.count({
      $or: [{ fromChunkId: chunk._id }, { toChunkId: chunk._id }]
    }) === 0
AND chunk.wordCount >= 10   // skip empty/figure-caption noise
AND NOT already repaired at current sweep version
```

**Repair strategy.**
1. Pull the chunk and a **large context**: the full page raw text + 3 chunks on each side. Pattern 3 is the most context-hungry because "no tags" means the original LLM couldn't figure it out either — we need to give Opus everything.
2. Call Opus with the **full-retagging prompt** (new file: `prompts/repair-retag.txt`). Prompt asks Opus to:
   - Identify every concept the chunk contains (emit as contextTags).
   - Identify every concept the chunk ASSUMES without defining (emit as `Ld` gap tags).
   - Identify every concept the chunk REFERENCES from elsewhere in this work (emit as `I{confidence}` tags).
   - Identify the chunk's role (`claim`, `result`, `background`, ...) if it has a clear one.
3. Parse Opus's output. The repair updates the chunk and its spans with new `contextTags`, `searchClasses`, `role` (if Opus identified one with confidence), and `hasUnresolvedSpans`.
4. **Run the existing funnel** (`funnelService.resolveSpanThroughFunnel`) on each newly-tagged span. This generates edges using the existing embedding + LLM picker pipeline. The funnel already exists and already handles this exact case — we just didn't have any tagged spans to feed it for these chunks.
5. **Piggyback canonical lookup** (see §4).
6. Mark `qualitySweepAt`, `qualitySweepVersion`, `qualityRepairApplied: ['p3-retag']`.

**Escalation.** If Opus returns no tags (genuinely content-free chunk — figure caption, section header, noise), mark `qualityRepairStatus: 'pattern-3-content-free'` and move on. If Opus returns tags but the funnel generates zero edges, that's fine — the tags alone are an improvement. Not every chunk needs edges.

---

## 2. Context Escalation — the new rule from the user

> *"It is okay to compare a chunk to more chunks if the first chunks we compare to don't match, and extra content I think is important. Not just chunk to chunk comparisons. Sometimes we need context."*

The escalation ladder for every pattern:

```
LEVEL 0 — Base context
  Pattern 1: 2 chunks before + 2 after, same page
  Pattern 2: 1 chunk before + this + 1 after (+prev page if top of page)
  Pattern 3: 3 chunks before + this + 3 after + full page text

LEVEL 1 — Extended context
  Pattern 1: 5 chunks before + 5 after, same page
  Pattern 2: full page text of this page + previous page
  Pattern 3: full page text + 5 chunks each side, previous + next page

LEVEL 2 — Book-scale context
  Pattern 1: full page text + chunks from the book's "core definitions"
             list (top-15 chunks by incoming edge count)
  Pattern 2: page + prev page + next page + surface metadata block
  Pattern 3: full page + surface metadata + top-10 most-connected
             chunks in the book (these are load-bearing concepts
             Opus can use to frame the isolated chunk)

LEVEL 3 — Cross-book context (expensive, rare)
  Pattern 1: LEVEL 2 + library-wide canonical definitions
             matching any of the tags the original span tried to use
  Pattern 2: same as Level 2 (rarely helps — anaphora is local)
  Pattern 3: LEVEL 2 + cosine-nearest 5 chunks across the library
             (semantic neighbors may reveal what this chunk is about)
```

Escalation is triggered automatically by the repair loop when:
- Opus refuses (empty output, syntactically invalid, "I cannot decompose this")
- Opus returns the same answer as the detector already knows (no progress)
- Opus expresses low confidence (threshold configurable, default 0.6)

Each escalation increases the context token count by roughly 2-4x. Level 3 cost ceiling is ~$0.05-0.15 per repair. A chunk that escalates to Level 3 on Pattern 3 gets ~10-20K input tokens into Opus at $15/Mt = ~$0.15-0.30. Still fine.

After Level 3, the chunk is marked unrepairable at this sweep version and skipped. It will be retried next time the sweep version bumps (e.g., after a prompt improvement) or on explicit manual trigger.

---

## 3. Canonical Definition Piggyback

Whenever Pattern 1 or Pattern 3 writes new spans with `Ld` (missing-definition) gap tags, the repair loop immediately runs a canonical lookup on each new tag BEFORE finishing the repair transaction.

Flow inside a repair:

```
1. Opus returns new DSL lines
2. Parse into span objects
3. FOR EACH new span:
     FOR EACH contextTag in span.contextTags:
       IF tag has an Ld gap marker on this span:
         canonical = CanonicalDefinition.findOne({ concept: tag })
         IF canonical:
           emit Edge {
             fromSpanId: span._id,
             fromChunkId: chunk._id,
             fromBookId: chunk.bookId,
             toChunkId: canonical.definitionChunkId,
             toSpanId: canonical.definitionSpanId,
             toBookId: canonical.definitionBookId,
             relationshipType: 'uses_definition',
             confidence: 'z',
             method: 'canonical-lookup',
           }
         ELSE:
           append tag to book.missingDefinitions[] for crawler
4. Save everything atomically.
```

This is the "once tagged, always tagged" mechanic made live. When a repair produces a new `tree_amplitudes` tag and `tree_amplitudes` already has a canonical definition elsewhere in the library, the edge gets written instantly, zero additional LLM calls.

When the canonical lookup *misses*, the unresolved concept gets appended to `Book.missingDefinitions` (new field). That list is the crawler's target queue — "these are the concepts our library doesn't yet define, prioritize ingesting papers that cover them." The quality sweep produces a structured backlog of gaps as a free side effect.

---

## 4. Chunk-Level vs Span-Level Edge Separation

The user explicitly called this out: **"keep that, cuz some edges truly are chunk level and not individual span level, such as assertions and dense math sentences."** The spec respects it strictly:

- **Pattern 1 repairs write span-level edges.** The whole point of Pattern 1 is to decompose into concept-specific spans so each concept gets its own anchor. Canonical lookup edges from Pattern 1 always set `fromSpanId` (not just `fromChunkId`) so they live at the span layer.
- **Pattern 2 repairs preserve existing edges.** Merged chunks inherit edges from both source chunks. If the source edges were span-level, the merged chunk's spans inherit them as span-level. If chunk-level, they become chunk-level on the merged chunk.
- **Pattern 3 repairs write BOTH layers depending on what the funnel produces.** The funnel already makes this decision per edge — some edges are emitted with `fromSpanId` (a specific span is the source), others with only `fromChunkId` (a whole-chunk assertion). Pattern 3 does not override this; it just runs the funnel and the funnel writes edges at the correct layer.
- **Chunks-view UI is already right on this.** The 2026-04-12 earlier commit merged chunk-level edges into single-span chunks for display purposes, but it did NOT merge them in the DB — the underlying Edge documents still have their original `fromSpanId` / `fromChunkId` set correctly. The sweep preserves that.

In short: **no repair ever flattens a chunk-level edge into a span-level edge or vice versa**. The layer is determined by the source of truth (the funnel's decision or Opus's decomposition output), not by display-layer convenience.

---

## 5. Data Model Changes

### 5.1 New fields on existing collections

**`Chunk` schema additions** (all nullable, no migration):
```
qualitySweepAt        Date       — last time this chunk was swept
qualitySweepVersion   Number     — version of sweep logic that touched it
qualityRepairApplied  [String]   — list of pattern ids: ['p1-decompose', 'p2-merge', ...]
qualityRepairStatus   String enum:
  - 'untouched' (default)
  - 'repaired'
  - 'merged'               (this chunk was merged into another; see mergedInto)
  - 'replaced'             (rare; all spans replaced via Pattern 1)
  - 'pattern-1-unrepairable'
  - 'pattern-2-uncertain'
  - 'pattern-3-content-free'
mergedInto            ObjectId ref Chunk — only set if status = 'merged'
crossesPages          [Number]  — only set if chunk bridges pages (Pattern 2 cross-page merge)
```

**`Span` schema additions** (all nullable):
```
qualitySweepAt        Date
qualitySweepVersion   Number
qualityRepairStatus   String enum:
  - 'untouched' (default)
  - 'repaired'
  - 'replaced'       (Pattern 1 decomposed this span into multiple new ones)
replacedBy            [ObjectId] ref Span — only set if status = 'replaced'
```

**`Book` schema additions**:
```
missingDefinitions    [String]  — concept tags the canonical lookup couldn't find;
                                  crawler target queue
qualitySweepAt        Date      — last time the book was swept at the book level
qualitySweepVersion   Number
```

### 5.2 New collection

**`QualitySweepJob`** — one row per book per sweep, for observability:
```
bookId                ObjectId ref Book
sweepVersion          Number
status                enum ['pending','running','done','failed','cancelled']
startedAt             Date
completedAt           Date
stats: {
  chunksScanned       Number
  pattern1Matched     Number
  pattern1Repaired    Number
  pattern1Unrepairable Number
  pattern2Matched     Number
  pattern2Merged      Number
  pattern2Disambiguated Number
  pattern2Uncertain   Number
  pattern3Matched     Number
  pattern3Retagged    Number
  pattern3ContentFree Number
  edgesCreated        Number
  canonicalHits       Number
  canonicalMisses     Number
  opusInputTokens     Number
  opusOutputTokens    Number
  estCostUsd          Number
}
error                 String (if failed)
```

The stats modal reads from this collection to show "Quality sweep: 23/340 chunks reviewed, 12 repaired, $0.14 spent".

### 5.3 No deletions, ever

The sweep **never deletes** a span, chunk, or edge. It creates new documents and marks old ones with status. This makes every repair a pure add-only operation that's safe to roll back by querying `qualitySweepVersion` and reverting affected docs. Full audit trail.

---

## 6. Job Architecture

### 6.1 Agenda job definition

New file: `services/qualitySweepService.js`. New Agenda job: `quality-sweep`. Same infrastructure as existing `extract-pdf`, `generate-html`, etc.

Job shape:
```
agenda.define('quality-sweep', async (job) => {
  const { bookId, sweepVersion } = job.attrs.data;
  const sweepService = require('./services/qualitySweepService');
  await sweepService.runSweepForBook(bookId, sweepVersion);
});
```

`runSweepForBook(bookId, sweepVersion)` in English:
1. Create a `QualitySweepJob` row with `status='running'`.
2. Load all chunks for the book sorted by `pageNumber, chunkIndex`.
3. For each batch of `QUALITY_SWEEP_BATCH_SIZE` chunks (default 10):
   - For each chunk in the batch:
     - Skip if `qualitySweepVersion >= sweepVersion`.
     - Run detectors for Pattern 1, 2, 3 — a chunk may match multiple.
     - For each matched pattern in priority order (2 first because merge changes neighbors, then 1, then 3):
       - Call the pattern repair function with the appropriate context level.
       - On success: update chunk/spans/edges, update stats.
       - On failure/escalation: retry at next context level up to Level 3.
       - After all escalations fail: mark the failure status and move on.
   - Every batch: update the `QualitySweepJob.stats` row.
4. Mark `QualitySweepJob.status='done'` with completedAt.
5. Update `Book.qualitySweepAt`, `Book.qualitySweepVersion`.

### 6.2 Scheduling

**Automatic trigger**: after a book's final ingestion step (`generate-metadata` or whatever the last step is) completes, enqueue a `quality-sweep` job for that book at low priority, running ~5 minutes later. The 5-minute delay lets any user who just uploaded see their book appear in the library first — the sweep runs in the background afterward.

**Manual trigger**: a new kebab menu item on the Files page — "Run quality sweep". Enqueues the job immediately at normal priority. Fires a toast: "Quality sweep started. Progress in stats modal."

**Version bump**: when the sweep logic itself improves (new detectors, better prompts), bump `QUALITY_SWEEP_VERSION` in config. The next run resets every chunk's sweep status and re-runs from scratch.

### 6.3 Config

```
pipeline.js additions:

QUALITY_SWEEP_ENABLED: process.env.QUALITY_SWEEP_ENABLED !== '0',
QUALITY_SWEEP_VERSION: 1,                                 // bump to force re-sweep
QUALITY_SWEEP_MODEL: process.env.QUALITY_SWEEP_MODEL || 'claude-opus-4-6',
QUALITY_SWEEP_BATCH_SIZE: parseInt(process.env.QUALITY_SWEEP_BATCH_SIZE, 10) || 10,
QUALITY_SWEEP_DELAY_AFTER_INGEST_MS: 5 * 60 * 1000,
QUALITY_SWEEP_MAX_ESCALATION: 3,                          // stop at Level 3
QUALITY_SWEEP_MIN_CONFIDENCE: 0.6,                        // below this → escalate
QUALITY_SWEEP_TOKEN_BUDGET_PER_BOOK: 200_000,             // hard cap (~$3/book)

PATTERN_1_ENABLED: true,
PATTERN_2_ENABLED: true,
PATTERN_3_ENABLED: true,

// Pattern 1 detection thresholds
PATTERN_1_MIN_TAGS: 3,
PATTERN_1_MIN_WORDS: 25,

// Pattern 3 detection thresholds
PATTERN_3_MIN_WORDS: 10,
```

### 6.4 Observability

**Stats modal** (existing UI). Already shows book stats. Add a "Quality Sweep" block under the processing stats:

```
Quality Sweep
  Last run:   2026-04-12 15:42 (version 1)
  Scanned:    340 chunks
  Repaired:   68  (24 p1, 12 p2, 32 p3)
  Unrepairable: 7
  Edges added:   215
  Canonical hits: 89 / canonical misses: 14
  Cost:       $0.14
  [Run again]
```

**Server logs**: every repair logs a one-line summary `[qualitySweep] p1 repair chunk=<id> spans 1→5 edges +8 cost=$0.012`.

**Abort / cancel**: the kebab item becomes "Cancel quality sweep" while running. Sets the job status to `cancelled`; the worker checks the status between chunks and exits cleanly.

---

## 7. Prompt Files (three new files)

Written during implementation, not in this spec. Each follows the existing `prompts/` convention — plain text, loaded with `fs.readFileSync` at runtime, never embedded in code.

- `prompts/repair-decompose.txt` — Pattern 1. Shows the multi-concept decomposition rule from `span-generation-full.txt` verbatim with additional context framing ("you are repairing an existing span that the first-pass LLM under-decomposed"). Outputs one DSL line per concept, overlapping ranges OK.
- `prompts/repair-anaphor.txt` — Pattern 2. Given prev + current + next chunks, decides MERGE / DISAMBIGUATE / UNCERTAIN and returns a structured verdict with the new spans or new tags.
- `prompts/repair-retag.txt` — Pattern 3. Given full page text + chunk + neighbor chunks, produces a complete retag: role, all contextTags, all gap tags (`Ld`, `Lv`, `Lp`), all internal refs (`I`).

All three prompts include a confidence field so the repair loop can trigger escalation when Opus is uncertain.

---

## 8. Cost Model

Per-repair token estimate:
- Input: 1K (chunk) + 2K-6K (context) + 1.5K (system prompt) = 4.5K-8.5K
- Output: 200-600 tokens (new DSL lines or verdict)

At Opus pricing ($15/Mt input, $75/Mt output):
- Input: 4.5K-8.5K × $0.000015 = $0.068-0.128
- Output: 200-600 × $0.000075 = $0.015-0.045
- **Total per repair: $0.08-0.17**

Estimated bad-node counts per book (rough, from inspecting current 6 books):
- Pattern 1 matches: ~30-50 chunks/book
- Pattern 2 matches: ~5-15 chunks/book
- Pattern 3 matches: ~20-60 chunks/book
- **Total: ~50-125 repairs per book → $5-20 per book**

At 6 books (current library): **$30-$120 one-time sweep cost**.
At 1500 books (full math/physics library): **~$7,500-$30,000** total — well within the user's $150K quality budget.

The per-book token budget hard cap (`QUALITY_SWEEP_TOKEN_BUDGET_PER_BOOK = 200K`) is a safety net, not a target. A book that blows through it has bigger problems than cost and deserves a manual look.

---

## 9. Failure Modes & Rollback

**An Opus call fails (rate limit, network blip)**: retry with exponential backoff, max 3 retries. If all fail, mark the chunk as `qualityRepairStatus: 'error'` with the error message stored, move to next chunk. Do NOT abort the whole sweep.

**A chunk's repair produces invalid data** (parser rejects Opus output, zero new spans, malformed tags): count as one escalation attempt, retry at next level. After Level 3, mark `pattern-N-unrepairable` and move on.

**The whole sweep job crashes mid-run**: `QualitySweepJob.status` stays `running`. On next server start, a janitor routine finds orphaned `running` jobs and either resumes them or marks them `failed`. Configurable (default: resume).

**A repair writes bad data that makes the chunks view worse**: the sweep version is bumped, or the user manually rolls back via a new admin endpoint `POST /api/quality-sweep/rollback?bookId=X&version=N`. Rollback query:
- Delete all Edge docs where `qualitySweepVersion === N`
- Revert all Chunk docs with `qualitySweepVersion === N` to their pre-sweep state using the `qualityRepairApplied` trace
- Since no doc was ever deleted during the sweep, rollback is just a `qualityRepairStatus` update and new-edge cleanup. Clean.

**Full kill switch**: `QUALITY_SWEEP_ENABLED=0` in env. Disables the Agenda job definition entirely. Existing data is untouched.

---

## 10. What Runs When

### On book upload (unchanged)
```
extract-pdf → generate-html → generate-metadata
   ↓ (new) delayed 5 min
quality-sweep (background, low priority)
```

### On manual trigger from kebab
```
User clicks "Run quality sweep" on a book
   → Enqueue quality-sweep with priority=normal
   → Toast notification
   → Stats modal updates live as batches complete
```

### On library-wide command (new script)
```
node scripts/sweep-all.js
   → Enqueue quality-sweep for every ready book
   → Jobs run serially (one book at a time) to avoid
     rate-limit contention on Opus
```

### On config version bump
```
Admin bumps QUALITY_SWEEP_VERSION in pipeline.js
   → Next `sweep-all` or manual trigger picks up the
     new version
   → Chunks whose qualitySweepVersion < new version
     are re-processed
```

---

## 11. What Is Explicitly OUT of Scope for v1

- **No repair of edges without chunk/span changes.** If the chunk and its spans look fine but the edges are wrong, the sweep doesn't touch them. Edge repair is a separate future job (probably under the existing funnel re-run infrastructure).
- **No cross-book analysis during repair.** Level 3 context includes canonical definitions, but repair decisions are always made in the scope of one book. Cross-book coherence is the Subject Tutor agent's job (Phase E in the vision doc).
- **No user-visible preview / dry-run.** The sweep writes to production data. A dry-run mode could be added later but would roughly double the code surface and isn't worth v1.
- **No span-level repair detection.** Patterns operate at the CHUNK level. If a chunk has 5 spans and 1 of them is bad, the detector only fires if the chunk-level signal trips. Span-level detectors are a future extension.
- **No prompt A/B testing inside the sweep.** One prompt per pattern, committed. Improvements happen by bumping the sweep version and re-running.

---

## 12. Open Questions for Jony Before CC Builds

1. **Cross-page merges.** Pattern 2 can produce a chunk that bridges two pages. This is the first time the schema has a cross-page chunk. OK to add a `crossesPages` field and let the chunks view render merged chunks that span pages? The alternative is to leave cross-page orphans unrepaired.

2. **Automatic trigger after upload vs manual-only.** The spec above auto-triggers the sweep 5 minutes after ingestion completes. You could prefer manual-only for v1 so you can see what the sweep does on a controlled set of books before it runs on everything. I lean manual-only for the first few runs, then flip to automatic.

3. **Version bump policy.** When we improve a prompt or add a new pattern, bumping `QUALITY_SWEEP_VERSION` causes every book to be re-swept. Do you want that to happen automatically on config push, or only on explicit command (`node scripts/sweep-all.js --force-version`)? I lean explicit.

4. **Kebab wording**. "Run quality sweep" is accurate but jargony. Alternatives: "Refine metadata", "Improve tags & edges", "Re-analyze this book". Pick your preference.

5. **Budget warning threshold**. At what per-book cost should the sweep pause and ask for confirmation? I lean $5/book (well above the p50 estimate of $0.50-$2 but below the outlier cap of $3). Configurable.

6. **Should Pattern 1 repairs re-run the chunker, or write new spans into the existing chunk?** Re-running the chunker is cleaner (uses the current break rules) but may split a previously-single-span chunk into multiple chunks depending on the break rules at repair time. I lean re-run the chunker for this chunk's page — it's a small scope and keeps the chunker as the single source of truth for grouping.

7. **Isolation failures**. Pattern 3 repairs that produce tags but the funnel can't generate edges from them — are those still counted as "repaired" or "partially repaired"? I lean "repaired, no edges" as a distinct stats bucket so we can tell "we tagged it but it's still not connected" from "we couldn't tag it at all".

8. **Batch size at Opus rate limits**. 10 chunks per batch, sequential within a batch. For a book with 125 bad chunks that's 13 batches = ~13 × 10 Opus calls sequentially = 2-3 minutes per book. Acceptable? Or do we want parallel Opus calls within a batch (faster but harder to rate-limit)?

---

## 13. Summary of Why This Is Better Than Re-Ingestion

Re-ingestion wipes good work and starts over. Users can't be asked to do it. Cost scales with book size whether or not a book needs repair. Re-running vision is the expensive part and it's wasted on 95% of pages that were fine.

Quality sweep only touches bad nodes. Users never have to do anything. Cost scales with the *amount of badness*, not book size — a clean book pays nothing. Prompts and the LLM improve over time, and bumping the sweep version automatically applies the improvements on the next run, with full rollback and no re-upload. The graph gets better monotonically as the sweep runs.

This is also what Phase E of the vision doc (Subject Tutors) will be doing at a higher level — watching the graph, noticing bad areas, healing them. The quality sweep is the first, mechanical layer of that: pattern detectors + Opus + canonical lookup. Later, the Subject Tutor can add its own detectors ("this definition is missing a proof", "this theorem has no use sites"), and they plug into the same repair loop.

---

*End of spec. No code yet. Answer the 12 open questions in §12, review the repair strategies in §1-4, and I'll implement.*
