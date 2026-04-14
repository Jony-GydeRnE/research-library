# ai-update.md

A rolling knowledge log of AI / backend / pipeline / data-quality / LLM routing / edges / cost / figures / notes rewrite changes. **Newest entries at the top.** Pair with `ai-to-do.md` for the working list.

Maintained by Claude Code (CC) on a ~3-5-response cadence. Bad attempts that got fixed in the same session are not listed — only the final state of each session's work matters. UI / reader / split-screen entries live in `ui-update.md`.

Commit messages are the authoritative comprehensive change record. This file is the narrative view: what was the session trying to accomplish, what worked, what didn't, what the current data quality numbers are.

The full rolling log from 2026-04-06 through 2026-04-13 lives in `update.md` (the pre-split combined file). Read that for deep history; write new entries in this file going forward.

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
