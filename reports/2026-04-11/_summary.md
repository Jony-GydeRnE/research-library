# 2026-04-11 Session Summary

Single-day session that moved the notes↔Rodina benchmark from 64.2% (day-start) through 76.5% → 82.7% → **93.8%** across three commits on the same day. Full narrative lives in the commit messages; this file is the dashboard.

## Benchmark trajectory (Tier B strict target, TW=0 NW=2)

| Checkpoint | Tier B | Tier C (STRICT_REL=1) | Commit | Change |
|---|---|---|---|---|
| Day start (pre-reprocess) | 52/81 = 64.2% | 20/81 = 24.7% | (prior session state) | — |
| After Fix 1 (reprocess 24 empty notes pages + funnel 429 retry + gpt-4o-mini picker) | 62/81 = 76.5% | 20/81 = 24.7% | `5033806` | +12.3 pts Tier B |
| After Fix 2 + Fix 3 (threshold bib filter + notes-source relationship prompt + direction-1 hardcode bug) | 67/81 = 82.7% | **67/81 = 82.7%** | `c54769f` | +6.2 pts B, +58 pts C |
| After Rejection + Page Context + Cosine Floor | **76/81 = 93.8%** | **76/81 = 93.8%** | `c781f35` | +11.1 pts, PARTIAL 14→5 |

**Net 1-day swing: Tier B +29.6 pts, Tier C +69.1 pts.**

## Per-group Tier B at the three checkpoints

| Group | 76.5% | 82.7% | 93.8% | Net Δ |
|---|---|---|---|---|
| 1-7   Foundations (Rp1) | 1/7 | **7/7** | 7/7 | +6 |
| 8-11  BCFW (Rp2) | 4/4 | 4/4 | 4/4 | 0 |
| 12-19 Core proof (Rp3-4) | 6/8 | 3/8 ⚠️ | **6/8** | 0 (recovered) |
| 20-32 D-subsets (Rp4-5) | 12/13 | 12/13 | 12/13 | 0 |
| 33-42 Deeper proof body | 10/10 | 7/10 ⚠️ | **10/10** | 0 (recovered + maxed) |
| 43-52 Worked examples | 8/10 | 6/10 ⚠️ | **9/10** | +1 |
| 53-66 S-matrix/BCFW/QFT | 11/14 | 13/14 | 13/14 | +2 |
| 67-81 Physical picture + Lagrangians | 10/15 | **15/15** | 15/15 | +5 |

The 82.7% checkpoint had a distribution side effect: Fix 2 unmasked Rodina p1 candidate pool, which pulled Core proof / Deeper body / Worked examples edges toward p1 where they didn't belong. The Rejection + Page Context fix let the picker correctly say "no, this note isn't about p1's intro content" and the edges rebalanced to the proof pages where they belong.

## Relationship histogram evolution

| Relationship | 76.5% | 82.7% | 93.8% |
|---|---|---|---|
| annotates | 638 | 0 | 0 |
| proves | 0 | 476 | 425 |
| assumes | 0 | 92 | 98 |
| prerequisite | 0 | 44 | 21 |
| uses_definition | 0 | 23 | 12 |
| equivalent | 0 | 4 | 0 |
| contradicts | 0 | 1 | 0 |
| extends | 0 | 0 | 1 |
| **total edges** | 638 | 640 | 569 |

The 76.5% state was a monoculture — every edge was `annotates` because of a hardcoded `'annotates'` literal in `noteIngestionService.js` Direction 1 that was overwriting the picker's verdict. Fix 3 + the hardcode bugfix unlocked the real distribution. The 93.8% state is cleaner: fewer total edges but higher quality, with obvious junk (single `contradicts`, 4 `equivalent` where only 1 was correct) gone.

## Code changes shipped this session

| Commit | Change | File(s) |
|---|---|---|
| `fe26fcd` | Add `scripts/score_benchmark.js` — 81-item benchmark scorer | new file |
| `5033806` | Reprocess 24 empty notes pages + funnel 429 retry + mini picker | `scripts/reprocess_empty_pages.js`, `services/funnelService.js`, `update.md` |
| `123023e` | Fix 2 (threshold bib filter) + Fix 3 (notes-source relationship prompt) | `services/funnelService.js`, `services/noteIngestionService.js`, `prompts/edge-pick.txt` |
| `c54769f` | Buffer-then-swap + direction-1 hardcode bugfix + benchmark rescore | `services/noteIngestionService.js`, `scripts/show_benchmark_examples.js` |
| `c781f35` | Rejection letter `x` + SOURCE_PAGE_CONTEXT + cosine floor 0.25 | `prompts/edge-pick.txt`, `services/funnelService.js`, `services/noteIngestionService.js`, `update.md` |

## Residual issues flagged in this session (not yet fixed)

1. **`rodina p7 i104` remains a magnet** for QFT-action-style notes. Example: notes p11 i130 momentum-space `½∫d⁴p(-p²φφ) + g∫...` landed on the amplitude zero cut proof with `z/z` confidence. Page context didn't rescue it because notes p11 page context is "QFT perturbation theory" which isn't distant enough from "amplitude zeros".
2. **Triangulation coverage is genuinely sparse** (only 1 edge in the 93.8% graph). This is a real Rodina paper limitation — the triangulation framing lives mostly in the *Understanding zeros* paper, not Rodina.
3. **`proves` still over-picked** (425/557 non-rejected = 76%). Prompt-level tightening ("require explicit verification language") is the next lever.
4. **Picker model fallback** queued in `update.md`: if `gpt-4o-mini` keeps misfiring, swap `EDGE_PICKER_MODEL` to `gpt-5-mini` or current flagship.
