# Figure-crop judge loop — minimal spec

**Status:** draft, awaiting Jony sign-off
**Date:** 2026-04-13
**Author:** Claude Code (CC)
**File owners after build:** `services/figureJudge.js` (new), `services/figureService.js` (wrapper loop)

## Principle

Never call the vision "painter" LLM after iteration 1. Each subsequent iteration adjusts the rectangle **mechanically** based on structured critique from a judge LLM. Old crops get **improved**, not thrown away.

This is the opposite of our current behavior, which discards the last crop every time we re-run the pipeline with a new prompt or heuristic.

## Data flow per figure

```text
rect_0 = best-guess bbox from the existing pipeline
         (GPT-4o bbox → caption-anchor bottom → column clamp → top-anchor)

for attempt in 1..3:
    crop_N = sharp.extract(page.png, rect_N)          // deterministic
    verdict = judge(crop_N, captionText)              // 1 Sonnet 4.6 vision call
    if verdict.score >= 95: break                     // good enough, ship
    rect_{N+1} = apply_deltas(rect_N, verdict)        // mechanical, no LLM

return crop_N
```

## Judge LLM

- **Model:** `claude-sonnet-4-6` vision
- **Input:** the current crop PNG (base64) + the caption string
- **System prompt (~300 tokens):**

```
You are judging a figure crop extracted from an academic paper page.

I will show you:
1. THE CROP (an image, purported to contain one figure)
2. THE EXPECTED CAPTION TEXT: "<caption>"

Return STRICT JSON only, no prose:

{
  "score": <int 0-100>,
  "extra_lines_above": <int>,     // body text / header visible at TOP of crop that shouldn't be there
  "extra_lines_below": <int>,     // body text / caption visible at BOTTOM of crop that shouldn't be there
  "clipped_above":    <int>,      // figure content cut off at TOP (estimate lines of figure missing)
  "clipped_below":    <int>,      // figure content cut off at BOTTOM
  "extra_px_left":    <int>,      // excess whitespace on LEFT in pixels
  "extra_px_right":   <int>,      // excess whitespace on RIGHT in pixels
  "notes": "<short reason>"
}

Scoring rubric:
  100:   figure fills crop, no text bleed, no clipping
  95-99: near-perfect, tiny whitespace asymmetry only
  70-94: usable but has excess text or minor clipping
  <70:   broken crop, major issues

Count "extra lines" as actual text lines visible, not pixels. Lines that are part of the figure artwork (axis labels, vertex tags, in-diagram annotations) do NOT count as extra.
```

## Mechanical delta application

```js
const LINE_H = deriveLineHeightPx(pageTextIndex); // fallback 25px
rect.top    += v.extra_lines_above * LINE_H  - v.clipped_above * LINE_H;
rect.bottom -= v.extra_lines_below * LINE_H  - v.clipped_below * LINE_H;
rect.left   += v.extra_px_left;
rect.right  -= v.extra_px_right;
// clamp to page bounds
rect.top    = Math.max(0, rect.top);
rect.bottom = Math.min(pngH, rect.bottom);
rect.left   = Math.max(0, rect.left);
rect.right  = Math.min(pngW, rect.right);
```

No LLM in this step. Pure arithmetic on judge's structured output.

**Line-height derivation:** instead of a hardcoded 25px, read the caption line's `.h` (font size in PDF pt) from the pdfjs text-line output we already compute, multiply by the PDF→PNG scale factor (`pngH / pdfPageH`) and a 1.2 leading factor. Accurate across papers with different body font sizes.

## Termination rules

| condition | action |
|---|---|
| `score >= 95` | done, ship current crop |
| attempt 3 finished without 95+ | ship the BEST crop across all 3 attempts (highest score) |
| judge returns invalid JSON | abort loop, ship attempt 1 (no regression) |
| rect would go out of page bounds after delta | clamp, continue |
| verdict oscillates (`extra_lines_above` and `clipped_above` both > 0 on same crop) | trust the model, apply both deltas (they partially cancel); if oscillation continues at attempt 3, take the rect from the attempt with the highest score |
| `score < 50` on final attempt | fall back to the "View figure in original page" link — the pipeline couldn't find a clean crop and a bad crop is worse than no crop |

## Cost

| item | count | unit cost | total |
|---|---|---|---|
| judge calls per figure | 3 × Sonnet 4.6 vision | $0.003 | **$0.009/figure** |
| typical Rodina figure page | ~1 figure | — | $0.009 |
| Rodina long paper (58 pages, 12 figures) | 12 figures | — | **$0.11** |
| Whole Rodina library (~5 papers, ~70 figures) | 70 figures | — | **~$0.63 one-time** |
| 1000-page user book (worst case) | ~100 figures | — | **~$0.90** |

Negligible. The Opus/Sonnet routing in the notes-rewrite pipeline already dominates cost. The judge loop is a rounding error by comparison.

## What this solves (today's debug screenshots)

| screenshot | current failure | judge verdict | delta | result |
|---|---|---|---|---|
| Rodina p2 FIG 1 | clean | `score: 98` | none | ship attempt 1 |
| Rodina p4 FIG 2 | paragraph above figure | `extra_lines_above: 4` | top += 100px | clean on attempt 2 |
| Rodina p7 FIG 3 | top clipped (colored meshes) | `clipped_above: 2` | top -= 50px | clean on attempt 2 |
| Rodina p7 FIG 4 | top clipped (neighbor diagrams) | `clipped_above: 2` | top -= 50px | clean on attempt 2 |
| off-center crops | excess whitespace | `extra_px_left: 30` | left += 30 | centered on attempt 2 |

## What this does NOT solve

1. **Wrong column** — still upstream. The column-detection (caption found in strict-left vs strict-right) runs BEFORE the loop. The judge can't tell us "you picked the wrong column"; it can only tell us "the text on the left edge of this crop is body text from the other column." In principle we could interpret `extra_px_left >> 100` as a signal to re-run column detection, but that's scope creep — leave it for v2.
2. **Hallucinated figures** — when GPT-4o's HTML includes a `<figure>` tag that doesn't correspond to anything on the page, the judge scores low for all 3 attempts and we fall back to the view-original-page link. Correct behavior — we shouldn't be cropping a non-existent figure.
3. **Model bbox wildly wrong** — if the model's initial bbox points at completely wrong area (e.g., the title block), the judge would score <20 and 3 iterations of ±50px deltas can't move the rect far enough. In that case the fallback link kicks in. Rare in practice.

## Integration (minimal code changes)

- **New file:** `services/figureJudge.js`
  - Export `judgeCrop(cropBuffer, captionText) → verdict | null`
  - One Sonnet 4.6 vision call with the prompt above
  - Strict-JSON parse (fence stripping, `JSON.parse` in try/catch)
  - Returns null on any failure (invalid JSON, API error, empty response)
- **Modify:** `services/figureService.js detectAndCropFigures`
  - After the initial `sharp.extract()` in the current flow, wrap in a `for attempt in 1..3` loop
  - Call `judgeCrop`, apply deltas, re-extract
  - Keep the best-score crop across attempts
  - Log per-attempt score + source for debugging
- **Env gate:** `FIGURE_JUDGE=1` — so we can A/B against current behavior. Default off during build, flip to default on once validated on Rodina.

## Edge cases to verify during build

1. **Rect out of bounds** → clamp, don't let the loop push off-page.
2. **Oscillation** → after 2 iterations take the rect with the best score so far.
3. **Judge JSON parse failure** → ship attempt 1 (no regression).
4. **Line height mismatch** → derive from pdfjs `.h`, fall back to 25px.
5. **Judge score stuck at same value across iterations** → we're adjusting but it's not helping; ship the best-score crop and log a warning.

## Not in scope for v1

- Multi-figure-per-page optimization (each figure is judged independently)
- Cross-book learning (no training data accumulation)
- Judge model swap (Opus instead of Sonnet) — revisit if Sonnet accuracy is insufficient
- Judge prompt few-shots (try zero-shot first, add examples only if needed)

## Build order

1. Write `services/figureJudge.js` standalone, unit-test with a single Rodina crop hand-picked from disk
2. Modify `figureService.js` to add the loop behind `FIGURE_JUDGE=1`
3. Run `scripts/reprocess-figures.js` on Rodina p2/p4/p7 with the flag on, compare against current
4. If all four Rodina figures hit score ≥ 95: enable by default, run on the longer Rodina and any other books with figures
5. Commit, push, update this spec with final results

## Sign-off

- [ ] Jony confirms the loop shape, termination rules, and cost estimate
- [ ] Jony confirms the judge prompt wording (or requests specific edits)
- [ ] Jony confirms env gate name (`FIGURE_JUDGE=1`) or picks a different one

When all three are checked, CC builds it in one session, validates against Rodina, and commits with a message linking back to this spec.
