
===== BENCHMARK SCORE =====
Total items: 81
COVERED:      55 (67.9%)
PARTIAL:      25 (target page hit, but not from expected notes range)
WRONG_TARGET: 0 (notes page hit something, but not the right Rodina page)
MISSING:      1 (no edge from expected notes range at all)

===== BY GROUP =====
1-7 Foundations (Rodina p1):  COV 3/7  PART 4  WRONG 0  MISS 0
8-11 BCFW (Rodina p2):  COV 4/4  PART 0  WRONG 0  MISS 0
12-19 Core proof (Rodina p3-4):  COV 3/8  PART 5  WRONG 0  MISS 0
20-32 D-subsets (Rodina p4-5):  COV 12/13  PART 1  WRONG 0  MISS 0
33-42 Deeper proof body:  COV 6/10  PART 4  WRONG 0  MISS 0
43-52 Worked examples (Rodina p2-4):  COV 5/10  PART 5  WRONG 0  MISS 0
53-66 S-matrix/BCFW/QFT:  COV 11/14  PART 3  WRONG 0  MISS 0
67-81 Physical picture + Lagrangians:  COV 11/15  PART 3  WRONG 0  MISS 1

===== ITEM-BY-ITEM =====
✓ [ 1] Ld Rp1    Np15       COVERED       Tr(ϕ³) amplitudes
       ↳ notes p17→Rodina p1 [assumes]
~ [ 2] Ld Rp1    Np7        PARTIAL       ordered amplitudes A(1,2,...,n)
       ↳ notes p17→Rodina p1 [assumes]  |  notes p19→Rodina p1 [proves]
✓ [ 3] Ld Rp*    Np40,45    COVERED       Feynman diagrams (used throughout)
       ↳ notes p40→Rodina p2 [uses_definition]  |  notes p40→Rodina p2 [uses_definition]
~ [ 4] Ld Rp1    Np40       PARTIAL       Mandelstam invariants sᵢⱼ
       ↳ notes p17→Rodina p1 [assumes]  |  notes p19→Rodina p1 [proves]
~ [ 5] Ld Rp1    Np40       PARTIAL       planar invariants Xᵢⱼ
       ↳ notes p17→Rodina p1 [assumes]  |  notes p19→Rodina p1 [proves]
~ [ 6] Ld Rp1    Np40       PARTIAL       non-planar invariants cᵢⱼ (eq.1)
       ↳ notes p17→Rodina p1 [assumes]  |  notes p19→Rodina p1 [proves]
✓ [ 7] Ld Rp1    Np1,15     COVERED       Lagrangian formalism
       ↳ notes p17→Rodina p1 [assumes]
✓ [ 8] Lv Rp2    Np40       COVERED       BCFW shift pᵢ→pᵢ+zq (eq.4)
       ↳ notes p40→Rodina p2 [uses_definition]  |  notes p40→Rodina p2 [uses_definition]
✓ [ 9] Lp Rp2    Np40       COVERED       contour at infinity must vanish
       ↳ notes p40→Rodina p2 [uses_definition]  |  notes p40→Rodina p2 [uses_definition]
✓ [10] Lp Rp2    Np40       COVERED       enhanced BCFW 1/z YM, 1/z² GR
       ↳ notes p40→Rodina p2 [uses_definition]  |  notes p40→Rodina p2 [uses_definition]
✓ [11] Lv Rp2    Np40       COVERED       unitarity → factorization of residues (eq.3)
       ↳ notes p40→Rodina p2 [uses_definition]  |  notes p40→Rodina p2 [uses_definition]
~ [12] Ld Rp4    Np45       PARTIAL       B homogeneous rational in Xᵢⱼ
       ↳ notes p36→Rodina p4 [prerequisite]  |  notes p56→Rodina p4 [assumes]
~ [13] Lv Rp4    Np45       PARTIAL       collect Bᵢ by z-scaling (eq.13)
       ↳ notes p36→Rodina p4 [prerequisite]  |  notes p56→Rodina p4 [assumes]
✓ [14] Lp Rp3    Np45       COVERED       "clear" that only certain Xᵢⱼ affected
       ↳ notes p47→Rodina p3 [proves]  |  notes p47→Rodina p3 [assumes]
✓ [15] Lv Rp3    Np45       COVERED       X⁽⁰⁾_{1,j+1} substitution (eq.10)
       ↳ notes p47→Rodina p3 [proves]  |  notes p47→Rodina p3 [assumes]
✓ [16] Lv Rp3    Np45       COVERED       leading order in z = X⁽∞⁾ (eq.11)
       ↳ notes p47→Rodina p3 [proves]  |  notes p47→Rodina p3 [assumes]
~ [17] Lp Rp4    Np50       PARTIAL       B(X⁰)=0 ⟹ B linear in cᵢⱼ (eq.15)
       ↳ notes p36→Rodina p4 [prerequisite]  |  notes p56→Rodina p4 [assumes]
~ [18] Lp Rp4    Np50       PARTIAL       enhanced scaling Bₘ(X⁰)=0 (eq.16-17)
       ↳ notes p36→Rodina p4 [prerequisite]  |  notes p56→Rodina p4 [assumes]
~ [19] Lv Rp4    Np50       PARTIAL       B-prime cascade induction (eq.18)
       ↳ notes p36→Rodina p4 [prerequisite]  |  notes p56→Rodina p4 [assumes]
✓ [20] Ld Rp4    Np61       COVERED       ansatz = sum of all Feynman diagrams
       ↳ notes p61→Rodina p4 [proves]  |  notes p61→Rodina p4 [uses_definition]
✓ [21] Ld Rp4    Np61       COVERED       D-subsets decomposition
       ↳ notes p61→Rodina p4 [proves]  |  notes p61→Rodina p4 [uses_definition]
✓ [22] Ld Rp4    Np61       COVERED       boundary propagators = Xᵢⱼ in eq.9
       ↳ notes p61→Rodina p4 [proves]  |  notes p61→Rodina p4 [uses_definition]
✓ [23] Lv Rp5    Np45,61    COVERED       term with k boundary props scales as z⁻ᵏ
       ↳ notes p61→Rodina p5 [uses_definition]  |  notes p62→Rodina p5 [uses_definition]
✓ [24] Ld Rp*    Np61,65    COVERED       Feynman diagrams ↔ triangulations
       ↳ notes p61→Rodina p5 [uses_definition]  |  notes p61→Rodina p2 [uses_definition]
✓ [25] Ld Rp*    Np65       COVERED       intersecting chords = non-planar cᵢⱼ
       ↳ notes p63→Rodina p5 [uses_definition]  |  notes p63→Rodina p5 [uses_definition]
~ [26] Ld Rp1    Np61       PARTIAL       locality = products of planar Xᵢⱼ
       ↳ notes p17→Rodina p1 [assumes]  |  notes p19→Rodina p1 [proves]
✓ [27] Lv Rp5    Np61       COVERED       cut s₃₄ uniquely picks S₁ (eq.20)
       ↳ notes p61→Rodina p5 [uses_definition]  |  notes p62→Rodina p5 [uses_definition]
✓ [28] Lp Rp5    Np61       COVERED       S₁ form with c₁ⱼ{...} (eq.21)
       ↳ notes p61→Rodina p5 [uses_definition]  |  notes p62→Rodina p5 [uses_definition]
✓ [29] Lp Rp5    Np61       COVERED       no lin. comb. of bdry props → s₃₄
       ↳ notes p61→Rodina p5 [uses_definition]  |  notes p62→Rodina p5 [uses_definition]
✓ [30] Lv Rp5    Np61       COVERED       cut s₂₃₄ ⟹ x₂=x₃ (eq.22-23)
       ↳ notes p61→Rodina p5 [uses_definition]  |  notes p62→Rodina p5 [uses_definition]
✓ [31] Lp Rp5    Np61       COVERED       diagram graph connectivity
       ↳ notes p61→Rodina p5 [uses_definition]  |  notes p62→Rodina p5 [uses_definition]
✓ [32] Lv Rp5    Np61       COVERED       distance bound n-3 steps
       ↳ notes p61→Rodina p5 [uses_definition]  |  notes p62→Rodina p5 [uses_definition]
✓ [33] Ld Rp*    Np61       COVERED       polygon correspondence with hexagons
       ↳ notes p61→Rodina p5 [uses_definition]  |  notes p61→Rodina p2 [uses_definition]
~ [34] Lv Rp5    Np45       PARTIAL       each term z⁻² = 2 bdry props
       ↳ notes p55→Rodina p5 [uses_definition]  |  notes p55→Rodina p5 [uses_definition]
✓ [35] Lv Rp*    Np45       COVERED       identify bdry props from diagram
       ↳ notes p47→Rodina p2 [uses_definition]  |  notes p47→Rodina p3 [proves]
~ [36] Lv Rp4    Np50       PARTIAL       HOW to decompose B=Bₘ+Bₘ₋₁+...
       ↳ notes p36→Rodina p4 [prerequisite]  |  notes p56→Rodina p4 [assumes]
~ [37] Lp Rp4    Np50       PARTIAL       B(X⁰)=0 ⟹ at least linear in cᵢⱼ
       ↳ notes p36→Rodina p4 [prerequisite]  |  notes p56→Rodina p4 [assumes]
~ [38] Lp Rp4    Np45,50    PARTIAL       X⁽∞⁾ = X⁽⁰⁾ bridge identity
       ↳ notes p36→Rodina p4 [prerequisite]  |  notes p56→Rodina p4 [assumes]
✓ [39] Lp Rp5    Np61       COVERED       S₁+S₂=B₋₂ ⟹ S₁=0 and S₂=0 indep
       ↳ notes p61→Rodina p5 [uses_definition]  |  notes p62→Rodina p5 [uses_definition]
✓ [40] Lv Rp5    Np61       COVERED       6-point coeff-fixing via zero+cut
       ↳ notes p61→Rodina p5 [uses_definition]  |  notes p62→Rodina p5 [uses_definition]
✓ [41] Lp Rp5    Np65       COVERED       eq.22 correction (notes catch error)
       ↳ notes p63→Rodina p5 [uses_definition]  |  notes p63→Rodina p5 [uses_definition]
✓ [42] Ld Rp*    Np65       COVERED       intersecting chords ⟹ non-Feynman
       ↳ notes p63→Rodina p5 [uses_definition]  |  notes p63→Rodina p5 [uses_definition]
✓ [43] Lv Rp2    Np40       COVERED       A₄ = 1/s₁₂ + 1/s₁₄ (eq.7)
       ↳ notes p40→Rodina p2 [uses_definition]  |  notes p40→Rodina p2 [uses_definition]
✓ [44] Lv Rp2    Np40       COVERED       A₄ vanishes under c₁₃=0
       ↳ notes p40→Rodina p2 [uses_definition]  |  notes p40→Rodina p2 [uses_definition]
~ [45] Ld Rp1    Np40       PARTIAL       cᵢⱼ = Xᵢⱼ+Xᵢ₊₁,ⱼ₊₁-... (eq.1)
       ↳ notes p17→Rodina p1 [assumes]  |  notes p19→Rodina p1 [proves]
✓ [46] Lv Rp3    Np40       COVERED       X⁽⁰⁾_{1,j+1}, X⁽⁰⁾_{2,j+1}, X⁽⁰⁾_{2,n}
       ↳ notes p42→Rodina p3 [assumes]  |  notes p42→Rodina p3 [uses_definition]
✓ [47] Lp Rp3    Np45       COVERED       X⁽∞⁾₂ⱼ = X⁽∞⁾₁ⱼ - X⁽∞⁾₁₃
       ↳ notes p47→Rodina p3 [proves]  |  notes p47→Rodina p3 [assumes]
~ [48] Lp Rp4    Np45,50    PARTIAL       the core 3-way equivalence (eq.14)
       ↳ notes p36→Rodina p4 [prerequisite]  |  notes p56→Rodina p4 [assumes]
~ [49] Lv Rp4    Np45       PARTIAL       B must be linear in cᵢⱼ (eq.15)
       ↳ notes p36→Rodina p4 [prerequisite]  |  notes p56→Rodina p4 [assumes]
~ [50] Lv Rp4    Np50       PARTIAL       enhanced scaling Bₘ(X⁰)=0
       ↳ notes p36→Rodina p4 [prerequisite]  |  notes p56→Rodina p4 [assumes]
~ [51] Lp Rp4    Np50       PARTIAL       the punchline: zeros ⟹ enhanced scaling
       ↳ notes p36→Rodina p4 [prerequisite]  |  notes p56→Rodina p4 [assumes]
✓ [52] Lv Rp*    Np45,50    COVERED       5-point worked example
       ↳ notes p47→Rodina p2 [uses_definition]  |  notes p50→Rodina p2 [uses_definition]
✓ [53] Ld Rp*    Np1,7,14   COVERED       S-matrix from ∫|p⟩⟨p|=1
       ↳ notes p9→Rodina p2 [uses_definition]
✓ [54] Lv Rp2    Np40       COVERED       BCFW shift conditions on q
       ↳ notes p40→Rodina p2 [uses_definition]  |  notes p40→Rodina p2 [uses_definition]
✓ [55] Lv Rp2    Np40       COVERED       Cauchy contour ⟹ BCFW recursion
       ↳ notes p40→Rodina p2 [uses_definition]  |  notes p40→Rodina p2 [uses_definition]
✓ [56] Lv Rp2    Np40       COVERED       residue factorization derivation
       ↳ notes p40→Rodina p2 [uses_definition]  |  notes p40→Rodina p2 [uses_definition]
✓ [57] Lv Rp3    Np40       COVERED       expand X₁ⱼ, X₂ⱼ, X₂ₙ from sᵢⱼ
       ↳ notes p42→Rodina p3 [assumes]  |  notes p42→Rodina p3 [uses_definition]
✓ [58] Lp Rp3    Np45       COVERED       X⁰ and X∞ satisfy same relations
       ↳ notes p47→Rodina p3 [proves]  |  notes p47→Rodina p3 [assumes]
~ [59] Lv Rp4    Np45       PARTIAL       X⁰ satisfy ONLY cᵢⱼ=0
       ↳ notes p36→Rodina p4 [prerequisite]  |  notes p56→Rodina p4 [assumes]
✓ [60] Ld Rp*    Np7        COVERED       path integral foundations
       ↳ notes p9→Rodina p2 [uses_definition]
✓ [61] Ld Rp*    Np7        COVERED       propagator = inverse kinetic
       ↳ notes p9→Rodina p2 [uses_definition]
✓ [62] Lv Rp*    Np7        COVERED       perturbative expansion
       ↳ notes p9→Rodina p2 [uses_definition]
✓ [63] Lv Rp*    Np14,15    COVERED       first Feynman diagrams from scratch
       ↳ notes p17→Rodina p1 [assumes]
✓ [64] Lv Rp*    Np15       COVERED       momentum-space Feynman rules
       ↳ notes p17→Rodina p1 [assumes]
~ [65] Lv Rp1    Np14       PARTIAL       color decomp & A₄ ordered
       ↳ notes p17→Rodina p1 [assumes]  |  notes p19→Rodina p1 [proves]
~ [66] Ld Rp1    Np40,61    PARTIAL       diagram↔triangulation correspondence
       ↳ notes p17→Rodina p1 [assumes]  |  notes p19→Rodina p1 [proves]
✓ [67] Ld Rp1    Np15       COVERED       ordered amplitudes eq.2
       ↳ notes p17→Rodina p1 [assumes]
✓ [68] Ld Rp1    Np15       COVERED       tree-level = no loops
       ↳ notes p17→Rodina p1 [assumes]
✓ [69] Lv Rp*    Np61,65    COVERED       Catalan count for n-gon triangulations
       ↳ notes p61→Rodina p5 [uses_definition]  |  notes p61→Rodina p2 [uses_definition]
~ [70] Ld Rp1    Np40       PARTIAL       kinematic mesh (c-eq)
       ↳ notes p17→Rodina p1 [assumes]  |  notes p19→Rodina p1 [proves]
✓ [71] Lv Rp*    Np40       COVERED       n(n-3)/2 independent invariants
       ↳ notes p40→Rodina p2 [uses_definition]  |  notes p40→Rodina p2 [uses_definition]
✓ [72] Lv Rp2    Np40       COVERED       residue factorization near poles
       ↳ notes p40→Rodina p2 [uses_definition]  |  notes p40→Rodina p2 [uses_definition]
~ [73] Lv Rp1    Np40       PARTIAL       Laurent series & residue meaning
       ↳ notes p17→Rodina p1 [assumes]  |  notes p19→Rodina p1 [proves]
✓ [74] Lv Rp3    Np40       COVERED       4-point zero s₁₂+s₁₃=-s₁₄
       ↳ notes p42→Rodina p3 [assumes]  |  notes p42→Rodina p3 [uses_definition]
✓ [75] Lv Rp*    Np40       COVERED       5-point amplitude explicit
       ↳ notes p40→Rodina p2 [uses_definition]  |  notes p40→Rodina p2 [uses_definition]
✓ [76] Lv Rp*    Np40,61    COVERED       6-point factorization at X₁₃, X₁₄
       ↳ notes p40→Rodina p2 [uses_definition]  |  notes p40→Rodina p2 [uses_definition]
✓ [77] Ld Rp2    Np61       COVERED       k-zero taxonomy
       ↳ notes p61→Rodina p2 [uses_definition]  |  notes p61→Rodina p2 [uses_definition]
✓ [78] Ld Rp*    Np61       COVERED       planar vs non-planar from polygon
       ↳ notes p61→Rodina p5 [uses_definition]  |  notes p61→Rodina p2 [uses_definition]
✓ [79] Ld Rp*    Np15,40    COVERED       Tr(ϕ³) Lagrangian + vertex rules
       ↳ notes p40→Rodina p2 [uses_definition]  |  notes p40→Rodina p2 [uses_definition]
~ [80] Lv Rp1    Np1        PARTIAL       EL equations from mechanics
       ↳ notes p17→Rodina p1 [assumes]  |  notes p19→Rodina p1 [proves]
— [81] Lv Rp*    Np1,2      MISSING       calculus of variations derivation

===== RELATIONSHIP TYPE HISTOGRAM (all notes→Rodina edges) =====
{ uses_definition: 34, assumes: 49, proves: 16, prerequisite: 3 }

===== NOTES PAGES WITH OUTGOING EDGES =====
p9:1  p17:1  p19:2  p20:5  p22:1  p29:4  p32:1  p34:2  p35:4  p36:2  p37:5  p40:9  p42:12  p47:6  p50:6  p55:5  p56:7  p59:4  p60:1  p61:7  p62:10  p63:6  p64:1

===== RODINA PAGES RECEIVING EDGES =====
p1:13  p2:37  p3:10  p4:6  p5:21  p6:14  p7:1
