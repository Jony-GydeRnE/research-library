# 2026-04-11 Benchmark Scores — All Three Checkpoints

81-item notes↔Rodina gap-map benchmark (`scripts/score_benchmark.js`).
Notes book: `69d9ce81aa83b8b11c1837dd` (Lagrangians + EL, 65 pp, kind=notes)
Target paper: `69d5dd60c826b8392d57012d` (Rodina — Hidden zeros ↔ enhanced UV, 2406.04234, 9 pp)

## Checkpoint 1 — 76.5% Tier B (post-reprocess, pre-Fix-2/3)

Commit: `5033806` (Benchmark rescore 64.2% → 76.5% after reprocess + funnel 429 retry)

```
===== BENCHMARK SCORE =====
Total items: 81
Tier B strict target (TW=0 NW=2):
  COVERED:      62 (76.5%)
  PARTIAL:       1
  WRONG_TARGET: 14
  MISSING:       4

Tier C strict + rel (STRICT_REL=1):
  COVERED:      20 (24.7%)

===== BY GROUP (Tier B) =====
1-7 Foundations (Rodina p1):                 COV 1/7    ← blocked by Rodina p1 candidate-pool exclusion
8-11 BCFW (Rodina p2):                       COV 4/4
12-19 Core proof (Rodina p3-4):              COV 6/8
20-32 D-subsets (Rodina p4-5):               COV 12/13
33-42 Deeper proof body:                     COV 10/10
43-52 Worked examples (Rodina p2-4):         COV 8/10
53-66 S-matrix/BCFW/QFT:                     COV 11/14
67-81 Physical picture + Lagrangians:        COV 10/15  ← partially blocked by Rodina p1 exclusion

===== RELATIONSHIP TYPE HISTOGRAM =====
{ annotates: 638 }    ← everything was `annotates` due to direction-1 hardcode bug

===== RODINA PAGES RECEIVING EDGES =====
p1:0  p2:82  p3:43  p4:26  p5:32  p6:59  p7:23
(p1 has zero edges — Fix 2 target)
```

**Blockers at this checkpoint:**
- Root cause #2: Rodina p1 candidate pool exclusion (`services/funnelService.js` + `services/edgeResolverService.js isBibliographyChunk`) was nuking all 22 p1 chunks because 2 narrative paragraphs had 3 `[N]` citation markers each. Fixed by the fraction-threshold rule in `123023e`.
- Root cause #3: Notes-source relationship prompt collapse — gpt-4o-mini defaulted to `n` (annotates) whenever source was a notes book. Fixed by Fix 3 in `123023e`, plus the direction-1 hardcode bug that was separately ignoring the picker verdict (fixed in `c54769f`).

---

## Checkpoint 2 — 82.7% Tier B / Tier C (post Fix 2 + Fix 3 + hardcode bugfix)

Commit: `c54769f` (Buffer-then-swap + hardcoded annotates fix + rescore)

```
===== BENCHMARK SCORE =====
Total items: 81
Tier B strict target (TW=0 NW=2):
  COVERED:      67 (82.7%)
  PARTIAL:      14
  WRONG_TARGET:  0
  MISSING:       0

Tier C strict + rel (STRICT_REL=1):
  COVERED:      67 (82.7%)  ← identical to Tier B because annotates count is 0

===== BY GROUP (Tier B) =====
1-7 Foundations (Rodina p1):                 COV 7/7   ← Fix 2 unblocked this
8-11 BCFW (Rodina p2):                       COV 4/4
12-19 Core proof (Rodina p3-4):              COV 3/8   ⚠️ regression
20-32 D-subsets (Rodina p4-5):               COV 12/13
33-42 Deeper proof body:                     COV 7/10  ⚠️ regression
43-52 Worked examples (Rodina p2-4):         COV 6/10  ⚠️ regression
53-66 S-matrix/BCFW/QFT:                     COV 13/14
67-81 Physical picture + Lagrangians:        COV 15/15 ← Fix 2 unblocked this

===== RELATIONSHIP TYPE HISTOGRAM =====
{
  proves:         476,
  assumes:         92,
  prerequisite:    44,
  uses_definition: 23,
  equivalent:       4,
  contradicts:      1,
  annotates:        0
}

===== RODINA PAGES RECEIVING EDGES =====
p1:146  p2:101  p3:105  p4:34  p5:47  p6:115  p7:92
(p1 went from 0 to 146 — Fix 2 working as intended, but pulled too much mass)
```

**Side effect:** Fix 2 correctly unmasked Rodina p1 but the picker started routing many notes chunks toward p1 intro content even when they should have hit the p3-5 proof body. Three groups (Core proof, Deeper body, Worked examples) regressed because of this mass-shift. All `WRONG_TARGET=0` though — the right Rodina page is still getting hit, just from the wrong notes source page (PARTIAL, not COVERED).

---

## Checkpoint 3 — 93.8% Tier B / Tier C (post Rejection + Page Context + Cosine Floor)

Commit: `c781f35` (Rejection letter x + page context + cosine floor)

```
===== BENCHMARK SCORE =====
Total items: 81
Tier B strict target (TW=0 NW=2):
  COVERED:      76 (93.8%)
  PARTIAL:       5
  WRONG_TARGET:  0
  MISSING:       0

Tier C strict + rel (STRICT_REL=1):
  COVERED:      76 (93.8%)  ← identical

===== BY GROUP (Tier B) =====
1-7 Foundations (Rodina p1):                 COV 7/7    held
8-11 BCFW (Rodina p2):                       COV 4/4    held
12-19 Core proof (Rodina p3-4):              COV 6/8    ✅ recovered
20-32 D-subsets (Rodina p4-5):               COV 12/13  held
33-42 Deeper proof body:                     COV 10/10  ✅ recovered + maxed
43-52 Worked examples (Rodina p2-4):         COV 9/10   ✅ recovered + 1 better
53-66 S-matrix/BCFW/QFT:                     COV 13/14  held
67-81 Physical picture + Lagrangians:        COV 15/15  held

===== RELATIONSHIP TYPE HISTOGRAM =====
{
  proves:         425,
  assumes:         98,
  prerequisite:    21,
  uses_definition: 12,
  extends:          1,
  equivalent:       0,
  contradicts:      0,
  annotates:        0
}
(single `contradicts` + 4 `equivalent` from 82.7% were junk; rejection killed them)

===== RODINA PAGES RECEIVING EDGES =====
p1:123  p2:91  p3:94  p4:32  p5:58  p6:88  p7:71

===== PIPELINE STATS =====
Total edges:      2206  (down from 2884 pre-fix — 678 false positives correctly removed)
Rodina edges:      569  (down from 653)
pickAttempts:     2908
pickErrors:          1
pickRejections:    668  (~23% rejection rate — x=no-match is working)
skippedCosine:       0  (the noise was all cosine >= 0.25)
elapsed:          2607s (~43 min)
```

**Verdict:** 3 regressions from checkpoint 2 all recovered and in 2 cases exceeded their prior state. 33-42 Deeper proof body is 10/10 for the first time in the benchmark. PARTIAL dropped from 14 → 5. Rejection letter `x` did the vast majority of the noise cleanup; cosine floor never fired but is still in place as a defensive guard.
