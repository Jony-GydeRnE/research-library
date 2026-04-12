# 93.8% Checkpoint — Themed Edge Examples

**State:** after commit `c781f35` (Rejection + Page Context + Cosine Floor). This is the CURRENT live DB state.
**Graph:** 569 notes→Rodina edges (down from 640 at 82.7%).
**Pipeline stats:** 2908 picker attempts, 668 rejected (23%), 1 API error, 0 cosine-floor skips.

This is the audit that answered "give me examples that target B-rational functions, then triangulations, locality, amplitudes" at the 93.8% state.

---

## 5 B-Rational / Bₘ / Homogeneous Edges (pool = 32, best deduped by source chunk)

| # | source | target | rel | c/r | verdict |
|---|---|---|---|---|---|
| 1 | **notes p46 i468** "Let B be a homogeneous rational function of Xᵢ, f(λx,...,λxₙ)=λⁿf(...)" | **rodina p3 i52** "we will prove that any rational function built from planar invariants Xᵢⱼ satisfies a zero condition iff subset enhanced UV scaling + subset zero" | prerequisite | u/z | ✅ **bullseye — benchmark item #12** |
| 2 | **notes p46 i473** "In general: B = Bₙ + Bₙ₋₁ + Bₙ₋₂ where zᵐ is largest scaling" | **rodina p3 i54** **"B = Bₘ + Bₘ₋₁ + Bₘ₋₂ + ... (13), if we assume zᵐ is largest scaling for any term in B"** | prerequisite | u/z | ✅ **perfect bullseye — literally eq.(13), benchmark item #13**. Improved from 82.7% where it landed on Appendix A (topic correct but not tightest target). |
| 3 | notes p47 i479 `B = zᵐBₘ(Xᵢ∞) + O(zᵐ⁻¹)` + worked example | rodina p6 i84 `[definition]` Appendix A: UV scaling vs general zeros | assumes | u/z | ✅ bullseye — enhanced-scaling ansatz → theorem it proves |
| 4 | notes p47 i482 `Bₘ = Σ_{cᵢⱼ∈zero} cᵢⱼ{...}` | rodina p6 i84 Appendix A | assumes | u/z | ✅ bullseye |
| 5 | notes p48 i487 `B = 1/X₁₃, n = 5, Supers:` | **rodina p3 i54** eq.(13) | assumes | u/z | ✅ bullseye — benchmark item #13 second hit |

**B-rational verdict: 5/5 bullseye.** Notable improvement from 82.7%: note p46 i473 now correctly lands on eq.(13) instead of Appendix A. Page context attached `"rational_function_scaling, assumption"` to the picker's view and it picked the right target. This is the single best cluster in the graph.

---

## Triangulation / Locality / Amplitude — Pool Sizes

| category | count |
|---|---|
| triangulation | **1** (genuinely sparse) |
| locality | 19 |
| amplitude | 176 |

### Triangulation (1 total — the only one)

| source | target | rel | c/r | verdict |
|---|---|---|---|---|
| notes p57 i582 "Let X_{i,j}(z) be the z-dependent planar invariant" | rodina p6 i88 `[example]` kinematic mesh + BCFW shift + z-dependence | proves | s/u | ⚠️ topic-adjacent. Kinematic mesh exists on p6 but the source span is just an X(z) definition. |

**This is a real Rodina-paper limitation.** The triangulation/polygon framing lives mostly in the *Understanding zeros* paper, not Rodina. The benchmark items that expect triangulation content (e.g. #24, #25, #33, #42, #66, #69, #78) are covered in the graph via D-subset edges instead — see the 82.7% D-subset section for evidence.

### Locality (2 of 19, best)

| source | target | rel | c/r | verdict |
|---|---|---|---|---|
| **notes p36 i368** "Indicating the possibility of residue factorization" | **rodina p2 i38** `[theorem]` unitarity / optical theorem / pole factorization | prerequisite | z/u | ✅ bullseye |
| **notes p29 i280** `∫dp A₃(1,2,p) A₃(-p,3,4)` | **rodina p2 i38** unitarity / factorization | proves | s/z | ✅ bullseye — literal amplitude factorization integral ↔ theorem statement |

### Amplitude (1 of 176, top-scored)

| source | target | rel | c/r | verdict |
|---|---|---|---|---|
| **notes p1 i5** `[equation]` `d/dt ∂L/∂ẋ = ∂L/∂x` EL equation | **rodina p1 i9** `[definition] lagrangian_formalism, hidden_zeros` | assumes | **z/z** | ✅ **perfect bullseye — benchmark item #7, top confidence**. This is the Fix-2-unmasked chunk. |

### Residual bad edge (the one that survived rejection)

| source | target | rel | c/r | verdict |
|---|---|---|---|---|
| notes p11 i130 momentum-space `½∫d⁴p(-p²φ(p)φ(-p)) + g∫... φ(p₁)φ(p₂)φ(p₃)δ(p₁+p₂+p₃)` | rodina p7 i104 `[proof]` P_A = -P_B amplitude zero cut | assumes | **z/z** | ⚠️ **rodina p7 i104 magnet still attracting**. QFT action → amplitude proof, not a real citation. Page context on notes p11 is QFT perturbation theory which isn't domain-different enough from amplitudes. |

---

## Residuals to watch

1. **`rodina p7 i104` remains a partial magnet.** It shed 21 edges from the 82.7% run (p7 went 92 → 71) but still attracts generic QFT content like the p11 i130 example above. Candidate future fix: tighten page-context matching to require concept-space overlap between source page context and target concept space, or upgrade to a stronger picker model.

2. **Triangulation coverage is 1 edge.** Confirmed as a Rodina-paper limitation, not a pipeline bug. If we ever want triangulation-specific benchmark items to hit, we'd need to either (a) accept that D-subset edges substitute for triangulation coverage, or (b) cross-reference to the *Understanding zeros* paper which actually has the triangulation framing.

3. **`proves` still over-picked at 76% of non-rejected edges.** Next tuning lever is prompt-level: require explicit verification language ("we show", "we derive", "let us prove") in the source span before the picker can pick `p`.

4. **Picker model fallback queued** in `update.md`: swap `EDGE_PICKER_MODEL=gpt-5-mini` or current flagship if mini keeps misfiring on the residuals above.
