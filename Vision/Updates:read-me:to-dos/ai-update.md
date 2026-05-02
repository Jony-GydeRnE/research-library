# ai-update.md

A rolling knowledge log of AI / backend / pipeline / data-quality / LLM routing / edges / cost / figures / notes rewrite changes. **Newest entries at the top.** Pair with `ai-to-do.md` for the working list.

Maintained by Claude Code (CC) on a ~3-5-response cadence. Bad attempts that got fixed in the same session are not listed — only the final state of each session's work matters. UI / reader / split-screen entries live in `ui-update.md`.

Commit messages are the authoritative comprehensive change record. This file is the narrative view: what was the session trying to accomplish, what worked, what didn't, what the current data quality numbers are.

The full rolling log from 2026-04-06 through 2026-04-13 lives in `update.md` (the pre-split combined file). Read that for deep history; write new entries in this file going forward.

---

## 2026-05-01 — Cold-start session: executive priorities + EX-0/EX-2/EX-4a shipped, EX-1 in flight

**Session shape:** ~2 weeks since last work. Cold-start "deep dive + take control" ask from Jony, then a follow-up making the goal explicit: **metadata + edges 200% better**. Reordered everything around that. Five tracks of concrete moves planned in `reports/2026-05-01/metadata-edge-quality-2x-plan.md`; executive priorities locked into the top of `ai-to-do.md` as EX-0 → EX-10. Quality-measurement work (judge service + dashboard + edge audit) comes BEFORE Phase A flip because flipping the agent on a low-quality graph amplifies bad edges.

### What shipped this session

**1. EX-0 prep + bug catch.** Started `generateSpansForBook` on the Lagrangians notes book to backfill the 33 pages that were filled by `fill-missing-pages.js` on 2026-04-13 but never had spans/chunks/edges generated. Caught a pre-existing bug live: `services/spanService.js:449` does `await Span.deleteMany({ bookId })` at the start, then line 462 SKIPS pages without source text. The 32 OLD-format pages on this book have `htmlContent` (clean Rodina-voice rewrite) but no `rawText` and no `visionProcessed=true` — so they were silently losing all their spans on every regen. Killed the partial run at 20/65 pages and shipped the fix.

**2. `scripts/repair-rawtext-from-html.js`** (new). Idempotent recovery: derives plain-text `rawText` from existing `Page.htmlContent` for any page where `rawText` is empty. Preserves LaTeX (\(...\) and \[...\]), uses block-tag boundaries as paragraph separators, normalizes whitespace, decodes common HTML entities. On the Lagrangians book: candidates 32, written 32, skipped (already had rawText) 33. After repair, `Source mix: 33 vision, 32 rawText, 0 skipped (empty)` — all 65 pages get spans on the next pass.

**3. .gitignore hardened for the bulk-PDF era.** Added `pdfs/` (any depth) and `/*.pdf` (root-only) so Jony's ~1000-book math/physics/nuclear/fusion stash plus the 6 nuclear/fusion books currently sitting at project root (Duderstadt-Hamilton, Cahn-Goldhaber, Wesson Tokamaks, Lamarsh-Baratta, Krane, Freidberg) can never accidentally be tracked. Curated `reports/` PDFs unaffected. `pdfs/.gitkeep` (also ignored) carries the convention note.

**4. EX-4a — judge rubric written.** `prompts/judge-rating.txt` was a 4-line placeholder; now a full six-axis rubric (specificity / normalization / role accuracy / gap detection / declarative-tag precision / search-class accuracy), each 0-3, total 0-18 mapped to grade 0-9 = total/2. Strict JSON output schema with per-axis scores, total, grade, and a max-6-entry `issues` list. Scoring bands map grades to ship/surface/re-annotate/fail actions. Model-agnostic so we can run it on Opus 4.7 first then downgrade per axis if calibration holds. **This is the load-bearing item for the 200% goal — every other quality move (failure mining, taxonomy proposals, edge audits, dashboards) hangs off this rubric.**

**5. EX-2 — notes-rewrite prompt padded past 1024-token cache threshold.** `prompts/notes-rewrite.txt` went from ~600 tokens to ~2100 tokens with six new sections of hard constraints (LATEX HARDENING with 12 specific rules, CITATION HARDENING with 6 rules, VOICE before/after table with 10 anti-patterns, DEFINITION-FIRST RULE, EQUATION DENSITY, PREREQUISITE PAGES). Two birds: enables Anthropic ephemeral cache (was silently ignored at <1024 tokens) AND tightens quality. Verification plan: run a 3-page test batch and watch `cache_read_input_tokens > 0` on calls 2 and 3.

**6. EX-0 in flight.** Re-running `generateSpansForBook` cleanly with all 65 pages having source text. Source mix at start: `33 vision, 32 rawText, 0 skipped`. Watcher armed for completion (which auto-fires the post-chain note-match per the 8f8a7b7 hook). Live count at last poll: page 59/65, 1698 spans. Pre-run state was 1098 spans / 365 chunks / 1462 edges. Expected after: ~2200+ spans, more chunks, fresh `note-citation` edges from previously-unspanned pages.

### What's queued immediately after EX-0

- **EX-1** — score Tier A loose / Tier B strict / Tier C strict+rel against the 81-item benchmark. Forecast (from 2026-04-11): Tier B 62 → ~71-73, Tier C 20 → ~50+ (validates Fix 2 + Fix 3 which were code-complete but never re-validated because OpenAI quota was hit). Quota verified restored 2026-05-01.
- **EX-2 verification** — 3-page test batch with cache-hit watch.
- **EX-3** — Jony manually uploads Rodina notes 14-18 (5 new PDFs). After upload, run Phase 2 pipeline + benchmark + edge counts.
- **EX-4b/c/d** — judgeService + Quality Dashboard + edge audit script. Track 1 of the 2x plan in earnest.

### Bug landed this session worth flagging

`spanService.generateSpansForBook` is destructive on skip: `Span.deleteMany({ bookId })` then SKIP pages without source text means every pre-existing span on a skipped page is lost on every regen. If the user uploads a book through the OLD pipeline (htmlContent only) and later regens spans, they lose work. The repair script is the workaround; the durable fix would be either (a) only delete spans for pages that WILL be regenerated, or (b) require source text before deletion. Logging as a candidate hardening item.

### Companion docs from this session

- `reports/2026-05-01/session-catchup-and-recommendation.md` — macro picture
- `reports/2026-05-01/metadata-edge-quality-2x-plan.md` — five tracks, six axes, 2x targets
- `Vision/Updates:read-me:to-dos/ai-to-do.md` — executive priorities EX-0 to EX-10
- `Vision/Updates:read-me:to-dos/ui-to-do.md` — UI parallel track EX-UI-1 to EX-UI-3

---

## 2026-04-14 — Figure judge loop v1 shipped, env-gated behind FIGURE_JUDGE=1

**Session shape:** Jony signed off on the judge-loop spec (`reports/Notes rewrite and vision/figure-judge-loop-spec.md`) after we tuned through v1 → v4 in a single pass. Ships a Sonnet 4.6 vision judge that critiques each crop with structured JSON; a deterministic delta-application loop mechanically adjusts the crop rectangle; no painter LLM in the loop after iteration 1.

**What shipped:**

1. **`services/figureJudge.js`** — `judgeCrop(cropBuffer, captionText)` returns `{score, extra_lines_above, extra_lines_below, clipped_above, clipped_below, extra_px_left, extra_px_right, notes}` or `null` on any failure. Strict JSON parse with first-balanced-brace extraction to handle prose-wrapped responses.

2. **`services/figureService.js cropWithJudgeLoop()`** — iterative refinement with these safety layers:
   - **Decaying amplifier** `[2.5x, 1.5x, 1.0x]` across 3 attempts. First iteration makes an aggressive big move; later iterations fine-tune without oscillating between "clipped" and "extra lines" error modes.
   - **Asymmetric clamp** — shrink capped at 40% of current dim per edge (collapse risk), grow capped at 50% (no collapse risk, can go bigger).
   - **Post-apply floor guard** — MIN_HEIGHT_PX = 60, MIN_WIDTH_PX = 60. If applying deltas would take the rectangle below the floor, proportionally scale shrink components back.
   - **Ship best-score crop** across all attempts. If final best score < 50, fall back to the "view original page" link rather than shipping a broken crop.

3. **Env gate:** `FIGURE_JUDGE=1` enables the loop. Default off during validation, flip to default on once Rodina long-paper results stabilize.

**Validation on Rodina short paper (9 pages, 4 figures):**

| figure | v1 sym 25% | v4 (shipped) | final notes |
|---|---|---|---|
| p2 fig 1 | 95 | 92 | converged cleanly |
| p4 fig 1 | 82 | 72 | known failure mode — judge scores flat despite objective improvement |
| p7 fig 1 | 0 (abandoned) | 90 | improved massively, different starting bbox this run |
| p7 fig 2 | 72 | 82 | partial improvement |
| **avg** | 62.25 | **84** | best overall of all versions tested |

**Key observation worth acting on:** p4 shows a judge calibration problem, not a loop math problem. Verdict trail on p4 was `"9 lines above → 4 lines above → top clipped"` — objectively monotonic improvement — but judge scores stayed at 72, 72, 72. The ship-best-score logic picks attempt 2 which is the intermediate position, when attempt 3 is arguably closer to correct. Two v2 candidates logged in `ai-to-do.md`:
1. Re-calibrate judge prompt to reward monotonic improvement.
2. Ship-last-if-monotonic: when verdict trail shows `extra_lines_above` decreasing, ship the LAST crop instead of the max-score crop.

**Cost:** ~$0.009/figure × 3 attempts ≈ $0.04 for the four Rodina figures. Long paper (12 figures) would be ~$0.11. Whole library ~$0.60 one-time. Negligible vs the notes-rewrite pipeline which dominates.

**Spec:** `reports/Notes rewrite and vision/figure-judge-loop-spec.md`.

---

## 2026-04-14 — Session convention change: four-file split

Jony asked for `update.md` and `to-do.md` to be split along the UI/AI axis so each session can focus without scrolling through unrelated items. New convention:
- `ui-to-do.md` — reader, split-screen, chat surface, file cards, kebabs.
- `ai-to-do.md` — pipeline, LLM routing, edges, figures, cost, data quality.
- `ui-update.md` — UI rolling log.
- `ai-update.md` — AI/backend rolling log (this file).

Legacy `update.md` and `to-do.md` remain in place as the combined archive; new content goes in the split files going forward. Rule: if a session touches both axes (e.g. figure cropping is AI but the reader rendering is UI), write the majority of the entry in the dominant file and a one-line pointer from the other.

---

For sessions before 2026-04-14, see `update.md`.
