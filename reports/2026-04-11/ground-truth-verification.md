
**Summary:** 3/23 claims content-verified. 19/23 claims have a matching edge in the live DB.

# Ground-Truth Verification — 2026-04-11

Source: 23-row ground-truth mapping from the user (composed by a prior Claude session).
Claim: notes PDF page N explains Rodina equation K (which lives on Rodina page P).

This report verifies TWO things per row:
1. **Claim check** — does the notes chunk at the claimed PDF page actually contain content about the equation? (keyword search in live DB)
2. **Edge check** — does an edge exist from that notes page to Rodina page P (±1)?

Live DB state: 93.8% checkpoint (post `c781f35`). Notes book `69d9ce81aa83b8b11c1837dd`. Rodina book `69d5dd60c826b8392d57012d`.

---

## Eq.1 — c_{ij} definition

**Expected:** notes PDF p13 → Rodina p1
**Status:** ❌ CLAIM INVALID  ✅ EDGE EXISTS

### Notes-page content at claimed PDF page(s)

**notes p13** — 4 chunks
  - i144 [narrative] tags=momentum_conservation
    "\[ \frac{1}{2} \int \frac{d^2 p}{p^2} \delta(p_1 + p_2 - p) \delta(p - q + p_3) \frac{1}{q^2} \delta(p_1 + p_3 - q) \delta(q + p_2 + p_4) \]"
  - i145 [narrative] tags=delta_function_representation
    "\[ \frac{1}{(p_1 + p_2)^2 (p_4 + p_5)^2} = \frac{\delta(p_1, p_4, p_5)}{s_{12} s_{45}} \]"
  - i146 [narrative] tags=mandelstam_invariants
    "\[ \frac{1}{s_{12} s_{45}} + \frac{1}{s_{12} s_{34}} + \frac{1}{s_{23} s_{34}} + \frac{1}{s_{23} s_{45}} + \frac{1}{s_{34} s_{15}} \]"
  - _(1 more chunks on this page)_

**Keyword check:** ❌ no match — none of `c_{ij}`, `cij`, `X_{ij}`, `X_{i+1,j+1}`

### Edge check — does any edge go notes p13 → Rodina p1 (±1)?

**Found 3 matching edge(s).** First 3:
  - notes p13 → Rodina p1  rel=prerequisite conf=s relev=u
    SRC: "\[ \frac{1}{2} \int \frac{d^2 p}{p^2} \delta(p_1 + p_2 - p) \delta(p - q + p_3) \frac{1}{q^2} \delta(p_1 + p_3 - q) \delta(q + p_2 + p_4) \]"
    DST: "Typical notations used are the Mandelstam invariants \( s_{ij,\ldots}=(p_i+p_j+\ldots+p_k)^2 \), the planar invariants \( X_{ij}=s_{i,i+1}=("
  - notes p13 → Rodina p1  rel=proves conf=s relev=u
    SRC: "\[ \frac{1}{s_{12} s_{45}} + \frac{1}{s_{12} s_{34}} + \frac{1}{s_{23} s_{34}} + \frac{1}{s_{23} s_{45}} + \frac{1}{s_{34} s_{15}} \]"
    DST: "Typical notations used are the Mandelstam invariants \( s_{ij,\ldots}=(p_i+p_j+\ldots+p_k)^2 \), the planar invariants \( X_{ij}=s_{i,i+1}=("
  - notes p13 → Rodina p1  rel=proves conf=r relev=s
    SRC: "\[ s_{1i} = (p_i + p_1)^2 = 2 p_i p_0 \]"
    DST: "Here \( p_i \) is the \( D \)-dimensional momentum of particle \( i \), subjected to momentum conservation \( \sum_i p_i=0 \) (which implies"

---

## Eq.2 — color decomp A_n = Σ Tr(T)Aₙ(σ)

**Expected:** notes PDF p44/45/46 → Rodina p2
**Status:** ✅ CLAIM VALID  ✅ EDGE EXISTS

### Notes-page content at claimed PDF page(s)

**notes p44** — 6 chunks
  - i448 [narrative] tags=amplitude_expression
    "\( A_4 = a_{1} \frac{1}{x} + a_{2} \frac{1}{y} \)"
  - i449 [narrative] tags=hidden_zero_condition
    "impose the hidden zero condition \(\Rightarrow a_{1} = a_{2}\) \[ \frac{1}{x} - \left( - \right) \] \[ \frac{1}{y} \left( - - \right) \]"
  - i450 [narrative] tags=xij_relations
    "goal: show that some of the \( X_{ij} \) variables satisfy the same relations if we set all 1-zeros or perform a BCFW shift (up to order \(\varepsilon\))"
  - _(3 more chunks on this page)_
**notes p45** — 7 chunks
  - i454 [narrative] tags=bcfw_shift, affected_invariants, question
    "Let's do the shift instead \[ \begin{align*} p_2 &\rightarrow p_2 + q z \\ p_n &\rightarrow p_n - q z \end{align*} \] which \( X_{ij} \) are affected by the shift?"
  - i455 [narrative] tags=bcfw_shift, affected_invariants, assumption
    "\[ \text{(assume } i \[ (p_i + p_{i+1} + \cdots + p_{j-1})^2 \] i = 1 or i = 2"
  - i456 [narrative] tags=bcfw_shift, affected_invariants, linear_expansion, instruction
    "\( X_{i\sigma} \), \(\sigma = 3, \ldots, n-1 \) and \( X_{2j} \), \( j = i, \ldots, n \) are the only affected ones. Expand \( X_{i\sigma}(z) \) to linear order Expand \( X_{2j}(z)"
  - _(4 more chunks on this page)_
**notes p46** — 13 chunks
  - i461 [narrative] tags=infinity_scaling
    "\( X_{2i}^{(\infty)} = 2z \cdot (p_3 + \ldots + p_{\emptyset - 1}) \)"
  - i462 [narrative] tags=infinity_scaling
    "\( X_{ij}^{(\infty)} = 2z \cdot (p_i + p_3 + \ldots + p_{\emptyset - 1}) \)"
  - i463 [narrative] tags=infinity_scaling
    "\[ X_{2i}^{(\infty)} = 2z \cdot p_i + X_{2j}^{(\infty)} \]"
  - _(10 more chunks on this page)_

**Keyword check:** ✅ matched — found: `Tr`

### Edge check — does any edge go notes p44/45/46 → Rodina p2 (±1)?

**Found 19 matching edge(s).** First 3:
  - notes p44 → Rodina p2  rel=proves conf=r relev=s
    SRC: "\( A_4 = a_{1} \frac{1}{x} + a_{2} \frac{1}{y} \)"
    DST: "All the various zeros are all independent, no zero implies any other zero. For example, the ordered 4-point Tr(\( \phi^3 \)) amplitude \[ A_"
  - notes p44 → Rodina p3  rel=proves conf=s relev=u
    SRC: "1-zero: \( c_{1i} = c_{1i+1} = \ldots = c_{1n-1} = 0 \Rightarrow n-3 \) constants started with \(\frac{n(n-2)}{2}\) variables, now we have \"
    DST: "First, each k-zero turns out to have a natural corresponding BCFW shift. For instance, for a 1-zero like \( c_{1i}=0 \), \( i\neq 2 \), the "
  - notes p44 → Rodina p1  rel=proves conf=s relev=u
    SRC: "we know that \( c_{ij} = X_{ij} + X_{ii-1 j} - X_{ii+1 j} - X_{i j+1} \) \[ \begin{align*} 0 &= X_{13} + X_{24} - X_{23} - X_{14} \\ 0 &= X_"
    DST: "At n-points, there is a basis of n(n−3)/2 kinematic invariants, which we can take as the \( X_{ij} \). A crucial relation between the planar"

---

## Eq.3 — factorization A_n → (1/P²)A^L·A^R

**Expected:** notes PDF p33/34/23 → Rodina p2
**Status:** ❌ CLAIM INVALID  ✅ EDGE EXISTS

### Notes-page content at claimed PDF page(s)

**notes p33** — 9 chunks
  - i331 [narrative] tags=equations_derivation
    "The following equations are derived:"
  - i332 [narrative] tags=equations_derivation
    "\[ \frac{1}{S_{12} S_{34}} + \frac{1}{S_{23} S_{45}} - \frac{1}{S_{34} S_{12}} + \frac{1}{S_{45} S_{12}} - \frac{1}{S_{12} S_{23}} \]"
  - i333 [narrative] tags=equations_simplification
    "By rearranging, it simplifies to: \[ \frac{1}{S_{23} S_{45}} + \frac{1}{S_{45} S_{12}} - \frac{1}{S_{12} S_{23}} \rightarrow \frac{S_{23} + S_{23} - S_{45}}{S_{23} S_{12} S_{45}} ="
  - _(6 more chunks on this page)_
**notes p34** — 16 chunks
  - i340 [narrative] tags=polytope_sketch
    "Figure: Polytope sketch with vertices labeled \(1, 2, 3, 4, 5\) and directed arrows illustrating relationships \(p_1, p_2, p_3, p_4, p_5\)."
  - i341 [narrative] tags=planar_invariants
    "\( X_{13} \)"
  - i342 [narrative] tags=planar_invariants
    "\( X_{14} \)"
  - _(13 more chunks on this page)_
**notes p23** — 7 chunks
  - i230 [narrative] tags=lagrangian_phi3
    "\[ \mathcal{L} = \frac{1}{2} \text{tr} \left( \partial_{\mu} \phi \, \partial^{\mu} \phi \right) + g \, \text{tr} \left( \phi^3 \right) \]"
  - i231 [narrative] tags=matrix_representation_phi
    "\(\phi\) is an \(N \times N\) matrix"
  - i232 [narrative] tags=matrix_component_phi
    "\(\phi^i_j\)"
  - _(4 more chunks on this page)_

**Keyword check:** ❌ no match — none of `factoriz`, `P^2`, `A^L`, `residue`

### Edge check — does any edge go notes p33/34/23 → Rodina p2 (±1)?

**Found 18 matching edge(s).** First 3:
  - notes p23 → Rodina p1  rel=proves conf=s relev=u
    SRC: "\[ \mathcal{L} = \frac{1}{2} \text{tr} \left( \partial_{\mu} \phi \, \partial^{\mu} \phi \right) + g \, \text{tr} \left( \phi^3 \right) \]"
    DST: "This directly applies to Tr(\(\phi^3\)), non-linear sigma model, or Yang-Mills scalar amplitudes, revealing a novel type of enhanced UV scal"
  - notes p23 → Rodina p2  rel=assumes conf=z relev=s
    SRC: "\(\phi^i_j\)"
    DST: "This observation generalizes to arbitrary multiplicity, and identical facts hold for NLSM, YM-scalar, which unlike Tr(\( \phi^3 \)) also con"
  - notes p23 → Rodina p1  rel=proves conf=s relev=z
    SRC: "\(\mathcal{L} = \frac{1}{2} \partial_{\mu} \phi^i_j \, \partial^{\mu} \phi^j_i + g \, \phi^i_j \phi^j_k \phi^k_i\)"
    DST: "These novel perspectives have revealed surprising structures and numerous additional simplifications that are completely hidden by the Lagra"

---

## Eq.4 — BCFW shift p_i → p_i + zq

**Expected:** notes PDF p24 → Rodina p2
**Status:** ❌ CLAIM INVALID  ✅ EDGE EXISTS

### Notes-page content at claimed PDF page(s)

**notes p24** — 9 chunks
  - i237 [narrative] tags=phi_correlation_function
    "\[ \left\langle \phi^{i_4} (P_1) \phi^{i_2}_{i_2} (P_2) \phi^{i_3}_{i_3} (P_3) \right\rangle \approx \frac{ \int \mathcal{D} \phi \ e^{-S_0[\phi]} \left( 1 + g \int d \tau \ t x \l"
  - i238 [narrative] tags=phi_correlation_function
    "\[ \left\langle \phi^{i_4} (P_1) \phi^{i_2}_{i_2} (P_2) \phi^{i_3}_{i_3} (P_3) \right\rangle \approx \left\langle \phi^{i_4} (P_1) \phi^{i_2}_{i_2} (P_2) \phi^{i_3}_{i_3} (P_3) \ri"
  - i239 [narrative] tags=phi_product
    "\[ \phi^{i_4}_{i_5} \phi^{i_5}_{i_6} \phi^{i_6}_{i_4} \]"
  - _(6 more chunks on this page)_

**Keyword check:** ❌ no match — none of `p_i`, `zq`, `BCFW`, `shift`

### Edge check — does any edge go notes p24 → Rodina p2 (±1)?

**Found 2 matching edge(s).** First 3:
  - notes p24 → Rodina p2  rel=proves conf=r relev=s
    SRC: "\[ \left\langle \phi^{i_4} (P_1) \phi^{i_2}_{i_2} (P_2) \phi^{i_3}_{i_3} (P_3) \right\rangle \approx \frac{ \int \mathcal{D} \phi \ e^{-S_0["
    DST: "All the various zeros are all independent, no zero implies any other zero. For example, the ordered 4-point Tr(\( \phi^3 \)) amplitude \[ A_"
  - notes p24 → Rodina p3  rel=proves conf=s relev=u
    SRC: "\[ \langle 1 2 \rangle \langle 3 4 \rangle \langle 5 6 \rangle (6 - 1)!! \]"
    DST: "\[ X_{2,n} = s_{2,...,n-1} = -s_{12} - \sum_{i=3}^{n-1} s_{1i}, \] for \( 2 \leq j \leq n-2 \). Under the zero condition, these become"

---

## Eq.5 — 1-zero: c_{1i}=0

**Expected:** notes PDF p13 → Rodina p2
**Status:** ❌ CLAIM INVALID  ✅ EDGE EXISTS

### Notes-page content at claimed PDF page(s)

**notes p13** — 4 chunks
  - i144 [narrative] tags=momentum_conservation
    "\[ \frac{1}{2} \int \frac{d^2 p}{p^2} \delta(p_1 + p_2 - p) \delta(p - q + p_3) \frac{1}{q^2} \delta(p_1 + p_3 - q) \delta(q + p_2 + p_4) \]"
  - i145 [narrative] tags=delta_function_representation
    "\[ \frac{1}{(p_1 + p_2)^2 (p_4 + p_5)^2} = \frac{\delta(p_1, p_4, p_5)}{s_{12} s_{45}} \]"
  - i146 [narrative] tags=mandelstam_invariants
    "\[ \frac{1}{s_{12} s_{45}} + \frac{1}{s_{12} s_{34}} + \frac{1}{s_{23} s_{34}} + \frac{1}{s_{23} s_{45}} + \frac{1}{s_{34} s_{15}} \]"
  - _(1 more chunks on this page)_

**Keyword check:** ❌ no match — none of `c_{1i}`, `1-zero`, `1 zero`, `c_{1,i}`

### Edge check — does any edge go notes p13 → Rodina p2 (±1)?

**Found 3 matching edge(s).** First 3:
  - notes p13 → Rodina p1  rel=prerequisite conf=s relev=u
    SRC: "\[ \frac{1}{2} \int \frac{d^2 p}{p^2} \delta(p_1 + p_2 - p) \delta(p - q + p_3) \frac{1}{q^2} \delta(p_1 + p_3 - q) \delta(q + p_2 + p_4) \]"
    DST: "Typical notations used are the Mandelstam invariants \( s_{ij,\ldots}=(p_i+p_j+\ldots+p_k)^2 \), the planar invariants \( X_{ij}=s_{i,i+1}=("
  - notes p13 → Rodina p1  rel=proves conf=s relev=u
    SRC: "\[ \frac{1}{s_{12} s_{45}} + \frac{1}{s_{12} s_{34}} + \frac{1}{s_{23} s_{34}} + \frac{1}{s_{23} s_{45}} + \frac{1}{s_{34} s_{15}} \]"
    DST: "Typical notations used are the Mandelstam invariants \( s_{ij,\ldots}=(p_i+p_j+\ldots+p_k)^2 \), the planar invariants \( X_{ij}=s_{i,i+1}=("
  - notes p13 → Rodina p1  rel=proves conf=r relev=s
    SRC: "\[ s_{1i} = (p_i + p_1)^2 = 2 p_i p_0 \]"
    DST: "Here \( p_i \) is the \( D \)-dimensional momentum of particle \( i \), subjected to momentum conservation \( \sum_i p_i=0 \) (which implies"

---

## Eq.6 — k-zero generalization

**Expected:** notes PDF p29/30 → Rodina p2
**Status:** ❌ CLAIM INVALID  ✅ EDGE EXISTS

### Notes-page content at claimed PDF page(s)

**notes p29** — 10 chunks
  - i274 [narrative] tags=partial_ordered_amplitude
    "A partial ordered amplitude"
  - i275 [narrative] tags=amplitude_factorization
    "\(\text{Res } A_n(1,2,3,\ldots,n) \) w.t are of the \( X_{ij} \) (no poles) factorizes as product of two smaller amplitudes"
  - i276 [narrative] tags=laurent_series
    "If \( f(z) \) is a complex function with Laurent series \(\sum_{n \in \mathbb{Z}} a_n z^n\)"
  - _(7 more chunks on this page)_
**notes p30** — 12 chunks
  - i284 [equation] tags=amplitude_equation
    "The following equation is given: \[ A_3(12, p) \, A_{n}(-p, 3 \ldots 5) \]"
  - i285 [narrative] tags=s_matrix, unitarity, key_symmetry, bcfw_shift
    "This follows from \( S^\dagger S = \mathbb{I} \) (S-matrix). Key Symmetry \( A_n \) Choose \( z \) moves such that:"
  - i286 [narrative] tags=bcfw_shift
    "\( p_i \rightarrow p_i + zq \) \( p_j \rightarrow p_j - zq \) where \( z \in \mathbb{C} \)."
  - _(9 more chunks on this page)_

**Keyword check:** ❌ no match — none of `k-zero`, `k zero`, `kzero`

### Edge check — does any edge go notes p29/30 → Rodina p2 (±1)?

**Found 19 matching edge(s).** First 3:
  - notes p29 → Rodina p2  rel=proves conf=r relev=s
    SRC: "A partial ordered amplitude"
    DST: "Pole structure and ordered amplitudes In this paper, we will only consider amplitudes of colored particles, which can be written as a sum ov"
  - notes p29 → Rodina p2  rel=proves conf=r relev=u
    SRC: "\(\text{Res } A_n(1,2,3,\ldots,n) \) w.t are of the \( X_{ij} \) (no poles) factorizes as product of two smaller amplitudes"
    DST: "Unitarity From the optical theorem, unitarity implies factorization of residues of the above poles. Near a pole \( P^2_i=0 \), the amplitude"
  - notes p29 → Rodina p2  rel=proves conf=s relev=u
    SRC: "If \( f(z) \) is a complex function with Laurent series \(\sum_{n \in \mathbb{Z}} a_n z^n\)"
    DST: "The poles are accessed via a complex parameter \( z \) introduced through a BCFW shift, \[ p_i \to p_i + zq, \quad p_j \to p_j - zq, \quad ("

---

## Eq.7 — A_4 = 1/s_{12} + 1/s_{14}

**Expected:** notes PDF p13 → Rodina p2
**Status:** ✅ CLAIM VALID  ✅ EDGE EXISTS

### Notes-page content at claimed PDF page(s)

**notes p13** — 4 chunks
  - i144 [narrative] tags=momentum_conservation
    "\[ \frac{1}{2} \int \frac{d^2 p}{p^2} \delta(p_1 + p_2 - p) \delta(p - q + p_3) \frac{1}{q^2} \delta(p_1 + p_3 - q) \delta(q + p_2 + p_4) \]"
  - i145 [narrative] tags=delta_function_representation
    "\[ \frac{1}{(p_1 + p_2)^2 (p_4 + p_5)^2} = \frac{\delta(p_1, p_4, p_5)}{s_{12} s_{45}} \]"
  - i146 [narrative] tags=mandelstam_invariants
    "\[ \frac{1}{s_{12} s_{45}} + \frac{1}{s_{12} s_{34}} + \frac{1}{s_{23} s_{34}} + \frac{1}{s_{23} s_{45}} + \frac{1}{s_{34} s_{15}} \]"
  - _(1 more chunks on this page)_

**Keyword check:** ✅ matched — found: `s_{12}`

### Edge check — does any edge go notes p13 → Rodina p2 (±1)?

**Found 3 matching edge(s).** First 3:
  - notes p13 → Rodina p1  rel=prerequisite conf=s relev=u
    SRC: "\[ \frac{1}{2} \int \frac{d^2 p}{p^2} \delta(p_1 + p_2 - p) \delta(p - q + p_3) \frac{1}{q^2} \delta(p_1 + p_3 - q) \delta(q + p_2 + p_4) \]"
    DST: "Typical notations used are the Mandelstam invariants \( s_{ij,\ldots}=(p_i+p_j+\ldots+p_k)^2 \), the planar invariants \( X_{ij}=s_{i,i+1}=("
  - notes p13 → Rodina p1  rel=proves conf=s relev=u
    SRC: "\[ \frac{1}{s_{12} s_{45}} + \frac{1}{s_{12} s_{34}} + \frac{1}{s_{23} s_{34}} + \frac{1}{s_{23} s_{45}} + \frac{1}{s_{34} s_{15}} \]"
    DST: "Typical notations used are the Mandelstam invariants \( s_{ij,\ldots}=(p_i+p_j+\ldots+p_k)^2 \), the planar invariants \( X_{ij}=s_{i,i+1}=("
  - notes p13 → Rodina p1  rel=proves conf=r relev=s
    SRC: "\[ s_{1i} = (p_i + p_1)^2 = 2 p_i p_0 \]"
    DST: "Here \( p_i \) is the \( D \)-dimensional momentum of particle \( i \), subjected to momentum conservation \( \sum_i p_i=0 \) (which implies"

---

## Eq.8 — splitting near zero

**Expected:** notes PDF p17/18 → Rodina p3
**Status:** ❌ CLAIM INVALID  ✅ EDGE EXISTS

### Notes-page content at claimed PDF page(s)

**notes p17** — 7 chunks
  - i177 [narrative] tags=propagator_rule
    "rule each internal edge is a propagator \(\frac{1}{p^2}\)"
  - i178 [narrative] tags=momentum_conservation
    "at each vertex we have conservation of momentum"
  - i179 [equation] tags=propagator_equation
    "\[ \frac{1}{p^2} = \frac{1}{(p_1 + p_2)^2} = \frac{1}{(-p_3 - p_4)^2} \]"
  - _(4 more chunks on this page)_
**notes p18** — 1 chunks
  - i184 [narrative] tags=planar_diagrams, catalan_number
    "The number of planar diagrams with fixed ordering is the Catalan number."

**Keyword check:** ❌ no match — none of `splitting`, `factoriz`, `near`, `zero`

### Edge check — does any edge go notes p17/18 → Rodina p3 (±1)?

**Found 2 matching edge(s).** First 3:
  - notes p17 → Rodina p3  rel=proves conf=r relev=s
    SRC: "\[ - p = p_1 + p_2 = p_1 + p_2 + p_4 = p_4 + p_5 \]"
    DST: "\[ X^{(\infty)}_{2,n} = -q \cdot p_1. \quad \quad \quad (11) \]"
  - notes p18 → Rodina p4  rel=assumes conf=u relev=u
    SRC: "The number of planar diagrams with fixed ordering is the Catalan number."
    DST: "All n-point diagrams can be uniquely obtained via this procedure by starting from all (n−1)-point diagrams, for all possible choices of arra"

---

## Eq.9 — three types of X_{ij}

**Expected:** notes PDF p13/14 → Rodina p3
**Status:** ❌ CLAIM INVALID  ❌ EDGE MISSING

### Notes-page content at claimed PDF page(s)

**notes p13** — 4 chunks
  - i144 [narrative] tags=momentum_conservation
    "\[ \frac{1}{2} \int \frac{d^2 p}{p^2} \delta(p_1 + p_2 - p) \delta(p - q + p_3) \frac{1}{q^2} \delta(p_1 + p_3 - q) \delta(q + p_2 + p_4) \]"
  - i145 [narrative] tags=delta_function_representation
    "\[ \frac{1}{(p_1 + p_2)^2 (p_4 + p_5)^2} = \frac{\delta(p_1, p_4, p_5)}{s_{12} s_{45}} \]"
  - i146 [narrative] tags=mandelstam_invariants
    "\[ \frac{1}{s_{12} s_{45}} + \frac{1}{s_{12} s_{34}} + \frac{1}{s_{23} s_{34}} + \frac{1}{s_{23} s_{45}} + \frac{1}{s_{34} s_{15}} \]"
  - _(1 more chunks on this page)_
**notes p14** — 16 chunks
  - i148 [narrative] tags=partial_derivatives
    "\[ \frac{\partial}{\partial x} = \cos \theta \frac{\partial}{\partial r} + \sin \theta \frac{\partial}{\partial \theta} \]"
  - i149 [narrative] tags=polar_coordinates
    "\[ x = r \cos \theta, \quad y = r \sin \theta \]"
  - i150 [narrative] tags=gradient_magnitude
    "\[ \left|\nabla || = ? \]"
  - _(13 more chunks on this page)_

**Keyword check:** ❌ no match — none of `X_{ij}`, `affected`, `three types`

### Edge check — does any edge go notes p13/14 → Rodina p3 (±1)?

**NO MATCHING EDGE** from claimed notes pages to Rodina p3.

_Other notes pages that DID land on Rodina p3 (±1):_ p2, p5, p6, p7, p8, p9, p10, p11, p12, p15, p16, p17, p18, p20, p21, p23, p24, p25, p26, p27, p29, p30, p31, p32, p33, p34, p35, p36, p37, p38, p39, p40, p41, p42, p43, p44, p45, p46, p47, p48, p49, p50, p51, p52, p53, p54, p55, p56, p57, p58, p59, p60, p61, p62, p63, p64, p65

---

## Eq.10 — X^{(0)} values zero substitution

**Expected:** notes PDF p13/14 → Rodina p3
**Status:** ❌ CLAIM INVALID  ❌ EDGE MISSING

### Notes-page content at claimed PDF page(s)

**notes p13** — 4 chunks
  - i144 [narrative] tags=momentum_conservation
    "\[ \frac{1}{2} \int \frac{d^2 p}{p^2} \delta(p_1 + p_2 - p) \delta(p - q + p_3) \frac{1}{q^2} \delta(p_1 + p_3 - q) \delta(q + p_2 + p_4) \]"
  - i145 [narrative] tags=delta_function_representation
    "\[ \frac{1}{(p_1 + p_2)^2 (p_4 + p_5)^2} = \frac{\delta(p_1, p_4, p_5)}{s_{12} s_{45}} \]"
  - i146 [narrative] tags=mandelstam_invariants
    "\[ \frac{1}{s_{12} s_{45}} + \frac{1}{s_{12} s_{34}} + \frac{1}{s_{23} s_{34}} + \frac{1}{s_{23} s_{45}} + \frac{1}{s_{34} s_{15}} \]"
  - _(1 more chunks on this page)_
**notes p14** — 16 chunks
  - i148 [narrative] tags=partial_derivatives
    "\[ \frac{\partial}{\partial x} = \cos \theta \frac{\partial}{\partial r} + \sin \theta \frac{\partial}{\partial \theta} \]"
  - i149 [narrative] tags=polar_coordinates
    "\[ x = r \cos \theta, \quad y = r \sin \theta \]"
  - i150 [narrative] tags=gradient_magnitude
    "\[ \left|\nabla || = ? \]"
  - _(13 more chunks on this page)_

**Keyword check:** ❌ no match — none of `X^{(0)}`, `(0)`, `zero`, `substitution`

### Edge check — does any edge go notes p13/14 → Rodina p3 (±1)?

**NO MATCHING EDGE** from claimed notes pages to Rodina p3.

_Other notes pages that DID land on Rodina p3 (±1):_ p2, p5, p6, p7, p8, p9, p10, p11, p12, p15, p16, p17, p18, p20, p21, p23, p24, p25, p26, p27, p29, p30, p31, p32, p33, p34, p35, p36, p37, p38, p39, p40, p41, p42, p43, p44, p45, p46, p47, p48, p49, p50, p51, p52, p53, p54, p55, p56, p57, p58, p59, p60, p61, p62, p63, p64, p65

---

## Eq.11 — X^{(∞)} values BCFW z→∞

**Expected:** notes PDF p13/14 → Rodina p3
**Status:** ❌ CLAIM INVALID  ❌ EDGE MISSING

### Notes-page content at claimed PDF page(s)

**notes p13** — 4 chunks
  - i144 [narrative] tags=momentum_conservation
    "\[ \frac{1}{2} \int \frac{d^2 p}{p^2} \delta(p_1 + p_2 - p) \delta(p - q + p_3) \frac{1}{q^2} \delta(p_1 + p_3 - q) \delta(q + p_2 + p_4) \]"
  - i145 [narrative] tags=delta_function_representation
    "\[ \frac{1}{(p_1 + p_2)^2 (p_4 + p_5)^2} = \frac{\delta(p_1, p_4, p_5)}{s_{12} s_{45}} \]"
  - i146 [narrative] tags=mandelstam_invariants
    "\[ \frac{1}{s_{12} s_{45}} + \frac{1}{s_{12} s_{34}} + \frac{1}{s_{23} s_{34}} + \frac{1}{s_{23} s_{45}} + \frac{1}{s_{34} s_{15}} \]"
  - _(1 more chunks on this page)_
**notes p14** — 16 chunks
  - i148 [narrative] tags=partial_derivatives
    "\[ \frac{\partial}{\partial x} = \cos \theta \frac{\partial}{\partial r} + \sin \theta \frac{\partial}{\partial \theta} \]"
  - i149 [narrative] tags=polar_coordinates
    "\[ x = r \cos \theta, \quad y = r \sin \theta \]"
  - i150 [narrative] tags=gradient_magnitude
    "\[ \left|\nabla || = ? \]"
  - _(13 more chunks on this page)_

**Keyword check:** ❌ no match — none of `X^{(\infty)}`, `infty`, `infinity`

### Edge check — does any edge go notes p13/14 → Rodina p3 (±1)?

**NO MATCHING EDGE** from claimed notes pages to Rodina p3.

_Other notes pages that DID land on Rodina p3 (±1):_ p2, p5, p6, p7, p8, p9, p10, p11, p12, p15, p16, p17, p18, p20, p21, p23, p24, p25, p26, p27, p29, p30, p31, p32, p33, p34, p35, p36, p37, p38, p39, p40, p41, p42, p43, p44, p45, p46, p47, p48, p49, p50, p51, p52, p53, p54, p55, p56, p57, p58, p59, p60, p61, p62, p63, p64, p65

---

## Eq.12 — k-zero ↔ BCFW map

**Expected:** notes PDF p20/21 → Rodina p3
**Status:** ❌ CLAIM INVALID  ✅ EDGE EXISTS

### Notes-page content at claimed PDF page(s)

**notes p20** — 10 chunks
  - i198 [narrative] tags=planar_invariants, nonplanar_invariants
    "Take \( X_{13} \), \( X_{14} \), \( X_{15} \), exclude \( c_{62} \), \( c_{63} \), \( c_{64} \)."
  - i199 [narrative] tags=planar_invariants
    "\[ C_{ij} = -(p_i + p_j)^2 \]"
  - i200 [narrative] tags=locality, constraint
    "Locality: \( c_{1i} = 0 \)"
  - _(7 more chunks on this page)_
**notes p21** — 20 chunks
  - i208 [narrative] tags=planar_invariants
    "\( c_{i,j} = X_{ij} + X_{i+1,j+1} - X_{i+1,j} - X_{i,j+1} \)"
  - i209 [narrative] tags=planar_invariants
    "\( c_{1,3} : \quad X_{13} + X_{24} - X_{14} \)"
  - i210 [narrative] tags=planar_invariants
    "\( c_{1,4} : \quad X_{14} + X_{25} - X_{24} \)"
  - _(17 more chunks on this page)_

**Keyword check:** ❌ no match — none of `k-zero`, `BCFW`, `equivalen`

### Edge check — does any edge go notes p20/21 → Rodina p3 (±1)?

**Found 4 matching edge(s).** First 3:
  - notes p20 → Rodina p4  rel=proves conf=r relev=z
    SRC: "Locality: \( c_{1i} = 0 \)"
    DST: "In our present case, these subsets can be further decomposed into what we call D-subsets, which have a simple meaning in terms of graph topo"
  - notes p21 → Rodina p4  rel=proves conf=s relev=u
    SRC: "- choose triangulation, wrap the chords"
    DST: "All n-point diagrams can be uniquely obtained via this procedure by starting from all (n−1)-point diagrams, for all possible choices of arra"
  - notes p21 → Rodina p3  rel=proves conf=s relev=u
    SRC: "\( X_{14} \rightarrow c_{63} \)"
    DST: "To see how the zero and shift may be related, let us write out the \( X_{ij} \) in terms of \( s_{ij} \). Consider the 1-zero type, \( c_{1i"

---

## Eq.13 — B = B_m + B_{m-1} + ...

**Expected:** notes PDF p7 → Rodina p3
**Status:** ❌ CLAIM INVALID  ✅ EDGE EXISTS

### Notes-page content at claimed PDF page(s)

**notes p7** — 13 chunks
  - i69 [narrative] tags=path_integral
    "\[ e^{-\frac{i}{2} \int \text{d}^{4}x \left( \phi L \phi \right)} \]"
  - i70 [narrative] tags=probability_measure
    "probability measure"
  - i71 [narrative] tags=multidimensional_gaussian
    "multi-dimensional Gaussian on \( \mathbb{R}^{n} \)"
  - _(10 more chunks on this page)_

**Keyword check:** ❌ no match — none of `B_m`, `B_{m-1}`, `scaling`

### Edge check — does any edge go notes p7 → Rodina p3 (±1)?

**Found 2 matching edge(s).** First 3:
  - notes p7 → Rodina p2  rel=assumes conf=u relev=u
    SRC: "probability measure"
    DST: "Pole structure and ordered amplitudes In this paper, we will only consider amplitudes of colored particles, which can be written as a sum ov"
  - notes p7 → Rodina p2  rel=proves conf=s relev=u
    SRC: "Theorem: Isserlis' theorem"
    DST: "We will always use this assumption throughout the paper."

---

## Eq.14 — three equivalences core theorem

**Expected:** notes PDF p20 → Rodina p4
**Status:** ❌ CLAIM INVALID  ✅ EDGE EXISTS

### Notes-page content at claimed PDF page(s)

**notes p20** — 10 chunks
  - i198 [narrative] tags=planar_invariants, nonplanar_invariants
    "Take \( X_{13} \), \( X_{14} \), \( X_{15} \), exclude \( c_{62} \), \( c_{63} \), \( c_{64} \)."
  - i199 [narrative] tags=planar_invariants
    "\[ C_{ij} = -(p_i + p_j)^2 \]"
  - i200 [narrative] tags=locality, constraint
    "Locality: \( c_{1i} = 0 \)"
  - _(7 more chunks on this page)_

**Keyword check:** ❌ no match — none of `equivalen`, `three`, `core`

### Edge check — does any edge go notes p20 → Rodina p4 (±1)?

**Found 1 matching edge(s).** First 3:
  - notes p20 → Rodina p4  rel=proves conf=r relev=z
    SRC: "Locality: \( c_{1i} = 0 \)"
    DST: "In our present case, these subsets can be further decomposed into what we call D-subsets, which have a simple meaning in terms of graph topo"

---

## Eq.15 — B = Σ c_{ij}{...}

**Expected:** notes PDF p8 → Rodina p4
**Status:** ❌ CLAIM INVALID  ✅ EDGE EXISTS

### Notes-page content at claimed PDF page(s)

**notes p8** — 13 chunks
  - i82 [example] tags=sum_over_permutations, example_k4, partition_example
    "\[ \sum_{\sigma\in S_p} P_k^2 \prod_{\{i Parity: = 0 if \( k \) is odd Ex: \( k = 4 \) Partitions:"
  - i83 [example] tags=partition_example
    "(1,2) (3,4) (1,3) (2,4) (1,4) (2,3)"
  - i84 [narrative] tags=gaussian_integral, path_integral_context
    "\[ \langle x^{i_1} \ldots x^{i_k} \rangle = \langle x^{i_1} x^{i_2} \rangle \langle x^{i_3} x^{i_4} \rangle + \langle x^{i_1} x^{i_3} \rangle \langle x^{i_2} x^{i_4} \rangle + \lan"
  - _(10 more chunks on this page)_

**Keyword check:** ❌ no match — none of `B_m`, `c_{ij}`, `zero`

### Edge check — does any edge go notes p8 → Rodina p4 (±1)?

**Found 5 matching edge(s).** First 3:
  - notes p8 → Rodina p3  rel=proves conf=r relev=s
    SRC: "(1,2) (3,4) (1,3) (2,4) (1,4) (2,3)"
    DST: "It is clear that the only \( X_{ij} \) affected by either the related shift or the zero are of three possible types: \[ X_{1,j+1} = s_{1,2,."
  - notes p8 → Rodina p3  rel=proves conf=s relev=u
    SRC: "\[ \langle x^{i_1} \ldots x^{i_k} \rangle = \langle x^{i_1} x^{i_2} \rangle \langle x^{i_3} x^{i_4} \rangle + \langle x^{i_1} x^{i_3} \rangl"
    DST: "It is clear that the only \( X_{ij} \) affected by either the related shift or the zero are of three possible types: \[ X_{1,j+1} = s_{1,2,."
  - notes p8 → Rodina p3  rel=proves conf=s relev=u
    SRC: "\[ \langle x^i x^j \rangle = \frac{\int d^n x \, x^i x^j e^{-\frac{1}{2} x' A x}}{\int d^n x \, e^{-\frac{1}{2} x' A x}} = (A^{-1})_{ij} \]"
    DST: "It is clear that the only \( X_{ij} \) affected by either the related shift or the zero are of three possible types: \[ X_{1,j+1} = s_{1,2,."

---

## Eq.16 — B → z^m B_m(X^{(∞)}) enhanced scaling

**Expected:** notes PDF p7/8 → Rodina p4
**Status:** ❌ CLAIM INVALID  ✅ EDGE EXISTS

### Notes-page content at claimed PDF page(s)

**notes p7** — 13 chunks
  - i69 [narrative] tags=path_integral
    "\[ e^{-\frac{i}{2} \int \text{d}^{4}x \left( \phi L \phi \right)} \]"
  - i70 [narrative] tags=probability_measure
    "probability measure"
  - i71 [narrative] tags=multidimensional_gaussian
    "multi-dimensional Gaussian on \( \mathbb{R}^{n} \)"
  - _(10 more chunks on this page)_
**notes p8** — 13 chunks
  - i82 [example] tags=sum_over_permutations, example_k4, partition_example
    "\[ \sum_{\sigma\in S_p} P_k^2 \prod_{\{i Parity: = 0 if \( k \) is odd Ex: \( k = 4 \) Partitions:"
  - i83 [example] tags=partition_example
    "(1,2) (3,4) (1,3) (2,4) (1,4) (2,3)"
  - i84 [narrative] tags=gaussian_integral, path_integral_context
    "\[ \langle x^{i_1} \ldots x^{i_k} \rangle = \langle x^{i_1} x^{i_2} \rangle \langle x^{i_3} x^{i_4} \rangle + \langle x^{i_1} x^{i_3} \rangle \langle x^{i_2} x^{i_4} \rangle + \lan"
  - _(10 more chunks on this page)_

**Keyword check:** ❌ no match — none of `z^m`, `B_m`, `X^{(\infty)}`, `enhanced`

### Edge check — does any edge go notes p7/8 → Rodina p4 (±1)?

**Found 6 matching edge(s).** First 3:
  - notes p7 → Rodina p5  rel=assumes conf=z relev=s
    SRC: "\[ = \frac{\int \mathcal{D} \phi \, e^{S[\phi]} \phi(x)}{\int \mathcal{D} \phi \, e^{S[\phi]}} = 0 \quad (1\text{-point function}) \] quanti"
    DST: "Imposing \( (n-3) \) distinct 1-zeros uniquely fixes the ansatz as the n-point \( \text{Tr}(\phi^3) \) amplitude, up to an overall coefficie"
  - notes p8 → Rodina p3  rel=proves conf=r relev=s
    SRC: "(1,2) (3,4) (1,3) (2,4) (1,4) (2,3)"
    DST: "It is clear that the only \( X_{ij} \) affected by either the related shift or the zero are of three possible types: \[ X_{1,j+1} = s_{1,2,."
  - notes p8 → Rodina p3  rel=proves conf=s relev=u
    SRC: "\[ \langle x^{i_1} \ldots x^{i_k} \rangle = \langle x^{i_1} x^{i_2} \rangle \langle x^{i_3} x^{i_4} \rangle + \langle x^{i_1} x^{i_3} \rangl"
    DST: "It is clear that the only \( X_{ij} \) affected by either the related shift or the zero are of three possible types: \[ X_{1,j+1} = s_{1,2,."

---

## Eq.17 — B_m same form X^{(∞)}=X^{(0)} bridge

**Expected:** notes PDF p7 → Rodina p4
**Status:** ✅ CLAIM VALID  ✅ EDGE EXISTS

### Notes-page content at claimed PDF page(s)

**notes p7** — 13 chunks
  - i69 [narrative] tags=path_integral
    "\[ e^{-\frac{i}{2} \int \text{d}^{4}x \left( \phi L \phi \right)} \]"
  - i70 [narrative] tags=probability_measure
    "probability measure"
  - i71 [narrative] tags=multidimensional_gaussian
    "multi-dimensional Gaussian on \( \mathbb{R}^{n} \)"
  - _(10 more chunks on this page)_

**Keyword check:** ✅ matched — found: `X^`

### Edge check — does any edge go notes p7 → Rodina p4 (±1)?

**Found 1 matching edge(s).** First 3:
  - notes p7 → Rodina p5  rel=assumes conf=z relev=s
    SRC: "\[ = \frac{\int \mathcal{D} \phi \, e^{S[\phi]} \phi(x)}{\int \mathcal{D} \phi \, e^{S[\phi]}} = 0 \quad (1\text{-point function}) \] quanti"
    DST: "Imposing \( (n-3) \) distinct 1-zeros uniquely fixes the ansatz as the n-point \( \text{Tr}(\phi^3) \) amplitude, up to an overall coefficie"

---

## Eq.18 — B' = B - B_m induction cascade

**Expected:** notes PDF p8/9 → Rodina p4
**Status:** ❌ CLAIM INVALID  ✅ EDGE EXISTS

### Notes-page content at claimed PDF page(s)

**notes p8** — 13 chunks
  - i82 [example] tags=sum_over_permutations, example_k4, partition_example
    "\[ \sum_{\sigma\in S_p} P_k^2 \prod_{\{i Parity: = 0 if \( k \) is odd Ex: \( k = 4 \) Partitions:"
  - i83 [example] tags=partition_example
    "(1,2) (3,4) (1,3) (2,4) (1,4) (2,3)"
  - i84 [narrative] tags=gaussian_integral, path_integral_context
    "\[ \langle x^{i_1} \ldots x^{i_k} \rangle = \langle x^{i_1} x^{i_2} \rangle \langle x^{i_3} x^{i_4} \rangle + \langle x^{i_1} x^{i_3} \rangle \langle x^{i_2} x^{i_4} \rangle + \lan"
  - _(10 more chunks on this page)_
**notes p9** — 12 chunks
  - i95 [narrative] tags=path_integral
    "\[ \mathcal{Z}[q] = \int \mathcal{D}q \, e^{i S[q]} \]"
  - i96 [narrative] tags=path_integral, statistical_mechanics
    ""sum over all paths" Statistical mechanics"
  - i97 [narrative] tags=partition_function
    "\[ \mathcal{Z} = \sum_i e^{-\beta E_i} \]"
  - _(9 more chunks on this page)_

**Keyword check:** ❌ no match — none of `B'`, `B prime`, `cascade`, `inductio`

### Edge check — does any edge go notes p8/9 → Rodina p4 (±1)?

**Found 5 matching edge(s).** First 3:
  - notes p8 → Rodina p3  rel=proves conf=r relev=s
    SRC: "(1,2) (3,4) (1,3) (2,4) (1,4) (2,3)"
    DST: "It is clear that the only \( X_{ij} \) affected by either the related shift or the zero are of three possible types: \[ X_{1,j+1} = s_{1,2,."
  - notes p8 → Rodina p3  rel=proves conf=s relev=u
    SRC: "\[ \langle x^{i_1} \ldots x^{i_k} \rangle = \langle x^{i_1} x^{i_2} \rangle \langle x^{i_3} x^{i_4} \rangle + \langle x^{i_1} x^{i_3} \rangl"
    DST: "It is clear that the only \( X_{ij} \) affected by either the related shift or the zero are of three possible types: \[ X_{1,j+1} = s_{1,2,."
  - notes p8 → Rodina p3  rel=proves conf=s relev=u
    SRC: "\[ \langle x^i x^j \rangle = \frac{\int d^n x \, x^i x^j e^{-\frac{1}{2} x' A x}}{\int d^n x \, e^{-\frac{1}{2} x' A x}} = (A^{-1})_{ij} \]"
    DST: "It is clear that the only \( X_{ij} \) affected by either the related shift or the zero are of three possible types: \[ X_{1,j+1} = s_{1,2,."

---

## Eq.19 — S_1, S_2 D-subsets 6-point

**Expected:** notes PDF p3/4 → Rodina p5
**Status:** ❌ CLAIM INVALID  ✅ EDGE EXISTS

### Notes-page content at claimed PDF page(s)

**notes p3** — 7 chunks
  - i22 [definition] tags=variational_problems, lagrangian_definition
    "A special subset of variational problems look like this: \[ \mathcal{S}(y) = \int_{t_0}^{t_1} \mathcal{L}(t, y(t), \dot{y}(t), \ddot{y}(t), \ldots) \, dt \quad y : [t_0, t_1] \to \"
  - i23 [narrative] tags=physics_derivatives
    "In physics generally we stop at 1 derivative."
  - i24 [narrative] tags=hamiltons_principle, euler_lagrange_equations
    "Hamilton's principle: the physical path is a critical point of \( \mathcal{S} \). Euler-Lagrange eqs: \[ \frac{d}{d\epsilon} \mathcal{S}(\delta_\epsilon) \bigg|_{\epsilon=0} = 0 \q"
  - _(4 more chunks on this page)_
**notes p4** — 10 chunks
  - i29 [narrative] tags=lagrangian_variation
    "\[ \int_{t_0}^{t_1} \frac{\partial \mathcal{L}}{\partial \dot{q}^n} (t, x(t), \dot{x}(t)) \delta \dot{q}^n(t) - \frac{d}{dt} \left( \frac{\partial \mathcal{L}}{\partial s^n} (t, x("
  - i30 [equation] tags=euler_lagrange_equation, lagrangian_general_form
    "\[ \frac{\partial}{\partial q^n} \mathcal{L}(t, x(t), \dot{q}(t)) - \frac{d}{dt} \frac{\partial}{\partial s^n} \mathcal{L}(t, x(t), \dot{x}(t)) = 0 \] general form: \( \mathcal{L} "
  - i31 [narrative] tags=action_integral
    "\[ S = \int_{t_n}^{t_1} \mathcal{L}(t, x(t), \dot{x}(t), \ddot{x}(t), \ldots) \, dt \]"
  - _(7 more chunks on this page)_

**Keyword check:** ❌ no match — none of `S_1`, `S_2`, `D-subset`, `D subset`

### Edge check — does any edge go notes p3/4 → Rodina p5 (±1)?

**Found 1 matching edge(s).** First 3:
  - notes p3 → Rodina p6  rel=proves conf=s relev=u
    SRC: "𝟙 \( \gamma \) is a critical point, then \( \frac{d}{d\epsilon} \mathcal{S}(\delta_\epsilon) \bigg|_{\epsilon=0} = 0 \) for all variations."
    DST: "This is precisely the same set of \( X_{ij} \) we found above for the zero condition! Finally we need to find all linear combinations of z-d"

---

## Eq.20 — cut argument s_{34}

**Expected:** notes PDF p3 → Rodina p5
**Status:** ❌ CLAIM INVALID  ✅ EDGE EXISTS

### Notes-page content at claimed PDF page(s)

**notes p3** — 7 chunks
  - i22 [definition] tags=variational_problems, lagrangian_definition
    "A special subset of variational problems look like this: \[ \mathcal{S}(y) = \int_{t_0}^{t_1} \mathcal{L}(t, y(t), \dot{y}(t), \ddot{y}(t), \ldots) \, dt \quad y : [t_0, t_1] \to \"
  - i23 [narrative] tags=physics_derivatives
    "In physics generally we stop at 1 derivative."
  - i24 [narrative] tags=hamiltons_principle, euler_lagrange_equations
    "Hamilton's principle: the physical path is a critical point of \( \mathcal{S} \). Euler-Lagrange eqs: \[ \frac{d}{d\epsilon} \mathcal{S}(\delta_\epsilon) \bigg|_{\epsilon=0} = 0 \q"
  - _(4 more chunks on this page)_

**Keyword check:** ❌ no match — none of `cut`, `s_{34}`, `s34`

### Edge check — does any edge go notes p3 → Rodina p5 (±1)?

**Found 1 matching edge(s).** First 3:
  - notes p3 → Rodina p6  rel=proves conf=s relev=u
    SRC: "𝟙 \( \gamma \) is a critical point, then \( \frac{d}{d\epsilon} \mathcal{S}(\delta_\epsilon) \bigg|_{\epsilon=0} = 0 \) for all variations."
    DST: "This is precisely the same set of \( X_{ij} \) we found above for the zero condition! Finally we need to find all linear combinations of z-d"

---

## Eq.21 — S_1 factored c_{ij} + s_{34}Q

**Expected:** notes PDF p3/4 → Rodina p5
**Status:** ❌ CLAIM INVALID  ✅ EDGE EXISTS

### Notes-page content at claimed PDF page(s)

**notes p3** — 7 chunks
  - i22 [definition] tags=variational_problems, lagrangian_definition
    "A special subset of variational problems look like this: \[ \mathcal{S}(y) = \int_{t_0}^{t_1} \mathcal{L}(t, y(t), \dot{y}(t), \ddot{y}(t), \ldots) \, dt \quad y : [t_0, t_1] \to \"
  - i23 [narrative] tags=physics_derivatives
    "In physics generally we stop at 1 derivative."
  - i24 [narrative] tags=hamiltons_principle, euler_lagrange_equations
    "Hamilton's principle: the physical path is a critical point of \( \mathcal{S} \). Euler-Lagrange eqs: \[ \frac{d}{d\epsilon} \mathcal{S}(\delta_\epsilon) \bigg|_{\epsilon=0} = 0 \q"
  - _(4 more chunks on this page)_
**notes p4** — 10 chunks
  - i29 [narrative] tags=lagrangian_variation
    "\[ \int_{t_0}^{t_1} \frac{\partial \mathcal{L}}{\partial \dot{q}^n} (t, x(t), \dot{x}(t)) \delta \dot{q}^n(t) - \frac{d}{dt} \left( \frac{\partial \mathcal{L}}{\partial s^n} (t, x("
  - i30 [equation] tags=euler_lagrange_equation, lagrangian_general_form
    "\[ \frac{\partial}{\partial q^n} \mathcal{L}(t, x(t), \dot{q}(t)) - \frac{d}{dt} \frac{\partial}{\partial s^n} \mathcal{L}(t, x(t), \dot{x}(t)) = 0 \] general form: \( \mathcal{L} "
  - i31 [narrative] tags=action_integral
    "\[ S = \int_{t_n}^{t_1} \mathcal{L}(t, x(t), \dot{x}(t), \ddot{x}(t), \ldots) \, dt \]"
  - _(7 more chunks on this page)_

**Keyword check:** ❌ no match — none of `S_1`, `s_{34}`, `c_{ij}`

### Edge check — does any edge go notes p3/4 → Rodina p5 (±1)?

**Found 1 matching edge(s).** First 3:
  - notes p3 → Rodina p6  rel=proves conf=s relev=u
    SRC: "𝟙 \( \gamma \) is a critical point, then \( \frac{d}{d\epsilon} \mathcal{S}(\delta_\epsilon) \bigg|_{\epsilon=0} = 0 \) for all variations."
    DST: "This is precisely the same set of \( X_{ij} \) we found above for the zero condition! Finally we need to find all linear combinations of z-d"

---

## Eq.22 — s_{1234}=-s_{2345} coefficient fixing

**Expected:** notes PDF p10/11/5 → Rodina p5
**Status:** ❌ CLAIM INVALID  ✅ EDGE EXISTS

### Notes-page content at claimed PDF page(s)

**notes p10** — 17 chunks
  - i107 [narrative] tags=free_propagator
    "\[ \sigma(1): \quad \langle \phi(x) \phi(y) \rangle_0 \]"
  - i108 [narrative] tags=amplitude_two
    "\[ \sigma(8) : \quad \langle \phi(x) \phi(y) \rangle_2 \]"
  - i109 [narrative] tags=beta_squared
    "\[ \sigma(\beta^2) \]"
  - _(14 more chunks on this page)_
**notes p11** — 13 chunks
  - i124 [narrative] tags=field_expectation
    "\(\langle \phi(x) \rangle = \)"
  - i125 [narrative] tags=fourier_transform
    "\(\phi(p) = \int \frac{d^4 x}{(2 \pi)^2} \phi(x) e^{-ip \cdot x}\)"
  - i126 [narrative] tags=inverse_fourier_transform
    "\(\phi(x) = \int \frac{d^4 p}{(2 \pi)^2} \phi(p) e^{+ip \cdot x}\)"
  - _(10 more chunks on this page)_
**notes p5** — 11 chunks
  - i39 [narrative] tags=lagrangian_equivalence, lagrangian_modification
    "if \( \mathcal{L} \Rightarrow \mathcal{L} + \frac{d}{dt}f(x,\dot{x}) \) thm same equations (what physicist say) mot why now: if you add \( F(x,a) \) to \( \mathcal{L} \) s.t."
  - i40 [equation] tags=lagrangian_modification, euler_lagrange_equation
    "\( F(x(t),x(t),\dot{x}) = \frac{d}{dt} \left( f(x(t),x(t)) \right) \) thm EL eq."
  - i41 [equation] tags=euler_lagrange_equation, equivalence
    "says the same"
  - _(8 more chunks on this page)_

**Keyword check:** ❌ no match — none of `s_{1234}`, `s_{2345}`, `s1234`

### Edge check — does any edge go notes p10/11/5 → Rodina p5 (±1)?

**Found 4 matching edge(s).** First 3:
  - notes p10 → Rodina p5  rel=proves conf=r relev=s
    SRC: "\[ = \sum_{k=0}^{\infty} \frac{(ig)^k}{k!} \int D\phi \, e^{iS_{0}[\phi]} (S_{T}[\phi])^k \]"
    DST: "Imposing \( (n-3) \) distinct 1-zeros uniquely fixes the ansatz as the n-point \( \text{Tr}(\phi^3) \) amplitude, up to an overall coefficie"
  - notes p10 → Rodina p5  rel=proves conf=r relev=s
    SRC: "\[ \langle \phi(x) \phi(y) \rangle \langle \phi(z) \phi(s) \rangle \langle \phi(b) \phi(s) \rangle^2 \]"
    DST: "Imposing \( (n-3) \) distinct 1-zeros uniquely fixes the ansatz as the n-point \( \text{Tr}(\phi^3) \) amplitude, up to an overall coefficie"
  - notes p10 → Rodina p5  rel=proves conf=r relev=s
    SRC: "\[ \langle \phi(y) \phi(z) \rangle \langle \phi(x) \phi(s) \rangle \langle \phi(b) \phi(s) \rangle^2 \]"
    DST: "Imposing \( (n-3) \) distinct 1-zeros uniquely fixes the ansatz as the n-point \( \text{Tr}(\phi^3) \) amplitude, up to an overall coefficie"

---

## Eq.23 — momentum identity s expressions

**Expected:** notes PDF p4/5 → Rodina p5
**Status:** ❌ CLAIM INVALID  ❌ EDGE MISSING

### Notes-page content at claimed PDF page(s)

**notes p4** — 10 chunks
  - i29 [narrative] tags=lagrangian_variation
    "\[ \int_{t_0}^{t_1} \frac{\partial \mathcal{L}}{\partial \dot{q}^n} (t, x(t), \dot{x}(t)) \delta \dot{q}^n(t) - \frac{d}{dt} \left( \frac{\partial \mathcal{L}}{\partial s^n} (t, x("
  - i30 [equation] tags=euler_lagrange_equation, lagrangian_general_form
    "\[ \frac{\partial}{\partial q^n} \mathcal{L}(t, x(t), \dot{q}(t)) - \frac{d}{dt} \frac{\partial}{\partial s^n} \mathcal{L}(t, x(t), \dot{x}(t)) = 0 \] general form: \( \mathcal{L} "
  - i31 [narrative] tags=action_integral
    "\[ S = \int_{t_n}^{t_1} \mathcal{L}(t, x(t), \dot{x}(t), \ddot{x}(t), \ldots) \, dt \]"
  - _(7 more chunks on this page)_
**notes p5** — 11 chunks
  - i39 [narrative] tags=lagrangian_equivalence, lagrangian_modification
    "if \( \mathcal{L} \Rightarrow \mathcal{L} + \frac{d}{dt}f(x,\dot{x}) \) thm same equations (what physicist say) mot why now: if you add \( F(x,a) \) to \( \mathcal{L} \) s.t."
  - i40 [equation] tags=lagrangian_modification, euler_lagrange_equation
    "\( F(x(t),x(t),\dot{x}) = \frac{d}{dt} \left( f(x(t),x(t)) \right) \) thm EL eq."
  - i41 [equation] tags=euler_lagrange_equation, equivalence
    "says the same"
  - _(8 more chunks on this page)_

**Keyword check:** ❌ no match — none of `momentum`, `s_{`

### Edge check — does any edge go notes p4/5 → Rodina p5 (±1)?

**NO MATCHING EDGE** from claimed notes pages to Rodina p5.

_Other notes pages that DID land on Rodina p5 (±1):_ p1, p2, p3, p6, p7, p8, p9, p10, p11, p12, p18, p19, p20, p21, p24, p25, p26, p30, p31, p32, p33, p34, p35, p36, p37, p38, p39, p41, p42, p43, p44, p45, p47, p48, p49, p50, p51, p52, p53, p54, p55, p56, p57, p58, p59, p60, p61, p62, p63, p64, p65

---
