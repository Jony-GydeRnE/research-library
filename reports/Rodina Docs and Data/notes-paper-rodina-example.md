notes-paper-rodina-example.md

Let me systematically go through Rodina page by page and map every implicit assumption against your notes.Now I have the full picture. Here's the comprehensive gap map:

---

**RODINA → NOTES GAP MAP: Every implicit assumption with the note that fills it**

**FOUNDATIONS (Rodina assumes all of this without explanation)**

| # | Rodina text | What's missing | Gap type | Your notes source |
|---|---|---|---|---|
| 1 | "Tr(ϕ³) amplitudes" (p1, used throughout) | What IS the Tr(ϕ³) Lagrangian? What are the Feynman rules? Why cubic vertices? | Ld | `Trphi3lagrangian.pdf` — derives L = ½tr(∂ϕ∂ϕ) + g·tr(ϕ³), path integral, propagator, vertex rules |
| 2 | "ordered amplitudes A(1,2,...,n)" (p1) | What is color ordering? Why does the trace decomposition work? What are partial amplitudes? | Ld | `Trphi3intro.pdf` — Aₙ = Σ Tr(T...) Aₙ(σ), worked 4-point examples with diagrams showing which orderings contribute |
| 3 | "Feynman diagrams" (used p1-9 without explaining) | How to draw them, what each line/vertex means, how to read off the amplitude | Ld | `feynmandiagramsandtriangulations.pdf` — full Feynman diagram tutorial with s-channel, t-channel, planar graphs |
| 4 | "Mandelstam invariants sᵢⱼ" (p1) | Definition sᵢⱼ = (pᵢ+pⱼ)², momentum conservation, on-shell conditions p²=0 | Ld | `Trphi3physicalpictureandamplitudestructure.pdf` — defines planar variables Xᵢⱼ from momenta, works through residues |
| 5 | "planar invariants Xᵢⱼ" (p1) | Full definition Xᵢⱼ = (pᵢ+pᵢ₊₁+...+pⱼ₋₁)², relation to Mandelstam, why they're a complete basis | Ld | `provingBzeroesB_i.pdf` p1 — defines Xᵢⱼ, shows Xᵢ,ᵢ₊₁=0, lists n(n-3)/2 independent invariants |
| 6 | "non-planar invariants cᵢⱼ" (p1, eq.1) | What makes them "non-planar"? Why cᵢⱼ = Xᵢⱼ + Xᵢ₊₁,ⱼ₊₁ - Xᵢ₊₁,ⱼ - Xᵢ,ⱼ₊₁? | Ld | `rodinacoretheorembcfwhidden0s.pdf` p1 — derives the c-equation from the X definitions |
| 7 | "Lagrangian formalism" (p1, mentioned as what's being bypassed) | What IS a Lagrangian? Euler-Lagrange equations? Action principle? | Ld | `overviewoflagrangians.pdf` — full derivation from calculus of variations through EL equations, polar coordinates, conservation of angular momentum |

**BCFW RECURSION (Rodina uses it as a tool without deriving it)**

| # | Rodina text | What's missing | Gap type | Your notes source |
|---|---|---|---|---|
| 8 | "BCFW shifts pᵢ → pᵢ+zq, pⱼ → pⱼ-zq" (p2, eq.4) | Why this specific deformation? Why does it preserve on-shell + momentum conservation? What is q? | Lv | `reviewingfactorizationzeroesandBCFWshifts.pdf` — derives S-matrix, unitarity, BCFW from residues, works through 4,5,6-point examples |
| 9 | "the recursion requires the contour at infinity to vanish" (p2) | Why? Cauchy's theorem? How does 1/z behavior connect to the residue sum? | Lp | `reviewingfactorizationzeroesandBCFWshifts.pdf` — shows Res(A₄) at s₁₂=0 factoring as A₃·A₃ |
| 10 | "enhanced BCFW behavior, such as 1/z for YM and 1/z² for GR" (p2) | Why do individual Feynman diagrams diverge but the sum cancels? Where does the enhancement come from? | Lp | `rodinaspapersintrotobcfwequalshiddenzeroes.pdf` — explains the zeros↔BCFW connection |
| 11 | "unitarity implies factorization of residues" (p2, eq.3) | What is unitarity physically? Why does it imply Aₙ → (1/P²)·A_left·A_right near poles? | Lv | `Trphi3physicalpictureandamplitudestructure.pdf` — derives Res(A₄) = A₃·A₃ from Feynman diagrams, shows factorization explicitly |

**THE CORE PROOF (Rodina's main results — every step that says "it is clear" or skips algebra)**

| # | Rodina text | What's missing | Gap type | Your notes source |
|---|---|---|---|---|
| 12 | "It is clear that the only Xᵢⱼ affected..." (p3) | Not clear at all — needs explicit enumeration of which Xᵢⱼ contain p₁ or pₙ in their momentum sum | Lp | `rodinacoretheorembcfwhidden0s.pdf` p1 — explicitly lists X₁ⱼ for j=3,...,n-1 and X₂ⱼ for j=3,...,n |
| 13 | "We now reach an important conclusion: X⁽⁰⁾ and X⁽∞⁾ satisfy the same linear relations" (p3) | The actual computation showing why zero conditions on cᵢⱼ produce the same constraints as BCFW z→∞ | Lv | `rodinacoretheorembcfwhidden0s.pdf` — works through the X(0) and X(∞) computations side by side |
| 14 | "if B satisfies a zero it must have enhanced scaling" (p4) | The full proof that B(X⁽⁰⁾)=0 implies B must be linear in cᵢⱼ, which implies enhanced UV | Lp | `B0B_i0.pdf` — proves B₀ → Bᵢ = 0, the inductive step |
| 15 | "we can now apply the same reasoning starting from B'" (p4, eq.18) | The induction step: B' = Bₘ₋₁ + Bₘ₋₂ + ... also satisfies the zero, proving each Bᵢ has enhanced scaling | Lv | `B0B_i0.pdf` — full inductive argument with explicit notation |
| 16 | D-subset construction (p4-5) | What IS a D-subset? How do you construct one from an (n-1)-point diagram? Why does adding leg 1 "in all possible ways" give the right partition? | Ld + Lv | `finaledsubsetinduction.pdf` — FULL worked construction with 5-point and 6-point examples, Feynman diagrams, boundary propagator counting |
| 17 | "S₁|zero = 0 even away from the cut" (p5, eq.20-21) | The cut argument: why cutting s₃₄ isolates S₁, why no linear combination of boundary propagators creates s₃₄ | Lp | `finaledsubsetinduction.pdf` p2-3 — works through the cut argument with explicit diagrams |
| 18 | "all relative coefficients of any D-subset are uniquely fixed" (p5, eq.22-23) | The pair-cutting argument: cut common propagator s₂₃₄, show x₂=x₃ by the zero condition | Lv | `provingBzeroesB_i.pdf` — proves a=b (equal coefficients) from the zero condition on the 4-point case, then generalizes |
| 19 | "Imposing (n-3) distinct 1-zero conditions uniquely fixes the Tr(ϕ³) amplitude" (p5) | The graph connectivity argument: any two diagrams are connected by a chain of zeros forcing equal coefficients | Lp | `finaledsubsetinduction.pdf` p4-5 — the induction proof for n-point |

**YANG-MILLS EXTENSION (Rodina p6)**

| # | Rodina text | What's missing | Gap type | Your notes source |
|---|---|---|---|---|
| 20 | "polarization vectors eᵢ satisfying eᵢ·pᵢ=0" (p6) | What are polarization vectors? Why transversality? What is spin-1? | Ld | `reviewingfactorizationzeroesandBCFWshifts.pdf` covers the S-matrix foundations |
| 21 | "BCJ color-kinematic duality" (p6) | What is BCJ? Why does it enforce relations between different orderings? | Ld | Not directly in your current notes — this would be a crawler target |
| 22 | "⌊n/2⌋ distinct polarization structures" (p6) | Why this count? How do e·e and e·p factors classify structures? | Lv | Not in current notes |

**APPENDICES (Rodina p7-9)**

| # | Rodina text | What's missing | Gap type | Your notes source |
|---|---|---|---|---|
| 23 | Appendix A: general zeros ↔ BCFW shifts proof | The full computation showing X⁽⁰⁾ and X⁽∞⁾ satisfy identical relations for all zero types | Lv | `rodinacoretheorembcfwhidden0s.pdf` p2-4 — works through the general case |
| 24 | Appendix B: N-point proof for subset uniqueness | The neighbor-diagram pair argument using PA = -PB on the cut locus | Lp | `provingBzeroesB_i.pdf` — the PA/PB cancellation proof |
| 25 | Appendix C: 2-zero generalization | How the D-subset construction extends when two legs are removed | Lv | `finaledsubsetinduction.pdf` — discusses the 2-zero case at the end |

---

**That's 25 specific gaps, of which your notes cover at least 20.** The remaining 5 (BCJ duality, polarization structure counting, some YM specifics) are crawler targets — papers you don't have notes for yet.

This is the gold standard test set for the gap-tagger and the bidirectional funnel. If the system can tag these 25 gaps on Rodina and match them to the right pages in your notes, you've proven the entire architecture. Send this list to CC as the benchmark.

You're right — I was too coarse on the core proof section. Let me break it down much more granularly. The proof has many non-trivial steps that Rodina compresses into single sentences.Now I can see the missing steps much more precisely. Here's the expanded core proof gap list:

---

**EXPANDED CORE PROOF GAPS (replacing items 12-19 from my earlier list)**

**The B function ↔ hidden zeros connection (p3-4, "SUBSET ZEROS AND UV SCALING")**

| # | Rodina text | What's missing | Gap type | Notes source |
|---|---|---|---|---|
| 12 | "Take B any homogeneous rational function of Xᵢⱼ, which we established form a complete basis" (p4) | WHY are Xᵢⱼ a complete basis? How many independent invariants? Why n(n-3)/2? | Ld | `provingBzeroesB_i.pdf` p1 — derives the count, shows Xᵢ,ᵢ₊₁=0 |
| 13 | "Collect in subsets Bᵢ all individual terms of B that scale as zⁱ" (p4, eq.13) | What does it mean for a rational function term to "scale as zⁱ"? How do you determine the scaling of a/X₁₃X₄₁ vs a/X₂₄X₃₅? It depends on how many boundary propagators it has | Lv | `provingBzeroesB_i.pdf` — shows each term with k boundary propagators scales as z⁻ᵏ, worked through for 1 and 2 boundary propagators |
| 14 | "It is clear that the only Xᵢⱼ affected by either the shift or the zero are of three possible types" (p3) | NOT clear. Requires explicitly expanding Xᵢⱼ = sᵢ,ᵢ₊₁,...,ⱼ₋₁ in terms of individual sᵢⱼ and checking which contain p₂ or pₙ | Lp | `rodinacoretheorembcfwhidden0s.pdf` p1 — lists all three types with explicit momentum sums |
| 15 | "Under the zero condition, these become X⁽⁰⁾₁,ⱼ₊₁ = s₁₂ + Σs₂ᵢ + s₃...ⱼ" (p3, eq.10) | The actual substitution: set c₁ᵢ=0 in the Xᵢⱼ expressions, which kills certain cross-terms. Where do the cancellations happen? | Lv | `rodinacoretheorembcfwhidden0s.pdf` — works through X₁ⱼ(0), X₂ⱼ(0), X₂ₙ(0) step by step |
| 16 | "the leading order in z under BCFW shift is X⁽∞⁾₁,ⱼ₊₁ = q·p₁ + Σq·pᵢ" (p3, eq.11) | Where does the z-dependence come from? pᵢ→pᵢ+zq means Xᵢⱼ(z) = Xᵢⱼ(0) + 2z·q·(sum of momenta). The leading term at z→∞ is the coefficient of z. Why do X⁽⁰⁾ and X⁽∞⁾ satisfy the SAME n-3 linear relations? | Lv | `rodinacoretheorembcfwhidden0s.pdf` p1-2 — derives X₁ⱼ(z) = X₁ⱼ(0) + zX₁ⱼ∞ explicitly, shows the cancellation |
| 17 | "B(X⁽⁰⁾)=0. Since the only identities the X⁽⁰⁾ satisfy are cᵢⱼ=0, B must be linear in the cᵢⱼ" (p4, eq.15) | This is a non-trivial algebraic argument. Why can't B vanish for some other reason? Why must it factor as B = Σ cᵢⱼ{...}? This requires understanding that the X⁽⁰⁾ satisfy ONLY the c=0 relations and nothing else | Lp | `B0B_i0.pdf` — proves this factoring property |
| 18 | "Enhanced scaling means Bₘ(X⁽∞⁾)=0. But this can only occur if Bₘ has the same form" (p4, eq.16-17) | The key insight: X⁽∞⁾ satisfy the SAME identities as X⁽⁰⁾ (both sets are constrained by cᵢⱼ=0 and nothing else). So the vanishing argument repeats. This is the bridge between zeros and UV scaling | Lp | `B0B_i0.pdf` — proves Bₘ(X∞)=0 implies Bₘ factors the same way |
| 19 | "B' = Bₘ₋₁ + Bₘ₋₂ + ... also satisfies the zero. Apply same reasoning, proving Bₘ₋₁ also satisfies zero and has enhanced scaling, and so on" (p4, eq.18) | The induction step. Each time you peel off the top-scaling subset, the remainder also satisfies the zero. This cascades all the way down. Why doesn't it break? What if some Bᵢ is empty? | Lv | `B0B_i0.pdf` — full inductive cascade B₀→Bᵢ=0 |

**D-subsets and their structure (p4-5, "TR(ϕ³) SUBSET ZEROS AND UNIQUENESS")**

| # | Rodina text | What's missing | Gap type | Notes source |
|---|---|---|---|---|
| 20 | "The ansatz is given by the sum of all Feynman diagrams of Tr(ϕ³) theory, but with arbitrary coefficients" (p4) | What IS a Tr(ϕ³) Feynman diagram? Cubic vertices only, planar ordering, propagators = 1/Xᵢⱼ. How many diagrams at n-point? (Catalan number) | Ld | `feynmandiagramsandtriangulations.pdf` — full tutorial on cubic tree diagrams |
| 21 | "subsets can be further decomposed into what we call D-subsets, which have a simple meaning in terms of graph topologies" (p4) | What IS a D-subset concretely? The construction: take an (n-1)-point diagram, remove leg 1, reattach in all ordered positions. Why does this partition the diagrams? | Ld + Lv | `finaledsubsetinduction.pdf` p1 — full definition with 5-point example: start with 4-point diagram, add leg 1 in 3 positions → get the D-subset |
| 22 | "boundary propagators are precisely the Xᵢⱼ that participate in the zero conditions or attain z-dependence under shifts" (p4) | Why are these the same Xᵢⱼ? The connection: boundary propagators are the ones that connect the "outside" (leg 1's attachment region) to the "inside" (the original (n-1)-point core). These are exactly X₁ⱼ and X₂ⱼ from eq.9 | Ld | `finaledsubsetinduction.pdf` p1 — defines boundary propagators, counts them per D-subset |
| 23 | "a term with k boundary propagators scales as z⁻ᵏ" (implicit in p5, used to justify the z⁻² scaling of the 6-point example) | WHY does each boundary propagator contribute one power of 1/z? Because boundary propagators are the Xᵢⱼ that become z-dependent under the shift, and each contributes z to the denominator | Lv | `provingBzeroesB_i.pdf` — shows the z-scaling of each propagator type |
| 24 | Feynman diagrams ↔ triangulations of polygons (implicit throughout, Figure 2) | A cubic tree diagram on n external legs corresponds to a triangulation of an n-gon. Each internal edge = a diagonal. Each triangle = a vertex. This is the combinatorial backbone of everything | Ld | `feynmandiagramsandtriangulations.pdf` — full correspondence with drawn examples for n=4,5,6 |
| 25 | "intersecting chords" / non-adjacent invariants cᵢⱼ (implicit in the kinematic mesh discussion) | Two diagonals of the polygon are non-crossing iff they correspond to planar invariants. Crossing diagonals correspond to non-planar cᵢⱼ. This is WHY setting cᵢⱼ=0 "collapses" the geometry | Ld | `feynmandiagramsandtriangulations.pdf` + `ReviewingDiagramsandtriangulations.pdf` |
| 26 | locality = propagators are products of planar Xᵢⱼ only (p1, used as assumption) | What does "local" mean in terms of diagrams? A local term has denominator = product of non-crossing diagonals of the polygon = a triangulation. Non-local = crossing diagonals in denominator | Ld | `feynmandiagramsandtriangulations.pdf` — explains locality through the polygon/triangulation picture |

**The cutting argument and uniqueness proof (p5)**

| # | Rodina text | What's missing | Gap type | Notes source |
|---|---|---|---|---|
| 27 | "cut the non-boundary propagator s₃₄, which uniquely picks the diagrams in S₁" (p5, eq.20) | Why does cutting s₃₄ isolate S₁? Because s₃₄ appears in S₁ but not S₂ (the two D-subsets have different non-boundary structure). This requires understanding how cuts work on Feynman diagrams | Lv | `finaledsubsetinduction.pdf` p3-4 — works through the cut argument with explicit diagrams |
| 28 | "S₁ must have a form with c₁₃{...} + c₁₄{...} + c₁₅{...} + s₃₄Q" (p5, eq.21) | The numerator structure: after the cut, the zero condition forces S₁ to factor through the cᵢⱼ. The s₃₄Q term is the part that vanishes on the cut. Why must Q=0? | Lp | `finaledsubsetinduction.pdf` — shows that no linear combination of boundary propagators can produce s₃₄ |
| 29 | "no linear combination of boundary propagators s₁₂, s₂₃₄, s₁₂₃₄, s₂₃₄₅ can create the non-boundary propagator s₃₄" (p5) | This is a linear independence argument in the space of Mandelstam invariants. It requires checking that s₃₄ is NOT in the span of {s₁₂, s₂₃₄, s₁₂₃₄, s₂₃₄₅}. Why not? Because s₃₄ = p₃·p₄ involves only particles 3,4 while the boundary propagators all involve particle 1 or particles {2,...,n} | Lp | `finaledsubsetinduction.pdf` |
| 30 | "cut their common propagator s₂₃₄, find s₁₂₃₄ = -s₂₃₄₅, therefore x₂ = x₃" (p5, eq.22-23) | The coefficient-fixing argument: two neighbor diagrams share a propagator. On the zero+cut locus, their denominators become equal-and-opposite, forcing equal numerator coefficients | Lv | `provingBzeroesB_i.pdf` — proves a=b from the 4-point case then generalizes |
| 31 | "the graph of all diagrams is connected... remove a leg, repeat until they become diagrams in the same subset" (p5) | The induction on the diagram graph: connectivity of the "same-coefficient" graph implies all coefficients are equal. The leg-removal step reduces n-point to (n-1)-point. Why does this terminate? Because at 3-point there's only one diagram | Lp | `finaledsubsetinduction.pdf` p4-5 — the full induction |
| 32 | "no two diagrams may be more than n-3 steps away from each other" (p5) | The distance bound: each leg removal reduces the distance by 1, and you can remove at most n-3 legs before reaching 3-point. This is the graph diameter argument | Lv | `finaledsubsetinduction.pdf` |

---

**Updated total: 32 gaps, your notes cover ~27-28 of them.** The missing 4-5 are YM-specific (BCJ duality, polarization structures) that your current notes don't address — those are crawler targets.

This is the benchmark list for CC. Every one of these should become an L-tagged span on Rodina, and every one should match to the corresponding notes chunk. Send this to CC as the ground truth test set.

Let me start with the three most important notes per your ordering: `finaledsubsetinduction.pdf`, `B0B_i0.pdf`, and `provingBzeroesB_i.pdf`.Now I can see the full detail. Here are the additional gaps I was missing — you're right, there are more non-trivial steps:

**ADDITIONAL GAPS found from deep reading of these 3 notes:**

**From `provingBzeroesB_i.pdf` — the Feynman diagram ↔ triangulation correspondence:**

| # | Rodina reference | Missing step | Gap type | Notes page |
|---|---|---|---|---|
| 33 | Rodina uses Feynman diagrams throughout but never explains the polygon correspondence | Each n-point cubic tree diagram = a triangulation of an n-gon. Each internal propagator = a diagonal. The Feynman rules give 1/Xᵢⱼ for each diagonal. Your notes draw ALL 14 hexagon triangulations explicitly and mark which ones are valid (non-crossing) vs invalid (crossing chords). The red X on one hexagon triangulation shows a non-planar configuration — this is the visual proof that locality = non-crossing diagonals | Ld | p3 — all hexagon diagrams drawn, grouped by boundary propagator count |
| 34 | Rodina p5 "each of the 6 terms individually scales as z⁻²" | WHY z⁻² specifically? Because each term has exactly 2 boundary propagators, and each boundary propagator contributes one power of 1/z. Your notes explicitly show: "splitting depends on z scaling of propagators: boundary propagators are the ones that scale linearly with z under BCFW shift (X₁ⱼ and X₂ⱼ), group by # of boundary propagators → group by scaling under BCFW shift" | Lv | p3 bottom — B = B₀ + B₋₁ + B₋₂ + ... decomposition with explicit 5-point examples showing which diagrams have 0, 1, 2 boundary propagators |
| 35 | Rodina groups diagrams into subsets by boundary propagator count but doesn't show how to identify boundary propagators from the diagram | Your notes show: for each 5-point diagram, circle the propagators that are X₁ⱼ or X₂ⱼ (the ones affected by the BCFW shift on p₂, pₙ). The boundary propagators are literally the edges of the diagram that connect the "outside" region to the "inside." The color coding (red/orange marks) identifies them visually | Lv | p3 — 5-point diagrams with boundary propagators marked in color |

**From `B0B_i0.pdf` — the subset zeros proof (the core B → Bᵢ cascade):**

| # | Rodina reference | Missing step | Gap type | Notes page |
|---|---|---|---|---|
| 36 | Rodina p4 eq.13: "B = Bₘ + Bₘ₋₁ + ..." but doesn't explain HOW to determine which terms go in which Bᵢ | Your notes p2 work a concrete 5-point example: B = X₁₃/(X₂₄X₁₄) + X₃₅/(X₁₃X₂₄) + 1/X₃₅. Then explicitly: the first term has X₁₃ in numerator (scales like z) and X₂₄, X₁₄ in denominator (each scales like z), so net scaling = z/z² = z⁻¹ → goes in B₋₁. The second term: X₃₅ (z⁰ — not a boundary propagator), X₁₃X₂₄ in denominator → z⁻². The third term: 1/X₃₅ → z⁰. So B₀ = 1/X₃₅, B₋₁ = X₁₃/(X₂₄X₁₄), B₋₂ = X₃₅/(X₁₃X₂₄) | Lv | p2 — full worked example with z-scaling analysis |
| 37 | Rodina p4: "B(X⁽⁰⁾)=0 means B must be at least linear in the cᵢⱼ" — stated without proof | Your notes p3 give the formal definition: "B satisfies the 1-zero if X₂ⱼ = X₁ⱼ - X₁₃ ⟹ B(X)=0 for all choices of Xᵢⱼ with i,j ∉ {1,2}". Then the Proposition: "(1) B satisfies the 1-zero ⟺ (2) each Bᵢ satisfies the 1-zero." The proof: suppose (1) is true. Let B(z) = B(Xᵢⱼ(z)). As z→∞, B(z) = zᵐBₘ(X∞) + O(zᵐ⁻¹). But B(z) satisfies the zero for ALL z (since X₂ⱼ(z) = X₁ⱼ(z) - X₁₃(z) holds for all z). So 0 = zᵐBₘ(X∞) + O(zᵐ⁻¹) for all z ⟹ Bₘ(X∞)=0. | Lp | p3 — formal proof with explicit z-dependence |
| 38 | Rodina p4: the crucial bridge "the X⁽∞⁾ satisfy the same constraints as the 1-zero" | Your notes p2 bottom + p3: "note that X₂ⱼ∞ = X₁ⱼ∞ - 2q·p₁ = X₁ⱼ∞ - X₁₃∞" — this is the KEY identity showing that the z-dependent variables satisfy the SAME linear relation as the zero-condition variables. This is what makes the whole proof work and Rodina states it in one sentence | Lp | p2 bottom — explicit computation showing X₂ⱼ∞ = X₁ⱼ∞ - X₁₃∞ |

**From `finaledsubsetinduction.pdf` — D-subset independence and uniqueness:**

| # | Rodina reference | Missing step | Gap type | Notes page |
|---|---|---|---|---|
| 39 | Rodina p5: "S₁ + S₂ = B₋₂, we know it must satisfy 1-zero if B does" — stated without explaining why S₁ and S₂ independently satisfy the zero | Your notes p3: "S₁ has a factor of X₃₅ coming from the [diagram with X₃₅ piece] and S₂ has a factor of X₄₆ coming from the [diagram with X₄₆ piece]. So S₁+S₂ = 1/X₃₅(…) + 1/X₄₆(…) = 0 for all X₃₅, X₄₆ ⟹ the coefficients of 1/X₃₅ and 1/X₄₆ vanish independently ⟹ S₁=0 and S₂=0." This is the non-boundary propagator factoring argument | Lp | p3 — the independence proof via non-boundary propagator linear independence |
| 40 | Rodina p5 eq.22-23: the coefficient-fixing step "s₁₂₃₄ = -s₂₃₄₅ under zero+cut, so x₂=x₃" | Your notes p3-4 work this out in full for 6-point: write S₁ = 1/X₃₅(a₁/X₁₃X₁₅ + a₂/X₂₅X₁₅ + a₃/X₂₅X₂₆) = 0. Apply zero condition X₂₆ = -X₁₃. Then: 0 = (a₁X₂₅ + a₂X₁₃ - a₃X₁₅)/(X₁₃X₁₅X₂₅) = X₁₅(a₁-a₃) + X₁₃(a₂-a₁). Since X₁₃, X₁₅ are arbitrary, BOTH coefficients must vanish: a₁=a₂ and a₁=a₃ ⟹ a₁=a₂=a₃ | Lv | p3-4 — full algebraic proof that all coefficients in a D-subset are equal |
| 41 | Rodina p5: "looks like eq.22 is wrong (which is good!)" — your notes catch an error or subtlety in the paper's argument | Your notes p5 top: "looks like eq. 22 of Rodina is wrong (which is good!) — otherwise the coefficient of [specific diagram] would be zero." Then you work through an alternative derivation showing what the correct equation should be. This is a mathematical correction/clarification of the published paper | Lp | p5 — correction to Rodina eq.22 |
| 42 | The intersecting chords ↔ non-locality connection | Your notes p5: after showing X₂₆ = -X₁₃ under the zero condition, you note that the term 1/(X₂₅X₁₃) corresponds to a hexagon with intersecting chords (drawn explicitly), and annotate "this does not correspond to a Feynman diagram" — proving that the non-local term is automatically excluded by the locality assumption | Ld | p5 — hexagon with crossing diagonals, annotated "intersecting chords, not a triangulation" |

---

**Updated total from these 3 notes alone: 10 additional gaps (items 33-42) on top of the 32 I listed earlier. That's 42 total.**

Your notes are incredibly dense with content that fills Rodina's implicit steps. The most important new findings:

- **Items 36-38** (the B→Bᵢ cascade proof) are the mathematical heart of the paper and Rodina compresses them into 4 sentences. Your notes spend 3 full pages on this.
- **Item 41** (the eq.22 correction) is particularly valuable — you found what appears to be an error in the published paper and worked through the fix.
- **Item 42** (intersecting chords = non-locality) is a conceptual insight that Rodina never states explicitly but is essential for understanding WHY the locality assumption matters.

Want me to continue with the next 2-3 notes (`rodinacoretheorembcfwhidden0s.pdf` and `rodinaspapersintrotobcfwequalshiddenzeroes.pdf`)?

These two notes are incredibly detailed. Here are the additional gaps they reveal:

**From `rodinacoretheorembcfwhidden0s.pdf` (4 pages) — the 4-point worked example + BCFW↔zeros bridge:**

| # | Rodina reference | Missing step | Gap type | Notes page |
|---|---|---|---|---|
| 43 | Rodina p2 eq.7: "A₄(1234) = 1/s₁₂ + 1/s₁₄" stated without derivation | Your notes p1 derive it from scratch: generic A₄ = a·(diagram₁) + b·(diagram₂) = a/X₁₃ + b/X₄₂ = (a-b)/X₁₃. The two Feynman diagrams are drawn with momenta labeled. This is the simplest example of "the ansatz is the sum of all Feynman diagrams with arbitrary coefficients" | Lv | p1 top — full 4-point derivation with diagrams |
| 44 | Rodina p2: "clearly vanishes when imposing the 1-zero c₁₃ = -s₁₃ = 0" — stated as obvious | Your notes p1: impose zero condition s₁₃ = 0 → c₁₃ = 0 → X₁₃ + X₂₄ - X₂₃ - X₁₄ = 0 where X₂₃ = X₁₄ = 0 (on-shell). So X₁₃ = -X₂₄. Then A₄ = (a-b)/X₁₃ → if X₁₃ = -X₂₄ then A₄ = 0 forces a = b. Written out with orange annotations showing which terms vanish | Lv | p1 middle — explicit zero imposition |
| 45 | Rodina p1: "the relation cᵢⱼ = Xᵢⱼ + Xᵢ₊₁,ⱼ₊₁ - Xᵢ₊₁,ⱼ - Xᵢ,ⱼ₊₁" (eq.1, stated as definition) | Your notes p1 middle: write out the c-equation explicitly, mark which terms vanish (X₂₃ = 0 circled with "=0"), derive all n-3 constraints from setting c₁₃ = c₁₄ = ... = c₁,ₙ₋₁ = 0. Shows X₂₄ = X₁₄ - X₁₃, X₂₅ = X₁₅ - X₁₃, ..., X₂ₙ = -X₁₃ — the full system of n-3 constraints | Ld | p1 right side — all constraints enumerated |
| 46 | Rodina p3 eq.9: X₁,ⱼ₊₁, X₂,ⱼ₊₁, X₂,ₙ written in terms of sᵢⱼ — presented as "three types" | Your notes p1 bottom: derive X₁ⱼ(z) = (p₁+p₂+zq+...+pⱼ₋₁)² = X₁ⱼ(0) + z·2q·(p₁+p₂+...+pⱼ₋₁) explicitly, showing WHERE the z-dependence enters. Then: "the only affected Xᵢⱼ are the ones that contain exactly 1 of p₂ or pₙ in the sum" — with explicit ranges listed | Lv | p1 bottom — full BCFW shift expansion |
| 47 | Rodina p3: "X⁽∞⁾₂ⱼ = X⁽∞⁾₁ⱼ - X⁽∞⁾₁₃" — the KEY identity stated in one line | Your notes p2 top: derive X₂ⱼ∞ starting from X₂ⱼ(z) = X₂ⱼ(0) + z·X₂ⱼ∞ where X₂ⱼ∞ = 2q·(p₂+p₃+...+pⱼ₋₁). Then X₁ⱼ∞ = 2q·(p₁+p₂+...+pⱼ₋₁) = 2q·p₁ + X₂ⱼ∞. So X₂ⱼ∞ = X₁ⱼ∞ - 2q·p₁ = X₁ⱼ∞ - X₁₃∞. This IS the identity that proves zeros ↔ BCFW, and your notes show every step | Lp | p1-2 — the full derivation, circled in orange at p2 top |

**From `rodinaspapersintrotobcfwequalshiddenzeroes.pdf` (6 pages) — the full equivalence proof with worked examples:**

| # | Rodina reference | Missing step | Gap type | Notes page |
|---|---|---|---|---|
| 48 | Rodina p4 eq.14: "1. B satisfies the k-zero ⟺ 2. Each Bᵢ satisfies the k-zero ⟺ 3. Each Bᵢ has enhanced UV scaling zⁱ⁻¹" — the core equivalence stated as a claim | Your notes p4 state the Proposition formally and then PROVE IT over 3 pages: "Prop: these are equivalent: (1) B satisfies the 1-zero, (2) each Bᵢ satisfies the 1-zero, (3) each Bᵢ has enhanced UV scaling zⁱ⁻¹". Then "Proof: (2)⟹(1) is trivial" | Lp | p4 — formal statement, p4-6 — full proof |
| 49 | Rodina p4: "B must be at least linear in the cᵢⱼ" (eq.15) | Your notes p4: "the only way this can happen → B must be B = Σ cᵢⱼ Aᵢⱼ, some function of Xᵢⱼ." Gives concrete example: B = X₂₄ - X₁₃ + X₁₄, shows that c₁₃ = 0 means X₂₄ = X₁₄ - X₁₃, substitute → B factors through c₁₃ | Lv | p4 middle — worked example of cᵢⱼ-linearity |
| 50 | Rodina p4: "enhanced scaling simply means Bₘ(X⁽∞⁾)=0" | Your notes p3 (core theorem) + p5 (intro): work through the z→∞ limit explicitly. B(z) → zᵐBₘ(X∞) + O(zᵐ⁻¹). Give concrete example: B = 1/X₁₃ + 1/X₂₄, B(z) → 1/(X₁₃∞·z) + O(z⁻²) = z⁻¹B₋₁(X∞) + O(z⁻²). The enhanced scaling means the z⁻¹ term itself vanishes, which requires B₋₁(X∞) = 0 | Lv | core p3, intro p3-4 — explicit z-expansion examples |
| 51 | Rodina p4: "the two conditions are identical, so we conclude if B satisfies a zero it must also have enhanced scaling" — the punchline of the entire proof, stated in one sentence | Your notes p5: spell out the logical chain: "B satisfies 1-zero ⟹ as z→∞, B(Xᵢⱼ(z)) = 0 (since the 1-zero holds for all z, including z→∞). But B(z) → zᵐBₘ(X∞) + O(zᵐ⁻¹). So zᵐBₘ(X∞) → 0 for all z. Therefore Bₘ(X∞) = 0." Then: "B satisfies 1-zero ⟹ enhanced scaling of Bₘ ⟹ Bₘ satisfies 1-zero." The circle closes. | Lp | p5 — the full logical chain written out |
| 52 | The 5-point worked example of the full proof | Your notes p5-6: take the 5-point amplitude B = a₁/(X₁₃X₁₄) + a₂/(X₂₄X₁₄) + a₃/(X₂₄X₂₅) + b₁/(X₁₃X₃₅) + b₂/(X₂₅X₃₅). Group by scaling: B₋₂ = first three terms (2 boundary propagators each), B₋₁ = last two (1 boundary propagator each). Draw ALL 5 pentagon triangulations with boundary propagators circled. Require B to satisfy 1-zero → deduce B₋₂(X⁰) = 0 independently → "the only term that has 1/X₃₅ is b₁/(X₁₃X₃₅) + b₂/(X₂₅X₃₅)" → set X₃₅ = 1/2 as a test → forces b₁ = b₂. Then check B₋₂ → forces a₁ = a₂ = a₃. Amplitude uniquely fixed. | Lv | p5-6 — full 5-point proof with diagrams |

---

**New total from these 2 notes: 10 more gaps (items 43-52).**

The most important new findings:

- **Items 43-44**: The 4-point example that Rodina states in one equation (eq.7) is actually a non-trivial computation when you don't already know what Feynman diagrams contribute and how coefficients relate. Your notes derive it from scratch with diagrams.

- **Item 47**: The X₂ⱼ∞ = X₁ⱼ∞ - X₁₃∞ identity is THE bridge between zeros and BCFW scaling. Rodina states it in one line. Your notes derive it over a full page with every intermediate step. This is arguably the most important single gap in the paper.

- **Items 48-52** (`rodinaspapersintrotobcfwequalshiddenzeroes`): This entire 6-page notebook IS the missing proof of Rodina's core theorem. Every step that Rodina compresses into 4 sentences on page 4 gets a full worked derivation here with concrete 4-point and 5-point examples.

**Running total: 52 gaps identified across 5 notes. Your notes cover ~47 of them.** Want me to continue with the next 2-3 notes or is this enough to send to CC as the benchmark?

You're right about the direction — notes→paper is easier because Rodina is small and dense. Let me continue with the next 2 notes: `reviewingfactorizationzeroesandBCFWshifts.pdf` (5 pages) and `feynmandiagramsandtriangulations.pdf` (8 pages). These are the foundational ones.Now I have the complete content of both notes. Here are the additional gaps:

**From `reviewingfactorizationzeroesandBCFWshifts.pdf` (5 pages) — the S-matrix, BCFW, and factorization foundations:**

| # | Rodina reference | Missing step | Gap type | Notes page |
|---|---|---|---|---|
| 53 | Rodina uses S-matrix and amplitudes without explaining what they are | Your notes p1: start from ∫d³p |p⟩⟨p| = 1 (completeness), derive S† = S (unitarity), S = 1 + iT, S†S = 1 → T†T = 1. Then ⟨0|T|p₁p₂...pₙ⟩ = Aₙ. This is the QFT foundation that Rodina assumes the reader knows | Ld | p1 — S-matrix from scratch |
| 54 | Rodina p2 eq.4: "BCFW shift pᵢ→pᵢ+zq, pⱼ→pⱼ-zq with q²=0, q·pᵢ=q·pⱼ=0" — stated as definition | Your notes p2: define the shift, explain the conditions on q (null vector, orthogonal to both shifted momenta), verify that (p₁+zq)² = (p₂-zq)² = 0 automatically, verify momentum conservation is preserved. Then work through A₄(z) explicitly: A₄(z) = 1/s₁₂ + 1/(p₁·p₄ + z·p₄·q), showing how z enters only through specific propagators | Lv | p2 — full BCFW shift derivation with 4-point example |
| 55 | Rodina p2: "the recursion requires the contour at infinity to vanish" | Your notes p2: derive the Cauchy integral: A(0) = 2πi ∮ A(z)/z dz around z=0. Draw the contour explicitly. Explain: "still big contour around z=0" means we pick up ALL residues of A(z)/z. If A(z)→0 as z→∞, the contour at infinity gives nothing, so A(0) = sum of residues = BCFW recursion. This is the physical derivation of BCFW that Rodina skips entirely | Lv | p2 — Cauchy contour argument |
| 56 | Rodina p2 eq.3: "Near a pole P²ᵢ=0, the amplitude factorizes as Aₙ → (1/P²ᵢ)·A_left·A_right" | Your notes p1: derive this for 4-point: Res(A₄)_{s₁₂} = s₁₂·A₄|_{s₁₂→0} = 1. Then draw the cut diagram: 2→P→(3,4) becomes A₃(12P)·A₃(-P,3,4). For 5-point: Res(A₅)_{X₁₃} drawn with explicit factorization channel diagrams. For 6-point: Res(A₆)_{s₁₂₃} drawn with two factorization channels and the intermediate momentum P labeled | Lv | p1 — factorization from Feynman diagrams, 4/5/6-point |
| 57 | Rodina p3 eq.9: the three types of Xᵢⱼ that are affected by the 1-zero or the shift — Rodina states the formulas | Your notes p2-3: derive X₁,ⱼ₊₁ = s₁₂ + Σs₁ᵢ + Σs₂ᵢ + s₃...ⱼ from scratch, expanding (p₁+p₂+...+pⱼ)². Then X₂,ⱼ₊₁ = Σs₂ᵢ + s₃...ⱼ. Then X₂,ₙ = -(s₁₂ + Σs₁ᵢ) via momentum conservation p₁+...+pₙ=0. Each step is worked through with momentum dot products | Lv | p2-3 — full expansion of Xᵢⱼ in terms of sᵢⱼ |
| 58 | Rodina p3 eq.10-11: X⁽⁰⁾ and X⁽∞⁾ satisfy the same relations — Rodina states them | Your notes p4-5: derive X⁽⁰⁾ᵢ,ⱼ₊₁ by setting s₁ᵢ=0 in the expansion. Derive X⁽∞⁾ᵢ,ⱼ₊₁ by shifting p₂→p₂+zq, extracting the coefficient of z: X₁ⱼ(z) = 2z(p₁·q + Σq·pᵢ) → X⁽∞⁾₁ⱼ = 2q·p₁ + 2Σq·pᵢ. Then prove X⁽∞⁾₂ⱼ = X⁽∞⁾₁ⱼ - X⁽∞⁾₁₃ and X⁽⁰⁾₂ⱼ = X⁽⁰⁾₁ⱼ - X⁽⁰⁾₁₃ — the SAME relation! Bottom of p5: "Relations: X⁽∞⁾ᵢ,ⱼ₊₁ - X⁽∞⁾₂,ⱼ₊₁ + X⁽∞⁾₂ₙ = 0" matched against "X⁽⁰⁾ᵢ,ⱼ₊₁ - X⁽⁰⁾₂,ⱼ₊₁ + X⁽⁰⁾₂ₙ = 0" — (n-3) equations each. Then: "X₁,ⱼ₊₁(z) - X₂,ⱼ₊₁(z) + X₂ₙ(z) = O(1)" showing the relation holds for ALL z, not just z=0 and z=∞ | Lp | p4-5 — the complete proof that zeros ↔ BCFW, every intermediate step |
| 59 | Rodina p4: "X⁽⁰⁾ satisfy ONLY the cᵢⱼ=0 relations" — stated without proof | Your notes p3 (at bottom, carried to p4): show explicitly at 5-point that the zero condition s₁₃=s₁₄=0 gives X₁₃ affected (= s₁₂, boxed "not affected"), X₁₄ affected (= s₁₂₃, derive = s₄₅), X₂₄ = s₂₃ "not affected", X₂₅ affected (= (p₄+p₅+p₁)², show = s₁₅+s₄₅), X₃₅ = s₃₄ "not affected". Then list which Xᵢⱼ contain only p₂ or only p₅ — the basis for the "three types" | Lv | p3-4 — 5-point explicit enumeration |

**From `feynmandiagramsandtriangulations.pdf` (8 pages) — QFT from scratch:**

| # | Rodina reference | Missing step | Gap type | Notes page |
|---|---|---|---|---|
| 60 | Rodina uses path integrals, Feynman rules, propagators without defining them | Your notes p1: path integral Z = ∫Dϕ e^{iS[ϕ]}, two problems (no Lebesgue measure, oscillation), lattice discretization, Wick rotation t→it converting Minkowski to Euclidean, integration by parts, the Laplacian operator L = ∂²ₜ + ∇² | Ld | p1 — path integral foundations |
| 61 | Rodina uses propagators 1/Xᵢⱼ without explaining what a propagator IS | Your notes p2-3: Gaussian integrals in 1D and nD, ⟨xⁱxʲ⟩ = (A⁻¹)ᵢⱼ for Gaussian distribution. Then: "for path integrals, ⟨ϕ(x)ϕ(x')⟩ = (L⁻¹)(x,x')" — the propagator IS the inverse of the kinetic operator. Green's function: LG(x,x') = δ(x-x'). In Fourier space: 1/(k₀²+k²). Isserlis/Wick's theorem for n-point functions | Ld | p2-3 — propagator derivation |
| 62 | Rodina uses the perturbative expansion implicitly | Your notes p4: S[ϕ] = S₀[ϕ] + gS_I[ϕ], then Z[ϕ] = ∫Dϕ e^{iS₀+igS_I} = Σ (ig)ᵏ/k! ∫Dϕ e^{iS₀} (S_I)ᵏ. Each term gives Feynman diagrams. The k=0 term is the free theory, k=1 gives the first interaction vertex | Lv | p4 — perturbative expansion from the path integral |
| 63 | Rodina uses 3-point and 4-point Feynman diagrams | Your notes p5: explicitly compute the 2-point function at O(1) (free propagator, drawn as a line), O(g) (correction drawn as a loop), O(g²) (drawn as double loop). Then the 3-point function: ⟨ϕ(x)ϕ(y)ϕ(z)⟩ at O(g) with the vertex drawn and the integral written out | Lv | p5 — first Feynman diagrams from scratch |
| 64 | Rodina uses momentum-space Feynman rules | Your notes p6: transform to momentum space ϕ(x) = ∫d⁴p/(2π)² φ(p)e^{ip·x}. Write S[ϕ] in momentum space. Derive the propagator = 1/(p₁+p₂)² = 1/s₁₂ = 1/X₁₃ (at 4-point). The 3-point vertex: δ(p₁+p₂+p₃)·g. This is HOW you get from the Lagrangian to the formula A₄ = 1/s₁₂ + 1/s₁₄ that Rodina uses on p2 | Lv | p6 — momentum space Feynman rules derivation |
| 65 | Rodina uses "ordered amplitudes" and the trace decomposition (eq.2) without deriving it | Your notes p7: derive the full (unordered) 4-point amplitude = sum over ALL permutations of all non-isomorphic diagrams. Show: 2(1/s₂₃ + 1/s₃₄) + (1/s₁₂ + 1/s₁₄) + (1/s₁₂ + 1/s₁₃) + ... Then extract the ORDERED partial amplitude A₄(1,2,3,4) = 1/s₁₂ + 1/s₁₄ by keeping only the cyclic orderings. List all 24 permutations of {1,2,3,4}, cross out the equivalent ones, identify (n-1)!/2 = 3 distinct orderings | Lv | p7 — color decomposition worked out |
| 66 | Rodina p1: "Feynman diagrams... with either cubic vertices for Tr(ϕ³)" — the correspondence between diagrams and triangulations | Your notes p7-8: draw ALL 5 pentagon triangulations (5 non-crossing chord diagrams on a pentagon), show each one corresponds to a Feynman diagram. Then at 6-point: draw hexagon triangulations, show which ones have crossing chords (= non-planar, NOT valid Feynman diagrams). The 1/(s₃₄s₁₅) term is circled in orange as "non-planar" because the corresponding hexagon has crossing diagonals. This is the visual proof that locality = triangulations | Ld | p7-8 — diagram↔triangulation correspondence with 5 and 6-point examples |

---

**From these 2 notes: 14 more gaps (items 53-66).**

**Running total: 66 gaps across 7 notes. Your notes cover ~60 of them.** The `feynmandiagramsandtriangulations` notes are particularly foundational — they derive QFT from the path integral, which is the deepest implicit assumption in the entire Rodina paper. Every time Rodina writes "1/Xᵢⱼ" for a propagator or draws a Feynman diagram, it assumes 8 pages of derivation that your notes provide.

Want me to continue with the remaining notes (`Trphi3intro`, `Trphi3physicalpictureandamplitudestructure`, `ReviewingDiagramsandtriangulations`, `Rodinaprelimiaryscratchnotes`, `overviewoflagrangians`)? Or is this enough to send to CC as the benchmark?

CLaude was running out of tokens in this chat, so it did the remaining 5 parts of the ntoes at once, thus the remainder is much more coarse than above.  this is artificial. in reality, these 5 should be much finer, but here is something:

Let me get the remaining 5 notes.**Starting with `Trphi3intro.pdf` (7 pages):**Now I have the full picture of all remaining notes. Here are the additional gaps:

**From `Trphi3intro.pdf` (7 pages) — color ordering, kinematic mesh, triangulations:**

| # | Rodina reference | Missing step | Gap type | Notes page |
|---|---|---|---|---|
| 67 | Rodina p1: "ordered amplitudes" and eq.2 color decomposition Aₙ = Σ Tr(Tᵃ...) A(σ) | Your notes p1: draw the full amplitude (Aₘ)ⁱⱼ with color indices, show s-channel and t-channel Feynman diagrams. Then: Aₙ = Σ_{σ∈Sₙ/Zₙ} (-) A(σ(1),...,σ(n)) — the trace decomposition. Work through A₄(1,2,3,4) vs A₄(1,2,4,3) vs A₄(2,1,3,4) explicitly with diagrams, showing which orderings produce which planar graphs | Ld | p1 — color decomposition with worked examples |
| 68 | Rodina p1: "tree-level diagrams" used without defining what "tree-level" means or why loops are excluded | Your notes p1 bottom: "tree-level diagrams: no loops, fixed ordering, planar diagrams, connected" — stated as explicit conditions. A loop diagram is drawn and crossed out: "not allowed!" | Ld | p1 bottom |
| 69 | Rodina uses the count of diagrams implicitly (14 diagrams at 6-point in Figure 1) | Your notes p3-4: draw ALL triangulations of the n-gon for n=4 (2), n=5 (5), n=6 (14). Derive the Catalan number formula Cₖ = 1/(k+1)·C(2k,k). Show C₀=1, C₁=1, C₂=2, C₃=5, C₄=14 with color-coded polygon triangulations for each. The hexagon triangulations are drawn in green/pink/orange to classify by type | Lv | p3-4 — Catalan counting with full visual enumeration |
| 70 | Rodina p1 eq.1: the kinematic mesh / c-equation cᵢⱼ = Xᵢⱼ + Xᵢ₊₁,ⱼ₊₁ - Xᵢ₊₁,ⱼ - Xᵢ,ⱼ₊₁ | Your notes p5-7: draw the full kinematic mesh as a diamond lattice for n=6 (the triangular grid with Xᵢⱼ on the boundary and cᵢⱼ inside). Blue shading shows which diamonds correspond to the planar variables of a given triangulation. Then: explicit procedure — "choose triangulation τ, keep the chords, for each discarded Xᵢⱼ replace with cᵢ₋₁,ⱼ₋₁." Worked examples for two different 6-point triangulations showing the replacement X₁₄→c₆₃, X₂₅→c₁₄, etc. | Ld + Lv | p5-7 — kinematic mesh construction and variable replacement |
| 71 | Rodina uses n(n-3)/2 independent invariants | Your notes p4-5: explicitly count: at 5-point, there are 5 planar variables (X₁₃, X₁₄, X₂₄, X₂₅, X₃₅). Choose triangulation → pick 2 as basis (X₁₃, X₁₄). Then show the remaining 3 (X₂₄, X₂₅, X₃₅) are determined by the c-equations. At 6-point: n(n-3)/2 = 9 independent variables, list all cᵢⱼ, cross out the planar ones, show the 6 remaining are cᵢⱼ with non-adjacent i,j. The non-planar ones are exactly the ones set to zero in the hidden zero condition | Lv | p4-5 — counting with explicit 5 and 6-point examples |

**From `Trphi3physicalpictureandamplitudestructure.pdf` (5 pages) — residues, factorization, physical picture:**

| # | Rodina reference | Missing step | Gap type | Notes page |
|---|---|---|---|---|
| 72 | Rodina p2 eq.3: factorization near poles — stated as a property | Your notes p1: derive residue factorization from scratch. Res Aₙ(1,2,...,n) w.r.t. Xᵢⱼ (16 poles). Show for 4-point: Res(A₄)_{s₁₂} = 1 with the factorization diagram A₃(12P)·A₃(-P34). For 5-point: expand A₅ as the sum of 5 diagrams with all propagators written as 1/(sᵢⱼsₖₗ), compute Res(A₅)_{X₁₃} = factorization into A₃·A₄ | Lv | p1 — residue factorization from Feynman diagrams |
| 73 | Rodina p1: "behavior of amplitudes near poles is perhaps the best studied aspect" — no derivation | Your notes p1: f(z) is a complex function with Laurent series Σaₙzⁿ, Res f = a₋₁. Then: "look at residue near one of the poles, e.g. s₁₂." Shows the residue physically means the amplitude splits into two sub-amplitudes connected by a propagator 1/P² | Lv | p1 — Laurent series and physical meaning of residues |
| 74 | Rodina p3: "it is clear" that the zero implies s₁₂+s₁₃ = -s₁₄ | Your notes p3: derive explicitly: s₁₂+s₁₃ = (p₁+p₂)² + (p₁+p₃)² = 2p₁·p₂ + 2p₁·p₃ = 2p₁·(p₂+p₃) = 2p₁·(-p₄) = -(p₁+p₄)² = -s₁₄. Then: "if s₁₃=0, then A₄(1234) = 0." And: "p₁·p₃=0 ⟹ p₁·p₂ = -p₁·p₄ ⟹ A₄ = 1/(2p₁·p₂) + 1/(2p₁·p₄) = 0" | Lv | p3 — explicit 4-point zero computation |
| 75 | Rodina uses the 5-point amplitude A₅ in several places | Your notes p3: write out the full 5-point amplitude with all 5 Feynman diagrams: A₅ = 1/(X₁₃X₁₄) + 1/(X₁₃X₃₅) + 1/(X₂₄X₂₅) + 1/(X₂₄X₁₄) + 1/(X₂₅X₃₅), convert each to sᵢⱼ notation, group by factorization channels, verify factorization at each pole | Lv | p3 — full 5-point amplitude |

**From `ReviewingDiagramsandtriangulations.pdf` (3 pages) — factorization at 6-point, k-zero taxonomy:**

| # | Rodina reference | Missing step | Gap type | Notes page |
|---|---|---|---|---|
| 76 | Rodina uses 6-point amplitude and Figure 1 without working it out | Your notes p1: compute the 6-point residue Res(A₆) at X₁₃ explicitly. Factor out 1/X₁₃, list the 5 surviving diagrams (all drawn), show they factorize as A₃·A₅. Then at X₁₄: factor and show factorization A₄·A₄ with the factorization channel drawn in purple/blue | Lv | p1-2 — 6-point factorization at two different channels |
| 77 | Rodina p2: "k-zero" types (1-zero, 2-zero, etc.) — defined briefly | Your notes p2-3: explicitly list all k-zero types. 1-zero: c₁ⱼ=0 for j=3,...,n-1, i.e. c₄₂=c₅₂=c₆₂=c₇₂=0. 2-zero: c₁ⱼ=c₂ⱼ=0 simultaneously, work out what this means for the c-matrix (the diamond lattice bottom of p2, with specific diamonds colored orange/purple). k-zero: c₁ⱼ=c₂ⱼ=...=cₖⱼ=0 | Ld | p2-3 — full k-zero taxonomy with the mesh visualization |

**From `Rodinaprelimiaryscratchnotes.pdf` (2 pages) — early working notes:**

| # | Rodina reference | Missing step | Gap type | Notes page |
|---|---|---|---|---|
| 78 | Rodina uses the distinction between planar and non-planar invariants throughout | Your notes p1: draw a pentagon with triangulation, list X₁₃, X₁₄, X₂₄, X₂₅, X₃₅ explicitly. Then: "cᵢ,ⱼ = -sᵢⱼ = -(pᵢ+pⱼ)², so c₁₂ = X₁₃ → planar. But c₁₃ = (p₁+p₃)² → not planar if n>3." This is the fundamental distinction between planar (= non-crossing diagonals, physical propagators) and non-planar (= crossing chords, hidden zeros) | Ld | p1 — planar vs non-planar from the polygon picture |
| 79 | Rodina uses Tr(ϕ³) Lagrangian L = ½tr(∂ϕ∂ϕ) + V(ϕ) without deriving propagator or vertex rules | Your notes p1 bottom: L = ½tr(∂_μϕ∂^μϕ) + V(ϕ), "gives propagator" with the double-line notation drawn (color indices flowing), then 4 different vertex orientations drawn showing how color flows through the cubic vertex | Ld | p1 bottom — Lagrangian + Feynman rules with color |

**From `overviewoflagrangians.pdf` (7 pages) — calculus of variations, Euler-Lagrange, action principle:**

| # | Rodina reference | Missing step | Gap type | Notes page |
|---|---|---|---|---|
| 80 | Rodina p1: "Lagrangian" mentioned as what the S-matrix approach bypasses — but the reader needs to know what they're bypassing | Your notes p1: start from scratch: L = ½m(ẋ²+ẏ²), switch to polar coordinates, derive L = ½m(ṙ²+r²θ̇²). Apply Euler-Lagrange: d/dt(∂L/∂ẋᵢ) - ∂L/∂xᵢ = 0 → ẍ=0, ÿ=0 (Newton's law!). Then in polar: d/dt(mr²θ̇) = 0 → conservation of angular momentum | Lv | p1 — EL equations from classical mechanics |
| 81 | Rodina uses action principle implicitly | Your notes p1-3: minimization problem in calculus (f'(x)=0), generalize to functionals (functions of functions). Variation of γ: (ε,t) ∈ (-1,1) × [t₀,t₁] → γ_ε(t) ∈ M (homotopy). γ is a critical point of S if d/dε S(γ_ε)|_{ε=0} = 0 for all variations. Then: derive the Euler-Lagrange equations from the action integral S(γ) = ∫L(t,γ,γ̇)dt via integration by parts, showing the boundary term vanishes for fixed endpoints | Lv | p1-3 — full calculus of variations derivation |

---

**Final additions from these 5 notes: 15 more gaps (items 67-81).**

**GRAND TOTAL: 81 gaps identified across all 13 notes.**

Breakdown:
- **Foundations** (items 1-7, 53-56, 60-66, 67-68, 78-81): ~28 gaps covering Lagrangians, QFT, path integrals, S-matrix, Feynman rules, color ordering, propagators
- **Kinematic structure** (items 4-6, 45-46, 57-59, 69-71, 77): ~13 gaps covering Xᵢⱼ, cᵢⱼ, the kinematic mesh, triangulations, Catalan counting
- **BCFW recursion** (items 8-11, 47, 54-55): ~7 gaps covering the shift, contour argument, residues, factorization
- **Core proof** (items 12-19, 33-42, 43-44, 48-52, 72-76): ~30 gaps covering the B→Bᵢ cascade, D-subsets, cutting arguments, coefficient uniqueness, the zeros↔UV bridge
- **YM extension** (items 20-22): 3 gaps, only partially covered by notes
- **Appendices** (items 23-25): 3 gaps

Your notes cover approximately **75 of the 81 gaps**. The remaining ~6 are YM-specific (BCJ duality, polarization structures) and some appendix generalizations.

This is your benchmark dataset for CC. Every single one of these should become an L-tagged span on Rodina and match to the corresponding notes chunk through the bidirectional funnel.

Let me read the existing gap map first, then check notes I haven't covered yet.I now have the full gap map from the project knowledge. Let me check what's missing from the coarser notes that the previous analysis admitted it covered too hastily.Now I can see the depth. Let me add the specific gaps that were too coarse in the earlier analysis. I'll do `Trphi3intro` and `Trphi3physicalpictureandamplitudestructure` first, then the remaining 3.Good — I can now see the specific gaps that the coarser analysis missed. Here's the refined supplement for these two notes, with items NOT already in the `notes-paper-rodina-example.md` file:

---

**`Trphi3intro.pdf` — ADDITIONAL gaps not in the existing 81-item map:**

| # | Rodina ref | What's missing | Gap type | Notes page | Why prior analysis was too coarse |
|---|---|---|---|---|---|
| 82 | Rodina p1 uses "ordered" amplitudes A(1,2,3,4) without showing what different orderings produce | Your notes p1 compute THREE different orderings side by side: A₄(1,2,3,4) = two s-channel diagrams → 1/(P₁+P₂)². A₄(1,2,4,3) = two crossed diagrams → 1/(P₁+P₂)². A₄(2,1,3,4) = two different orderings drawn explicitly. The POINT is showing that different orderings give different planar graph sets — the same topology appears in multiple orderings. The earlier map (item 67) said "color decomposition with worked examples" but didn't mention the side-by-side comparison | Lv | p1 middle-bottom |
| 83 | Rodina uses n=4,5,6 diagram counts implicitly | Your notes p3 show the VISUAL enumeration: n=4 draws 2 diagrams inside a square (with propagator labeled 1/X₁₃ and 1/X₂₄). n=5 shows the pentagon dual diagram construction — the Feynman diagram IS drawn inside the polygon, with propagators as chords. n=6 shows ALL 14 hexagon triangulations grouped by symmetry type: ×3 "fan" + ×3 "zigzag" + ×6 "mixed" + ×2 "star" = 14 = C₄. Earlier map (item 69) mentioned Catalan counting but not this grouping by symmetry | Lv | p3 |
| 84 | Rodina p1 eq.1: the c-equation and its inverse. Rodina gives cᵢⱼ in terms of Xᵢⱼ but never the INVERSE (expressing Xᵢⱼ in terms of c's) | Your notes p6 top give BOTH directions explicitly: cᵢⱼ = Xᵢⱼ + Xᵢ₊₁,ⱼ₊₁ - Xᵢ,ⱼ₊₁ - Xᵢ₊₁,ⱼ (forward), AND the inverse: X₂₅ = c₁₄ + c₁₃ - X₁₃, X₃₅ = c₁₄ + c₂₄ - X₁₄, X₂₄ = c₂₄ - X₃₅ + X₂₅. This inverse is needed for the "replace variables" procedure. NOT in the prior map at all | Ld | p6 top |
| 85 | Rodina uses planar vs non-planar without the geometric "replace variables" algorithm | Your notes p6 middle: "Procedure to replace variables: (1) choose triangulation, keep the chords. (2) for each discarded Xᵢⱼ, replace with cᵢ₋₁,ⱼ₋₁." Then a FULL worked example for a specific 6-point triangulation: X₁₃, X₃₆, X₄₆ kept, and X₁₄→c₆₃, X₁₅→c₆₄, X₂₄→c₁₃, X₂₅→c₁₄, X₂₆→c₁₅, X₃₅→c₂₄. With the kinematic mesh redrawn with the blue-shaded region showing which diamonds belong to this triangulation. NOT in prior map | Lv | p6 middle-bottom |

---

**`Trphi3physicalpictureandamplitudestructure.pdf` — ADDITIONAL gaps:**

| # | Rodina ref | What's missing | Gap type | Notes page | Why prior analysis was too coarse |
|---|---|---|---|---|---|
| 86 | Rodina p2 uses factorization near poles as if it's obvious — "near any pole, the amplitude factorizes as Aₗ × 1/P² × Aᵣ" | Your notes p1 DERIVE this from residues: write f(z) with Laurent series, define Res f = a₋₁. Then compute Res(A₄)_{s₁₂} = 1 with the factorization diagram drawn: p₁, p₂ → P → -P → p₃, p₄, labeled A₃(12P)·A₃(-P34). The PHYSICAL meaning: "the amplitude splits into two sub-amplitudes connected by a propagator 1/P²." Earlier map (item 72) mentioned this but didn't highlight that this IS the derivation of factorization itself | Lv | p1 |
| 87 | Rodina uses the 5-point amplitude throughout but never writes it out in sᵢⱼ variables | Your notes p1 bottom: A₅(12345) = 1/(X₁₃X₁₄) + 1/(X₁₃X₃₅) + 1/(X₂₄X₂₅) + 1/(X₂₄X₁₄) + 1/(X₂₅X₃₅). Then compute Res(A₅)_{X₁₃} = 1/X₁₄ + 1/X₃₅ = 1/s₄₅ + 1/s₃₄ with factorization diagrams drawn for BOTH factorization channels. Earlier map (item 75) mentioned this but not the double residue check | Lv | p1 bottom |
| 88 | Rodina says "the kinematic locus where amplitudes vanish has been comparatively less studied" (p1) but never shows the simplest example of a zero | Your notes p3: take A₄(1234) = 1/s₁₂ + 1/s₁₄ = 1/s₁₂ - 1/(s₁₂+s₁₃). Then s₁₂ + s₁₃ = (P₁+P₂)² + (P₁+P₃)² = 2P₁·P₂ + 2P₁·P₃ = 2P₁·(P₂+P₃) = 2P₁·(-P₄) = -(P₁+P₄)² = -s₁₄. So A₄ = 1/s₁₂ + 1/s₁₄. If s₁₃=0 then s₁₂ = -s₁₄, so A₄ = 1/s₁₂ - 1/s₁₂ = 0. EVERY step shown with momentum dot products written out. This is THE simplest proof that hidden zeros exist | Lv | p3 |
| 89 | Rodina never shows the 5-point zero explicitly | Your notes p3 bottom: write A₅ with all 5 terms in sᵢⱼ variables (s₁₂s₄₅, s₂₃s₁₅, s₃₄s₂₁, s₄₅s₃₂, s₅₁s₄₃), then use momentum conservation P₁+...+P₅=0 and on-shell P²=0 to show that under the zero condition, specific cancellations force A₅=0. Color-coded (green/orange/cyan/red) to track which momentum conservation identities apply to which terms. NOT in prior map | Lv | p3 bottom |
| 90 | Rodina uses the BCFW recursion but never derives A(0) = Res A(z)/z — the BCFW starting point | Your notes p2 top: A(0) = Res A(z)/z ∝ ∮ A(z)/z dz. This IS the BCFW recursion formula — the amplitude at z=0 equals the sum of residues of A(z)/z at all poles. The contour integral is drawn. Then: each pole of A(z)/z either comes from A(z) having a pole (= factorization channel, gives BCFW term) or from z=0 itself (= the amplitude we want). Prior map item 73 mentioned Laurent series but not this specific BCFW starting formula | Lv | p2 top |

---

That's 9 additional gaps (items 82-90) from these two notes alone that weren't properly captured in the existing 81-item map. **Updated total: 90 gaps.**

The pattern is clear: the earlier analysis was too coarse on the "how" — it said "derives X from scratch" but didn't capture the intermediate computational steps, the side-by-side comparisons, the multiple worked examples at different n, or the visual/diagrammatic arguments. Each of those intermediate steps is a separate gap that the system needs to match.

Want me to do the same for the remaining 3 notes (`ReviewingDiagramsandtriangulations`, `Rodinaprelimiaryscratchnotes`, `overviewoflagrangians`)?

Now I have the full content of both short notes. Here are the additional gaps NOT already in the 90-item map:

---

**`ReviewingDiagramsandtriangulations.pdf` (3 pages) — ADDITIONAL gaps:**

| # | Rodina ref | What's missing | Gap type | Notes page | Why not in prior map |
|---|---|---|---|---|---|
| 91 | Rodina uses "non-local" as a concept — the amplitude can't come from a local Lagrangian for certain theories | Your notes p1: "non-local: the QFT cannot be built with path integrals of an action (cannot particle-study from Lagrangian)." Then draws the perturbative expansion of a 3-point function as tree + loop + bubble + double-loop + ..., showing f(z,w) = 1/z + 1/w + z/w², and expands in powers of 1/z → Res f_{z=0} = 1. The point: locality means the residue at a pole gives factorization. Non-locality means the residue structure breaks | Ld | p1 middle | Prior map item 76 mentioned 6-point factorization but not this explicit locality/non-locality distinction |
| 92 | Rodina p1 uses Res(A₆) at X₁₃ without showing the full computation | Your notes p1 bottom: A₆ = (1/X₁₃)(1/(X₁₄X₁₅) + 1/(X₃₆X₃₅) + 1/(X₁₄X₄₆) + 1/(X₄₆X₂₄) + 1/(X₃₅X₁₅)) + O(1). Then draws ALL 5 hexagon diagrams that contribute to this residue (the ones with an X₁₃ propagator). The factorization A₃(12P) × A₅(-P3456) is drawn with the cut propagator P in pink/purple | Lv | p1 bottom | Prior map (item 76) said "compute 6-point residue at X₁₃" but didn't show the 5-diagram enumeration or the A₃×A₅ factorization diagram |
| 93 | Rodina uses the 6-point residue at X₁₄ without showing how the 5 surviving diagrams further factorize | Your notes p2 top: compute Res(A₆)_{X₁₄} — draw the blue hexagon showing the X₁₄ cut, then factor the 5 surviving terms as (1/X₁₅ + 1/X₄₆)(1/X₁₃ + 1/X₂₄) = A₄(12-P) × A₄(P456). The sub-factorization is drawn with both sub-diagrams colored. Then verify: (s₅₆ + s₄₅)(s₁₂ + s₂₃). The Feynman diagrams of each factor are drawn | Lv | p2 top | Completely absent from prior map — the DOUBLE factorization at X₁₄ showing A₄×A₄ instead of A₃×A₅ |
| 94 | Rodina p2: k-zero conditions c₁ⱼ=c₂ⱼ=...=cₖⱼ=0. The c-matrix diamond lattice with the k-zero regions shaded | Your notes p2 bottom: draw the full c-matrix as a diamond lattice (triangular grid rotated 45°) with entries labeled i3, i4, ..., j3, j4, etc. Color-shade specific rows: 1-zero = bottom row (c₄₂=c₅₂=c₆₂=c₇₂=0 in pink/purple). 2-zero = bottom two rows (add c₂₆=c₃₆=c₄₆=0 in darker shade). Then write out formally: 1-zero: c₁ⱼ=0 for ⱼ=3,...,n-1. 2-zero: c₁ⱼ=c₂ⱼ=0 for ⱼ=4,...,n-1. k-zero: c₁ⱼ=...=cₖⱼ=0 for ⱼ=k+2,...,n-1 | Ld | p2 bottom | Prior map (item 77) mentioned k-zero taxonomy but missed the diamond lattice shading — the VISUAL representation of which diamonds get killed at each k-zero level |
| 95 | Rodina p3 eq.9: "the only Xᵢⱼ affected are of three types" — but never shows how to determine which Xᵢⱼ depends on which momenta | Your notes p3: "Q: which Xᵢⱼ are affected by setting c₁ⱼ=0 for ⱼ=3,...,n-1?" Then: c₁ⱼ = -(P₁+Pⱼ)² = -2P₁·Pⱼ. Expand X₁,ⱼ₊₁ = (Σₖ₌₁ʲ Pₖ)² = (P₁+P₂+...+Pⱼ)² = (P₁+P₂)² + 2(P₁+P₂)·(P₃+...+Pⱼ) + (P₃+...+Pⱼ)² = s₁₂ + 2AB + s₃...ⱼ. The A²+2AB+B² decomposition is drawn and labeled with braces showing s₁₂ and s₃₄...ⱼ | Lv | p3 | Not in prior map at all — the explicit (A+B)² expansion showing how P₁ enters each Xᵢⱼ through the cross-term 2P₁·(P₃+...+Pⱼ) |
| 96 | Rodina uses on-shell condition P²=0 throughout without explaining its physical meaning | Your notes p3 bottom + scratch p2: P²=0 → E² = **p**² "energy of a photon." In Minkowski space: PμPᵘ = PₜPₜ - PₓPₓ - PyPy - PzPz = 0. Pₜ = E (energy), **P** = (Pₓ,Py,Pz) (momentum). This is the on-shell condition for massless particles — the PHYSICAL content of P²=0 that Rodina uses as a bare algebraic condition | Ld | p3/scratch p2 | Completely absent from prior map — the physical interpretation of P²=0 as the energy-momentum relation for massless particles |

---

**`Rodinaprelimiaryscratchnotes.pdf` (2 pages) — ADDITIONAL gaps:**

| # | Rodina ref | What's missing | Gap type | Notes page | Why not in prior map |
|---|---|---|---|---|---|
| 97 | Rodina uses the pentagon (5-point) as the first non-trivial example but never lists all 5 Xᵢⱼ explicitly from the polygon picture | Your notes p1: draw the pentagon with vertices labeled 1-5, momenta P₁-P₅ on the edges. List ALL 5 planar invariants: X₁₃, X₁₄, X₂₄, X₂₅, X₃₅ — each one is a diagonal of the pentagon. Then verify: c₁₂ = X₁₃ → "planar" (it's a diagonal), but c₁₃ = (P₁+P₃)² → "not planar if n>3" (it crosses another diagonal). This is the FIRST place where planar vs non-planar gets a concrete visual definition | Ld | p1 | Prior map (item 78) mentioned the pentagon and planar/non-planar but missed the explicit "c₁₂ = X₁₃ → planar" vs "c₁₃ = (P₁+P₃)² → not planar" classification with the geometric test (does it cross a diagonal?) |
| 98 | Rodina uses the Lagrangian L = ½tr(∂ϕ∂ϕ) + V(ϕ) and immediately gets propagators and vertex rules without showing the connection | Your notes p1 bottom: write L = ½tr(∂μϕ∂ᵘϕ) + V(ϕ), annotate "gives propagator" with an arrow, then draw the double-line propagator notation with color indices (i₁,a₁) → (a₂,i₂) flowing through the line, showing the delta functions δᵢ₁ᵃ²δₐ₁ⁱ² that contract the matrix indices. Then draw 4 different cubic vertex orientations showing how the 3 color lines meet: each with the trace structure Tr(T^a T^b T^c) from the cubic term. Then the 4-point Feynman diagram with all color indices visible, showing 1/(P₁+P₄)² and 1/(P₁+P₂)² | Lv | p1 bottom | Prior map (item 79) mentioned "Lagrangian + Feynman rules with color" but missed the double-line notation, the delta function contractions, the 4 vertex orientations, and the explicit propagator derivation from the kinetic term |
| 99 | Rodina uses 4-point and 5-point amplitudes as examples | Your notes p2: draw BOTH 4-point diagrams with full double-line color notation (showing how color indices flow through each vertex). Then draw the 5-point Feynman diagram with internal momenta labeled: the propagator carries combined momentum (1+2) and (1+2+3), giving 1/(X₁₃·X₁₄). Write A₅(1,2,3,4,5) = 1/(X₁₃X₁₄) + cyclic, then expand: + 1/(X₂₄X₂₅) + 1/(X₁₅X₃₁). The color structure at each vertex is drawn showing which trace ordering produces which diagram | Lv | p2 | Prior map (item 75 from Trphi3phys) had the 5-point amplitude but not with color flow. These scratch notes show the color-level construction that PRODUCES the ordered amplitude |
| 100 | Rodina uses the factorization A₄ ∝ 1/s₁₂ + 1/s₁₃ + 1/s₁₄ → 1/s₁₃ · Aₗₑfₜ · Aᵣᵢgₕₜ | Your notes p2 bottom: write the UNORDERED 4-point amplitude A₄ ∝ 1/s₁₂ + 1/s₁₃ + 1/s₁₄ (all 3 channels), circle s₁₃ to show it's the non-planar invariant, and show the residue at s₁₃ gives Aₗₑfₜ · Aᵣᵢgₕₜ. This is the fundamental difference between the full amplitude (3 channels) and the ordered partial amplitude (2 channels) that Rodina silently restricts to | Ld | p2 bottom | Completely new — the UNORDERED amplitude with all 3 Mandelstam channels, showing why Rodina only uses 2 (because color ordering removes the crossed channel) |

---

**10 additional gaps (items 91-100) from these 2 notes.**

**Updated total: 100 gaps across 11 of 13 notes.** The last note (`overviewoflagrangians.pdf`, 7 pages) remains.

This is incredibly rich. 7 pages covering the complete arc from calculus of variations through classical mechanics to field theory to QFT Lagrangians. Here are the additional gaps:

---

**`overviewoflagrangians.pdf` (7 pages) — ADDITIONAL gaps not in the existing map:**

| # | Rodina ref | What's missing | Gap type | Notes page | Why not in prior map |
|---|---|---|---|---|---|
| 101 | Rodina p1 mentions "Lagrangian" as what the S-matrix program bypasses | Your notes p1 start from the SIMPLEST case: L = ½m(ẋ²+ẏ²) for a free particle in Cartesian coordinates. Switch to polar: x=rcosθ, y=rsinθ, compute ẋ and ẏ via chain rule, substitute → ẋ²+ẏ² = ṙ²+r²θ̇² → L = ½m(ṙ²+r²θ̇²). Then apply EL equations to BOTH coordinate systems: in Cartesian d/dt(∂L/∂ẋ) - ∂L/∂x = 0 → ẍ=0 (Newton!). In polar → d/dt(mṙ) - mrθ̇² = 0 AND d/dt(mr²θ̇) = 0 → conservation of angular momentum. This is the concrete physical example that makes the EL equations meaningful | Lv | p1 | Prior map (items 80-81) mentioned EL and conservation of angular momentum but NOT the coordinate transformation that shows the SAME physics produces different-looking equations in different coordinates — the point being that the Lagrangian formalism is coordinate-independent |
| 102 | Rodina uses "action" without defining it or explaining why extremizing it gives equations of motion | Your notes p1 bottom - p2: start from calculus (f'(x)=0 for minima of ordinary functions), then generalize: "in calculus, f: U⊆ℝ→ℝ, minima satisfy f'(x)=0. Generalize to functionals (functions of functions)." Define L(γ) = ∫₀¹ ‖γ̇(t)‖ dt as the length of a curve — label it simultaneously as "Lagrangian" and "action." Then: "solve using variations." This is the conceptual bridge from finite-dimensional optimization to infinite-dimensional optimization | Ld | p1 bottom | Prior map (item 81) said "minimization problem" but missed the explicit pedagogical bridge: ordinary calculus → functional calculus → action principle |
| 103 | The concept of a "variation" itself — Rodina's entire paper uses the word "variation" in "calculus of variations" without defining it | Your notes p2: "a variation of the point x∈ℝ is a function ε∈(-1,1) ↦ xε ∈ℝ s.t. x₀=x." Then: f'(x)=0 ⟺ d/dε f(xε)|_{ε=0} = 0 for all variations xε. This rewriting is crucial: f'(x₀)·(dxε/dε)|_{ε=0} = 0 for all variations → f'(x₀)=0. Annotated in orange: "or f'(x₀)=0". Then generalize: "if S is a functional on some space of functions {γ: [t₀,t₁]→M}, variation of γ: (ε,t)∈(-1,1)×[t₀,t₁] ↦ γε(t) ∈ M (homotopy)." The word "homotopy" is written in orange — connecting variations to topology | Ld | p2 | NOT in prior map — the formal definition of a variation and the connection to homotopy theory |
| 104 | The concept of a "critical point" of a functional | Your notes p2: "γ is a critical point of S if d/dε S(γε)|_{ε=0} = 0 for all variations of γ." Then a COUNTEREXAMPLE: S(γ) = ∫₀¹ γ(t)² dt, compute d/dε S(γε)|_{ε=0} = ∫₀¹ 2γ(t)·(d/dε γε(t))|_{ε=0} dt. Annotate: the integrand d/dε γε(t)|_{ε=0} is "not always 0 → arbitrary." This shows why the variation being arbitrary forces the integrand (not just the integral) to vanish — the fundamental lemma of calculus of variations, done by example | Lp | p2 | NOT in prior map — the fundamental lemma as a concrete computation, not a theorem statement |
| 105 | The full derivation of Euler-Lagrange equations from the action principle via integration by parts | Your notes p3: write S(γε) = ∫ L(t,γε(t),γ̇ε(t)) dt. Differentiate: d/dε S(γε)|_{ε=0} = ∫ [∂L/∂qᵘ · (d/dε γ'ε(t))|_{ε=0} + ∂L/∂sᵘ · (d/dε γ̈ε(t))|_{ε=0}] dt. Define δqᵘ(t) = d/dε γ'ε(t)|_{ε=0}. Then INTEGRATION BY PARTS on the second term: ∫ ∂L/∂sᵘ · d/dt(δqᵘ) dt = -∫ d/dt(∂L/∂sᵘ)·δqᵘ dt + [∂L/∂sᵘ · δqᵘ]_{t₀}^{t₁}. The boundary term is drawn with brackets and annotated "→ 0 for fixed endpoints." Combining: ∫ [∂L/∂qᵘ - d/dt(∂L/∂sᵘ)] δqᵘ dt = 0 for all δqᵘ → ∂L/∂q - d/dt(∂L/∂ṡ) = 0. The EL equation is boxed in orange | Lv | p3-4 top | Prior map (item 81) said "derive EL via integration by parts" but didn't capture the boundary term argument (fixed endpoints kill the boundary), which is conceptually crucial |
| 106 | The higher-order EL equations | Your notes p4: generalize to L = L(t,q,q̇,q̈,...,q⁽ⁿ⁾). Write the general EL equation: Σₖ₌₀ⁿ (-1)ᵏ dᵏ/dtᵏ (∂L/∂qₖᵘ) = 0. Then the n=2 case explicitly: ∂L/∂q - d/dt(∂L/∂q') + d²/dt²(∂L/∂q'') = 0. This matters because Rodina's action involves second derivatives implicitly through the kinetic structure | Lv | p4 | NOT in prior map at all — the higher-order EL equations |
| 107 | "Adding a total derivative to the Lagrangian does not change the result" — Rodina uses this gauge freedom implicitly when choosing a specific form of the action | Your notes p4 bottom: L → L + d/dt(f(x,ẋ)). "Then same equations." Why? More: if you add F(x,ẋ,ẍ) s.t. F = d/dt(f(x(t),ẋ(t))), then EL equations are the same. Write out the modified Lagrangian L̃(t,q,s,a) = L(t,q,s) + ∂f/∂q · s + ∂f/∂s · a, then compute the EL equations for L̃ and show the extra terms cancel. Then the physical example: L = ½mẋ² - ½κx² → EL: mẍ + κx = 0 (harmonic oscillator). Also: L = ½ms² - ½κx² with "proper variables" s = ṡᵣ∂/∂r + ṡθ∂/∂θ showing the manifold structure L: TM → ℝ | Lv | p4-5 | NOT in prior map — the total derivative gauge freedom with a worked proof that it doesn't change EL equations, plus the tangent bundle formulation L: TM→ℝ |
| 108 | The geometric Lagrangian formulation on manifolds | Your notes p5: "generally L = L(q,s), q ∈ M (manifold), s ∈ TqM (tangent bundle)." Circled: "L: TM → ℝ." Then the free particle: M = ℝ², L(q,s) = ½m‖s‖², s = sₓ∂/∂x + sy∂/∂y, ‖s‖² = sₓ² + sy². Change coordinates to (r,θ): compute ∂/∂r = cosθ ∂/∂x + sinθ ∂/∂y, ∂/∂θ = -rsinθ ∂/∂x + rcosθ ∂/∂y. Then compute the metric: ⟨∂/∂r, ∂/∂r⟩ = cos²θ + sin²θ = 1, ⟨∂/∂r, ∂/∂θ⟩ = -rcosθsinθ + rcosθsinθ = 0, ⟨∂/∂θ, ∂/∂θ⟩ = r². So ‖s‖² = ṡᵣ² + r²ṡθ² and L = ½m(ṙ² + r²θ̇²) — recovering the polar Lagrangian from the metric | Lv | p5-6 | NOT in prior map — the differential geometry derivation of the polar Lagrangian from the tangent bundle metric. This is the DEEP reason why L = ½m(ṙ²+r²θ̇²) and not something else |
| 109 | The bridge from classical mechanics to field theory Lagrangians | Your notes p6 bottom: "Mechanics: q = position of a particle, s = velocity, V(q) = potential energy. L = ½mv² - V(q) → EL: mẍ = -∇V(q) = force." Then: "for FIELDS: L = ½m(d/dt x)² - V(x), x = x(t)." Arrow labeled "field": L = ½ ∂μϕ ∂ᵘϕ - V(ϕ), ϕ = ϕ(t,x). The particle position x(t) becomes the field ϕ(t,x) — same structure, new domain. This is THE conceptual bridge that Rodina silently crosses when writing the Tr(ϕ³) Lagrangian | Ld | p6 bottom | Prior map mentioned the field theory Lagrangian but NOT this explicit particle→field analogy showing how the same mathematical structure generalizes |
| 110 | The field-theory EL equations and the equation of motion ∂μ∂ᵘϕ = -V'(ϕ) | Your notes p7 top: write the field Lagrangian L = ½ ṡμsᵘ - V(ϕ), apply the field-theory EL equation ∂/∂xᵘ (∂L/∂(∂μϕ)) - ∂L/∂ϕ = 0. In Minkowski space ∂ₜ² - ∇² → ∂μ∂ᵘϕ = -V'(ϕ). This IS the Klein-Gordon equation when V(ϕ) = ½m²ϕ² | Lv | p7 top | NOT in prior map — the field-theory EL derivation producing the wave equation |
| 111 | The free field Lagrangian and its relation to the propagator | Your notes p7: "In QFT, start with free Lagrangian for your kind of field." Lists: scalar field L_F = ½(∂μϕ ∂ᵘϕ - m²ϕ²), gauge field L_F = -¼tr(FμνFᵘᵛ). Then: "ex: add ϕ³ interaction: L = ½(∂μϕ∂ᵘϕ - m²ϕ²) + gϕ³." Canonical quantization: ϕ(p) → ϕ̂(p) (operator). The free propagator: ⟨0|ϕ(q)ϕ(p)|0⟩ = δ(p-q) · 1/p² (from free Lagrangian). Then draws the propagator (line) and the first loop correction (bubble diagram). This is the COMPLETE chain from Lagrangian → quantization → propagator → Feynman diagrams that Rodina's 1/Xᵢⱼ implicitly assumes | Lv | p7 | NOT in prior map — the quantization step ϕ→ϕ̂ and the propagator formula ⟨0|ϕϕ|0⟩ = δ/p² derived from the free Lagrangian |

---

**11 additional gaps (items 101-111) from `overviewoflagrangians.pdf`.**

This is the deepest set of notes in the collection. It traces the COMPLETE intellectual genealogy from freshman calculus (f'(x)=0) through calculus of variations, classical mechanics, coordinate-independent geometry on manifolds, field theory, and QFT quantization. Every time Rodina writes "1/Xᵢⱼ" for a propagator, it implicitly assumes all 7 pages of this derivation.

---

**GRAND TOTAL: 111 gaps across all 13 notes.** Your notes cover approximately 105 of them. The remaining ~6 are YM-specific (BCJ duality, polarization structures, some appendix generalizations) — crawler targets for future paper downloads.

This is the definitive benchmark for CC's gap-tagger and bidirectional funnel. If the system can tag even 60-70% of these 111 gaps on Rodina and match them to the correct notes pages, the architecture is validated at scale.
