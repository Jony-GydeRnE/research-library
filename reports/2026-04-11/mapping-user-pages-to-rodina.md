# Actual Edge Mapping: User-Specified Notes Pages → Rodina

Generated 2026-04-11. Live DB state: 93.8% checkpoint (post `c781f35`).
Notes book: `69d9ce81aa83b8b11c1837dd` (Lagrangians + EL, 65 pp).
Target: Rodina `69d5dd60c826b8392d57012d` (Hidden zeros ↔ enhanced UV, 9 pp).

For each notes page, shows: (a) what the page actually contains in the DB, (b) every edge from that page to Rodina with target chunk text, relationship, and confidence.

---

# p18-29 (amplitude defs, eq.2 color decomp, eq.3-7 foundations)

## notes p18 — 1 chunks, 1 edges to Rodina

### Page content (first 4 chunks):

- i184 [narrative] tags=`planar_diagrams, catalan_number`
  "The number of planar diagrams with fixed ordering is the Catalan number."

### Edges from notes p18 → Rodina:

| # | → Rodina page | Rodina chunk | rel | conf | relev | notes source text (first 120ch) | Rodina target text (first 160ch) |
|---|---|---|---|---|---|---|---|
| 1 | **p4** | i65 [narrative] `n_point_diagrams,uniqueness_procedure` | assumes | u | u | The number of planar diagrams with fixed ordering is the Catalan number. | All n-point diagrams can be uniquely obtained via this procedure by starting from all (n−1)-point diagrams, for all possible choices of arranging the propagator |

---

## notes p19 — 13 chunks, 8 edges to Rodina

### Page content (first 4 chunks):

- i185 [narrative] tags=`catalan_numbers`
  "\( C_k \)"
- i186 [narrative] tags=`catalan_numbers`
  "\( C_0 = 1 \) \( C_1 = 1 \) \( C_2 = 2 \) \( C_3 = 5 \) \( C_4 = 14 \)"
- i187 [narrative] tags=`catalan_numbers, formula`
  "\[ \frac{1}{n+1} \binom{2n}{n} \]"
- i188 [narrative] tags=`triangulation, process`
  "Triangulate \(\tau\)"
- _(9 more chunks)_

### Edges from notes p19 → Rodina:

| # | → Rodina page | Rodina chunk | rel | conf | relev | notes source text (first 120ch) | Rodina target text (first 160ch) |
|---|---|---|---|---|---|---|---|
| 1 | **p1** | i18 [narrative] `mandelstam_invariants,planar_invariants,nonplanar_invariants` | assumes | s | z | \(C_{i0} = -(P_i + P_j)^2\) | Typical notations used are the Mandelstam invariants \( s_{ij,\ldots}=(p_i+p_j+\ldots+p_k)^2 \), the planar invariants \( X_{ij}=s_{i,i+1}=(p_i+p_{i+1}+\ldots+p |
| 2 | **p1** | i18 [narrative] `mandelstam_invariants,planar_invariants,nonplanar_invariants` | proves | s | u | Also include \(C_{12}, C_{23}, C_{34}\) | Typical notations used are the Mandelstam invariants \( s_{ij,\ldots}=(p_i+p_j+\ldots+p_k)^2 \), the planar invariants \( X_{ij}=s_{i,i+1}=(p_i+p_{i+1}+\ldots+p |
| 3 | **p1** | i20 [narrative] `kinematic_invariants,planar_invariants,nonplanar_invariants` | proves | s | u | Number of intervals: \(\frac{n(n-3)}{2} = 5\) | At n-points, there is a basis of n(n−3)/2 kinematic invariants, which we can take as the \( X_{ij} \). A crucial relation between the planar \( X_{ij} \) and th |
| 4 | **p1** | i18 [narrative] `mandelstam_invariants,planar_invariants,nonplanar_invariants` | proves | s | u | \[ C_{12} = - X_{13} = -(P_1 + P_2)^2 \] | Typical notations used are the Mandelstam invariants \( s_{ij,\ldots}=(p_i+p_j+\ldots+p_k)^2 \), the planar invariants \( X_{ij}=s_{i,i+1}=(p_i+p_{i+1}+\ldots+p |
| 5 | **p1** | i20 [narrative] `kinematic_invariants,planar_invariants,nonplanar_invariants` | proves | r | s | Select \(X_{13}, X_{14}\) as planar avoiding everything but \(C_{ij} - j - i \) with \((i,j) \in \{ (1,3), (1,4) \}\) | At n-points, there is a basis of n(n−3)/2 kinematic invariants, which we can take as the \( X_{ij} \). A crucial relation between the planar \( X_{ij} \) and th |
| 6 | **p5** | i73 [narrative] `d_subsets,d_subsets_zero_condition,boundary_propagator_cut` | proves | r | s | Exclude \(C_{52}, C_{53}\). | All D-subsets independently satisfy the zero Consider the D-subsets in eq.(19), which satisfy \( (S_1+S_2)\big\|_{zero=0} \). Next, cut the non-boundary propagat |
| 7 | **p1** | i20 [narrative] `kinematic_invariants,planar_invariants,nonplanar_invariants` | proves | r | s | Include \(C_{15}, C_{45}\) because planar. | At n-points, there is a basis of n(n−3)/2 kinematic invariants, which we can take as the \( X_{ij} \). A crucial relation between the planar \( X_{ij} \) and th |
| 8 | **p1** | i18 [narrative] `mandelstam_invariants,planar_invariants,nonplanar_invariants` | proves | r | s | Planar: sum of consecutive momentum squared. | Typical notations used are the Mandelstam invariants \( s_{ij,\ldots}=(p_i+p_j+\ldots+p_k)^2 \), the planar invariants \( X_{ij}=s_{i,i+1}=(p_i+p_{i+1}+\ldots+p |

---

## notes p20 — 10 chunks, 10 edges to Rodina

### Page content (first 4 chunks):

- i198 [narrative] tags=`planar_invariants, nonplanar_invariants`
  "Take \( X_{13} \), \( X_{14} \), \( X_{15} \), exclude \( c_{62} \), \( c_{63} \), \( c_{64} \)."
- i199 [narrative] tags=`planar_invariants`
  "\[ C_{ij} = -(p_i + p_j)^2 \]"
- i200 [narrative] tags=`locality, constraint`
  "Locality: \( c_{1i} = 0 \)"
- i201 [narrative] tags=`planar_invariants, nonplanar_invariants`
  "Explore \( X_{24}, X_{25}, X_{35}, X_{36}, X_{40} \) with \( c_{13}, c_{20}, c_{15}, c_{24}, c_{25}, c_{35} \)."
- _(6 more chunks)_

### Edges from notes p20 → Rodina:

| # | → Rodina page | Rodina chunk | rel | conf | relev | notes source text (first 120ch) | Rodina target text (first 160ch) |
|---|---|---|---|---|---|---|---|
| 1 | **p1** | i18 [narrative] `mandelstam_invariants,planar_invariants,nonplanar_invariants` | proves | s | z | \[ X_{12} = p_{12} = -10 \] | Typical notations used are the Mandelstam invariants \( s_{ij,\ldots}=(p_i+p_j+\ldots+p_k)^2 \), the planar invariants \( X_{ij}=s_{i,i+1}=(p_i+p_{i+1}+\ldots+p |
| 2 | **p4** | i60 [narrative] `d_subsets,graph_topologies,focus` | proves | r | z | Locality: \( c_{1i} = 0 \) | In our present case, these subsets can be further decomposed into what we call D-subsets, which have a simple meaning in terms of graph topologies. Let us focus |
| 3 | **p6** | i90 [remark] `zero_condition,z_dependence,linear_combinations` | proves | s | u | Set \( n=6 \): 8 independent variables. In the \( n=5 \) example: | This is precisely the same set of \( X_{ij} \) we found above for the zero condition! Finally we need to find all linear combinations of z-dependent \( X_{ij} \ |
| 4 | **p1** | i20 [narrative] `kinematic_invariants,planar_invariants,nonplanar_invariants` | proves | r | s | Take \( X_{13} \), \( X_{14} \), \( X_{15} \), exclude \( c_{62} \), \( c_{63} \), \( c_{64} \). | At n-points, there is a basis of n(n−3)/2 kinematic invariants, which we can take as the \( X_{ij} \). A crucial relation between the planar \( X_{ij} \) and th |
| 5 | **p1** | i18 [narrative] `mandelstam_invariants,planar_invariants,nonplanar_invariants` | proves | r | s | \[ C_{ij} = -(p_i + p_j)^2 \] | Typical notations used are the Mandelstam invariants \( s_{ij,\ldots}=(p_i+p_j+\ldots+p_k)^2 \), the planar invariants \( X_{ij}=s_{i,i+1}=(p_i+p_{i+1}+\ldots+p |
| 6 | **p1** | i20 [narrative] `kinematic_invariants,planar_invariants,nonplanar_invariants` | proves | r | s | Explore \( X_{24}, X_{25}, X_{35}, X_{36}, X_{40} \) with \( c_{13}, c_{20}, c_{15}, c_{24}, c_{25}, c_{35} \). | At n-points, there is a basis of n(n−3)/2 kinematic invariants, which we can take as the \( X_{ij} \). A crucial relation between the planar \( X_{ij} \) and th |
| 7 | **p6** | i87 [narrative] `zero_condition` | proves | r | s | Must be shown that the remaining are obtained from basis. | The remaining \( X_{ij} \) are independent under the zero condition. |
| 8 | **p1** | i20 [narrative] `kinematic_invariants,planar_invariants,nonplanar_invariants` | proves | r | s | \[ X_{13}, X_{14}, c_{2} = X_{24}, X_{25}, X_{35} \] | At n-points, there is a basis of n(n−3)/2 kinematic invariants, which we can take as the \( X_{ij} \). A crucial relation between the planar \( X_{ij} \) and th |
| 9 | **p1** | i20 [narrative] `kinematic_invariants,planar_invariants,nonplanar_invariants` | proves | r | s | \[ c_{13}, c_{14}, c_{21}, c_{61}, X_{13}, X_{12} \] | At n-points, there is a basis of n(n−3)/2 kinematic invariants, which we can take as the \( X_{ij} \). A crucial relation between the planar \( X_{ij} \) and th |
| 10 | **p6** | i87 [narrative] `zero_condition` | proves | r | s | These pictures aim to find the non-zero \( X_{ij} \)'s. | The remaining \( X_{ij} \) are independent under the zero condition. |

---

## notes p21 — 20 chunks, 20 edges to Rodina

### Page content (first 4 chunks):

- i208 [narrative] tags=`planar_invariants`
  "\( c_{i,j} = X_{ij} + X_{i+1,j+1} - X_{i+1,j} - X_{i,j+1} \)"
- i209 [narrative] tags=`planar_invariants`
  "\( c_{1,3} : \quad X_{13} + X_{24} - X_{14} \)"
- i210 [narrative] tags=`planar_invariants`
  "\( c_{1,4} : \quad X_{14} + X_{25} - X_{24} \)"
- i211 [narrative] tags=`planar_invariants`
  "\( c_{2,4} : \quad X_{24} + X_{35} - X_{25} \)"
- _(16 more chunks)_

### Edges from notes p21 → Rodina:

| # | → Rodina page | Rodina chunk | rel | conf | relev | notes source text (first 120ch) | Rodina target text (first 160ch) |
|---|---|---|---|---|---|---|---|
| 1 | **p1** | i21 [narrative] `planar_invariants,nonplanar_invariants` | uses_definition | u | z | \( c_{i,j} = X_{ij} + X_{i+1,j+1} - X_{i+1,j} - X_{i,j+1} \) | \[ c_{ij} = X_{i,j} + X_{i+1,j+1} - X_{i+1,j} - X_{i,j+1}, \quad (1) \] |
| 2 | **p1** | i21 [narrative] `planar_invariants,nonplanar_invariants` | uses_definition | u | z | \( c_{23} = X_{23} + X_{34} + X_{24} - X_{33} - X_{24} \) | \[ c_{ij} = X_{i,j} + X_{i+1,j+1} - X_{i+1,j} - X_{i,j+1}, \quad (1) \] |
| 3 | **p1** | i18 [narrative] `mandelstam_invariants,planar_invariants,nonplanar_invariants` | proves | s | z | \( X_{i=1} = p_1^2 =0 \) | Typical notations used are the Mandelstam invariants \( s_{ij,\ldots}=(p_i+p_j+\ldots+p_k)^2 \), the planar invariants \( X_{ij}=s_{i,i+1}=(p_i+p_{i+1}+\ldots+p |
| 4 | **p4** | i65 [narrative] `n_point_diagrams,uniqueness_procedure` | proves | s | u | - choose triangulation, wrap the chords | All n-point diagrams can be uniquely obtained via this procedure by starting from all (n−1)-point diagrams, for all possible choices of arranging the propagator |
| 5 | **p3** | i42 [narrative] `zero_shift_relation,k_zero_type` | proves | s | u | \( X_{14} \rightarrow c_{63} \) | To see how the zero and shift may be related, let us write out the \( X_{ij} \) in terms of \( s_{ij} \). Consider the 1-zero type, \( c_{1i}=0 \). |
| 6 | **p3** | i42 [narrative] `zero_shift_relation,k_zero_type` | proves | s | u | \( X_{15} \rightarrow c_{64} \) | To see how the zero and shift may be related, let us write out the \( X_{ij} \) in terms of \( s_{ij} \). Consider the 1-zero type, \( c_{1i}=0 \). |
| 7 | **p1** | i21 [narrative] `planar_invariants,nonplanar_invariants` | proves | s | u | \( X_{24} \rightarrow c_{13} \) | \[ c_{ij} = X_{i,j} + X_{i+1,j+1} - X_{i+1,j} - X_{i,j+1}, \quad (1) \] |
| 8 | **p1** | i21 [narrative] `planar_invariants,nonplanar_invariants` | proves | s | u | \( X_{25} \rightarrow c_{16} \) | \[ c_{ij} = X_{i,j} + X_{i+1,j+1} - X_{i+1,j} - X_{i,j+1}, \quad (1) \] |
| 9 | **p1** | i21 [narrative] `planar_invariants,nonplanar_invariants` | proves | s | u | \( X_{26} \rightarrow c_{15} \) | \[ c_{ij} = X_{i,j} + X_{i+1,j+1} - X_{i+1,j} - X_{i,j+1}, \quad (1) \] |
| 10 | **p1** | i20 [narrative] `kinematic_invariants,planar_invariants,nonplanar_invariants` | proves | r | s | \( c_{1,3} : \quad X_{13} + X_{24} - X_{14} \) | At n-points, there is a basis of n(n−3)/2 kinematic invariants, which we can take as the \( X_{ij} \). A crucial relation between the planar \( X_{ij} \) and th |
| 11 | **p1** | i20 [narrative] `kinematic_invariants,planar_invariants,nonplanar_invariants` | proves | r | s | \( c_{1,4} : \quad X_{14} + X_{25} - X_{24} \) | At n-points, there is a basis of n(n−3)/2 kinematic invariants, which we can take as the \( X_{ij} \). A crucial relation between the planar \( X_{ij} \) and th |
| 12 | **p1** | i20 [narrative] `kinematic_invariants,planar_invariants,nonplanar_invariants` | proves | r | s | \( c_{2,4} : \quad X_{24} + X_{35} - X_{25} \) | At n-points, there is a basis of n(n−3)/2 kinematic invariants, which we can take as the \( X_{ij} \). A crucial relation between the planar \( X_{ij} \) and th |
| 13 | **p1** | i20 [narrative] `kinematic_invariants,planar_invariants,nonplanar_invariants` | proves | r | s | \( X_{25} = c_{1,4} + c_{1,3} - X_{13} \) | At n-points, there is a basis of n(n−3)/2 kinematic invariants, which we can take as the \( X_{ij} \). A crucial relation between the planar \( X_{ij} \) and th |
| 14 | **p1** | i20 [narrative] `kinematic_invariants,planar_invariants,nonplanar_invariants` | proves | r | s | \( X_{35} = c_{1,4} + c_{2,4} - X_{14} \) | At n-points, there is a basis of n(n−3)/2 kinematic invariants, which we can take as the \( X_{ij} \). A crucial relation between the planar \( X_{ij} \) and th |
| 15 | **p1** | i18 [narrative] `mandelstam_invariants,planar_invariants,nonplanar_invariants` | proves | r | s | \( X_{24} = c_{2,4} - X_{35} + X_{25} \) Procedure to replace variables: | Typical notations used are the Mandelstam invariants \( s_{ij,\ldots}=(p_i+p_j+\ldots+p_k)^2 \), the planar invariants \( X_{ij}=s_{i,i+1}=(p_i+p_{i+1}+\ldots+p |
| 16 | **p6** | i86 [narrative] `zero_condition` | proves | r | s | - for each discarded \( X_{ij} \), replace with \( c_{i-1,j-1} \) Replace: | The set of all \( X_{ij} \) that attain such dependencies can be easily obtained from the definition eq.(1). For a \( c_{ij} = 0 \), for \( i = 1, 2, \ldots, n- |
| 17 | **p6** | i85 [narrative] `zero_condition` | proves | r | s | \( X_{35} \rightarrow c_{24} \) | We accomplish this by showing that the \( X_{ij}^0 \equiv 0 \) satisfy the same set of identities, defined by the zero condition, as the ones \( c_{ij} = 0 \) i |
| 18 | **p1** | i20 [narrative] `kinematic_invariants,planar_invariants,nonplanar_invariants` | proves | r | s | If \( i \neq j \) | At n-points, there is a basis of n(n−3)/2 kinematic invariants, which we can take as the \( X_{ij} \). A crucial relation between the planar \( X_{ij} \) and th |
| 19 | **p1** | i18 [narrative] `mandelstam_invariants,planar_invariants,nonplanar_invariants` | proves | r | s | \( X_{i,j} = \left( \sum_{k_s:}^{j-1} p_{n}^2 \right) \) | Typical notations used are the Mandelstam invariants \( s_{ij,\ldots}=(p_i+p_j+\ldots+p_k)^2 \), the planar invariants \( X_{ij}=s_{i,i+1}=(p_i+p_{i+1}+\ldots+p |
| 20 | **p1** | i20 [narrative] `kinematic_invariants,planar_invariants,nonplanar_invariants` | proves | r | s | \( X_{i:=} = 0 \quad \text{by definition} \) | At n-points, there is a basis of n(n−3)/2 kinematic invariants, which we can take as the \( X_{ij} \). A crucial relation between the planar \( X_{ij} \) and th |

---

## notes p22 — 2 chunks, 2 edges to Rodina

### Page content (first 4 chunks):

- i228 [narrative] tags=`planar_invariants`
  "\[ X_{13} \quad X_{35} \quad X_{51} \]"
- i229 [narrative] tags=`nonplanar_invariants, transformation`
  "replace: \[ X_{14} \rightarrow c_{63} \\ X_{24} \rightarrow c_{13} \\ X_{25} \rightarrow c_{14} \\ X_{26} \rightarrow c_{15} \\ X_{36} \rightarrow c_{25} \\ X_{46} \rightarrow c_{35} \]"

### Edges from notes p22 → Rodina:

| # | → Rodina page | Rodina chunk | rel | conf | relev | notes source text (first 120ch) | Rodina target text (first 160ch) |
|---|---|---|---|---|---|---|---|
| 1 | **p1** | i18 [narrative] `mandelstam_invariants,planar_invariants,nonplanar_invariants` | proves | r | s | \[ X_{13} \quad X_{35} \quad X_{51} \] | Typical notations used are the Mandelstam invariants \( s_{ij,\ldots}=(p_i+p_j+\ldots+p_k)^2 \), the planar invariants \( X_{ij}=s_{i,i+1}=(p_i+p_{i+1}+\ldots+p |
| 2 | **p1** | i20 [narrative] `kinematic_invariants,planar_invariants,nonplanar_invariants` | proves | r | s | replace: \[ X_{14} \rightarrow c_{63} \\ X_{24} \rightarrow c_{13} \\ X_{25} \rightarrow c_{14} \\ X_{26} \rightarrow c_ | At n-points, there is a basis of n(n−3)/2 kinematic invariants, which we can take as the \( X_{ij} \). A crucial relation between the planar \( X_{ij} \) and th |

---

## notes p23 — 7 chunks, 5 edges to Rodina

### Page content (first 4 chunks):

- i230 [narrative] tags=`lagrangian_phi3`
  "\[ \mathcal{L} = \frac{1}{2} \text{tr} \left( \partial_{\mu} \phi \, \partial^{\mu} \phi \right) + g \, \text{tr} \left( \phi^3 \right) \]"
- i231 [narrative] tags=`matrix_representation_phi`
  "\(\phi\) is an \(N \times N\) matrix"
- i232 [narrative] tags=`matrix_component_phi`
  "\(\phi^i_j\)"
- i233 [narrative] tags=`lagrangian_phi3_expanded`
  "\(\mathcal{L} = \frac{1}{2} \partial_{\mu} \phi^i_j \, \partial^{\mu} \phi^j_i + g \, \phi^i_j \phi^j_k \phi^k_i\)"
- _(3 more chunks)_

### Edges from notes p23 → Rodina:

| # | → Rodina page | Rodina chunk | rel | conf | relev | notes source text (first 120ch) | Rodina target text (first 160ch) |
|---|---|---|---|---|---|---|---|
| 1 | **p2** | i32 [narrative] `tr_phi3_amplitudes,generalization,amplitude_zeros` | assumes | z | s | \(\phi^i_j\) | This observation generalizes to arbitrary multiplicity, and identical facts hold for NLSM, YM-scalar, which unlike Tr(\( \phi^3 \)) also contains non-trivial nu |
| 2 | **p1** | i9 [definition] `lagrangian_formalism,hidden_zeros` | proves | s | z | \(\mathcal{L} = \frac{1}{2} \partial_{\mu} \phi^i_j \, \partial^{\mu} \phi^j_i + g \, \phi^i_j \phi^j_k \phi^k_i\) | These novel perspectives have revealed surprising structures and numerous additional simplifications that are completely hidden by the Lagrangian formalism. |
| 3 | **p1** | i3 [narrative] `enhanced_uv_scaling,tr_phi3_amplitudes` | proves | s | u | \[ \mathcal{L} = \frac{1}{2} \text{tr} \left( \partial_{\mu} \phi \, \partial^{\mu} \phi \right) + g \, \text{tr} \left( | This directly applies to Tr(\(\phi^3\)), non-linear sigma model, or Yang-Mills scalar amplitudes, revealing a novel type of enhanced UV scaling in these theorie |
| 4 | **p2** | i31 [narrative] `amplitude_zeros,independence,tr_phi3_amplitudes` | proves | s | u | \[ \langle \phi^{i_1}_{j_1}(x_1) \, \phi^{i_2}_{j_2}(x_2) \rangle_0 \propto \delta^{i_1}_{j_2} \, \delta^{i_2}_{j_1} \] | All the various zeros are all independent, no zero implies any other zero. For example, the ordered 4-point Tr(\( \phi^3 \)) amplitude \[ A_4(1234) = \frac{1}{s |
| 5 | **p1** | i0 [narrative] `hidden_zeros,enhanced_uv_scaling,tr_phi3_amplitudes` | proves | s | u | \[ e^{i S[\phi]} = e^{i S_0[\phi]} \left( 1 + g \int \text{tr}(\phi^3) + \frac{g^2}{2} \left( \int \text{tr}(\phi^3) \ri | Hidden zeros are equivalent to enhanced ultraviolet scaling and lead to unique amplitudes in Tr(\(\phi^3\)) theory |

---

## notes p24 — 9 chunks, 4 edges to Rodina

### Page content (first 4 chunks):

- i237 [narrative] tags=`phi_correlation_function`
  "\[ \left\langle \phi^{i_4} (P_1) \phi^{i_2}_{i_2} (P_2) \phi^{i_3}_{i_3} (P_3) \right\rangle \approx \frac{ \int \mathcal{D} \phi \ e^{-S_0[\phi]} \left( 1 + g \int d \tau \ t x \langle \phi^3 \rangle"
- i238 [narrative] tags=`phi_correlation_function`
  "\[ \left\langle \phi^{i_4} (P_1) \phi^{i_2}_{i_2} (P_2) \phi^{i_3}_{i_3} (P_3) \right\rangle \approx \left\langle \phi^{i_4} (P_1) \phi^{i_2}_{i_2} (P_2) \phi^{i_3}_{i_3} (P_3) \right\rangle \int dp_4"
- i239 [narrative] tags=`phi_product`
  "\[ \phi^{i_4}_{i_5} \phi^{i_5}_{i_6} \phi^{i_6}_{i_4} \]"
- i240 [narrative] tags=`bra_ket_notation`
  "\[ \langle 0 | 2 3 4 5 6 \rangle = \]"
- _(5 more chunks)_

### Edges from notes p24 → Rodina:

| # | → Rodina page | Rodina chunk | rel | conf | relev | notes source text (first 120ch) | Rodina target text (first 160ch) |
|---|---|---|---|---|---|---|---|
| 1 | **p3** | i44 [narrative] `affected_invariants,zero_condition` | proves | s | u | \[ \langle 1 2 \rangle \langle 3 4 \rangle \langle 5 6 \rangle (6 - 1)!! \] | \[ X_{2,n} = s_{2,...,n-1} = -s_{12} - \sum_{i=3}^{n-1} s_{1i}, \] for \( 2 \leq j \leq n-2 \). Under the zero condition, these become |
| 2 | **p4** | i59 [narrative] `amplitude_zeros,uv_scaling` | proves | s | u | Extract 4 5 6 and themselves | In the previous section we saw that the zero for any function can be decomposed into zeros of individual subsets, organized by their UV scaling. |
| 3 | **p2** | i31 [narrative] `amplitude_zeros,independence,tr_phi3_amplitudes` | proves | r | s | \[ \left\langle \phi^{i_4} (P_1) \phi^{i_2}_{i_2} (P_2) \phi^{i_3}_{i_3} (P_3) \right\rangle \approx \frac{ \int \mathca | All the various zeros are all independent, no zero implies any other zero. For example, the ordered 4-point Tr(\( \phi^3 \)) amplitude \[ A_4(1234) = \frac{1}{s |
| 4 | **p4** | i57 [narrative] `tr_phi3_amplitudes,local_ansatz,assumption` | proves | r | s | \[ \left\langle \phi^{i_4} (P_1) \phi^{i_2}_{i_2} (P_2) \phi^{i_3}_{i_3} (P_3) \right\rangle \approx \left\langle \phi^{ | In this case we assume all ansatz terms have numerators which do not carry any momentum dependence, and denominators which can be associated to cubic tree graph |

---

## notes p25 — 9 chunks, 6 edges to Rodina

### Page content (first 4 chunks):

- i246 [narrative] tags=`matrix_multiplication`
  "\[ -\langle l \, (A B) \rangle = \sum_{i, j, k} A^{i}_{k} B^{k}_{j} \]"
- i247 [narrative] tags=`matrix_multiplication`
  "\[ t_{l} \, (A B C) = \sum_{i, j, k} A^{i}_{k} B^{k}_{j} C^{j}_{i} \]"
- i248 [narrative] tags=`tensor_contraction`
  "\[ = \sum_{i_1, i_2, i_3, k_1, k_2, k_3, l_1, l_2, l_3} A^{i_1}_{k_1} B^{i_2}_{k_2} C^{i_3}_{k_3} S^{i_1 i_2 i_3}_{j_1 j_2 j_3} \]"
- i249 [narrative] tags=`matrix_multiplication`
  "\[ (A B)^{j}_{i} = \sum_{k} A^{i}_{k} B^{k}_{j} \]"
- _(5 more chunks)_

### Edges from notes p25 → Rodina:

| # | → Rodina page | Rodina chunk | rel | conf | relev | notes source text (first 120ch) | Rodina target text (first 160ch) |
|---|---|---|---|---|---|---|---|
| 1 | **p1** | i19 [narrative] `momentum_conservation,on_shell_condition` | prerequisite | u | z | \[ \sum_{{i_1, i_2, i_3 \atop i_4, i_5, i_6}} \int dp_{5} \, dp_{6} \, \langle 1 \, 4 \rangle \langle 2 \, 5 \rangle \la | Here \( p_i \) is the \( D \)-dimensional momentum of particle \( i \), subjected to momentum conservation \( \sum_i p_i=0 \) (which implies \( X_{ij}=X_{ji} \) |
| 2 | **p5** | i68 [narrative] `d_subsets` | proves | s | z | \[ -\langle l \, (A B) \rangle = \sum_{i, j, k} A^{i}_{k} B^{k}_{j} \] | \[ \begin{align*} S_1 &= \frac{x_1}{s_{12}s_{1234}s_{34}} + \frac{x_2}{s_{23}s_{41234}s_{34}} + \frac{x_3}{s_{34}s_{2345}s_{34}}, \\ S_2 &= \frac{s_{12}s_{12345 |
| 3 | **p1** | i21 [narrative] `planar_invariants,nonplanar_invariants` | assumes | s | z | Non-cyclic permutation of panels are among 2 and 3. | \[ c_{ij} = X_{i,j} + X_{i+1,j+1} - X_{i+1,j} - X_{i,j+1}, \quad (1) \] |
| 4 | **p5** | i68 [narrative] `d_subsets` | assumes | u | u | \[ t_{l} \, (A B C) = \sum_{i, j, k} A^{i}_{k} B^{k}_{j} C^{j}_{i} \] | \[ \begin{align*} S_1 &= \frac{x_1}{s_{12}s_{1234}s_{34}} + \frac{x_2}{s_{23}s_{41234}s_{34}} + \frac{x_3}{s_{34}s_{2345}s_{34}}, \\ S_2 &= \frac{s_{12}s_{12345 |
| 5 | **p5** | i68 [narrative] `d_subsets` | assumes | u | u | \[ \langle 1 \, 4 \rangle \langle 2 \, 6 \rangle \langle 3 \, 5 \rangle \] | \[ \begin{align*} S_1 &= \frac{x_1}{s_{12}s_{1234}s_{34}} + \frac{x_2}{s_{23}s_{41234}s_{34}} + \frac{x_3}{s_{34}s_{2345}s_{34}}, \\ S_2 &= \frac{s_{12}s_{12345 |
| 6 | **p3** | i43 [example] `affected_invariants` | proves | s | u | \[ (A B)^{j}_{i} = \sum_{k} A^{i}_{k} B^{k}_{j} \] | It is clear that the only \( X_{ij} \) affected by either the related shift or the zero are of three possible types: \[ X_{1,j+1} = s_{1,2,...,j} = s_{12} + \su |

---

## notes p26 — 11 chunks, 11 edges to Rodina

### Page content (first 4 chunks):

- i255 [narrative] tags=`amplitude_fixed_ordering`
  "\( A_3 = \sum \) of amplitude with fixed ordering"
- i256 [narrative] tags=`amplitude_fixed_ordering`
  "\[ \frac{1}{S_n / 2 n} \]"
- i257 [narrative] tags=`amplitude_fixed_ordering`
  "\( n = 4 \)"
- i258 [narrative] tags=`amplitude_fixed_ordering`
  "\(\langle 1\, 2\, 3\, 4 \rangle \quad \langle 5\, 6\, 7\, 8\, 9\, 10 \rangle\) \\ extend bg \(\quad t_1(\phi^3)\) \(\quad t_1(\psi)\)"
- _(7 more chunks)_

### Edges from notes p26 → Rodina:

| # | → Rodina page | Rodina chunk | rel | conf | relev | notes source text (first 120ch) | Rodina target text (first 160ch) |
|---|---|---|---|---|---|---|---|
| 1 | **p2** | i33 [theorem] `pole_structure,colored_amplitudes` | assumes | u | z | \[ \frac{1}{S_n / 2 n} \] | Pole structure and ordered amplitudes In this paper, we will only consider amplitudes of colored particles, which can be written as a sum over different colored |
| 2 | **p2** | i33 [theorem] `pole_structure,colored_amplitudes` | proves | s | z | \(\langle 1\,:\!5 \rangle \langle 2\,6 \rangle \langle 3\,8 \rangle \langle 4\,9 \rangle \langle 7\,10 \rangle\) \(\cdot | Pole structure and ordered amplitudes In this paper, we will only consider amplitudes of colored particles, which can be written as a sum over different colored |
| 3 | **p2** | i31 [narrative] `amplitude_zeros,independence,tr_phi3_amplitudes` | assumes | u | u | \(\langle 1\, 2\, 3\, 4 \rangle \quad \langle 5\, 6\, 7\, 8\, 9\, 10 \rangle\) \\ extend bg \(\quad t_1(\phi^3)\) \(\qua | All the various zeros are all independent, no zero implies any other zero. For example, the ordered 4-point Tr(\( \phi^3 \)) amplitude \[ A_4(1234) = \frac{1}{s |
| 4 | **p3** | i51 [narrative] `zeros_bcfw_permutation,zeros_bcfw_connection,subset_zeros_uv_scaling` | assumes | u | u | cyclic symmetry \(\quad \langle 5\, 6\, 7 \rangle \quad \langle 8\, 9\, 10 \rangle\) | The above can be cyclically permuted leading to similar statements for all zeros. In the next section we explore the connection more concretely. SUBSET ZEROS AN |
| 5 | **p2** | i31 [narrative] `amplitude_zeros,independence,tr_phi3_amplitudes` | proves | s | u | \( n = 4 \) | All the various zeros are all independent, no zero implies any other zero. For example, the ordered 4-point Tr(\( \phi^3 \)) amplitude \[ A_4(1234) = \frac{1}{s |
| 6 | **p1** | i0 [narrative] `hidden_zeros,enhanced_uv_scaling,tr_phi3_amplitudes` | proves | s | u | w/o colors | Hidden zeros are equivalent to enhanced ultraviolet scaling and lead to unique amplitudes in Tr(\(\phi^3\)) theory |
| 7 | **p2** | i33 [theorem] `pole_structure,colored_amplitudes` | proves | r | u | \( A_3 = \sum \) of amplitude with fixed ordering | Pole structure and ordered amplitudes In this paper, we will only consider amplitudes of colored particles, which can be written as a sum over different colored |
| 8 | **p3** | i51 [narrative] `zeros_bcfw_permutation,zeros_bcfw_connection,subset_zeros_uv_scaling` | proves | r | u | this time, if we want connected, true local things, we need to connect one of 567 with one of 8910 | The above can be cyclically permuted leading to similar statements for all zeros. In the next section we explore the connection more concretely. SUBSET ZEROS AN |
| 9 | **p7** | i106 [narrative] `amplitude_zero` | proves | r | s | fix connection between 7 and 10 | This can be repeated for all pairs in the subset, and then for all subsets, proving that one amplitude zero uniquely fixes all subsets. |
| 10 | **p6** | i95 [narrative] `hidden_amplitude_zeros,uv_scaling` | proves | r | s | the rest needs to be created without loops | In this work we showed hidden amplitude zeros are in fact closely related to UV scaling, a crucial ingredient of the BCFW recursion. |
| 11 | **p7** | i106 [narrative] `amplitude_zero` | proves | r | s | \[ \begin{align*} \langle 1\,5 \rangle \langle 2\,6 \rangle \langle 3\,8 \rangle \langle 4\,9 \rangle \langle 7\,10 \ran | This can be repeated for all pairs in the subset, and then for all subsets, proving that one amplitude zero uniquely fixes all subsets. |

---

## notes p27 — 7 chunks, 6 edges to Rodina

### Page content (first 4 chunks):

- i266 [narrative] tags=`cycle_permutations, other_diagrams`
  "Cycle permutations: \[ \langle 1\,5\rangle \langle 2\,6\rangle \langle 3\,8\rangle \langle 4\,9\rangle \langle 7\,10 \rangle \] Other diagrams:"
- i267 [narrative] tags=`other_diagrams, complex_diagram, tree_level_amplitude`
  "\[ \langle 2\,5\rangle \langle 3\,6\rangle \langle 4\,8\rangle \langle 1\,9 \rangle \langle 7\,10 \rangle \] Figure: A complex diagram involving crossings, labeled i1 to i4 and d1 to d4. Figure: Tree-"
- i268 [narrative] tags=`permutation_steps, cycle_permutations, permutation_notation`
  "Figure: A series of steps showing permutation with paths labeled 1 to 4. \[ \langle 3\,5\rangle \langle 4\,6\rangle \langle 1\,8\rangle \langle 2\,9 \rangle \langle 7\,10 \rangle \] In the paper \( T_"
- i269 [narrative] tags=`permutation_amplitude`
  "\[ \mathcal{A}_4 = \sum_{\sigma \in S_4/\mathbb{Z}_4} \delta_{i_1}^{i_{\sigma1}} \delta_{i_2}^{i_{\sigma2}} \delta_{i_3}^{i_{\sigma3}} \delta_{i_4}^{i_{\sigma4}} \, \mathcal{A}_4(\sigma_{(1)} - \sigma"
- _(3 more chunks)_

### Edges from notes p27 → Rodina:

| # | → Rodina page | Rodina chunk | rel | conf | relev | notes source text (first 120ch) | Rodina target text (first 160ch) |
|---|---|---|---|---|---|---|---|
| 1 | **p2** | i33 [theorem] `pole_structure,colored_amplitudes` | proves | s | z | Mention amplitudes (planar) (partial amplitude): | Pole structure and ordered amplitudes In this paper, we will only consider amplitudes of colored particles, which can be written as a sum over different colored |
| 2 | **p2** | i33 [theorem] `pole_structure,colored_amplitudes` | assumes | u | u | \[ \mathcal{A}_4 = \sum_{\sigma \in S_4/\mathbb{Z}_4} \delta_{i_1}^{i_{\sigma1}} \delta_{i_2}^{i_{\sigma2}} \delta_{i_3} | Pole structure and ordered amplitudes In this paper, we will only consider amplitudes of colored particles, which can be written as a sum over different colored |
| 3 | **p1** | i17 [narrative] `tree_amplitudes,lorentz_invariants` | proves | s | u | \[ \langle 2\,5\rangle \langle 3\,6\rangle \langle 4\,8\rangle \langle 1\,9 \rangle \langle 7\,10 \rangle \] Figure: A c | Tree amplitudes are rational functions of Lorentz invariant dot products of momenta. |
| 4 | **p3** | i51 [narrative] `zeros_bcfw_permutation,zeros_bcfw_connection,subset_zeros_uv_scaling` | proves | s | u | Figure: A series of steps showing permutation with paths labeled 1 to 4. \[ \langle 3\,5\rangle \langle 4\,6\rangle \lan | The above can be cyclically permuted leading to similar statements for all zeros. In the next section we explore the connection more concretely. SUBSET ZEROS AN |
| 5 | **p2** | i31 [narrative] `amplitude_zeros,independence,tr_phi3_amplitudes` | proves | s | u | \[ \mathcal{A}_4 (1 \to 2 \to 3 \to 4) = \] Figure: Three tree-level diagrams with external labels 1, 2, 3, 4 showing di | All the various zeros are all independent, no zero implies any other zero. For example, the ordered 4-point Tr(\( \phi^3 \)) amplitude \[ A_4(1234) = \frac{1}{s |
| 6 | **p2** | i28 [narrative] `skinny_zero,cyclic_permutations,k_zero` | proves | r | s | Cycle permutations: \[ \langle 1\,5\rangle \langle 2\,6\rangle \langle 3\,8\rangle \langle 4\,9\rangle \langle 7\,10 \ra | \[ 1\text{-zero}: \quad c_{i1} = 0, \quad \text{for } i = \{3, 4, \ldots, n - 1 \}. \] Other similar zeros are cyclic permutations of the above, \( c_{i2} = 0,  |

---

## notes p28 — 1 chunks, 0 edges to Rodina

### Page content (first 4 chunks):

- i273 [narrative] tags=`tetrahedron_diagrams, left_diagram, vertex_labeling, right_diagram`
  "Figure: Two tetrahedron diagrams. Left diagram has vertices labeled 1, 2, 3, 4; diagonal from 1 to 3. Right diagram has vertices labeled 1, 2, 3, 4; diagonal from 1 to 2."

### Edges from notes p28 → Rodina:

**NO EDGES** from this notes page to Rodina.

---

## notes p29 — 10 chunks, 10 edges to Rodina

### Page content (first 4 chunks):

- i274 [narrative] tags=`partial_ordered_amplitude`
  "A partial ordered amplitude"
- i275 [narrative] tags=`amplitude_factorization`
  "\(\text{Res } A_n(1,2,3,\ldots,n) \) w.t are of the \( X_{ij} \) (no poles) factorizes as product of two smaller amplitudes"
- i276 [narrative] tags=`laurent_series`
  "If \( f(z) \) is a complex function with Laurent series \(\sum_{n \in \mathbb{Z}} a_n z^n\)"
- i277 [definition] tags=`residue_definition`
  "\[ \text{Res } f = a_{-1} \]"
- _(6 more chunks)_

### Edges from notes p29 → Rodina:

| # | → Rodina page | Rodina chunk | rel | conf | relev | notes source text (first 120ch) | Rodina target text (first 160ch) |
|---|---|---|---|---|---|---|---|
| 1 | **p2** | i31 [narrative] `amplitude_zeros,independence,tr_phi3_amplitudes` | assumes | z | s | \[ A_4(1,2,3,4) \propto \frac{1}{s_{12}} + \frac{1}{s_{23}} \] Look at residues near one of the poles (ex: \( s_{12} \)) | All the various zeros are all independent, no zero implies any other zero. For example, the ordered 4-point Tr(\( \phi^3 \)) amplitude \[ A_4(1234) = \frac{1}{s |
| 2 | **p2** | i38 [theorem] `unitarity,optical_theorem,pole_factorization` | proves | s | z | \[ \propto \int dp \; A_3(1,2,p) \; A_3(-p,3,4) \] | Unitarity From the optical theorem, unitarity implies factorization of residues of the above poles. Near a pole \( P^2_i=0 \), the amplitude factorizes into two |
| 3 | **p2** | i38 [theorem] `unitarity,optical_theorem,pole_factorization` | proves | s | z | \[ A_4 = \frac{1}{s_{12}} \; A_{\text{left}} \; A_{\text{right}} + O(1) \] If you want to expand at \( s_{12} = X_{13} \ | Unitarity From the optical theorem, unitarity implies factorization of residues of the above poles. Near a pole \( P^2_i=0 \), the amplitude factorizes into two |
| 4 | **p2** | i38 [theorem] `unitarity,optical_theorem,pole_factorization` | proves | s | z | \[ \text{Res }(A_5)_{X_{13}} = \frac{1}{X_{14}} \frac{1}{X_{35}} = \frac{1}{s_{45} s_{34}} = (p_1+ p_2 + p_3)^2 = (p_4 + | Unitarity From the optical theorem, unitarity implies factorization of residues of the above poles. Near a pole \( P^2_i=0 \), the amplitude factorizes into two |
| 5 | **p2** | i24 [narrative] `bcfw_shift,poles` | proves | s | u | If \( f(z) \) is a complex function with Laurent series \(\sum_{n \in \mathbb{Z}} a_n z^n\) | The poles are accessed via a complex parameter \( z \) introduced through a BCFW shift, \[ p_i \to p_i + zq, \quad p_j \to p_j - zq, \quad (4) \] with \( p_i \c |
| 6 | **p2** | i38 [theorem] `unitarity,optical_theorem,pole_factorization` | proves | s | u | \[ \text{Res }\left( A_4 \right)_{s_{12}} = 1 \] | Unitarity From the optical theorem, unitarity implies factorization of residues of the above poles. Near a pole \( P^2_i=0 \), the amplitude factorizes into two |
| 7 | **p2** | i31 [narrative] `amplitude_zeros,independence,tr_phi3_amplitudes` | proves | s | u | \[ A_5(1,2,3,4,5) = \frac{1}{X_{13}X_{14}} + \frac{1}{X_{13}X_{35}} + \frac{1}{X_{24}X_{25}} + \frac{1}{X_{24}X_{34}} +  | All the various zeros are all independent, no zero implies any other zero. For example, the ordered 4-point Tr(\( \phi^3 \)) amplitude \[ A_4(1234) = \frac{1}{s |
| 8 | **p2** | i38 [theorem] `unitarity,optical_theorem,pole_factorization` | proves | r | u | \(\text{Res } A_n(1,2,3,\ldots,n) \) w.t are of the \( X_{ij} \) (no poles) factorizes as product of two smaller amplitu | Unitarity From the optical theorem, unitarity implies factorization of residues of the above poles. Near a pole \( P^2_i=0 \), the amplitude factorizes into two |
| 9 | **p2** | i33 [theorem] `pole_structure,colored_amplitudes` | proves | r | s | A partial ordered amplitude | Pole structure and ordered amplitudes In this paper, we will only consider amplitudes of colored particles, which can be written as a sum over different colored |
| 10 | **p2** | i38 [theorem] `unitarity,optical_theorem,pole_factorization` | proves | r | s | \[ \text{Res } f = a_{-1} \] | Unitarity From the optical theorem, unitarity implies factorization of residues of the above poles. Near a pole \( P^2_i=0 \), the amplitude factorizes into two |

---

# p40-43 (eq.8-11: BCFW, splitting, X_ij types, X^0, X^inf)

## notes p40 — 8 chunks, 8 edges to Rodina

### Page content (first 4 chunks):

- i405 [narrative] tags=`bcfw_shift, external_momenta, momentum_shift`
  "Pick \( p_i, p_j \) among the external momenta \((i \neq j)\): Send: \( p_i \rightarrow p_i + zq \) \( p_j \rightarrow p_j - zq \)"
- i406 [narrative] tags=`bcfw_shift, momentum_shift, lightlike_vector, orthogonality_condition`
  "\( q \) s.t. \( q^2 = 0 \) \( q \cdot p_i = q \cdot p_j = 0 \)"
- i407 [narrative] tags=`bcfw_shift`
  "Ex: 4 particles Momenta: \( p_1, p_2, p_3, p_4 \) After shift: \( p_1 + zq, p_2 - zq, p_3, p_4 \)"
- i408 [narrative] tags=`bcfw_shift, momentum_conservation, lightlike_condition`
  "Total momentum is still zero \((p_1 + zq)^2 = (p_2 - zq)^2 = 0 \)"
- _(4 more chunks)_

### Edges from notes p40 → Rodina:

| # | → Rodina page | Rodina chunk | rel | conf | relev | notes source text (first 120ch) | Rodina target text (first 160ch) |
|---|---|---|---|---|---|---|---|
| 1 | **p2** | i24 [narrative] `bcfw_shift,poles` | proves | u | z | Pick \( p_i, p_j \) among the external momenta \((i \neq j)\): Send: \( p_i \rightarrow p_i + zq \) \( p_j \rightarrow p | The poles are accessed via a complex parameter \( z \) introduced through a BCFW shift, \[ p_i \to p_i + zq, \quad p_j \to p_j - zq, \quad (4) \] with \( p_i \c |
| 2 | **p2** | i24 [narrative] `bcfw_shift,poles` | assumes | u | z | \( q \) s.t. \( q^2 = 0 \) \( q \cdot p_i = q \cdot p_j = 0 \) | The poles are accessed via a complex parameter \( z \) introduced through a BCFW shift, \[ p_i \to p_i + zq, \quad p_j \to p_j - zq, \quad (4) \] with \( p_i \c |
| 3 | **p2** | i24 [narrative] `bcfw_shift,poles` | uses_definition | u | z | \( z : p_1 \cdot p_2 \) | The poles are accessed via a complex parameter \( z \) introduced through a BCFW shift, \[ p_i \to p_i + zq, \quad p_j \to p_j - zq, \quad (4) \] with \( p_i \c |
| 4 | **p2** | i24 [narrative] `bcfw_shift,poles` | proves | s | u | Ex: 4 particles Momenta: \( p_1, p_2, p_3, p_4 \) After shift: \( p_1 + zq, p_2 - zq, p_3, p_4 \) | The poles are accessed via a complex parameter \( z \) introduced through a BCFW shift, \[ p_i \to p_i + zq, \quad p_j \to p_j - zq, \quad (4) \] with \( p_i \c |
| 5 | **p2** | i24 [narrative] `bcfw_shift,poles` | proves | s | u | Total momentum is still zero \((p_1 + zq)^2 = (p_2 - zq)^2 = 0 \) | The poles are accessed via a complex parameter \( z \) introduced through a BCFW shift, \[ p_i \to p_i + zq, \quad p_j \to p_j - zq, \quad (4) \] with \( p_i \c |
| 6 | **p3** | i43 [example] `affected_invariants` | proves | s | u | \[ X_{i,j+1} = s_{1,2 \cdots i} = (p_1 + p_2 + \cdots + p_i)^2 = (p_1 + p_2)^2 + (p_3 +(p_4 + \cdots))^2 + 2(p_1 + p_2)  | It is clear that the only \( X_{ij} \) affected by either the related shift or the zero are of three possible types: \[ X_{1,j+1} = s_{1,2,...,j} = s_{12} + \su |
| 7 | **p2** | i25 [narrative] `bcfw_shift,amplitude_behavior` | proves | r | s | Amplitudes now depend on \( z \) \[ A_4 = \frac{1}{s_{12}} + \frac{1}{s_{14}} = \frac{1}{p_1 \cdot p_2} + \frac{1}{p_1 \ | Crucially, the recursion requires the contour at infinity to vanish, which means that under a BCFW shift, the amplitude must behave as \( 1/z \) or better at la |
| 8 | **p2** | i38 [theorem] `unitarity,optical_theorem,pole_factorization` | proves | r | s | Look at \(\frac{A(z)}{z}\) pole at \( z = 0 \) \[ A(0) = z \cdot \oint \frac{A(z)}{z} dz \] | Unitarity From the optical theorem, unitarity implies factorization of residues of the above poles. Near a pole \( P^2_i=0 \), the amplitude factorizes into two |

---

## notes p41 — 11 chunks, 10 edges to Rodina

### Page content (first 4 chunks):

- i413 [narrative] tags=`expression_for_x_2_i_plus_1`
  "Consider the expression for \( X_{2,i+1} \):"
- i414 [narrative] tags=`expression_for_x_2_i_plus_1`
  "\[ (P_3 + \ldots + P_j)^2 = (P_3 + P_{i+1} + \ldots)^2 + 2P_{i+1} \cdot (P_3 + P_{i+1} + \ldots) \] which simplifies to:"
- i415 [narrative] tags=`expression_for_x_2_i_plus_1, expression_for_x_2_n`
  "\[ =\sum_{i=3}^{j} S_i + S_{3,\ldots,j} \] The expression for \( X_{2,n} \) is:"
- i416 [narrative] tags=`expression_for_x_2_n`
  "\[ S_{2,3,\ldots,n-1} = (P_2 + P_3 + \ldots + P_{n-1})^2 = (P_i + P_n)^2 = 2P_i \cdot P_n \] which further reduces to:"
- _(7 more chunks)_

### Edges from notes p41 → Rodina:

| # | → Rodina page | Rodina chunk | rel | conf | relev | notes source text (first 120ch) | Rodina target text (first 160ch) |
|---|---|---|---|---|---|---|---|
| 1 | **p7** | i104 [proof] `boundary_propagator,amplitude_zero` | assumes | p | z | and \[ = -2P_i \cdot P_2 = 2P_j (P_3 + P_4 + \ldots + P_{n-1}) \] Finally, | \[ \frac{1}{P_L P_R} \left( \frac{x_i}{P_A} + \frac{x_{i+1}}{P_B} \right). \] (27) We need to prove \( P_A=-P_B \) on the amplitude zero plus \((P_L, P_R)\)-cut |
| 2 | **p6** | i89 [narrative] `bcfw_shift,z_dependence` | proves | s | u | \[ (P_3 + \ldots + P_j)^2 = (P_3 + P_{i+1} + \ldots)^2 + 2P_{i+1} \cdot (P_3 + P_{i+1} + \ldots) \] which simplifies to: | Since \( X_{ij}=(p_{i}+p_{i+1}+\ldots+p_{j-1})^2 \), for \( X_{ij} \) to have dependence on z, we must have \( i \leq a \leq j-1 \), otherwise the z shift cance |
| 3 | **p7** | i104 [proof] `boundary_propagator,amplitude_zero` | proves | s | u | \[ = 2P_i \cdot (-P_1 - P_2 - \ldots - P_{n-1}) \] | \[ \frac{1}{P_L P_R} \left( \frac{x_i}{P_A} + \frac{x_{i+1}}{P_B} \right). \] (27) We need to prove \( P_A=-P_B \) on the amplitude zero plus \((P_L, P_R)\)-cut |
| 4 | **p3** | i43 [example] `affected_invariants` | proves | s | u | \( X_{2,i+1} \) only contains \( P_2 \). \( X_{3,i} \) contains no \( P_2 \) and no \( P_n \). | It is clear that the only \( X_{ij} \) affected by either the related shift or the zero are of three possible types: \[ X_{1,j+1} = s_{1,2,...,j} = s_{12} + \su |
| 5 | **p6** | i90 [remark] `zero_condition,z_dependence,linear_combinations` | proves | s | u |  | This is precisely the same set of \( X_{ij} \) we found above for the zero condition! Finally we need to find all linear combinations of z-dependent \( X_{ij} \ |
| 6 | **p3** | i44 [narrative] `affected_invariants,zero_condition` | proves | r | s | Consider the expression for \( X_{2,i+1} \): | \[ X_{2,n} = s_{2,...,n-1} = -s_{12} - \sum_{i=3}^{n-1} s_{1i}, \] for \( 2 \leq j \leq n-2 \). Under the zero condition, these become |
| 7 | **p3** | i44 [narrative] `affected_invariants,zero_condition` | proves | r | s | \[ =\sum_{i=3}^{j} S_i + S_{3,\ldots,j} \] The expression for \( X_{2,n} \) is: | \[ X_{2,n} = s_{2,...,n-1} = -s_{12} - \sum_{i=3}^{n-1} s_{1i}, \] for \( 2 \leq j \leq n-2 \). Under the zero condition, these become |
| 8 | **p3** | i47 [narrative] `bcfw_shift` | proves | r | s | \[ S_{2,3,\ldots,n-1} = (P_2 + P_3 + \ldots + P_{n-1})^2 = (P_i + P_n)^2 = 2P_i \cdot P_n \] which further reduces to: | \[ X^{(\infty)}_{2,n} = -q \cdot p_1. \quad \quad \quad (11) \] |
| 9 | **p3** | i43 [example] `affected_invariants` | proves | r | s | \[ = -S_{1,2} - \sum_{i=3}^{n-1} S_i \] Steps: Set \( S_{1,i} = 0 \) for \( i = 3, \ldots, n-1 \). Shift: \( P_2 \righta | It is clear that the only \( X_{ij} \) affected by either the related shift or the zero are of three possible types: \[ X_{1,j+1} = s_{1,2,...,j} = s_{12} + \su |
| 10 | **p3** | i45 [narrative] `zero_condition` | proves | r | s | Consider \( X_{13}, X_{14}, X_{24}, X_{25}, X_{35} \): Expression shift: If \( X_{ij} \) includes only \( P_2 \) or only | \[ X^{(0)}_{1,j+1} = s_{12} + \sum_{i=3}^{j} s_{2i} + s_{3...j}, \] \[ X^{(0)}_{2,j+1} = \sum_{i=3}^{j} s_{2i} + s_{3...j} , \] \[ X^{(0)}_{2,n} = -s_{12}, \qua |

---

## notes p42 — 9 chunks, 9 edges to Rodina

### Page content (first 4 chunks):

- i424 [narrative] tags=`amplitude_label, planar_invariants, amplitude_zeros`
  "\[ A_5 \] \( X_{13} \quad X_{14} \quad X_{24} \quad X_{25} \quad X_{35} \) zero: \hspace{2em} \( S_{13} = S_{14} = 0 \)"
- i425 [narrative] tags=`planar_invariants`
  "\[ X_{13} = (p_1 + p_4)^2 = S_{12} \quad \text{not affected} \] \[ X_{14} = (p_1 + p_2 + p_4)^2 = S_{12,3} \quad \text{affected} \quad \Rightarrow \quad S_{4,5} \] \[ X_{22} = (p_1 + p_4)^2 = S_{12,3}"
- i426 [narrative] tags=`planar_invariants, amplitude_zeros`
  "\( X_{24} = (p_1 + p_3)^2 = 2(p_1, p_2) \) \(\Rightarrow\) \(\hspace{2em} S_{12} + S_{23} \) \( S_{13} = 0 \) \[ X_{24} = (p_2 + p_3)^2 = S_{23} \hspace{2em} \text{not affected} \]"
- i427 [narrative] tags=`planar_invariants, amplitude_zeros`
  "\[ X_{35} = (p_3 + p_4)^2 = S_{34} \] \( = (p_1 + p_2 + p_5) \) \[ S_{13} = S_{14} = S_{15} = 0 \]"
- _(5 more chunks)_

### Edges from notes p42 → Rodina:

| # | → Rodina page | Rodina chunk | rel | conf | relev | notes source text (first 120ch) | Rodina target text (first 160ch) |
|---|---|---|---|---|---|---|---|
| 1 | **p3** | i43 [example] `affected_invariants` | assumes | z | s | \( X_{24} = (p_1 + p_3)^2 = 2(p_1, p_2) \) \(\Rightarrow\) \(\hspace{2em} S_{12} + S_{23} \) \( S_{13} = 0 \) \[ X_{24}  | It is clear that the only \( X_{ij} \) affected by either the related shift or the zero are of three possible types: \[ X_{1,j+1} = s_{1,2,...,j} = s_{12} + \su |
| 2 | **p6** | i87 [narrative] `zero_condition` | proves | s | z | \( S_{13} = S_{14} = S_{15} = 0 \) \( \mathcal{X}_{j,i}^{(0)} \quad \text{x the} \quad X_{j,i} \quad \text{gives setting | The remaining \( X_{ij} \) are independent under the zero condition. |
| 3 | **p3** | i49 [narrative] `zero_types,zeros_bcfw_connection,summary` | proves | r | z | \frac{1}{d \, z} \right\|_{z=0} X_{i,j}(z) \quad \bigg\\| \quad \text{or} \quad X_{i,j}(z) = X_{i,j}^{(\infty)}(n) + X_{i, | This connection between the \( X^{(0)} \) and the \( X^{(\infty)} \) remains true for all zero types, which we prove in Appendix A. In summary, we find a non-tr |
| 4 | **p3** | i43 [example] `affected_invariants` | assumes | u | u | \[ X_{13} = (p_1 + p_4)^2 = S_{12} \quad \text{not affected} \] \[ X_{14} = (p_1 + p_2 + p_4)^2 = S_{12,3} \quad \text{a | It is clear that the only \( X_{ij} \) affected by either the related shift or the zero are of three possible types: \[ X_{1,j+1} = s_{1,2,...,j} = s_{12} + \su |
| 5 | **p5** | i69 [narrative] `amplitude_zeros,stronger_statements` | proves | s | u | \[ A_5 \] \( X_{13} \quad X_{14} \quad X_{24} \quad X_{25} \quad X_{35} \) zero: \hspace{2em} \( S_{13} = S_{14} = 0 \) | Using the results of the previous section, we directly know that if the 6-point amplitude satisfies a zero \( c_{1i}=0 \), then we also must have \( (S_1+S_2)\b |
| 6 | **p1** | i18 [narrative] `mandelstam_invariants,planar_invariants,nonplanar_invariants` | proves | s | u | \[ X_{35} = (p_3 + p_4)^2 = S_{34} \] \( = (p_1 + p_2 + p_5) \) \[ S_{13} = S_{14} = S_{15} = 0 \] | Typical notations used are the Mandelstam invariants \( s_{ij,\ldots}=(p_i+p_j+\ldots+p_k)^2 \), the planar invariants \( X_{ij}=s_{i,i+1}=(p_i+p_{i+1}+\ldots+p |
| 7 | **p1** | i20 [narrative] `kinematic_invariants,planar_invariants,nonplanar_invariants` | proves | r | s | \( = \{n = 6\} \quad \Rightarrow \quad \) \[ X_{36} = (p_1 + p_4 + p_5)^2 = (p_1 + p_2 + p_6) \] \[ X_{35} = (p_3 + p_4) | At n-points, there is a basis of n(n−3)/2 kinematic invariants, which we can take as the \( X_{ij} \). A crucial relation between the planar \( X_{ij} \) and th |
| 8 | **p3** | i43 [example] `affected_invariants` | proves | r | s | \[ X_{i+1}^{(0)} = S_{1,2} + \sum_{i=3}^{i=n} S_{2,i} + S_{3, \ldots \hat{i}} \] \[ X_{i + 2}^{(0)} = \sum_{i=3}^{i=\hat | It is clear that the only \( X_{ij} \) affected by either the related shift or the zero are of three possible types: \[ X_{1,j+1} = s_{1,2,...,j} = s_{12} + \su |
| 9 | **p3** | i49 [narrative] `zero_types,zeros_bcfw_connection,summary` | proves | r | s | \[ X_{i,j} = X_{i,j}(z) \quad (\text{polynomial}) \] \( X_{i}^{(\infty)} \quad \text{is the leading order coefficient in | This connection between the \( X^{(0)} \) and the \( X^{(\infty)} \) remains true for all zero types, which we prove in Appendix A. In summary, we find a non-tr |

---

## notes p43 — 15 chunks, 15 edges to Rodina

### Page content (first 4 chunks):

- i433 [narrative] tags=`shift_p2_pn`
  "shift \( P_2 \) and \( P_n \)"
- i434 [narrative] tags=`shift_dependence`
  "\[ X_{i_0+1}(z) = S_{1,2}(z) + \sum_{i=3}^{\dot{i}} S_{i,2}(i') + \sum_{i=3}^{\dot{i}} S_{i,2}(i) + S_{3,-j}(z) = S_{1,2}(z) + \sum_{i=3}^{\dot{i}} S_{i,2}(i) + O(1) \]"
- i435 [narrative] tags=`s12_approximation`
  "\[ S_{1,2}(z) \simeq z \, P_1 \cdot (P_2 + q) = z \, z \, P_1 \cdot q + o(1) \]"
- i436 [narrative] tags=`si2_approximation`
  "\[ S_{2,i}(z) = z \, P_i \cdot (P_2 + \emph{∅}[unclear]) = z \, z \, P_i \cdot q + o(1) \]"
- _(11 more chunks)_

### Edges from notes p43 → Rodina:

| # | → Rodina page | Rodina chunk | rel | conf | relev | notes source text (first 120ch) | Rodina target text (first 160ch) |
|---|---|---|---|---|---|---|---|
| 1 | **p3** | i47 [narrative] `bcfw_shift` | proves | u | z | \[ X_{2n}^{(\infty)} = -2 \, q \cdot P_1 \] | \[ X^{(\infty)}_{2,n} = -q \cdot p_1. \quad \quad \quad (11) \] |
| 2 | **p6** | i90 [remark] `zero_condition,z_dependence,linear_combinations` | assumes | u | z | \[ X_{i_0+1}(z) - X_{2,i_0+1}(z) + X_{2n}(z) = O(1) \] | This is precisely the same set of \( X_{ij} \) we found above for the zero condition! Finally we need to find all linear combinations of z-dependent \( X_{ij} \ |
| 3 | **p7** | i100 [narrative] `affected_invariants_classification` | assumes | u | u | \[ X_{i_0+1}^{(\infty)} - X_{2,i_0+1}^{(\infty)} + X_{2n}^{(\infty)} = 0 \] | three types of such \( X_{ij} \) are given by \[ X^{(\infty)}_{k+1,-i,n} = \sum_{l=k+1}^{n-1} q \cdot p_{l}, \quad i \geq 1, \] \[ X^{(\infty)}_{k+1,n-j} = \sum |
| 4 | **p2** | i24 [narrative] `bcfw_shift,poles` | proves | s | u | \[ S_{1,2}(z) \simeq z \, P_1 \cdot (P_2 + q) = z \, z \, P_1 \cdot q + o(1) \] | The poles are accessed via a complex parameter \( z \) introduced through a BCFW shift, \[ p_i \to p_i + zq, \quad p_j \to p_j - zq, \quad (4) \] with \( p_i \c |
| 5 | **p2** | i24 [narrative] `bcfw_shift,poles` | proves | s | u | \[ S_{2,i}(z) = z \, P_i \cdot (P_2 + \emph{∅}[unclear]) = z \, z \, P_i \cdot q + o(1) \] | The poles are accessed via a complex parameter \( z \) introduced through a BCFW shift, \[ p_i \to p_i + zq, \quad p_j \to p_j - zq, \quad (4) \] with \( p_i \c |
| 6 | **p3** | i46 [narrative] `bcfw_shift` | proves | s | u | \[ X_{i_0+1}^{(\infty)} = 2 \, q \cdot P_1 + 2 \sum_{i=3}^{\dot{i}} q \cdot P_i \] | while the leading order in \( z \) under a BCFW shift is given by \[ X^{(\infty)}_{0,j+1} = q \cdot p_1 + \sum_{i=3}^{j} q \cdot p_i, \] \[ X^{(\infty)}_{2,j+1} |
| 7 | **p3** | i46 [narrative] `bcfw_shift` | proves | s | u | \[ X_{2,i_0+1}^{(\infty)} = z \sum_{i=3}^{\dot{i}} q \cdot P_i \] | while the leading order in \( z \) under a BCFW shift is given by \[ X^{(\infty)}_{0,j+1} = q \cdot p_1 + \sum_{i=3}^{j} q \cdot p_i, \] \[ X^{(\infty)}_{2,j+1} |
| 8 | **p7** | i102 [narrative] `relations_satisfied_by_x,subset_uniqueness` | proves | s | u | \( n-2 - 3 + 1 = n - 3 \) eqs Relations | This shows that the only relations satisfied by the \( X^{(\infty)}_{ij} \) are those corresponding to \( c_{ij}=0 \), and so \( X^{(\infty)}_{ij} \) and \( X^{ |
| 9 | **p5** | i72 [narrative] `tr_phi3_amplitude` | proves | s | u | \( (n-3) \) eqs | Imposing \( (n-3) \) distinct 1-zeros uniquely fixes the ansatz as the n-point \( \text{Tr}(\phi^3) \) amplitude, up to an overall coefficient. |
| 10 | **p3** | i50 [narrative] `k_zero_bcfw_shift` | proves | r | s | shift \( P_2 \) and \( P_n \) | A BCFW shift: \( p_{k+1} \rightarrow p_{k+1}+zq, \, p_j \rightarrow p_j-nq \) (12) |
| 11 | **p6** | i89 [narrative] `bcfw_shift,z_dependence` | proves | r | s | \[ X_{i_0+1}(z) = S_{1,2}(z) + \sum_{i=3}^{\dot{i}} S_{i,2}(i') + \sum_{i=3}^{\dot{i}} S_{i,2}(i) + S_{3,-j}(z) = S_{1,2 | Since \( X_{ij}=(p_{i}+p_{i+1}+\ldots+p_{j-1})^2 \), for \( X_{ij} \) to have dependence on z, we must have \( i \leq a \leq j-1 \), otherwise the z shift cance |
| 12 | **p6** | i89 [narrative] `bcfw_shift,z_dependence` | proves | r | s | \[ X_{i_0+1}(z) = z z\, P_1 \cdot q + z z \sum_{i=3}^{\dot{i}} P_i \cdot q + o(1) \] | Since \( X_{ij}=(p_{i}+p_{i+1}+\ldots+p_{j-1})^2 \), for \( X_{ij} \) to have dependence on z, we must have \( i \leq a \leq j-1 \), otherwise the z shift cance |
| 13 | **p6** | i86 [narrative] `zero_condition` | proves | r | s | \( \dot{i} = 2, \ldots, n-2 \) | The set of all \( X_{ij} \) that attain such dependencies can be easily obtained from the definition eq.(1). For a \( c_{ij} = 0 \), for \( i = 1, 2, \ldots, n- |
| 14 | **p6** | i90 [remark] `zero_condition,z_dependence,linear_combinations` | proves | r | s | \[ X_{i_0+1}^{(0)} - X_{2,i_0+1}^{(0)} + X_{2n}^{(0)} = 0 \] | This is precisely the same set of \( X_{ij} \) we found above for the zero condition! Finally we need to find all linear combinations of z-dependent \( X_{ij} \ |
| 15 | **p6** | i86 [narrative] `zero_condition` | proves | r | s | \( \dot{i} = 2, \ldots, n-2 \) | The set of all \( X_{ij} \) that attain such dependencies can be easily obtained from the definition eq.(1). For a \( c_{ij} = 0 \), for \( i = 1, 2, \ldots, n- |

---

# p51-53 (eq.15-18: B-cascade, enhanced scaling, B' induction)

## notes p51 — 16 chunks, 16 edges to Rodina

### Page content (first 4 chunks):

- i512 [narrative] tags=`subset_zeros`
  "\[ X_{2}^{\infty} = X_{ij}^{\circ} - X_{13}^{\infty} \] Subset zeros"
- i513 [narrative] tags=`homogeneous_rational_function, scaling`
  "\( B \) is an homogeneous rational function of the \( X_i \). Collect \( B \) into subterms, depending on how they scale under the shift:"
- i514 [narrative] tags=`shift_transformation`
  "\( P_2 \rightarrow P_2 + z q \)"
- i515 [narrative] tags=`shift_transformation, scaling_terms`
  "\( P_0 \rightarrow P_0 = P_2 + z q \) \[ B(z) = B_m + B_{m-1} + B_{n-2} + \ldots \]"
- _(12 more chunks)_

### Edges from notes p51 → Rodina:

| # | → Rodina page | Rodina chunk | rel | conf | relev | notes source text (first 120ch) | Rodina target text (first 160ch) |
|---|---|---|---|---|---|---|---|
| 1 | **p3** | i41 [narrative] `k_zero_bcfw_shift` | uses_definition | z | z | \( P_2 \rightarrow P_2 + z q \) | First, each k-zero turns out to have a natural corresponding BCFW shift. For instance, for a 1-zero like \( c_{1i}=0 \), \( i\neq 2 \), the corresponding shift  |
| 2 | **p3** | i52 [narrative] `rational_function_zeros_uv_scaling` | prerequisite | u | z | \( B \) is an homogeneous rational function of the \( X_i \). Collect \( B \) into subterms, depending on how they scale | Here we will prove that any rational function built from planar invariants \( X_{ij} \) satisfies a zero condition if and only if it also satisfies both a “subs |
| 3 | **p6** | i84 [definition] `uv_scaling_vs_zeros` | proves | u | z | If \( B \) satisfies 1-zero, then it must have enhanced scaling. \( B \) satisfies zero. | Appendix A: UV scaling vs general zeros In this appendix we prove that all zeros are equivalent to enhanced scaling under some corresponding BCFW shift. |
| 4 | **p6** | i90 [remark] `zero_condition,z_dependence,linear_combinations` | prerequisite | u | z | \(\Rightarrow B\) must be at least linear in \( C_{13}, C_{14}, C_{15}, \ldots \) | This is precisely the same set of \( X_{ij} \) we found above for the zero condition! Finally we need to find all linear combinations of z-dependent \( X_{ij} \ |
| 5 | **p3** | i52 [narrative] `rational_function_zeros_uv_scaling` | prerequisite | u | z |  | Here we will prove that any rational function built from planar invariants \( X_{ij} \) satisfies a zero condition if and only if it also satisfies both a “subs |
| 6 | **p5** | i71 [narrative] `d_subsets_uniqueness` | assumes | s | z | [unclear: B is obvious] | All D-subsets are uniquely fixed by the 1-zero condition up to an overall coefficient |
| 7 | **p6** | i84 [definition] `uv_scaling_vs_zeros` | proves | s | z | Figure: sketch of scaling relationship labeled with \( z \rightarrow \infty \). \[ B = \frac{1}{X_{13} X_{24}} = \frac{X | Appendix A: UV scaling vs general zeros In this appendix we prove that all zeros are equivalent to enhanced scaling under some corresponding BCFW shift. |
| 8 | **p6** | i90 [remark] `zero_condition,z_dependence,linear_combinations` | assumes | u | u | \[ B = \sum_{i=3}^{n} C_{1i} \left\{ -\frac{1}{z} \right\} \] | This is precisely the same set of \( X_{ij} \) we found above for the zero condition! Finally we need to find all linear combinations of z-dependent \( X_{ij} \ |
| 9 | **p3** | i51 [narrative] `zeros_bcfw_permutation,zeros_bcfw_connection,subset_zeros_uv_scaling` | proves | s | u | \[ X_{2}^{\infty} = X_{ij}^{\circ} - X_{13}^{\infty} \] Subset zeros | The above can be cyclically permuted leading to similar statements for all zeros. In the next section we explore the connection more concretely. SUBSET ZEROS AN |
| 10 | **p5** | i75 [narrative] `d_subsets_zero_condition,implication` | proves | s | u | \( B \) satisfies 1-zero [unclear: condition] Each \( B_i \) satisfies 1-zero Each \( B_i \) has enhanced UV scaling \(  | The argument can be repeated for the D-subset \( S_2 \), by cutting \( s_{45} \), and similarly for all other D-subsets. This implies Each D-subset vanishes und |
| 11 | **p1** | i14 [narrative] `hidden_zeros,enhanced_uv_scaling,bcfw_shifts` | proves | s | u | Namely, if \( X_{2}^{\infty} = X_{ij}^{\circ} - X_{13}^{\infty} \), then \( B = 0 \) for other classes of \( X_{ij} \). | In this Letter we prove that amplitude zeros are in fact equivalent to a novel "secret" UV scaling under non-adjacent Britto-Cachazo-Feng-Witten (BCFW) shifts [ |
| 12 | **p3** | i54 [narrative] `rational_function_scaling,assumption` | proves | r | s | \( P_0 \rightarrow P_0 = P_2 + z q \) \[ B(z) = B_m + B_{m-1} + B_{n-2} + \ldots \] | \[ B = B_m + B_{m-1} + B_{m-2} + \cdots , \quad \quad \quad (13) \] if we assume \( z^m \) is the largest scaling for any term in \( B \). Note the above is not |
| 13 | **p6** | i84 [definition] `uv_scaling_vs_zeros` | proves | r | s | where \( B_m \) contains all terms that scale like \( z^m \) (as \( z \rightarrow \infty \)). Prop. | Appendix A: UV scaling vs general zeros In this appendix we prove that all zeros are equivalent to enhanced scaling under some corresponding BCFW shift. |
| 14 | **p6** | i90 [remark] `zero_condition,z_dependence,linear_combinations` | proves | r | s | These are equivalent: | This is precisely the same set of \( X_{ij} \) we found above for the zero condition! Finally we need to find all linear combinations of z-dependent \( X_{ij} \ |
| 15 | **p1** | i0 [narrative] `hidden_zeros,enhanced_uv_scaling,tr_phi3_amplitudes` | proves | r | s | Step 1 | Hidden zeros are equivalent to enhanced ultraviolet scaling and lead to unique amplitudes in Tr(\(\phi^3\)) theory |
| 16 | **p2** | i28 [narrative] `skinny_zero,cyclic_permutations,k_zero` | proves | r | s | 1-zero constraint \( i,j = 4, \ldots, n \) | \[ 1\text{-zero}: \quad c_{i1} = 0, \quad \text{for } i = \{3, 4, \ldots, n - 1 \}. \] Other similar zeros are cyclic permutations of the above, \( c_{i2} = 0,  |

---

## notes p52 — 14 chunks, 13 edges to Rodina

### Page content (first 4 chunks):

- i528 [narrative] tags=`b_scaling_at_infinity`
  "What happens to \(B\) as \(z \to \infty\)"
- i529 [narrative] tags=`b_scaling_at_infinity, unclear_expression`
  "\[ B \to z^m B_m(X_{ij}^\circ) + O(z^{m-1}) \] [unclear: exp]:"
- i530 [narrative] tags=`b_value`
  "\(B = B_3\)"
- i531 [narrative] tags=`xij_z_dependence, series_expansion_diagrams`
  "\[ X_{24}(z) = X_{24} + \frac{1}{X_{24i}} \quad X_{24} = X_{3i}^\circ \\ X_{3}(z-1) = X_{3} \quad X_{3}(0) + z \longrightarrow \frac{1}{z^2} \] Figure: Diagrams illustrating the series expansion and s"
- _(10 more chunks)_

### Edges from notes p52 → Rodina:

| # | → Rodina page | Rodina chunk | rel | conf | relev | notes source text (first 120ch) | Rodina target text (first 160ch) |
|---|---|---|---|---|---|---|---|
| 1 | **p6** | i84 [definition] `uv_scaling_vs_zeros` | assumes | u | z | \( B_m \) has enhanced scaling \(\longrightarrow B_m(X_{ij}^\circ) = 0 \quad \forall \, X_{ij}^\circ \) \( X_{ij}^\circ  | Appendix A: UV scaling vs general zeros In this appendix we prove that all zeros are equivalent to enhanced scaling under some corresponding BCFW shift. |
| 2 | **p3** | i55 [narrative] `bcfw_shift_large_z_behavior` | proves | s | z | What happens to \(B\) as \(z \to \infty\) | We will denote the large \( z \) behavior under BCFW shifts as \( B\|_{\!\displaystyle \text{UVW} \sim z^m} \) so that originally \(\| B \rangle \sim z^m \) |
| 3 | **p3** | i55 [narrative] `bcfw_shift_large_z_behavior` | proves | s | z | \[ B \to z^m B_m(X_{ij}^\circ) + O(z^{m-1}) \] [unclear: exp]: | We will denote the large \( z \) behavior under BCFW shifts as \( B\|_{\!\displaystyle \text{UVW} \sim z^m} \) so that originally \(\| B \rangle \sim z^m \) |
| 4 | **p3** | i53 [narrative] `rational_function_invariants,rational_function_scaling` | proves | s | z | \[ B(z) = \left( \frac{1}{X_{13}z} \right) + \left( \frac{1}{X_{13}^2} + O(z^{-2}) \right) \] | Take \( B \) any homogenous rational function of \( X_{ij} \), which is established from a complete basis of invariants. Collect in subsets \( B_l \) all indivi |
| 5 | **p6** | i90 [remark] `zero_condition,z_dependence,linear_combinations` | assumes | s | z | change of variable \( z = \frac{1}{w} \) expand at \(w = 0\) | This is precisely the same set of \( X_{ij} \) we found above for the zero condition! Finally we need to find all linear combinations of z-dependent \( X_{ij} \ |
| 6 | **p6** | i84 [definition] `uv_scaling_vs_zeros` | proves | s | u | \[ B_m(z) \to z^m B_m(X_{ij}^\circ) + O(z^{m-1}) \] | Appendix A: UV scaling vs general zeros In this appendix we prove that all zeros are equivalent to enhanced scaling under some corresponding BCFW shift. |
| 7 | **p3** | i44 [narrative] `affected_invariants,zero_condition` | proves | s | u | \(1-2X_{10}\) | \[ X_{2,n} = s_{2,...,n-1} = -s_{12} - \sum_{i=3}^{n-1} s_{1i}, \] for \( 2 \leq j \leq n-2 \). Under the zero condition, these become |
| 8 | **p3** | i54 [narrative] `rational_function_scaling,assumption` | proves | r | s | \(B = B_3\) | \[ B = B_m + B_{m-1} + B_{m-2} + \cdots , \quad \quad \quad (13) \] if we assume \( z^m \) is the largest scaling for any term in \( B \). Note the above is not |
| 9 | **p6** | i93 [narrative] `mixed_basis,z_dependence` | proves | r | s | \[ X_{24}(z) = X_{24} + \frac{1}{X_{24i}} \quad X_{24} = X_{3i}^\circ \\ X_{3}(z-1) = X_{3} \quad X_{3}(0) + z \longrigh | In such a basis, the only z-dependence can come from the (n-3) \( X_{ij} \) terms on the top edges of the k-zero rectangle, shown in red in Figure 3. |
| 10 | **p6** | i84 [definition] `uv_scaling_vs_zeros` | proves | r | s | \(B\) has enhanced scaling | Appendix A: UV scaling vs general zeros In this appendix we prove that all zeros are equivalent to enhanced scaling under some corresponding BCFW shift. |
| 11 | **p6** | i90 [remark] `zero_condition,z_dependence,linear_combinations` | proves | r | s | \(f + g = 0\) | This is precisely the same set of \( X_{ij} \) we found above for the zero condition! Finally we need to find all linear combinations of z-dependent \( X_{ij} \ |
| 12 | **p3** | i55 [narrative] `bcfw_shift_large_z_behavior` | proves | r | s | \[ B = \frac{1}{1+z} + \frac{1}{2-z} = \frac{2 - z + 1 + z}{(1 + z)(2 - z)} = \frac{3}{{\color{red}[unreadable: - - z^2] | We will denote the large \( z \) behavior under BCFW shifts as \( B\|_{\!\displaystyle \text{UVW} \sim z^m} \) so that originally \(\| B \rangle \sim z^m \) |
| 13 | **p2** | i24 [narrative] `bcfw_shift,poles` | proves | r | s | \[ f = \frac{1}{a+b/w} - \frac{w}{wa+b} = \frac{w}{b} + O(w^2) \quad (t+g\log \, subset) \\ g = \frac{1}{bz} + \eta(z^{- | The poles are accessed via a complex parameter \( z \) introduced through a BCFW shift, \[ p_i \to p_i + zq, \quad p_j \to p_j - zq, \quad (4) \] with \( p_i \c |

---

## notes p53 — 8 chunks, 8 edges to Rodina

### Page content (first 4 chunks):

- i542 [narrative] tags=`one_zero_condition`
  "\( B_m(x^*_j) = 0 \ \forall \ X^\wedge_\nu \) \( B_m \text{ satisfies } 1-\text{zero} \)"
- i543 [narrative] tags=`logical_equivalence, assumption, one_zero_condition, implication`
  "this gives that \( \Box \iff \bigcirc \) and \( \bigcirc \Rightarrow \Box \) suppose \( \ominus \) is true \( \mathcal{B} \text{ satisfies } 1-\text{zero} \) => \( B_m \text{ satisfies } 1-\text{zero}"
- i544 [definition] tags=`x2z_definition, x2z_shift`
  "if we let \( X_{2z}(0) = X_{i_1}(0) - X_{i_3}(n) \) then \( B = 0 \) then we do shift then \( X_{2z}(z) = X_{i_1}(z) - X_{i_3}(z) \)"
- i545 [narrative] tags=`xij_transformation`
  "\( \overset{\curvearrowleft}{x_{ij}(x)} = x \ X^*_\ominus \)"
- _(4 more chunks)_

### Edges from notes p53 → Rodina:

| # | → Rodina page | Rodina chunk | rel | conf | relev | notes source text (first 120ch) | Rodina target text (first 160ch) |
|---|---|---|---|---|---|---|---|
| 1 | **p3** | i46 [narrative] `bcfw_shift` | prerequisite | z | u | let \( B' = B - B_m = B_{m-1} + \cdots \) | while the leading order in \( z \) under a BCFW shift is given by \[ X^{(\infty)}_{0,j+1} = q \cdot p_1 + \sum_{i=3}^{j} q \cdot p_i, \] \[ X^{(\infty)}_{2,j+1} |
| 2 | **p6** | i90 [remark] `zero_condition,z_dependence,linear_combinations` | assumes | u | u | \( \mathcal{B}(X_{ij}\|z) \) | This is precisely the same set of \( X_{ij} \) we found above for the zero condition! Finally we need to find all linear combinations of z-dependent \( X_{ij} \ |
| 3 | **p6** | i90 [remark] `zero_condition,z_dependence,linear_combinations` | proves | s | u | if we let \( X_{2z}(0) = X_{i_1}(0) - X_{i_3}(n) \) then \( B = 0 \) then we do shift then \( X_{2z}(z) = X_{i_1}(z) - X | This is precisely the same set of \( X_{ij} \) we found above for the zero condition! Finally we need to find all linear combinations of z-dependent \( X_{ij} \ |
| 4 | **p2** | i25 [narrative] `bcfw_shift,amplitude_behavior` | proves | s | u | then \( \mathcal{B}(z) \to 0 \ \text{as } z \to \infty \) | Crucially, the recursion requires the contour at infinity to vanish, which means that under a BCFW shift, the amplitude must behave as \( 1/z \) or better at la |
| 5 | **p5** | i71 [narrative] `d_subsets_uniqueness` | proves | r | s | \( B_m(x^*_j) = 0 \ \forall \ X^\wedge_\nu \) \( B_m \text{ satisfies } 1-\text{zero} \) | All D-subsets are uniquely fixed by the 1-zero condition up to an overall coefficient |
| 6 | **p5** | i71 [narrative] `d_subsets_uniqueness` | proves | r | s | this gives that \( \Box \iff \bigcirc \) and \( \bigcirc \Rightarrow \Box \) suppose \( \ominus \) is true \( \mathcal{B | All D-subsets are uniquely fixed by the 1-zero condition up to an overall coefficient |
| 7 | **p3** | i42 [narrative] `zero_shift_relation,k_zero_type` | proves | r | s | \( \overset{\curvearrowleft}{x_{ij}(x)} = x \ X^*_\ominus \) | To see how the zero and shift may be related, let us write out the \( X_{ij} \) in terms of \( s_{ij} \). Consider the 1-zero type, \( c_{1i}=0 \). |
| 8 | **p6** | i90 [remark] `zero_condition,z_dependence,linear_combinations` | proves | r | s | since \( \mathcal{B} \geq \hat{Z}B_m(X^\wedge_j) + O(z^{-n}) \) it must be \( B_m(X^\wedge_j) = 0 \) | This is precisely the same set of \( X_{ij} \) we found above for the zero condition! Finally we need to find all linear combinations of z-dependent \( X_{ij} \ |

---

# p57-59 (eq.14 proof: three equivalences)

## notes p57 — 10 chunks, 10 edges to Rodina

### Page content (first 4 chunks):

- i576 [narrative] tags=`bcfw_shift`
  "1-zero and BCFW shift Up to cyclic permutations, a 1-zero is the imposition of the \( n-3 \) constraints \( C_{i3} = C_{i4} = \cdots = C_{in_i} = 0 \) on the kinematic data."
- i577 [narrative] tags=`(none)`
  "Since \( C_{i,j} = X_{i,j+1} + X_{i,j+2}, \ldots, X_{i+n-1},i+1} - X_{i,n} - X_{i,n+1},i \),"
- i578 [narrative] tags=`constraint_equivalence`
  "the constraints can be equivalently be written as \[ \begin{aligned} &\begin{cases} X_{1,3} + X_{2,4} - X_{4} + \cdots + X_{3} = 0 \\ X_{1,i} + X_{2,5} - X_{5} - X_{2,u} = 0 \\ \vdots \\ X_{n,1} - X_{"
- i579 [narrative] tags=`(none)`
  "The corresponding BCFW shift is the change"
- _(6 more chunks)_

### Edges from notes p57 → Rodina:

| # | → Rodina page | Rodina chunk | rel | conf | relev | notes source text (first 120ch) | Rodina target text (first 160ch) |
|---|---|---|---|---|---|---|---|
| 1 | **p6** | i89 [narrative] `bcfw_shift,z_dependence` | uses_definition | z | u | Let \( X_{i,j}^{\infty} \) denote the coefficient of the largest power of \( z \) appearing in \( X_{i,j}(z) \). | Since \( X_{ij}=(p_{i}+p_{i+1}+\ldots+p_{j-1})^2 \), for \( X_{ij} \) to have dependence on z, we must have \( i \leq a \leq j-1 \), otherwise the z shift cance |
| 2 | **p6** | i90 [remark] `zero_condition,z_dependence,linear_combinations` | assumes | u | u | \( X_{i,j}(z) \) depends on \( z \) only if it includes exactly one of \( P_2, P_n \) in the sum; otherwise, either ther | This is precisely the same set of \( X_{ij} \) we found above for the zero condition! Finally we need to find all linear combinations of z-dependent \( X_{ij} \ |
| 3 | **p6** | i90 [remark] `zero_condition,z_dependence,linear_combinations` | proves | s | u | the constraints can be equivalently be written as \[ \begin{aligned} &\begin{cases} X_{1,3} + X_{2,4} - X_{4} + \cdots + | This is precisely the same set of \( X_{ij} \) we found above for the zero condition! Finally we need to find all linear combinations of z-dependent \( X_{ij} \ |
| 4 | **p2** | i24 [narrative] `bcfw_shift,poles` | proves | s | u | \[ \begin{cases} P_2 \to P_2 + z q \\ P_n \to P_n - z q \end{cases} \] where \( z \) is a complex parameter and \( q \)  | The poles are accessed via a complex parameter \( z \) introduced through a BCFW shift, \[ p_i \to p_i + zq, \quad p_j \to p_j - zq, \quad (4) \] with \( p_i \c |
| 5 | **p6** | i88 [example] `kinematic_mesh,bcfw_shift,z_dependence` | proves | s | u | Let \( X_{i,j}(z) \) be the \( z \)-dependent planar invariant. | These sets can be visualized in the kinematic mesh, as the vertices of squares participating in the zero. Next, we are interested in which \( X_{ij} \) attain a |
| 6 | **p3** | i41 [narrative] `k_zero_bcfw_shift` | proves | r | u | The corresponding BCFW shift is the change | First, each k-zero turns out to have a natural corresponding BCFW shift. For instance, for a 1-zero like \( c_{1i}=0 \), \( i\neq 2 \), the corresponding shift  |
| 7 | **p2** | i28 [narrative] `skinny_zero,cyclic_permutations,k_zero` | proves | r | s | 1-zero and BCFW shift Up to cyclic permutations, a 1-zero is the imposition of the \( n-3 \) constraints \( C_{i3} = C_{ | \[ 1\text{-zero}: \quad c_{i1} = 0, \quad \text{for } i = \{3, 4, \ldots, n - 1 \}. \] Other similar zeros are cyclic permutations of the above, \( c_{i2} = 0,  |
| 8 | **p6** | i89 [narrative] `bcfw_shift,z_dependence` | proves | r | s | Since \( C_{i,j} = X_{i,j+1} + X_{i,j+2}, \ldots, X_{i+n-1},i+1} - X_{i,n} - X_{i,n+1},i \), | Since \( X_{ij}=(p_{i}+p_{i+1}+\ldots+p_{j-1})^2 \), for \( X_{ij} \) to have dependence on z, we must have \( i \leq a \leq j-1 \), otherwise the z shift cance |
| 9 | **p2** | i24 [narrative] `bcfw_shift,poles` | proves | r | s | \[ \begin{cases} q^2 = 0 \\ q \cdot p_2 = q \cdot p_n = 0 \end{cases} \] Figure: Diagram showing the shift involving \(  | The poles are accessed via a complex parameter \( z \) introduced through a BCFW shift, \[ p_i \to p_i + zq, \quad p_j \to p_j - zq, \quad (4) \] with \( p_i \c |
| 10 | **p6** | i89 [narrative] `bcfw_shift,z_dependence` | proves | r | s |  | Since \( X_{ij}=(p_{i}+p_{i+1}+\ldots+p_{j-1})^2 \), for \( X_{ij} \) to have dependence on z, we must have \( i \leq a \leq j-1 \), otherwise the z shift cance |

---

## notes p58 — 7 chunks, 7 edges to Rodina

### Page content (first 4 chunks):

- i586 [narrative] tags=`bcfw_shift`
  "\( X_i(z) = (P_i + P_2 + 2q + \ldots + P_{i-1})^2 - (P_i + P_2 + \ldots + P_{i-1})^2 \) \( = (2q) + 2 \cdot 2q \cdot (P_i + P_2 + \ldots + P_{i-1}) \) \[ X_i^0(z) = 2q \cdot (P_i + P_2 + \ldots + P_{i"
- i587 [narrative] tags=`bcfw_shift`
  "\( X_{2i}(z) = (P_2 + 2q + \ldots + P_{i-1})^2 = \ldots \) \( = X_{2i}(0) + z \cdot 2q \cdot (P_2 + P_3 + \ldots + P_{i-1}) \Rightarrow \) \[ X_{2i}^0 = 2q \cdot (P_2 + P_3 + \ldots + P_{i-1}) \quad ("
- i588 [narrative] tags=`bcfw_shift`
  "Note that \( X_2^{\omega} = X_1^{\omega} - 2q \cdot P_1 = X_i^{**} = X_i^{\omega} = X_1^3 \)"
- i589 [narrative] tags=`bcfw_shift, constraint, subset_zeros`
  "So the \( X_i^0 \) satisfy the same constraint as the 1-2/1. Subset Zeros"
- _(3 more chunks)_

### Edges from notes p58 → Rodina:

| # | → Rodina page | Rodina chunk | rel | conf | relev | notes source text (first 120ch) | Rodina target text (first 160ch) |
|---|---|---|---|---|---|---|---|
| 1 | **p6** | i85 [narrative] `zero_condition` | uses_definition | z | u | So the \( X_i^0 \) satisfy the same constraint as the 1-2/1. Subset Zeros | We accomplish this by showing that the \( X_{ij}^0 \equiv 0 \) satisfy the same set of identities, defined by the zero condition, as the ones \( c_{ij} = 0 \) i |
| 2 | **p3** | i49 [narrative] `zero_types,zeros_bcfw_connection,summary` | proves | s | u | \( X_i(z) = (P_i + P_2 + 2q + \ldots + P_{i-1})^2 - (P_i + P_2 + \ldots + P_{i-1})^2 \) \( = (2q) + 2 \cdot 2q \cdot (P_ | This connection between the \( X^{(0)} \) and the \( X^{(\infty)} \) remains true for all zero types, which we prove in Appendix A. In summary, we find a non-tr |
| 3 | **p6** | i89 [narrative] `bcfw_shift,z_dependence` | proves | s | u | \( X_{2i}(z) = (P_2 + 2q + \ldots + P_{i-1})^2 = \ldots \) \( = X_{2i}(0) + z \cdot 2q \cdot (P_2 + P_3 + \ldots + P_{i- | Since \( X_{ij}=(p_{i}+p_{i+1}+\ldots+p_{j-1})^2 \), for \( X_{ij} \) to have dependence on z, we must have \( i \leq a \leq j-1 \), otherwise the z shift cance |
| 4 | **p3** | i52 [narrative] `rational_function_zeros_uv_scaling` | proves | s | u | If \(\lambda \neq 0\) \(\quad B(\lambda X_i) = \lambda^{\text{some } s \in \mathbb{Z}} B(X_i)\) Let \( B(X_i) \) be a ho | Here we will prove that any rational function built from planar invariants \( X_{ij} \) satisfies a zero condition if and only if it also satisfies both a “subs |
| 5 | **p3** | i46 [narrative] `bcfw_shift` | proves | s | u | We will write \( B(X) = B_m(X) + B_n(X) + \ldots \) where \( B_i(X) \) is the sum of all the terms of \( B \) that scale | while the leading order in \( z \) under a BCFW shift is given by \[ X^{(\infty)}_{0,j+1} = q \cdot p_1 + \sum_{i=3}^{j} q \cdot p_i, \] \[ X^{(\infty)}_{2,j+1} |
| 6 | **p3** | i40 [narrative] `zeros_bcfw_shifts,zeros_bcfw_equivalence` | proves | r | s | Note that \( X_2^{\omega} = X_1^{\omega} - 2q \cdot P_1 = X_i^{**} = X_i^{\omega} = X_1^3 \) | ZEROS VS BCFW SHIFTS To demonstrate the proposed equivalence between zeros and BCFW scaling, we must first establish this connection at the level of kinematic d |
| 7 | **p3** | i46 [narrative] `bcfw_shift` | proves | r | s | scales like \( z \) scales like \( z^{-2} \) then \( B_0 = \frac{1}{X_{35}}, B_{-1} = -\frac{X_{13}}{X_{24}X_{1u}}, B_{- | while the leading order in \( z \) under a BCFW shift is given by \[ X^{(\infty)}_{0,j+1} = q \cdot p_1 + \sum_{i=3}^{j} q \cdot p_i, \] \[ X^{(\infty)}_{2,j+1} |

---

## notes p59 — 9 chunks, 9 edges to Rodina

### Page content (first 4 chunks):

- i593 [narrative] tags=`one_zero_condition, equivalence_proposition, equivalence_claim`
  "Def: we say a function \( \mathcal{B} = \mathcal{B}(X_{ij}) \) satisfies the 1-zero if \( X_{2j}, X_{i0}, X_{i3} \Rightarrow \mathcal{B}(X) = 0 \) (∀ dices j, \( X_{ij} \) with \( i \neq 2 \)) Prop. T"
- i594 [narrative] tags=`one_zero_condition, proof_start`
  "\( \mathcal{B} \) satisfies the 1-zero Each \( \mathcal{B}_i \) satisfies the 1-zero Prf."
- i595 [narrative] tags=`trivial_implication, assumption, z_infinity_limit`
  "\( (2 \Rightarrow 1) \) is trivial. Suppose \( (1) \) is true, and let \( \mathcal{B}(z) = \mathcal{B}(X_{ij}(z)) \) Note that as \( z \rightarrow \infty \)"
- i596 [narrative] tags=`rational_function_expansion`
  "\[ \mathcal{B}(z) = 2^m \mathcal{B}_m(X^\infty_{ij}) + O(2^{-m}) \]"
- _(5 more chunks)_

### Edges from notes p59 → Rodina:

| # | → Rodina page | Rodina chunk | rel | conf | relev | notes source text (first 120ch) | Rodina target text (first 160ch) |
|---|---|---|---|---|---|---|---|
| 1 | **p5** | i71 [narrative] `d_subsets_uniqueness` | uses_definition | u | z | Def: we say a function \( \mathcal{B} = \mathcal{B}(X_{ij}) \) satisfies the 1-zero if \( X_{2j}, X_{i0}, X_{i3} \Righta | All D-subsets are uniquely fixed by the 1-zero condition up to an overall coefficient |
| 2 | **p3** | i52 [narrative] `rational_function_zeros_uv_scaling` | assumes | s | z | This is because \( \mathcal{B} \) is a rational function and \( m \) is the largest power of \( z \) appearing. ex: if \ | Here we will prove that any rational function built from planar invariants \( X_{ij} \) satisfies a zero condition if and only if it also satisfies both a “subs |
| 3 | **p6** | i90 [remark] `zero_condition,z_dependence,linear_combinations` | proves | s | u | \( (2 \Rightarrow 1) \) is trivial. Suppose \( (1) \) is true, and let \( \mathcal{B}(z) = \mathcal{B}(X_{ij}(z)) \) Not | This is precisely the same set of \( X_{ij} \) we found above for the zero condition! Finally we need to find all linear combinations of z-dependent \( X_{ij} \ |
| 4 | **p3** | i52 [narrative] `rational_function_zeros_uv_scaling` | proves | s | u | Then \( \mathcal{B}(z) = \mathcal{B}_{-1}(z) + O(z^{-2}) \) \[ = \frac{X_{13}(\infty) + zX^\infty_{13}}{(X_{2u}(\infty)  | Here we will prove that any rational function built from planar invariants \( X_{ij} \) satisfies a zero condition if and only if it also satisfies both a “subs |
| 5 | **p5** | i71 [narrative] `d_subsets_uniqueness` | proves | s | u | The only constraints on the \( X^\infty_{ij} \) are the same as the 1-zero, so this means \( \mathcal{B}_m \) satisfies  | All D-subsets are uniquely fixed by the 1-zero condition up to an overall coefficient |
| 6 | **p5** | i71 [narrative] `d_subsets_uniqueness` | proves | r | s | \( \mathcal{B} \) satisfies the 1-zero Each \( \mathcal{B}_i \) satisfies the 1-zero Prf. | All D-subsets are uniquely fixed by the 1-zero condition up to an overall coefficient |
| 7 | **p3** | i53 [narrative] `rational_function_invariants,rational_function_scaling` | proves | r | s | \[ \mathcal{B}(z) = 2^m \mathcal{B}_m(X^\infty_{ij}) + O(2^{-m}) \] | Take \( B \) any homogenous rational function of \( X_{ij} \), which is established from a complete basis of invariants. Collect in subsets \( B_l \) all indivi |
| 8 | **p6** | i85 [narrative] `zero_condition` | proves | r | s | Note that if \( X_{2i}(\infty) = X_{i0}(\infty) - X_{13}(\infty) \) then \( X_{2i}(z) = X_{i0}(z) - X_{13}(z) \) ∀ z So  | We accomplish this by showing that the \( X_{ij}^0 \equiv 0 \) satisfy the same set of identities, defined by the zero condition, as the ones \( c_{ij} = 0 \) i |
| 9 | **p6** | i85 [narrative] `zero_condition` | proves | r | s | \[ 0 = z^m \mathcal{B}_m(X^\infty_{ij}) + O(2^{-m-1}) \quad \forall z \quad \text{so it must be} \quad \mathcal{B}_m(X^\ | We accomplish this by showing that the \( X_{ij}^0 \equiv 0 \) satisfy the same set of identities, defined by the zero condition, as the ones \( c_{ij} = 0 \) i |

---

# Summary: notes page → primary Rodina target

| notes page | # edges to Rodina | top Rodina target (best edge) | relationship | conf/relev |
|---|---|---|---|---|
| p18 | 1 | Rodina **p4** i65 [narrative] | assumes | u/u |
| p19 | 8 | Rodina **p1** i18 [narrative] | assumes | s/z |
| p20 | 10 | Rodina **p1** i18 [narrative] | proves | s/z |
| p21 | 20 | Rodina **p1** i21 [narrative] | uses_definition | u/z |
| p22 | 2 | Rodina **p1** i18 [narrative] | proves | r/s |
| p23 | 5 | Rodina **p2** i32 [narrative] | assumes | z/s |
| p24 | 4 | Rodina **p3** i44 [narrative] | proves | s/u |
| p25 | 6 | Rodina **p1** i19 [narrative] | prerequisite | u/z |
| p26 | 11 | Rodina **p2** i33 [theorem] | assumes | u/z |
| p27 | 6 | Rodina **p2** i33 [theorem] | proves | s/z |
| p28 | 0 | — | — | — |
| p29 | 10 | Rodina **p2** i31 [narrative] | assumes | z/s |
| p40 | 8 | Rodina **p2** i24 [narrative] | proves | u/z |
| p41 | 10 | Rodina **p7** i104 [proof] | assumes | p/z |
| p42 | 9 | Rodina **p3** i43 [example] | assumes | z/s |
| p43 | 15 | Rodina **p3** i47 [narrative] | proves | u/z |
| p51 | 16 | Rodina **p3** i41 [narrative] | uses_definition | z/z |
| p52 | 13 | Rodina **p6** i84 [definition] | assumes | u/z |
| p53 | 8 | Rodina **p3** i46 [narrative] | prerequisite | z/u |
| p57 | 10 | Rodina **p6** i89 [narrative] | uses_definition | z/u |
| p58 | 7 | Rodina **p6** i85 [narrative] | uses_definition | z/u |
| p59 | 9 | Rodina **p5** i71 [narrative] | uses_definition | u/z |
