# How to verify quality yourself

**Date:** 2026-05-01

This is your hands-on guide to spot-check metadata, edges, and flags directly. Three artifacts to open, three commands to run.

---

## What we just measured

After EX-1's match-pass re-run + Fix 2/3 validation, with the rubric/audit infrastructure shipped:

### Benchmark (`reports/2026-05-01/ex1-benchmark-results.md`)
| Tier | Before | After NW=2 | After NW=3 |
|---|---|---|---|
| A loose | 100.0% | **100.0%** | **100.0%** |
| B strict | 67.9% | **82.7%** | **98.8%** |
| C strict + non-`annotates` | 24.7% | **82.7%** | **98.8%** |

**NW=3 widening absorbs all but 1 PARTIAL.** The remaining 1/81 is in the Deeper-proof-body group — we can ground-truth-update the benchmark range or accept it.

### Judge calibration (n=10 dry-run on Lagrangians notes)
- Mean grade: **4.9 / 9** (one notch below "production")
- p10 / p50 / p90: **3 / 5 / 6.1**
- 3 / 10 chunks below threshold (grade 5)
- Per-axis (each 0–3):
  - Specificity: **1.8**
  - Normalization: **1.9**
  - **Role accuracy: 1.2** ← lowest
  - Gap detection: **1.8**
  - Declarative precision: **1.7**
  - Search-class accuracy: **1.6**

**This is the baseline for the 200% goal.** Doubling means hitting mean ~7+ with no axis below 2.0. The biggest lever right now is role accuracy.

Sample issues from the judge (verbatim):
- "Sentence 1 defines conditions on q, role=definition is borderline (no `:=`)"
- "`Ld` on sentence 1 arguably should be `Lv` (conditions stated, derivation implicit)"
- "`Lp` missing confidence suffix (should be e.g. `Lpa`)"

These are real, actionable. They feed straight back into the next prompt iteration.

### Edge audit (n=20 on stratified sample)
- correct: **2/15 = 13%**
- borderline: **10/15 = 67%**
- wrong: **3/15 = 20%**
- unparseable: 5 (rate-limit hit; pacing fix needed)

Borderline-heavy: most edges connect chunks that ARE related but the picker chose the wrong relationship label (`proves` instead of `prerequisite`, etc.). Wrong cases are the actual junk we want to filter. Recall the 14.8 pp Tier-B jump was real — these audit numbers don't contradict that, they explain WHY we still have headroom.

---

## Three artifacts to open

### 1. The sample-quality snapshot — `reports/2026-05-02/sample-quality-1837dd-n6.md`

6 random chunks from the Lagrangians notes book, each with:
- The full raw text (clean LaTeX)
- Every span: range, role, context tags, declarative tags, search-class (Ld / Lv / Lp / S)
- Every outgoing edge with target preview + deep link to that chunk's reader page
- Every incoming edge

**What to look for:** scan whether the context tags actually describe what the chunk is about, whether the L-class flags fire on the missing-derivation / missing-definition / missing-proof spots that you'd flag manually.

### 2. The edge-audit CSV — `reports/2026-05-02/edge-audit-lagrangians-n20-fixed.csv`

15 actual edge verdicts with reasons. Each row: `edgeId, bucket, relationship, confidence, method, verdict, reason, suggested_rel, suggested_conf`. Open in any spreadsheet or `cat` it. The "borderline" rows are the most interesting — they tell us WHICH relationship type the auditor would have used instead.

### 3. The judge issues list — appended to `/tmp/judge-n10b.log`

(Don't ship the .log; it's in /tmp.) The full `issuesSample` from the dry-run. These are 30 specific complaints the judge raised across the 10 chunks. Each is a candidate negative example for the next span-generation prompt iteration.

---

## Three commands you can run

These all run locally, no API calls (except the judge/audit which already ran). Pull a fresh sample any time.

```bash
# 1. Random snapshot of any book — spans, edges, flags, deep reader links
node scripts/sample-quality-snapshot.js --book=<bookId> --n=8

# 2. Snapshot a specific page (every chunk on it)
node scripts/sample-quality-snapshot.js --book=<bookId> --page=29

# 3. Quick judge sample, dry-run (~$0.30 for n=10)
node scripts/judge-sample.js --book=<bookId> --n=10
```

The bookId for Rodina is `69d5dd60c826b8392d57012d`. For the Lagrangians notes book it's `69d9ce81aa83b8b11c1837dd`. Other linked source books in the perSourceStats from EX-1 results.

---

## In the live UI

Things you can already do that surface metadata + edges:

1. **Open any book in the reader,** click the **Metadata** view-mode (or hit the chunks-view toggle). Every chunk's spans + tags + edges render inline.
2. **Highlight any text** in the reader → click **Metadata** in the popup. The canonical resolver (`/api/metadata/resolve`) finds the synonym-collapsed concept + every span across the library + the canonical definition chunk.
3. **In a chat,** edges from the source-book chunks show up as `cross_book_edges` in the system prompt. Ask Claude "what's the path from `bcfw_shift` to `enhanced_uv_scaling`" — even pre-Phase-A, you'll get grounded responses.

If you spot an edge that's plainly wrong, copy the `edgeId` from the snapshot or the audit CSV and tell me — I'll wire it into the next picker-prompt iteration as a negative example (Track 2 of the 2× plan).

---

## What's next on the quality stack

In priority order:

1. **EX-4c — Quality Dashboard.** The numbers above (judge axes, audit precision, coverage) get rendered as a single live page at `/admin/quality`. So far the data lives in scattered reports — the dashboard makes it ambient.
2. **Audit pacing.** Add a 250 ms delay between calls so we don't hit Anthropic 30K TPM rate limits at n=50.
3. **Role-accuracy fix.** It's the lowest axis at 1.2 / 3. Next iteration of `prompts/span-generation-full.txt` should add a few-shot example pair specifically for "preview vs proof" and "definition vs background" — the two role errors the judge flagged most often.
4. **Borderline-edge sweep.** The 10/15 borderline cases all suggest a different relationship type. Take those `suggested_rel` values, add them as a `prompts/edge-pick.txt` few-shot block, re-run the funnel on a small sample, see if precision moves.

Tell me which to do first, or "go" for top-down.
