# 82.7% Checkpoint — Full Edge Audit

**State:** after commit `c54769f`, before rejection/context/floor (`c781f35`).
**Graph:** 640 notes→Rodina edges, 2884 total note-citation edges library-wide.
**Source book:** Lagrangians + EL notes (`69d9ce81aa83b8b11c1837dd`, 65 pp).
**Target book:** Rodina (`69d5dd60c826b8392d57012d`, 2406.04234, 9 pp).

Note: this is a **frozen snapshot**. The current DB is the 93.8% state — these tables cannot be regenerated from live queries.

---

## Top 10 Best (deduped by target chunk)

Scored by `confidence_letter_value + relevance_letter_value`. Max score = 52 (both `z = 100%`).

| # | source | target | rel | c/r | verdict |
|---|---|---|---|---|---|
| 1 | **notes p17 i180** `[equation]` `1/p² = 1/(p₁+p₄)² = 1/(p₂+p₃)²` | **rodina p2 i24** BCFW shift `pᵢ→pᵢ+zq` eq.(4) | equivalent | z/z | ❌ **wrong**. Propagators ≠ BCFW shift. Glyph-similarity trap. |
| 2 | **notes p19 i195** `[definition]` "Planar: sum of consecutive momentum squared" | **rodina p1 i18** Mandelstam/planar Xᵢⱼ definition | uses_definition | z/z | ✅ **bullseye** |
| 3 | **notes p47 i479** `B = zᵐBₘ(Xᵢ∞) + O(zᵐ⁻¹)` | **rodina p6 i84** `[definition]` Appendix A: UV scaling vs general zeros | assumes | z/z | ✅ **bullseye** — enhanced-scaling ansatz → exact theorem |
| 4 | **notes p57 i584** "Let X_{ij}∞ denote coefficient of largest power of z" | **rodina p6 i89** Xᵢⱼ z-dependence condition | uses_definition | z/z | ✅ bullseye |
| 5 | **notes p63 i627** `a₁/(x₁₃x₁₅) + a₂/(x₂₅x₁₅) + a₃/(x₂₅x₂₆) = 0` | **rodina p3 i44** X_{2,n} zero condition | equivalent | z/z | ✅ both zero-condition equations |
| 6 | **notes p1 i1** `L = ½m(ṙ² + r²θ̇²)` polar Lagrangian | **rodina p7 i105** `P_A = s₁₂+Σs₁ₖ+P_L` cut condition | prerequisite | z/u | ❌ **wrong**. Classical mechanics ≠ amplitude cut. |
| 7 | **notes p4 i36** `(x,s) → L(x,s)` | **rodina p1 i9** `[definition] lagrangian_formalism` (Fix 2 chunk) | uses_definition | u/z | ✅ bullseye |
| 8 | **notes p6 i56** "translation invariant 2 problems:" | **rodina p3 i43** `[example]` affected Xᵢⱼ | prerequisite | u/z | ⚠️ right topic, source text too bare |
| 9 | **notes p13 i144** `½∫d²p/p² δ(p₁+p₂-p)δ(p-q+p₃)...` | **rodina p1 i19** momentum conservation `Σpᵢ=0` | prerequisite | u/z | ✅ bullseye |
| 10 | **notes p21 i208** `c_{ij} = X_{ij} + X_{i+1,j+1} - X_{i+1,j} - X_{i,j+1}` | **rodina p1 i21** **same equation, eq.(1)** | uses_definition | u/z | ✅ **perfect verbatim** |

**Top-10 audit: 7 bullseyes, 2 wrongs (#1, #6 — both glyph-similarity traps), 1 marginal.**

---

## Bottom 10 Worst (deduped by source chunk)

| # | source | target | rel | c/r | verdict |
|---|---|---|---|---|---|
| 1 | notes p3 i23 "In physics generally we stop at 1 derivative" | rodina p2 i37 Locality definition | assumes | k/u | ⚠️ aside comment |
| 2 | notes p7 i71 "multi-dimensional Gaussian on ℝⁿ" | rodina p1 i18 Mandelstam/planar invariants | assumes | k/u | ❌ Gaussian integral ≠ Mandelstam |
| 3 | notes p14 i161 "x = x(t) field:" | rodina p3 i43 affected Xᵢⱼ | assumes | k/u | ❌ 2-char classical notation → amplitude paper |
| 4 | notes p23 i234 `⟨φⁱⱼ(x)φᵏₗ(y)⟩` path integral | rodina p2 i32 Tr(φ³) NLSM/YM generalization | assumes | k/u | ❌ path integral ≠ amplitude generalization |
| 5 | notes p34 i351 `C₁₃=(p₁+p₃)² not clear: if n>3` | rodina p1 i19 momentum conservation | assumes | k/u | ⚠️ tangential |
| 6 | notes p55 i562 "another D-subset" (figure caption) | rodina p4 i60 D-subsets definition | assumes | k/u | ⚠️ right concept, source is a caption |
| 7 | notes p15 i167 `∂μ∂ᵘφ = -V'(φ) in QFT` Klein-Gordon | rodina p1 i0 **paper title** | assumes | p/s | ⚠️ generic topic link |
| 8 | notes p45 i458 `→ ℓit X_{iσ}∞` (OCR fragment) | rodina p7 i100 three types of X_{ij}∞ | assumes | p/s | ✅ correct, correctly rated low |
| 9 | notes p50 i508 `X_{2,j}(z) = X_{i,j}(0) + z(...)` | rodina p6 i90 `[remark]` zero condition | assumes | p/s | ✅ correct, low conf due to typo |
| 10 | notes p1 i2 `x = r cos θ, y = r sin θ` | rodina p7 i104 `[proof]` amplitude zero cut | proves | r/s | ❌ polar coords ≠ amplitude proof |

**Bottom-10 audit: 2 correct low-conf, 8 wrong/tangential. Floor is working — all of these would be filtered by a `relev >= u` cutoff.**

---

## By Relationship Type (2 of each at 82.7%)

### `equivalent` (4 total)
- ❌ **notes p17 i180** `1/p² = 1/(p₁+p₄)²...` → rodina p2 i24 BCFW shift (z/z)
- ✅ **notes p63 i627** zero-condition linear equation → rodina p3 i44 zero condition on X_{2,n} (z/z)

### `uses_definition` (23 total)
- ✅ **notes p19 i195** "Planar: sum of consecutive momentum squared" → rodina p1 i18 (z/z)
- ✅ **notes p57 i584** "Let X_{ij}∞ denote coefficient of largest power of z" → rodina p6 i89 (z/z)

### `assumes` (92 total)
- ✅ **notes p47 i479** enhanced scaling ansatz → rodina p6 i84 Appendix A (z/z)
- ✅ **notes p47 i482** `Bₘ = Σ_{cᵢⱼ∈zero} cᵢⱼ{...}` → rodina p6 i84 same (z/z)

### `prerequisite` (44 total)
- ❌ **notes p1 i1** polar-coords Lagrangian `L=½m(ṙ²+r²θ̇²)` → rodina p7 i105 P_A cut (z/u)
- ⚠️ **notes p6 i56** "translation invariant 2 problems:" → rodina p3 i43 (u/z)

### `proves` (476 total — biggest bucket)
- ⚠️ **notes p38 i386** `Σpₖ` → rodina p1 i19 momentum conservation — `proves` is wrong label, should be `prerequisite`
- ✅ **notes p38 i388** "Which Xᵢⱼ are affected by setting c_{i₀}=0?" → rodina p3 i43

### `contradicts` (1 total — only 1 in the entire library)
- ❌ **notes p21 i211** `c_{2,4}: X₂₄+X₃₅-X₂₅` → rodina p1 i21 `cᵢⱼ = Xᵢⱼ+...` eq.(1). Note is APPLYING the definition, not contradicting. Single `contradicts` is wrong — rejection killed it in the 93.8% run.

---

## B-Rational / B-Cascade / Bₘ Edges Targeting Paper (33 edges total, showing top 12)

Filter: target chunk text or tags match B_m / rational function / homogeneous / enhanced scaling.

| # | source | target | rel | c/r | verdict |
|---|---|---|---|---|---|
| 1 | notes p47 i479 `B = zᵐBₘ(Xᵢ∞) + O(zᵐ⁻¹)` | rodina p6 i84 Appendix A | assumes | z/z | ✅ bullseye |
| 2 | notes p47 i482 `Bₘ = Σ_{cᵢⱼ∈zero} cᵢⱼ{...}` | rodina p6 i84 | assumes | z/z | ✅ bullseye |
| 3 | **notes p46 i468** "Let B be a homogeneous rational function of Xᵢ..." | **rodina p3 i52** "any rational function built from planar invariants Xᵢⱼ..." | prerequisite | u/z | ✅ **bullseye — benchmark item #12** |
| 4 | notes p51 i527 (empty source) | rodina p3 i52 rational function | prerequisite | u/z | ⚠️ empty source — min-length filter needed |
| 5 | notes p53 i542 `Bₘ(X*ⱼ)=0 ∀X^Λ_ν, Bₘ satisfies 1-zero` | rodina p2 i28 "1-zero: cᵢ₁=0..." | uses_definition | z/u | ✅ bullseye |
| 6 | notes p59 i597 `[example]` `B = X₁₃/(X₂₄X_u4) + X₃₅/(X₁₃X₂₄)` | rodina p3 i52 | uses_definition | u/z | ✅ bullseye |
| 7 | **notes p46 i469** "Let Bᵢ be subset of terms in B scaling as zⁱ..." | **rodina p1 i2** "every type of hidden zero is equivalent to subset enhanced scaling..." | assumes | z/s | ✅ bullseye — B-subset def ↔ theorem statement |
| 8 | notes p46 i473 "In general: B = Bₙ+Bₙ₋₁+Bₙ₋₂..." | rodina p6 i84 Appendix A | assumes | z/s | ✅ correct, though rodina p3 i53 eq.(13) would be tighter |
| 9 | **notes p48 i487** `B = 1/X₁₃, n=5, Supers:` | **rodina p3 i54** **"B = Bₘ+Bₘ₋₁+Bₘ₋₂+... (13), if we assume zᵐ is largest"** | assumes | z/s | ✅ **bullseye — benchmark item #13** |
| 10 | notes p52 i540 "Bₘ has enhanced scaling → Bₘ(Xᵢⱼ°)=0..." | rodina p6 i84 Appendix A | assumes | z/s | ✅ bullseye |
| 11 | **notes p51 i513** "B is homogeneous rational function of Xᵢ. Collect B into subterms..." | **rodina p3 i53** "Take B any homogenous rational function of Xᵢⱼ... Collect in subsets Bₗ..." | uses_definition | r/z | ✅ **perfect — same procedure word-for-word** |
| 12 | notes p53 i549 `[definition]` "let B' = B - Bₘ = Bₘ₋₁ + ..." | rodina p3 i54 eq.(13) | uses_definition | r/z | ✅ bullseye |

**B-rational audit: 11/12 bullseye, 1 empty-source artifact.** Strongest section in the entire library. Benchmark items #12 and #13 are both getting spot-on edges.

---

## D-Subset / Boundary Propagator / Triangulation Edges (135 total, showing top 10)

| # | source | target | rel | c/r | verdict |
|---|---|---|---|---|---|
| 1 | notes p54 i559 "Start with: 6-gon with leg 1 removed..." | rodina p4 i61 "We interpret D-subsets as n-point starting with (n-1)-point, leg 1 missing" | prerequisite | z/u | ✅ bullseye |
| 2 | notes p61 i605 "D-subsets" | rodina p4 i60 "decomposed into what we call D-subsets..." | uses_definition | u/z | ✅ bullseye |
| 3 | notes p62 i613 "3 boundary generators:" | rodina p4 i64 "boundary propagators are precisely the Xᵢⱼ in eq.(9)..." | prerequisite | u/z | ✅ bullseye — **item #22** |
| 4 | notes p62 i614 "orange lines count # boundary propagators (k≥1)" | rodina p4 i64 same | prerequisite | u/z | ✅ bullseye |
| 5 | notes p62 i615 `[equation]` "graph with 1 boundary operator" | rodina p4 i64 same | prerequisite | u/z | ✅ bullseye |
| 6 | notes p65 i642 "all graphs with n=3 that have 2 boundary propagator" | rodina p5 i67 "14 diagrams... 5 different subsets..." | prerequisite | u/z | ✅ bullseye |
| 7 | notes p4 i38 `d/dt(mẋ) + kx = 0` harmonic oscillator | rodina p7 i104 `[proof]` amplitude zero cut | proves | s/z | ❌ **wrong** |
| 8 | notes p5 i39 "if L ⇒ L + (d/dt)f(x,ẋ), same equations" | rodina p7 i104 same | assumes | s/z | ❌ wrong |
| 9 | notes p6 i62 `a = L/N` lattice spacing | rodina p7 i104 same | proves | s/z | ❌ wrong |
| 10 | notes p6 i68 `-½∫dᵈ⁻¹x(φ∂ₜ²φ + φ∇²φ)` integration by parts | rodina p7 i104 same | proves | s/z | ❌ wrong |

**D-subset audit: 6/10 bullseye, 4/10 all wrong landing on the same `rodina p7 i104` magnet chunk** — the failure mode that motivated the rejection + page context fix.

---

## Targeting B-Rational (second query — target-side filter, 33 edges, top 12)

See the B-rational section above — this query returned the same cluster plus a few additional high-score variants. All 11/12 bullseye except the empty-source artifact.

---

## Targeting Triangulation / Polygon / Kinematic Mesh (2 edges total)

| # | source | target | rel | c/r | verdict |
|---|---|---|---|---|---|
| 1 | notes p57 i582 "Let X_{i,j}(z) be the z-dependent planar invariant" | rodina p6 i88 `[example]` kinematic mesh + BCFW shift | proves | s/u | ⚠️ topic-adjacent |
| 2 | notes p58 i591 "B(X) = Bₘ(X) + Bₙ(X)..." | rodina p6 i88 same | proves | s/u | ⚠️ topic-adjacent |

**Thin coverage — only 2 edges touch kinematic-mesh-tagged chunks.** Neither is a bullseye. This is a real gap in Rodina coverage (triangulation framing lives in *Understanding zeros*, not Rodina).

---

## Targeting Locality / Unitarity / Causal (39 edges, top 10)

| # | source | target | rel | c/r | verdict |
|---|---|---|---|---|---|
| 1 | **notes p39 i401** `Res A₅|_{s₁₂=0}` 5-point residue factorization | **rodina p2 i38** `[theorem]` Unitarity / optical theorem / pole factorization | assumes | u/z | ✅ **bullseye — item #11** |
| 2 | notes p23 i232 `φⁱⱼ` matrix component | rodina p4 i66 "local ansatz for Tr(Φ³)..." | proves | s/z | ❌ too-short source |
| 3 | notes p30 i294 "Res A(z)/z = A(n)" | rodina p2 i38 unitarity | assumes | z/s | ✅ correct — contour residue ↔ unitarity |
| 4 | **notes p39 i396** `S†S = lim U(T,-T)` S-matrix unitarity | **rodina p2 i38** unitarity | proves | s/z | ✅ **bullseye** |
| 5 | notes p10 i121 `⟨φ(x)φ(z)⟩⟨φ(y)φ(s)⟩⟨φ(b)φ(s)⟩²` | rodina p1 i4 Tr(φ³) uniqueness conjecture | proves | r/z | ⚠️ topic-adjacent |
| 6 | **notes p40 i411** `[theorem]` "Look at A(z)/z pole at z=0, A(0) = z·∮A(z)/z dz" | **rodina p2 i38** unitarity | proves | r/z | ✅ **bullseye — item #9** |
| 7 | notes p1 i10 `d/dt(mrθ̇)=0, Minimization Problem` | rodina p5 i83 `[proof]` Yang-Mills polarization | assumes | u/u | ❌ |
| 8 | notes p10 i111 `Σ(ig)ᵏ/k!∫Dφ eⁱˢ⁰(S_T)ᵏ` perturbation | rodina p1 i4 Tr(φ³) uniqueness conjecture | assumes | u/u | ⚠️ topic-adjacent |
| 9 | notes p11 i135 `⟨φ(p₁)φ(p₂)φ(p₃)⟩` | rodina p1 i4 Tr(φ³) uniqueness conjecture | assumes | u/u | ⚠️ topic-adjacent |
| 10 | notes p24 i237 `⟨φⁱ⁴(P₁)φⁱ²(P₂)φⁱ³(P₃)⟩ ≈ ∫Dφ e⁻ˢ(...)` | rodina p1 i4 Tr(φ³) uniqueness conjecture | assumes | u/u | ⚠️ topic-adjacent |

**Locality audit: 3 bullseye (#1, #4, #6 — benchmark items #9/#10/#11), 5 topic-adjacent (rodina p1 i4 magnet), 2 wrong.**

---

## Targeting Amplitude / Hidden Zeros (181 edges, top 12)

| # | source | target | rel | c/r | verdict |
|---|---|---|---|---|---|
| 1 | notes p1 i1 `L = ½m(ṙ²+r²θ̇²)` | rodina p7 i105 P_A cut | prerequisite | z/u | ❌ |
| 2 | notes p4 i36 `(x,s) → L(x,s)` | rodina p1 i9 `lagrangian_formalism` | uses_definition | u/z | ✅ bullseye |
| 3 | notes p26 i261 "fix connection between 7 and 10" | rodina p7 i106 amplitude zero | prerequisite | u/z | ⚠️ bare source |
| 4 | **notes p1 i4** `L = ½(s²ᵣ + r²s²_θ)` EL | **rodina p1 i9** `lagrangian_formalism` | proves | s/z | ✅ **bullseye — item #7** |
| 5 | notes p1 i5 `d/dt ∂L/∂ẋ = ∂L/∂x` EL | rodina p1 i9 `lagrangian_formalism` | assumes | z/s | ✅ bullseye |
| 6 | notes p3 i24 Hamilton's principle + EL | rodina p1 i9 `lagrangian_formalism` | proves | s/z | ✅ bullseye |
| 7 | notes p4 i30 `[equation]` EL general form | rodina p1 i9 `lagrangian_formalism` | assumes | z/s | ✅ bullseye |
| 8 | notes p4 i38 harmonic oscillator `mẍ=-kx` | rodina p7 i104 amplitude proof | proves | s/z | ❌ wrong |
| 9 | notes p5 i39 "if L → L + (d/dt)f" | rodina p7 i104 same | assumes | s/z | ❌ wrong |
| 10 | notes p5 i45 `L : TM → R, M=R²` | rodina p1 i9 `lagrangian_formalism` | proves | s/z | ⚠️ generic definition match |
| 11 | notes p6 i62 `a = L/N` lattice spacing | rodina p7 i104 same | proves | s/z | ❌ wrong |
| 12 | notes p6 i63 `Z = Π∫dφᵢ eⁱˢ⁽ᵠ⁾` lattice partition function | rodina p2 i33 "Pole structure and ordered amplitudes..." | assumes | z/s | ❌ wrong |

**Amplitude audit: 5 bullseye Lagrangian cluster, 4 wrong (all rodina p7 i104 magnet), 3 marginal.**

---

## Patterns flagged at this checkpoint (informed the rejection + context + floor fix)

1. **Two magnet chunks polluting the graph:** `rodina p7 i104` (amplitude proof) and `rodina p1 i4` (Tr(φ³) uniqueness conjecture) pull in broad QFT / classical-mech notes that have no real citation relationship.
2. **Glyph-similarity traps:** the picker matches on `1/p²` and `L=½...` surface similarity without checking physics. Needs page context.
3. **Classical-mechanics notes on p1-14** contribute most of the wrongs. These pages are background that Rodina doesn't cover at all — they should be getting REJECTED, not forced-matched.
4. **`proves` is over-picked** (476/640 = 74%). Needs explicit verification-language requirement.
5. **Empty and figure-caption source chunks survive.** Min-length cutoff at source side would help.
6. **`equivalent` is a 50/50 coin flip** (2 of 4 are correct). Rare relationship, worth leaving in.
7. **Only 1 `contradicts` edge** in the entire library and it's wrong. Rejection killed it at 93.8%.

The rejection + page context + cosine floor commit (`c781f35`) was built to address patterns 1, 2, 3, and partially 4.
