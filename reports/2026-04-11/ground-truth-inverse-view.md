# Inverse Ground-Truth View — Where Does the System Say the Content Lives?

For each of the 23 Rodina equations, this report shows:
1. **What Claude CLAIMED** — the notes PDF pages listed in the user ground-truth table
2. **What the SYSTEM FOUND** — the actual notes pages that produced edges to the target Rodina page, ranked by the best edge score from each source page
3. The **best edge from each source page**: source text, target text, relationship, conf/relev

Live DB state: 93.8% checkpoint (post `c781f35`).

---

## Eq.1 — c_{ij} definition  (Rodina p1)

**Claude claimed:** notes p13
**System landed 214 edges on Rodina p1 (±1) from 49 distinct notes pages.**

### Top notes pages the system chose (best edge per source page, top 6):

- **notes p1** → Rodina p1  rel=assumes conf=z relev=z (score=52)
  SRC: "\[ \frac{d}{dt} \frac{\partial \mathcal{L}}{\partial \dot{x}} = \frac{\partial \mathcal{L}}{\partial x} \] \[ \frac{d}{dt} \frac{\partial \mathcal{L}}{\partial \dot{y}} = \frac{\pa"
  DST: "These novel perspectives have revealed surprising structures and numerous additional simplifications that are completely hidden by the Lagrangian formalism."
- **notes p17** → Rodina p1  rel=assumes conf=z relev=z (score=52)
  SRC: "\[ \frac{1}{p^2} = \frac{1}{(p_1 + p_2)^2} = \frac{1}{(-p_3 - p_4)^2} \]"
  DST: "Here \( p_i \) is the \( D \)-dimensional momentum of particle \( i \), subjected to momentum conservation \( \sum_i p_i=0 \) (which implies \( X_{ij}=X_{ji} \)), and the on-shell "
- **notes p35** → Rodina p2  rel=assumes conf=z relev=z (score=52)
  SRC: "\[ A_4 \propto \frac{1}{s_{12}} + \frac{1}{s_{13}} + \frac{1}{s_{14}} = \frac{1}{s_{13}} \]"
  DST: "All the various zeros are all independent, no zero implies any other zero. For example, the ordered 4-point Tr(\( \phi^3 \)) amplitude \[ A_4(1234) = \frac{1}{s_{12}} + \frac{1}{s_"
- **notes p5** → Rodina p1  rel=prerequisite conf=u relev=z (score=47)
  SRC: "says the same"
  DST: "This equivalence, concretely explained in eq.(14), is valid for all zero types, and for any function built purely from planar invariants, which are the same data (and ansatz) for T"
- **notes p21** → Rodina p1  rel=uses_definition conf=u relev=z (score=47)
  SRC: "\( c_{i,j} = X_{ij} + X_{i+1,j+1} - X_{i+1,j} - X_{i,j+1} \)"
  DST: "\[ c_{ij} = X_{i,j} + X_{i+1,j+1} - X_{i+1,j} - X_{i,j+1}, \quad (1) \]"
- **notes p25** → Rodina p1  rel=prerequisite conf=u relev=z (score=47)
  SRC: "\[ \sum_{{i_1, i_2, i_3 \atop i_4, i_5, i_6}} \int dp_{5} \, dp_{6} \, \langle 1 \, 4 \rangle \langle 2 \, 5 \rangle \langle 3 \, 6 \rangle \delta \left( p_{1} + p_{5} + p_{6} \rig"
  DST: "Here \( p_i \) is the \( D \)-dimensional momentum of particle \( i \), subjected to momentum conservation \( \sum_i p_i=0 \) (which implies \( X_{ij}=X_{ji} \)), and the on-shell "

_…and 43 more source pages: p26, p31, p32, p34, p36, p40, p2, p4, p12, p15, p19, p20, p23, p27, p29, p30, p46, p50, p54, p6, p39, p3, p7, p8, p9, p11, p37, p38, p10, p13, p42, p43, p44, p47, p51, p53, p57, p16, p14, p22, p24, p52, p60_

---

## Eq.2 — color decomp Aₙ=ΣTr(T)Aₙ(σ)  (Rodina p2)

**Claude claimed:** notes p44/45/46
**System landed 308 edges on Rodina p2 (±1) from 60 distinct notes pages.**

### Top notes pages the system chose (best edge per source page, top 6):

- **notes p1** → Rodina p1  rel=assumes conf=z relev=z (score=52)
  SRC: "\[ \frac{d}{dt} \frac{\partial \mathcal{L}}{\partial \dot{x}} = \frac{\partial \mathcal{L}}{\partial x} \] \[ \frac{d}{dt} \frac{\partial \mathcal{L}}{\partial \dot{y}} = \frac{\pa"
  DST: "These novel perspectives have revealed surprising structures and numerous additional simplifications that are completely hidden by the Lagrangian formalism."
- **notes p17** → Rodina p1  rel=assumes conf=z relev=z (score=52)
  SRC: "\[ \frac{1}{p^2} = \frac{1}{(p_1 + p_2)^2} = \frac{1}{(-p_3 - p_4)^2} \]"
  DST: "Here \( p_i \) is the \( D \)-dimensional momentum of particle \( i \), subjected to momentum conservation \( \sum_i p_i=0 \) (which implies \( X_{ij}=X_{ji} \)), and the on-shell "
- **notes p35** → Rodina p2  rel=assumes conf=z relev=z (score=52)
  SRC: "\[ A_4 \propto \frac{1}{s_{12}} + \frac{1}{s_{13}} + \frac{1}{s_{14}} = \frac{1}{s_{13}} \]"
  DST: "All the various zeros are all independent, no zero implies any other zero. For example, the ordered 4-point Tr(\( \phi^3 \)) amplitude \[ A_4(1234) = \frac{1}{s_{12}} + \frac{1}{s_"
- **notes p51** → Rodina p3  rel=uses_definition conf=z relev=z (score=52)
  SRC: "\( P_2 \rightarrow P_2 + z q \)"
  DST: "First, each k-zero turns out to have a natural corresponding BCFW shift. For instance, for a 1-zero like \( c_{1i}=0 \), \( i\neq 2 \), the corresponding shift is \( p_2 \rightarro"
- **notes p5** → Rodina p1  rel=prerequisite conf=u relev=z (score=47)
  SRC: "says the same"
  DST: "This equivalence, concretely explained in eq.(14), is valid for all zero types, and for any function built purely from planar invariants, which are the same data (and ansatz) for T"
- **notes p21** → Rodina p1  rel=uses_definition conf=u relev=z (score=47)
  SRC: "\( c_{i,j} = X_{ij} + X_{i+1,j+1} - X_{i+1,j} - X_{i,j+1} \)"
  DST: "\[ c_{ij} = X_{i,j} + X_{i+1,j+1} - X_{i+1,j} - X_{i,j+1}, \quad (1) \]"

_…and 54 more source pages: p25, p26, p31, p32, p34, p36, p40, p43, p46, p48, p53, p2, p4, p11, p12, p15, p19, p20, p23, p27, p29, p30, p42, p49, p50, p52, p54, p56, p59, p6, p39, p3, p7, p8, p9, p10, p37, p38, p13, p24, p41, p44, p45, p47, p55, p57, p58, p63, p16, p14, p22, p33, p60, p64_

---

## Eq.3 — factorization Aₙ→(1/P²)·A^L·A^R  (Rodina p2)

**Claude claimed:** notes p33/34/23
**System landed 308 edges on Rodina p2 (±1) from 60 distinct notes pages.**

### Top notes pages the system chose (best edge per source page, top 6):

- **notes p1** → Rodina p1  rel=assumes conf=z relev=z (score=52)
  SRC: "\[ \frac{d}{dt} \frac{\partial \mathcal{L}}{\partial \dot{x}} = \frac{\partial \mathcal{L}}{\partial x} \] \[ \frac{d}{dt} \frac{\partial \mathcal{L}}{\partial \dot{y}} = \frac{\pa"
  DST: "These novel perspectives have revealed surprising structures and numerous additional simplifications that are completely hidden by the Lagrangian formalism."
- **notes p17** → Rodina p1  rel=assumes conf=z relev=z (score=52)
  SRC: "\[ \frac{1}{p^2} = \frac{1}{(p_1 + p_2)^2} = \frac{1}{(-p_3 - p_4)^2} \]"
  DST: "Here \( p_i \) is the \( D \)-dimensional momentum of particle \( i \), subjected to momentum conservation \( \sum_i p_i=0 \) (which implies \( X_{ij}=X_{ji} \)), and the on-shell "
- **notes p35** → Rodina p2  rel=assumes conf=z relev=z (score=52)
  SRC: "\[ A_4 \propto \frac{1}{s_{12}} + \frac{1}{s_{13}} + \frac{1}{s_{14}} = \frac{1}{s_{13}} \]"
  DST: "All the various zeros are all independent, no zero implies any other zero. For example, the ordered 4-point Tr(\( \phi^3 \)) amplitude \[ A_4(1234) = \frac{1}{s_{12}} + \frac{1}{s_"
- **notes p51** → Rodina p3  rel=uses_definition conf=z relev=z (score=52)
  SRC: "\( P_2 \rightarrow P_2 + z q \)"
  DST: "First, each k-zero turns out to have a natural corresponding BCFW shift. For instance, for a 1-zero like \( c_{1i}=0 \), \( i\neq 2 \), the corresponding shift is \( p_2 \rightarro"
- **notes p5** → Rodina p1  rel=prerequisite conf=u relev=z (score=47)
  SRC: "says the same"
  DST: "This equivalence, concretely explained in eq.(14), is valid for all zero types, and for any function built purely from planar invariants, which are the same data (and ansatz) for T"
- **notes p21** → Rodina p1  rel=uses_definition conf=u relev=z (score=47)
  SRC: "\( c_{i,j} = X_{ij} + X_{i+1,j+1} - X_{i+1,j} - X_{i,j+1} \)"
  DST: "\[ c_{ij} = X_{i,j} + X_{i+1,j+1} - X_{i+1,j} - X_{i,j+1}, \quad (1) \]"

_…and 54 more source pages: p25, p26, p31, p32, p34, p36, p40, p43, p46, p48, p53, p2, p4, p11, p12, p15, p19, p20, p23, p27, p29, p30, p42, p49, p50, p52, p54, p56, p59, p6, p39, p3, p7, p8, p9, p10, p37, p38, p13, p24, p41, p44, p45, p47, p55, p57, p58, p63, p16, p14, p22, p33, p60, p64_

---

## Eq.4 — BCFW shift p_i→p_i+zq  (Rodina p2)

**Claude claimed:** notes p24
**System landed 308 edges on Rodina p2 (±1) from 60 distinct notes pages.**

### Top notes pages the system chose (best edge per source page, top 6):

- **notes p1** → Rodina p1  rel=assumes conf=z relev=z (score=52)
  SRC: "\[ \frac{d}{dt} \frac{\partial \mathcal{L}}{\partial \dot{x}} = \frac{\partial \mathcal{L}}{\partial x} \] \[ \frac{d}{dt} \frac{\partial \mathcal{L}}{\partial \dot{y}} = \frac{\pa"
  DST: "These novel perspectives have revealed surprising structures and numerous additional simplifications that are completely hidden by the Lagrangian formalism."
- **notes p17** → Rodina p1  rel=assumes conf=z relev=z (score=52)
  SRC: "\[ \frac{1}{p^2} = \frac{1}{(p_1 + p_2)^2} = \frac{1}{(-p_3 - p_4)^2} \]"
  DST: "Here \( p_i \) is the \( D \)-dimensional momentum of particle \( i \), subjected to momentum conservation \( \sum_i p_i=0 \) (which implies \( X_{ij}=X_{ji} \)), and the on-shell "
- **notes p35** → Rodina p2  rel=assumes conf=z relev=z (score=52)
  SRC: "\[ A_4 \propto \frac{1}{s_{12}} + \frac{1}{s_{13}} + \frac{1}{s_{14}} = \frac{1}{s_{13}} \]"
  DST: "All the various zeros are all independent, no zero implies any other zero. For example, the ordered 4-point Tr(\( \phi^3 \)) amplitude \[ A_4(1234) = \frac{1}{s_{12}} + \frac{1}{s_"
- **notes p51** → Rodina p3  rel=uses_definition conf=z relev=z (score=52)
  SRC: "\( P_2 \rightarrow P_2 + z q \)"
  DST: "First, each k-zero turns out to have a natural corresponding BCFW shift. For instance, for a 1-zero like \( c_{1i}=0 \), \( i\neq 2 \), the corresponding shift is \( p_2 \rightarro"
- **notes p5** → Rodina p1  rel=prerequisite conf=u relev=z (score=47)
  SRC: "says the same"
  DST: "This equivalence, concretely explained in eq.(14), is valid for all zero types, and for any function built purely from planar invariants, which are the same data (and ansatz) for T"
- **notes p21** → Rodina p1  rel=uses_definition conf=u relev=z (score=47)
  SRC: "\( c_{i,j} = X_{ij} + X_{i+1,j+1} - X_{i+1,j} - X_{i,j+1} \)"
  DST: "\[ c_{ij} = X_{i,j} + X_{i+1,j+1} - X_{i+1,j} - X_{i,j+1}, \quad (1) \]"

_…and 54 more source pages: p25, p26, p31, p32, p34, p36, p40, p43, p46, p48, p53, p2, p4, p11, p12, p15, p19, p20, p23, p27, p29, p30, p42, p49, p50, p52, p54, p56, p59, p6, p39, p3, p7, p8, p9, p10, p37, p38, p13, p24, p41, p44, p45, p47, p55, p57, p58, p63, p16, p14, p22, p33, p60, p64_

---

## Eq.5 — 1-zero: c_{1i}=0  (Rodina p2)

**Claude claimed:** notes p13
**System landed 308 edges on Rodina p2 (±1) from 60 distinct notes pages.**

### Top notes pages the system chose (best edge per source page, top 6):

- **notes p1** → Rodina p1  rel=assumes conf=z relev=z (score=52)
  SRC: "\[ \frac{d}{dt} \frac{\partial \mathcal{L}}{\partial \dot{x}} = \frac{\partial \mathcal{L}}{\partial x} \] \[ \frac{d}{dt} \frac{\partial \mathcal{L}}{\partial \dot{y}} = \frac{\pa"
  DST: "These novel perspectives have revealed surprising structures and numerous additional simplifications that are completely hidden by the Lagrangian formalism."
- **notes p17** → Rodina p1  rel=assumes conf=z relev=z (score=52)
  SRC: "\[ \frac{1}{p^2} = \frac{1}{(p_1 + p_2)^2} = \frac{1}{(-p_3 - p_4)^2} \]"
  DST: "Here \( p_i \) is the \( D \)-dimensional momentum of particle \( i \), subjected to momentum conservation \( \sum_i p_i=0 \) (which implies \( X_{ij}=X_{ji} \)), and the on-shell "
- **notes p35** → Rodina p2  rel=assumes conf=z relev=z (score=52)
  SRC: "\[ A_4 \propto \frac{1}{s_{12}} + \frac{1}{s_{13}} + \frac{1}{s_{14}} = \frac{1}{s_{13}} \]"
  DST: "All the various zeros are all independent, no zero implies any other zero. For example, the ordered 4-point Tr(\( \phi^3 \)) amplitude \[ A_4(1234) = \frac{1}{s_{12}} + \frac{1}{s_"
- **notes p51** → Rodina p3  rel=uses_definition conf=z relev=z (score=52)
  SRC: "\( P_2 \rightarrow P_2 + z q \)"
  DST: "First, each k-zero turns out to have a natural corresponding BCFW shift. For instance, for a 1-zero like \( c_{1i}=0 \), \( i\neq 2 \), the corresponding shift is \( p_2 \rightarro"
- **notes p5** → Rodina p1  rel=prerequisite conf=u relev=z (score=47)
  SRC: "says the same"
  DST: "This equivalence, concretely explained in eq.(14), is valid for all zero types, and for any function built purely from planar invariants, which are the same data (and ansatz) for T"
- **notes p21** → Rodina p1  rel=uses_definition conf=u relev=z (score=47)
  SRC: "\( c_{i,j} = X_{ij} + X_{i+1,j+1} - X_{i+1,j} - X_{i,j+1} \)"
  DST: "\[ c_{ij} = X_{i,j} + X_{i+1,j+1} - X_{i+1,j} - X_{i,j+1}, \quad (1) \]"

_…and 54 more source pages: p25, p26, p31, p32, p34, p36, p40, p43, p46, p48, p53, p2, p4, p11, p12, p15, p19, p20, p23, p27, p29, p30, p42, p49, p50, p52, p54, p56, p59, p6, p39, p3, p7, p8, p9, p10, p37, p38, p13, p24, p41, p44, p45, p47, p55, p57, p58, p63, p16, p14, p22, p33, p60, p64_

---

## Eq.6 — k-zero generalization  (Rodina p2)

**Claude claimed:** notes p29/30
**System landed 308 edges on Rodina p2 (±1) from 60 distinct notes pages.**

### Top notes pages the system chose (best edge per source page, top 6):

- **notes p1** → Rodina p1  rel=assumes conf=z relev=z (score=52)
  SRC: "\[ \frac{d}{dt} \frac{\partial \mathcal{L}}{\partial \dot{x}} = \frac{\partial \mathcal{L}}{\partial x} \] \[ \frac{d}{dt} \frac{\partial \mathcal{L}}{\partial \dot{y}} = \frac{\pa"
  DST: "These novel perspectives have revealed surprising structures and numerous additional simplifications that are completely hidden by the Lagrangian formalism."
- **notes p17** → Rodina p1  rel=assumes conf=z relev=z (score=52)
  SRC: "\[ \frac{1}{p^2} = \frac{1}{(p_1 + p_2)^2} = \frac{1}{(-p_3 - p_4)^2} \]"
  DST: "Here \( p_i \) is the \( D \)-dimensional momentum of particle \( i \), subjected to momentum conservation \( \sum_i p_i=0 \) (which implies \( X_{ij}=X_{ji} \)), and the on-shell "
- **notes p35** → Rodina p2  rel=assumes conf=z relev=z (score=52)
  SRC: "\[ A_4 \propto \frac{1}{s_{12}} + \frac{1}{s_{13}} + \frac{1}{s_{14}} = \frac{1}{s_{13}} \]"
  DST: "All the various zeros are all independent, no zero implies any other zero. For example, the ordered 4-point Tr(\( \phi^3 \)) amplitude \[ A_4(1234) = \frac{1}{s_{12}} + \frac{1}{s_"
- **notes p51** → Rodina p3  rel=uses_definition conf=z relev=z (score=52)
  SRC: "\( P_2 \rightarrow P_2 + z q \)"
  DST: "First, each k-zero turns out to have a natural corresponding BCFW shift. For instance, for a 1-zero like \( c_{1i}=0 \), \( i\neq 2 \), the corresponding shift is \( p_2 \rightarro"
- **notes p5** → Rodina p1  rel=prerequisite conf=u relev=z (score=47)
  SRC: "says the same"
  DST: "This equivalence, concretely explained in eq.(14), is valid for all zero types, and for any function built purely from planar invariants, which are the same data (and ansatz) for T"
- **notes p21** → Rodina p1  rel=uses_definition conf=u relev=z (score=47)
  SRC: "\( c_{i,j} = X_{ij} + X_{i+1,j+1} - X_{i+1,j} - X_{i,j+1} \)"
  DST: "\[ c_{ij} = X_{i,j} + X_{i+1,j+1} - X_{i+1,j} - X_{i,j+1}, \quad (1) \]"

_…and 54 more source pages: p25, p26, p31, p32, p34, p36, p40, p43, p46, p48, p53, p2, p4, p11, p12, p15, p19, p20, p23, p27, p29, p30, p42, p49, p50, p52, p54, p56, p59, p6, p39, p3, p7, p8, p9, p10, p37, p38, p13, p24, p41, p44, p45, p47, p55, p57, p58, p63, p16, p14, p22, p33, p60, p64_

---

## Eq.7 — A_4=1/s_{12}+1/s_{14}  (Rodina p2)

**Claude claimed:** notes p13
**System landed 308 edges on Rodina p2 (±1) from 60 distinct notes pages.**

### Top notes pages the system chose (best edge per source page, top 6):

- **notes p1** → Rodina p1  rel=assumes conf=z relev=z (score=52)
  SRC: "\[ \frac{d}{dt} \frac{\partial \mathcal{L}}{\partial \dot{x}} = \frac{\partial \mathcal{L}}{\partial x} \] \[ \frac{d}{dt} \frac{\partial \mathcal{L}}{\partial \dot{y}} = \frac{\pa"
  DST: "These novel perspectives have revealed surprising structures and numerous additional simplifications that are completely hidden by the Lagrangian formalism."
- **notes p17** → Rodina p1  rel=assumes conf=z relev=z (score=52)
  SRC: "\[ \frac{1}{p^2} = \frac{1}{(p_1 + p_2)^2} = \frac{1}{(-p_3 - p_4)^2} \]"
  DST: "Here \( p_i \) is the \( D \)-dimensional momentum of particle \( i \), subjected to momentum conservation \( \sum_i p_i=0 \) (which implies \( X_{ij}=X_{ji} \)), and the on-shell "
- **notes p35** → Rodina p2  rel=assumes conf=z relev=z (score=52)
  SRC: "\[ A_4 \propto \frac{1}{s_{12}} + \frac{1}{s_{13}} + \frac{1}{s_{14}} = \frac{1}{s_{13}} \]"
  DST: "All the various zeros are all independent, no zero implies any other zero. For example, the ordered 4-point Tr(\( \phi^3 \)) amplitude \[ A_4(1234) = \frac{1}{s_{12}} + \frac{1}{s_"
- **notes p51** → Rodina p3  rel=uses_definition conf=z relev=z (score=52)
  SRC: "\( P_2 \rightarrow P_2 + z q \)"
  DST: "First, each k-zero turns out to have a natural corresponding BCFW shift. For instance, for a 1-zero like \( c_{1i}=0 \), \( i\neq 2 \), the corresponding shift is \( p_2 \rightarro"
- **notes p5** → Rodina p1  rel=prerequisite conf=u relev=z (score=47)
  SRC: "says the same"
  DST: "This equivalence, concretely explained in eq.(14), is valid for all zero types, and for any function built purely from planar invariants, which are the same data (and ansatz) for T"
- **notes p21** → Rodina p1  rel=uses_definition conf=u relev=z (score=47)
  SRC: "\( c_{i,j} = X_{ij} + X_{i+1,j+1} - X_{i+1,j} - X_{i,j+1} \)"
  DST: "\[ c_{ij} = X_{i,j} + X_{i+1,j+1} - X_{i+1,j} - X_{i,j+1}, \quad (1) \]"

_…and 54 more source pages: p25, p26, p31, p32, p34, p36, p40, p43, p46, p48, p53, p2, p4, p11, p12, p15, p19, p20, p23, p27, p29, p30, p42, p49, p50, p52, p54, p56, p59, p6, p39, p3, p7, p8, p9, p10, p37, p38, p13, p24, p41, p44, p45, p47, p55, p57, p58, p63, p16, p14, p22, p33, p60, p64_

---

## Eq.8 — splitting near zero  (Rodina p3)

**Claude claimed:** notes p17/18
**System landed 217 edges on Rodina p3 (±1) from 57 distinct notes pages.**

### Top notes pages the system chose (best edge per source page, top 6):

- **notes p35** → Rodina p2  rel=assumes conf=z relev=z (score=52)
  SRC: "\[ A_4 \propto \frac{1}{s_{12}} + \frac{1}{s_{13}} + \frac{1}{s_{14}} = \frac{1}{s_{13}} \]"
  DST: "All the various zeros are all independent, no zero implies any other zero. For example, the ordered 4-point Tr(\( \phi^3 \)) amplitude \[ A_4(1234) = \frac{1}{s_{12}} + \frac{1}{s_"
- **notes p51** → Rodina p3  rel=uses_definition conf=z relev=z (score=52)
  SRC: "\( P_2 \rightarrow P_2 + z q \)"
  DST: "First, each k-zero turns out to have a natural corresponding BCFW shift. For instance, for a 1-zero like \( c_{1i}=0 \), \( i\neq 2 \), the corresponding shift is \( p_2 \rightarro"
- **notes p26** → Rodina p2  rel=assumes conf=u relev=z (score=47)
  SRC: "\[ \frac{1}{S_n / 2 n} \]"
  DST: "Pole structure and ordered amplitudes In this paper, we will only consider amplitudes of colored particles, which can be written as a sum over different colored components \[ A_n ="
- **notes p36** → Rodina p2  rel=prerequisite conf=z relev=u (score=47)
  SRC: "Indicating the possibility of residue factorization."
  DST: "Unitarity From the optical theorem, unitarity implies factorization of residues of the above poles. Near a pole \( P^2_i=0 \), the amplitude factorizes into two lower point amplitu"
- **notes p40** → Rodina p2  rel=proves conf=u relev=z (score=47)
  SRC: "Pick \( p_i, p_j \) among the external momenta \((i \neq j)\): Send: \( p_i \rightarrow p_i + zq \) \( p_j \rightarrow p_j - zq \)"
  DST: "The poles are accessed via a complex parameter \( z \) introduced through a BCFW shift, \[ p_i \to p_i + zq, \quad p_j \to p_j - zq, \quad (4) \] with \( p_i \cdot q = p_j \cdot q "
- **notes p43** → Rodina p3  rel=proves conf=u relev=z (score=47)
  SRC: "\[ X_{2n}^{(\infty)} = -2 \, q \cdot P_1 \]"
  DST: "\[ X^{(\infty)}_{2,n} = -q \cdot p_1. \quad \quad \quad (11) \]"

_…and 51 more source pages: p46, p48, p53, p54, p56, p65, p2, p11, p12, p23, p27, p29, p30, p31, p42, p49, p50, p52, p59, p61, p20, p39, p6, p7, p8, p10, p15, p18, p37, p5, p9, p21, p24, p25, p32, p34, p38, p41, p44, p45, p47, p55, p57, p58, p62, p63, p16, p17, p33, p60, p64_

---

## Eq.9 — three types of X_{ij}  (Rodina p3)

**Claude claimed:** notes p13/14
**System landed 217 edges on Rodina p3 (±1) from 57 distinct notes pages.**

### Top notes pages the system chose (best edge per source page, top 6):

- **notes p35** → Rodina p2  rel=assumes conf=z relev=z (score=52)
  SRC: "\[ A_4 \propto \frac{1}{s_{12}} + \frac{1}{s_{13}} + \frac{1}{s_{14}} = \frac{1}{s_{13}} \]"
  DST: "All the various zeros are all independent, no zero implies any other zero. For example, the ordered 4-point Tr(\( \phi^3 \)) amplitude \[ A_4(1234) = \frac{1}{s_{12}} + \frac{1}{s_"
- **notes p51** → Rodina p3  rel=uses_definition conf=z relev=z (score=52)
  SRC: "\( P_2 \rightarrow P_2 + z q \)"
  DST: "First, each k-zero turns out to have a natural corresponding BCFW shift. For instance, for a 1-zero like \( c_{1i}=0 \), \( i\neq 2 \), the corresponding shift is \( p_2 \rightarro"
- **notes p26** → Rodina p2  rel=assumes conf=u relev=z (score=47)
  SRC: "\[ \frac{1}{S_n / 2 n} \]"
  DST: "Pole structure and ordered amplitudes In this paper, we will only consider amplitudes of colored particles, which can be written as a sum over different colored components \[ A_n ="
- **notes p36** → Rodina p2  rel=prerequisite conf=z relev=u (score=47)
  SRC: "Indicating the possibility of residue factorization."
  DST: "Unitarity From the optical theorem, unitarity implies factorization of residues of the above poles. Near a pole \( P^2_i=0 \), the amplitude factorizes into two lower point amplitu"
- **notes p40** → Rodina p2  rel=proves conf=u relev=z (score=47)
  SRC: "Pick \( p_i, p_j \) among the external momenta \((i \neq j)\): Send: \( p_i \rightarrow p_i + zq \) \( p_j \rightarrow p_j - zq \)"
  DST: "The poles are accessed via a complex parameter \( z \) introduced through a BCFW shift, \[ p_i \to p_i + zq, \quad p_j \to p_j - zq, \quad (4) \] with \( p_i \cdot q = p_j \cdot q "
- **notes p43** → Rodina p3  rel=proves conf=u relev=z (score=47)
  SRC: "\[ X_{2n}^{(\infty)} = -2 \, q \cdot P_1 \]"
  DST: "\[ X^{(\infty)}_{2,n} = -q \cdot p_1. \quad \quad \quad (11) \]"

_…and 51 more source pages: p46, p48, p53, p54, p56, p65, p2, p11, p12, p23, p27, p29, p30, p31, p42, p49, p50, p52, p59, p61, p20, p39, p6, p7, p8, p10, p15, p18, p37, p5, p9, p21, p24, p25, p32, p34, p38, p41, p44, p45, p47, p55, p57, p58, p62, p63, p16, p17, p33, p60, p64_

---

## Eq.10 — X^{(0)} values  (Rodina p3)

**Claude claimed:** notes p13/14
**System landed 217 edges on Rodina p3 (±1) from 57 distinct notes pages.**

### Top notes pages the system chose (best edge per source page, top 6):

- **notes p35** → Rodina p2  rel=assumes conf=z relev=z (score=52)
  SRC: "\[ A_4 \propto \frac{1}{s_{12}} + \frac{1}{s_{13}} + \frac{1}{s_{14}} = \frac{1}{s_{13}} \]"
  DST: "All the various zeros are all independent, no zero implies any other zero. For example, the ordered 4-point Tr(\( \phi^3 \)) amplitude \[ A_4(1234) = \frac{1}{s_{12}} + \frac{1}{s_"
- **notes p51** → Rodina p3  rel=uses_definition conf=z relev=z (score=52)
  SRC: "\( P_2 \rightarrow P_2 + z q \)"
  DST: "First, each k-zero turns out to have a natural corresponding BCFW shift. For instance, for a 1-zero like \( c_{1i}=0 \), \( i\neq 2 \), the corresponding shift is \( p_2 \rightarro"
- **notes p26** → Rodina p2  rel=assumes conf=u relev=z (score=47)
  SRC: "\[ \frac{1}{S_n / 2 n} \]"
  DST: "Pole structure and ordered amplitudes In this paper, we will only consider amplitudes of colored particles, which can be written as a sum over different colored components \[ A_n ="
- **notes p36** → Rodina p2  rel=prerequisite conf=z relev=u (score=47)
  SRC: "Indicating the possibility of residue factorization."
  DST: "Unitarity From the optical theorem, unitarity implies factorization of residues of the above poles. Near a pole \( P^2_i=0 \), the amplitude factorizes into two lower point amplitu"
- **notes p40** → Rodina p2  rel=proves conf=u relev=z (score=47)
  SRC: "Pick \( p_i, p_j \) among the external momenta \((i \neq j)\): Send: \( p_i \rightarrow p_i + zq \) \( p_j \rightarrow p_j - zq \)"
  DST: "The poles are accessed via a complex parameter \( z \) introduced through a BCFW shift, \[ p_i \to p_i + zq, \quad p_j \to p_j - zq, \quad (4) \] with \( p_i \cdot q = p_j \cdot q "
- **notes p43** → Rodina p3  rel=proves conf=u relev=z (score=47)
  SRC: "\[ X_{2n}^{(\infty)} = -2 \, q \cdot P_1 \]"
  DST: "\[ X^{(\infty)}_{2,n} = -q \cdot p_1. \quad \quad \quad (11) \]"

_…and 51 more source pages: p46, p48, p53, p54, p56, p65, p2, p11, p12, p23, p27, p29, p30, p31, p42, p49, p50, p52, p59, p61, p20, p39, p6, p7, p8, p10, p15, p18, p37, p5, p9, p21, p24, p25, p32, p34, p38, p41, p44, p45, p47, p55, p57, p58, p62, p63, p16, p17, p33, p60, p64_

---

## Eq.11 — X^{(∞)} values  (Rodina p3)

**Claude claimed:** notes p13/14
**System landed 217 edges on Rodina p3 (±1) from 57 distinct notes pages.**

### Top notes pages the system chose (best edge per source page, top 6):

- **notes p35** → Rodina p2  rel=assumes conf=z relev=z (score=52)
  SRC: "\[ A_4 \propto \frac{1}{s_{12}} + \frac{1}{s_{13}} + \frac{1}{s_{14}} = \frac{1}{s_{13}} \]"
  DST: "All the various zeros are all independent, no zero implies any other zero. For example, the ordered 4-point Tr(\( \phi^3 \)) amplitude \[ A_4(1234) = \frac{1}{s_{12}} + \frac{1}{s_"
- **notes p51** → Rodina p3  rel=uses_definition conf=z relev=z (score=52)
  SRC: "\( P_2 \rightarrow P_2 + z q \)"
  DST: "First, each k-zero turns out to have a natural corresponding BCFW shift. For instance, for a 1-zero like \( c_{1i}=0 \), \( i\neq 2 \), the corresponding shift is \( p_2 \rightarro"
- **notes p26** → Rodina p2  rel=assumes conf=u relev=z (score=47)
  SRC: "\[ \frac{1}{S_n / 2 n} \]"
  DST: "Pole structure and ordered amplitudes In this paper, we will only consider amplitudes of colored particles, which can be written as a sum over different colored components \[ A_n ="
- **notes p36** → Rodina p2  rel=prerequisite conf=z relev=u (score=47)
  SRC: "Indicating the possibility of residue factorization."
  DST: "Unitarity From the optical theorem, unitarity implies factorization of residues of the above poles. Near a pole \( P^2_i=0 \), the amplitude factorizes into two lower point amplitu"
- **notes p40** → Rodina p2  rel=proves conf=u relev=z (score=47)
  SRC: "Pick \( p_i, p_j \) among the external momenta \((i \neq j)\): Send: \( p_i \rightarrow p_i + zq \) \( p_j \rightarrow p_j - zq \)"
  DST: "The poles are accessed via a complex parameter \( z \) introduced through a BCFW shift, \[ p_i \to p_i + zq, \quad p_j \to p_j - zq, \quad (4) \] with \( p_i \cdot q = p_j \cdot q "
- **notes p43** → Rodina p3  rel=proves conf=u relev=z (score=47)
  SRC: "\[ X_{2n}^{(\infty)} = -2 \, q \cdot P_1 \]"
  DST: "\[ X^{(\infty)}_{2,n} = -q \cdot p_1. \quad \quad \quad (11) \]"

_…and 51 more source pages: p46, p48, p53, p54, p56, p65, p2, p11, p12, p23, p27, p29, p30, p31, p42, p49, p50, p52, p59, p61, p20, p39, p6, p7, p8, p10, p15, p18, p37, p5, p9, p21, p24, p25, p32, p34, p38, p41, p44, p45, p47, p55, p57, p58, p62, p63, p16, p17, p33, p60, p64_

---

## Eq.12 — k-zero↔BCFW map  (Rodina p3)

**Claude claimed:** notes p20/21
**System landed 217 edges on Rodina p3 (±1) from 57 distinct notes pages.**

### Top notes pages the system chose (best edge per source page, top 6):

- **notes p35** → Rodina p2  rel=assumes conf=z relev=z (score=52)
  SRC: "\[ A_4 \propto \frac{1}{s_{12}} + \frac{1}{s_{13}} + \frac{1}{s_{14}} = \frac{1}{s_{13}} \]"
  DST: "All the various zeros are all independent, no zero implies any other zero. For example, the ordered 4-point Tr(\( \phi^3 \)) amplitude \[ A_4(1234) = \frac{1}{s_{12}} + \frac{1}{s_"
- **notes p51** → Rodina p3  rel=uses_definition conf=z relev=z (score=52)
  SRC: "\( P_2 \rightarrow P_2 + z q \)"
  DST: "First, each k-zero turns out to have a natural corresponding BCFW shift. For instance, for a 1-zero like \( c_{1i}=0 \), \( i\neq 2 \), the corresponding shift is \( p_2 \rightarro"
- **notes p26** → Rodina p2  rel=assumes conf=u relev=z (score=47)
  SRC: "\[ \frac{1}{S_n / 2 n} \]"
  DST: "Pole structure and ordered amplitudes In this paper, we will only consider amplitudes of colored particles, which can be written as a sum over different colored components \[ A_n ="
- **notes p36** → Rodina p2  rel=prerequisite conf=z relev=u (score=47)
  SRC: "Indicating the possibility of residue factorization."
  DST: "Unitarity From the optical theorem, unitarity implies factorization of residues of the above poles. Near a pole \( P^2_i=0 \), the amplitude factorizes into two lower point amplitu"
- **notes p40** → Rodina p2  rel=proves conf=u relev=z (score=47)
  SRC: "Pick \( p_i, p_j \) among the external momenta \((i \neq j)\): Send: \( p_i \rightarrow p_i + zq \) \( p_j \rightarrow p_j - zq \)"
  DST: "The poles are accessed via a complex parameter \( z \) introduced through a BCFW shift, \[ p_i \to p_i + zq, \quad p_j \to p_j - zq, \quad (4) \] with \( p_i \cdot q = p_j \cdot q "
- **notes p43** → Rodina p3  rel=proves conf=u relev=z (score=47)
  SRC: "\[ X_{2n}^{(\infty)} = -2 \, q \cdot P_1 \]"
  DST: "\[ X^{(\infty)}_{2,n} = -q \cdot p_1. \quad \quad \quad (11) \]"

_…and 51 more source pages: p46, p48, p53, p54, p56, p65, p2, p11, p12, p23, p27, p29, p30, p31, p42, p49, p50, p52, p59, p61, p20, p39, p6, p7, p8, p10, p15, p18, p37, p5, p9, p21, p24, p25, p32, p34, p38, p41, p44, p45, p47, p55, p57, p58, p62, p63, p16, p17, p33, p60, p64_

---

## Eq.13 — B=Bₘ+Bₘ₋₁+...  (Rodina p3)

**Claude claimed:** notes p7
**System landed 217 edges on Rodina p3 (±1) from 57 distinct notes pages.**

### Top notes pages the system chose (best edge per source page, top 6):

- **notes p35** → Rodina p2  rel=assumes conf=z relev=z (score=52)
  SRC: "\[ A_4 \propto \frac{1}{s_{12}} + \frac{1}{s_{13}} + \frac{1}{s_{14}} = \frac{1}{s_{13}} \]"
  DST: "All the various zeros are all independent, no zero implies any other zero. For example, the ordered 4-point Tr(\( \phi^3 \)) amplitude \[ A_4(1234) = \frac{1}{s_{12}} + \frac{1}{s_"
- **notes p51** → Rodina p3  rel=uses_definition conf=z relev=z (score=52)
  SRC: "\( P_2 \rightarrow P_2 + z q \)"
  DST: "First, each k-zero turns out to have a natural corresponding BCFW shift. For instance, for a 1-zero like \( c_{1i}=0 \), \( i\neq 2 \), the corresponding shift is \( p_2 \rightarro"
- **notes p26** → Rodina p2  rel=assumes conf=u relev=z (score=47)
  SRC: "\[ \frac{1}{S_n / 2 n} \]"
  DST: "Pole structure and ordered amplitudes In this paper, we will only consider amplitudes of colored particles, which can be written as a sum over different colored components \[ A_n ="
- **notes p36** → Rodina p2  rel=prerequisite conf=z relev=u (score=47)
  SRC: "Indicating the possibility of residue factorization."
  DST: "Unitarity From the optical theorem, unitarity implies factorization of residues of the above poles. Near a pole \( P^2_i=0 \), the amplitude factorizes into two lower point amplitu"
- **notes p40** → Rodina p2  rel=proves conf=u relev=z (score=47)
  SRC: "Pick \( p_i, p_j \) among the external momenta \((i \neq j)\): Send: \( p_i \rightarrow p_i + zq \) \( p_j \rightarrow p_j - zq \)"
  DST: "The poles are accessed via a complex parameter \( z \) introduced through a BCFW shift, \[ p_i \to p_i + zq, \quad p_j \to p_j - zq, \quad (4) \] with \( p_i \cdot q = p_j \cdot q "
- **notes p43** → Rodina p3  rel=proves conf=u relev=z (score=47)
  SRC: "\[ X_{2n}^{(\infty)} = -2 \, q \cdot P_1 \]"
  DST: "\[ X^{(\infty)}_{2,n} = -q \cdot p_1. \quad \quad \quad (11) \]"

_…and 51 more source pages: p46, p48, p53, p54, p56, p65, p2, p11, p12, p23, p27, p29, p30, p31, p42, p49, p50, p52, p59, p61, p20, p39, p6, p7, p8, p10, p15, p18, p37, p5, p9, p21, p24, p25, p32, p34, p38, p41, p44, p45, p47, p55, p57, p58, p62, p63, p16, p17, p33, p60, p64_

---

## Eq.14 — three equivalences core theorem  (Rodina p4)

**Claude claimed:** notes p20
**System landed 184 edges on Rodina p4 (±1) from 55 distinct notes pages.**

### Top notes pages the system chose (best edge per source page, top 6):

- **notes p51** → Rodina p3  rel=uses_definition conf=z relev=z (score=52)
  SRC: "\( P_2 \rightarrow P_2 + z q \)"
  DST: "First, each k-zero turns out to have a natural corresponding BCFW shift. For instance, for a 1-zero like \( c_{1i}=0 \), \( i\neq 2 \), the corresponding shift is \( p_2 \rightarro"
- **notes p43** → Rodina p3  rel=proves conf=u relev=z (score=47)
  SRC: "\[ X_{2n}^{(\infty)} = -2 \, q \cdot P_1 \]"
  DST: "\[ X^{(\infty)}_{2,n} = -q \cdot p_1. \quad \quad \quad (11) \]"
- **notes p46** → Rodina p3  rel=prerequisite conf=u relev=z (score=47)
  SRC: "Let \(\mathcal{B}\) be an homogeneous rational function of the \( X_i \), a function \( f(\lambda x, \lambda x, \ldots, \lambda x_n) = \lambda^n f(x, \ldots, x_n) \)"
  DST: "Here we will prove that any rational function built from planar invariants \( X_{ij} \) satisfies a zero condition if and only if it also satisfies both a “subset enhanced UV scali"
- **notes p48** → Rodina p3  rel=assumes conf=u relev=z (score=47)
  SRC: "\( B = \frac{1}{X_{13}} \) \( n = 5 \) Supers:"
  DST: "\[ B = B_m + B_{m-1} + B_{m-2} + \cdots , \quad \quad \quad (13) \] if we assume \( z^m \) is the largest scaling for any term in \( B \). Note the above is not a series expansion,"
- **notes p53** → Rodina p3  rel=prerequisite conf=z relev=u (score=47)
  SRC: "let \( B' = B - B_m = B_{m-1} + \cdots \)"
  DST: "while the leading order in \( z \) under a BCFW shift is given by \[ X^{(\infty)}_{0,j+1} = q \cdot p_1 + \sum_{i=3}^{j} q \cdot p_i, \] \[ X^{(\infty)}_{2,j+1} = \sum_{i=3}^{j} q "
- **notes p54** → Rodina p4  rel=uses_definition conf=u relev=z (score=47)
  SRC: "Start with: Figure: 6-gon with leg 1 removed, marked for matching Adding leg 1 back in all possible ways (according to color):"
  DST: "Then the D-subset corresponding to this (n−1)-point diagram is formed by adding leg 1 in all possible ways (that respect ordering and trivalent interactions)."

_…and 49 more source pages: p56, p59, p65, p7, p11, p25, p31, p42, p49, p52, p55, p61, p63, p20, p33, p1, p2, p6, p8, p10, p12, p15, p18, p26, p39, p5, p21, p24, p27, p34, p35, p37, p38, p40, p41, p44, p45, p47, p50, p58, p60, p62, p57, p17, p19, p30, p32, p36, p64_

---

## Eq.15 — B=Σc_{ij}{...}  (Rodina p4)

**Claude claimed:** notes p8
**System landed 184 edges on Rodina p4 (±1) from 55 distinct notes pages.**

### Top notes pages the system chose (best edge per source page, top 6):

- **notes p51** → Rodina p3  rel=uses_definition conf=z relev=z (score=52)
  SRC: "\( P_2 \rightarrow P_2 + z q \)"
  DST: "First, each k-zero turns out to have a natural corresponding BCFW shift. For instance, for a 1-zero like \( c_{1i}=0 \), \( i\neq 2 \), the corresponding shift is \( p_2 \rightarro"
- **notes p43** → Rodina p3  rel=proves conf=u relev=z (score=47)
  SRC: "\[ X_{2n}^{(\infty)} = -2 \, q \cdot P_1 \]"
  DST: "\[ X^{(\infty)}_{2,n} = -q \cdot p_1. \quad \quad \quad (11) \]"
- **notes p46** → Rodina p3  rel=prerequisite conf=u relev=z (score=47)
  SRC: "Let \(\mathcal{B}\) be an homogeneous rational function of the \( X_i \), a function \( f(\lambda x, \lambda x, \ldots, \lambda x_n) = \lambda^n f(x, \ldots, x_n) \)"
  DST: "Here we will prove that any rational function built from planar invariants \( X_{ij} \) satisfies a zero condition if and only if it also satisfies both a “subset enhanced UV scali"
- **notes p48** → Rodina p3  rel=assumes conf=u relev=z (score=47)
  SRC: "\( B = \frac{1}{X_{13}} \) \( n = 5 \) Supers:"
  DST: "\[ B = B_m + B_{m-1} + B_{m-2} + \cdots , \quad \quad \quad (13) \] if we assume \( z^m \) is the largest scaling for any term in \( B \). Note the above is not a series expansion,"
- **notes p53** → Rodina p3  rel=prerequisite conf=z relev=u (score=47)
  SRC: "let \( B' = B - B_m = B_{m-1} + \cdots \)"
  DST: "while the leading order in \( z \) under a BCFW shift is given by \[ X^{(\infty)}_{0,j+1} = q \cdot p_1 + \sum_{i=3}^{j} q \cdot p_i, \] \[ X^{(\infty)}_{2,j+1} = \sum_{i=3}^{j} q "
- **notes p54** → Rodina p4  rel=uses_definition conf=u relev=z (score=47)
  SRC: "Start with: Figure: 6-gon with leg 1 removed, marked for matching Adding leg 1 back in all possible ways (according to color):"
  DST: "Then the D-subset corresponding to this (n−1)-point diagram is formed by adding leg 1 in all possible ways (that respect ordering and trivalent interactions)."

_…and 49 more source pages: p56, p59, p65, p7, p11, p25, p31, p42, p49, p52, p55, p61, p63, p20, p33, p1, p2, p6, p8, p10, p12, p15, p18, p26, p39, p5, p21, p24, p27, p34, p35, p37, p38, p40, p41, p44, p45, p47, p50, p58, p60, p62, p57, p17, p19, p30, p32, p36, p64_

---

## Eq.16 — B→zᵐBₘ(X^{(∞)}) enhanced  (Rodina p4)

**Claude claimed:** notes p7/8
**System landed 184 edges on Rodina p4 (±1) from 55 distinct notes pages.**

### Top notes pages the system chose (best edge per source page, top 6):

- **notes p51** → Rodina p3  rel=uses_definition conf=z relev=z (score=52)
  SRC: "\( P_2 \rightarrow P_2 + z q \)"
  DST: "First, each k-zero turns out to have a natural corresponding BCFW shift. For instance, for a 1-zero like \( c_{1i}=0 \), \( i\neq 2 \), the corresponding shift is \( p_2 \rightarro"
- **notes p43** → Rodina p3  rel=proves conf=u relev=z (score=47)
  SRC: "\[ X_{2n}^{(\infty)} = -2 \, q \cdot P_1 \]"
  DST: "\[ X^{(\infty)}_{2,n} = -q \cdot p_1. \quad \quad \quad (11) \]"
- **notes p46** → Rodina p3  rel=prerequisite conf=u relev=z (score=47)
  SRC: "Let \(\mathcal{B}\) be an homogeneous rational function of the \( X_i \), a function \( f(\lambda x, \lambda x, \ldots, \lambda x_n) = \lambda^n f(x, \ldots, x_n) \)"
  DST: "Here we will prove that any rational function built from planar invariants \( X_{ij} \) satisfies a zero condition if and only if it also satisfies both a “subset enhanced UV scali"
- **notes p48** → Rodina p3  rel=assumes conf=u relev=z (score=47)
  SRC: "\( B = \frac{1}{X_{13}} \) \( n = 5 \) Supers:"
  DST: "\[ B = B_m + B_{m-1} + B_{m-2} + \cdots , \quad \quad \quad (13) \] if we assume \( z^m \) is the largest scaling for any term in \( B \). Note the above is not a series expansion,"
- **notes p53** → Rodina p3  rel=prerequisite conf=z relev=u (score=47)
  SRC: "let \( B' = B - B_m = B_{m-1} + \cdots \)"
  DST: "while the leading order in \( z \) under a BCFW shift is given by \[ X^{(\infty)}_{0,j+1} = q \cdot p_1 + \sum_{i=3}^{j} q \cdot p_i, \] \[ X^{(\infty)}_{2,j+1} = \sum_{i=3}^{j} q "
- **notes p54** → Rodina p4  rel=uses_definition conf=u relev=z (score=47)
  SRC: "Start with: Figure: 6-gon with leg 1 removed, marked for matching Adding leg 1 back in all possible ways (according to color):"
  DST: "Then the D-subset corresponding to this (n−1)-point diagram is formed by adding leg 1 in all possible ways (that respect ordering and trivalent interactions)."

_…and 49 more source pages: p56, p59, p65, p7, p11, p25, p31, p42, p49, p52, p55, p61, p63, p20, p33, p1, p2, p6, p8, p10, p12, p15, p18, p26, p39, p5, p21, p24, p27, p34, p35, p37, p38, p40, p41, p44, p45, p47, p50, p58, p60, p62, p57, p17, p19, p30, p32, p36, p64_

---

## Eq.17 — Bₘ same form bridge  (Rodina p4)

**Claude claimed:** notes p7
**System landed 184 edges on Rodina p4 (±1) from 55 distinct notes pages.**

### Top notes pages the system chose (best edge per source page, top 6):

- **notes p51** → Rodina p3  rel=uses_definition conf=z relev=z (score=52)
  SRC: "\( P_2 \rightarrow P_2 + z q \)"
  DST: "First, each k-zero turns out to have a natural corresponding BCFW shift. For instance, for a 1-zero like \( c_{1i}=0 \), \( i\neq 2 \), the corresponding shift is \( p_2 \rightarro"
- **notes p43** → Rodina p3  rel=proves conf=u relev=z (score=47)
  SRC: "\[ X_{2n}^{(\infty)} = -2 \, q \cdot P_1 \]"
  DST: "\[ X^{(\infty)}_{2,n} = -q \cdot p_1. \quad \quad \quad (11) \]"
- **notes p46** → Rodina p3  rel=prerequisite conf=u relev=z (score=47)
  SRC: "Let \(\mathcal{B}\) be an homogeneous rational function of the \( X_i \), a function \( f(\lambda x, \lambda x, \ldots, \lambda x_n) = \lambda^n f(x, \ldots, x_n) \)"
  DST: "Here we will prove that any rational function built from planar invariants \( X_{ij} \) satisfies a zero condition if and only if it also satisfies both a “subset enhanced UV scali"
- **notes p48** → Rodina p3  rel=assumes conf=u relev=z (score=47)
  SRC: "\( B = \frac{1}{X_{13}} \) \( n = 5 \) Supers:"
  DST: "\[ B = B_m + B_{m-1} + B_{m-2} + \cdots , \quad \quad \quad (13) \] if we assume \( z^m \) is the largest scaling for any term in \( B \). Note the above is not a series expansion,"
- **notes p53** → Rodina p3  rel=prerequisite conf=z relev=u (score=47)
  SRC: "let \( B' = B - B_m = B_{m-1} + \cdots \)"
  DST: "while the leading order in \( z \) under a BCFW shift is given by \[ X^{(\infty)}_{0,j+1} = q \cdot p_1 + \sum_{i=3}^{j} q \cdot p_i, \] \[ X^{(\infty)}_{2,j+1} = \sum_{i=3}^{j} q "
- **notes p54** → Rodina p4  rel=uses_definition conf=u relev=z (score=47)
  SRC: "Start with: Figure: 6-gon with leg 1 removed, marked for matching Adding leg 1 back in all possible ways (according to color):"
  DST: "Then the D-subset corresponding to this (n−1)-point diagram is formed by adding leg 1 in all possible ways (that respect ordering and trivalent interactions)."

_…and 49 more source pages: p56, p59, p65, p7, p11, p25, p31, p42, p49, p52, p55, p61, p63, p20, p33, p1, p2, p6, p8, p10, p12, p15, p18, p26, p39, p5, p21, p24, p27, p34, p35, p37, p38, p40, p41, p44, p45, p47, p50, p58, p60, p62, p57, p17, p19, p30, p32, p36, p64_

---

## Eq.18 — B'=B-Bₘ cascade  (Rodina p4)

**Claude claimed:** notes p8/9
**System landed 184 edges on Rodina p4 (±1) from 55 distinct notes pages.**

### Top notes pages the system chose (best edge per source page, top 6):

- **notes p51** → Rodina p3  rel=uses_definition conf=z relev=z (score=52)
  SRC: "\( P_2 \rightarrow P_2 + z q \)"
  DST: "First, each k-zero turns out to have a natural corresponding BCFW shift. For instance, for a 1-zero like \( c_{1i}=0 \), \( i\neq 2 \), the corresponding shift is \( p_2 \rightarro"
- **notes p43** → Rodina p3  rel=proves conf=u relev=z (score=47)
  SRC: "\[ X_{2n}^{(\infty)} = -2 \, q \cdot P_1 \]"
  DST: "\[ X^{(\infty)}_{2,n} = -q \cdot p_1. \quad \quad \quad (11) \]"
- **notes p46** → Rodina p3  rel=prerequisite conf=u relev=z (score=47)
  SRC: "Let \(\mathcal{B}\) be an homogeneous rational function of the \( X_i \), a function \( f(\lambda x, \lambda x, \ldots, \lambda x_n) = \lambda^n f(x, \ldots, x_n) \)"
  DST: "Here we will prove that any rational function built from planar invariants \( X_{ij} \) satisfies a zero condition if and only if it also satisfies both a “subset enhanced UV scali"
- **notes p48** → Rodina p3  rel=assumes conf=u relev=z (score=47)
  SRC: "\( B = \frac{1}{X_{13}} \) \( n = 5 \) Supers:"
  DST: "\[ B = B_m + B_{m-1} + B_{m-2} + \cdots , \quad \quad \quad (13) \] if we assume \( z^m \) is the largest scaling for any term in \( B \). Note the above is not a series expansion,"
- **notes p53** → Rodina p3  rel=prerequisite conf=z relev=u (score=47)
  SRC: "let \( B' = B - B_m = B_{m-1} + \cdots \)"
  DST: "while the leading order in \( z \) under a BCFW shift is given by \[ X^{(\infty)}_{0,j+1} = q \cdot p_1 + \sum_{i=3}^{j} q \cdot p_i, \] \[ X^{(\infty)}_{2,j+1} = \sum_{i=3}^{j} q "
- **notes p54** → Rodina p4  rel=uses_definition conf=u relev=z (score=47)
  SRC: "Start with: Figure: 6-gon with leg 1 removed, marked for matching Adding leg 1 back in all possible ways (according to color):"
  DST: "Then the D-subset corresponding to this (n−1)-point diagram is formed by adding leg 1 in all possible ways (that respect ordering and trivalent interactions)."

_…and 49 more source pages: p56, p59, p65, p7, p11, p25, p31, p42, p49, p52, p55, p61, p63, p20, p33, p1, p2, p6, p8, p10, p12, p15, p18, p26, p39, p5, p21, p24, p27, p34, p35, p37, p38, p40, p41, p44, p45, p47, p50, p58, p60, p62, p57, p17, p19, p30, p32, p36, p64_

---

## Eq.19 — S1,S2 D-subsets  (Rodina p5)

**Claude claimed:** notes p3/4
**System landed 178 edges on Rodina p5 (±1) from 51 distinct notes pages.**

### Top notes pages the system chose (best edge per source page, top 6):

- **notes p43** → Rodina p6  rel=assumes conf=u relev=z (score=47)
  SRC: "\[ X_{i_0+1}(z) - X_{2,i_0+1}(z) + X_{2n}(z) = O(1) \]"
  DST: "This is precisely the same set of \( X_{ij} \) we found above for the zero condition! Finally we need to find all linear combinations of z-dependent \( X_{ij} \), in which the z-de"
- **notes p45** → Rodina p6  rel=proves conf=u relev=z (score=47)
  SRC: "\[ \text{(assume } i \[ (p_i + p_{i+1} + \cdots + p_{j-1})^2 \] i = 1 or i = 2"
  DST: "Since \( X_{ij}=(p_{i}+p_{i+1}+\ldots+p_{j-1})^2 \), for \( X_{ij} \) to have dependence on z, we must have \( i \leq a \leq j-1 \), otherwise the z shift cancels out."
- **notes p47** → Rodina p6  rel=assumes conf=u relev=z (score=47)
  SRC: "as \( t \to \infty \) \[ B = z^m B_m\left(X_{i}^{\infty}\right) + \mathcal{O}\left(z^{m-1}\right) \] ex: \[ B(z) = \frac{1}{X_{2_i}(z)} = \frac{1}{X_{2_i}(0) + X_{i}^{\infty} z} \]"
  DST: "Appendix A: UV scaling vs general zeros In this appendix we prove that all zeros are equivalent to enhanced scaling under some corresponding BCFW shift."
- **notes p49** → Rodina p6  rel=assumes conf=u relev=z (score=47)
  SRC: "The equations and conditions below denote important considerations in this analysis:"
  DST: "This is precisely the same set of \( X_{ij} \) we found above for the zero condition! Finally we need to find all linear combinations of z-dependent \( X_{ij} \), in which the z-de"
- **notes p51** → Rodina p6  rel=proves conf=u relev=z (score=47)
  SRC: "If \( B \) satisfies 1-zero, then it must have enhanced scaling. \( B \) satisfies zero."
  DST: "Appendix A: UV scaling vs general zeros In this appendix we prove that all zeros are equivalent to enhanced scaling under some corresponding BCFW shift."
- **notes p52** → Rodina p6  rel=assumes conf=u relev=z (score=47)
  SRC: "\( B_m \) has enhanced scaling \(\longrightarrow B_m(X_{ij}^\circ) = 0 \quad \forall \, X_{ij}^\circ \) \( X_{ij}^\circ \) satisfies the same relation, e.g."
  DST: "Appendix A: UV scaling vs general zeros In this appendix we prove that all zeros are equivalent to enhanced scaling under some corresponding BCFW shift."

_…and 45 more source pages: p54, p56, p57, p58, p59, p65, p6, p7, p25, p31, p42, p55, p61, p63, p64, p20, p33, p1, p2, p8, p12, p18, p37, p38, p39, p44, p48, p53, p3, p9, p11, p21, p24, p34, p35, p41, p50, p60, p62, p10, p19, p26, p30, p32, p36_

---

## Eq.20 — cut s_{34}  (Rodina p5)

**Claude claimed:** notes p3
**System landed 178 edges on Rodina p5 (±1) from 51 distinct notes pages.**

### Top notes pages the system chose (best edge per source page, top 6):

- **notes p43** → Rodina p6  rel=assumes conf=u relev=z (score=47)
  SRC: "\[ X_{i_0+1}(z) - X_{2,i_0+1}(z) + X_{2n}(z) = O(1) \]"
  DST: "This is precisely the same set of \( X_{ij} \) we found above for the zero condition! Finally we need to find all linear combinations of z-dependent \( X_{ij} \), in which the z-de"
- **notes p45** → Rodina p6  rel=proves conf=u relev=z (score=47)
  SRC: "\[ \text{(assume } i \[ (p_i + p_{i+1} + \cdots + p_{j-1})^2 \] i = 1 or i = 2"
  DST: "Since \( X_{ij}=(p_{i}+p_{i+1}+\ldots+p_{j-1})^2 \), for \( X_{ij} \) to have dependence on z, we must have \( i \leq a \leq j-1 \), otherwise the z shift cancels out."
- **notes p47** → Rodina p6  rel=assumes conf=u relev=z (score=47)
  SRC: "as \( t \to \infty \) \[ B = z^m B_m\left(X_{i}^{\infty}\right) + \mathcal{O}\left(z^{m-1}\right) \] ex: \[ B(z) = \frac{1}{X_{2_i}(z)} = \frac{1}{X_{2_i}(0) + X_{i}^{\infty} z} \]"
  DST: "Appendix A: UV scaling vs general zeros In this appendix we prove that all zeros are equivalent to enhanced scaling under some corresponding BCFW shift."
- **notes p49** → Rodina p6  rel=assumes conf=u relev=z (score=47)
  SRC: "The equations and conditions below denote important considerations in this analysis:"
  DST: "This is precisely the same set of \( X_{ij} \) we found above for the zero condition! Finally we need to find all linear combinations of z-dependent \( X_{ij} \), in which the z-de"
- **notes p51** → Rodina p6  rel=proves conf=u relev=z (score=47)
  SRC: "If \( B \) satisfies 1-zero, then it must have enhanced scaling. \( B \) satisfies zero."
  DST: "Appendix A: UV scaling vs general zeros In this appendix we prove that all zeros are equivalent to enhanced scaling under some corresponding BCFW shift."
- **notes p52** → Rodina p6  rel=assumes conf=u relev=z (score=47)
  SRC: "\( B_m \) has enhanced scaling \(\longrightarrow B_m(X_{ij}^\circ) = 0 \quad \forall \, X_{ij}^\circ \) \( X_{ij}^\circ \) satisfies the same relation, e.g."
  DST: "Appendix A: UV scaling vs general zeros In this appendix we prove that all zeros are equivalent to enhanced scaling under some corresponding BCFW shift."

_…and 45 more source pages: p54, p56, p57, p58, p59, p65, p6, p7, p25, p31, p42, p55, p61, p63, p64, p20, p33, p1, p2, p8, p12, p18, p37, p38, p39, p44, p48, p53, p3, p9, p11, p21, p24, p34, p35, p41, p50, p60, p62, p10, p19, p26, p30, p32, p36_

---

## Eq.21 — S1 factored  (Rodina p5)

**Claude claimed:** notes p3/4
**System landed 178 edges on Rodina p5 (±1) from 51 distinct notes pages.**

### Top notes pages the system chose (best edge per source page, top 6):

- **notes p43** → Rodina p6  rel=assumes conf=u relev=z (score=47)
  SRC: "\[ X_{i_0+1}(z) - X_{2,i_0+1}(z) + X_{2n}(z) = O(1) \]"
  DST: "This is precisely the same set of \( X_{ij} \) we found above for the zero condition! Finally we need to find all linear combinations of z-dependent \( X_{ij} \), in which the z-de"
- **notes p45** → Rodina p6  rel=proves conf=u relev=z (score=47)
  SRC: "\[ \text{(assume } i \[ (p_i + p_{i+1} + \cdots + p_{j-1})^2 \] i = 1 or i = 2"
  DST: "Since \( X_{ij}=(p_{i}+p_{i+1}+\ldots+p_{j-1})^2 \), for \( X_{ij} \) to have dependence on z, we must have \( i \leq a \leq j-1 \), otherwise the z shift cancels out."
- **notes p47** → Rodina p6  rel=assumes conf=u relev=z (score=47)
  SRC: "as \( t \to \infty \) \[ B = z^m B_m\left(X_{i}^{\infty}\right) + \mathcal{O}\left(z^{m-1}\right) \] ex: \[ B(z) = \frac{1}{X_{2_i}(z)} = \frac{1}{X_{2_i}(0) + X_{i}^{\infty} z} \]"
  DST: "Appendix A: UV scaling vs general zeros In this appendix we prove that all zeros are equivalent to enhanced scaling under some corresponding BCFW shift."
- **notes p49** → Rodina p6  rel=assumes conf=u relev=z (score=47)
  SRC: "The equations and conditions below denote important considerations in this analysis:"
  DST: "This is precisely the same set of \( X_{ij} \) we found above for the zero condition! Finally we need to find all linear combinations of z-dependent \( X_{ij} \), in which the z-de"
- **notes p51** → Rodina p6  rel=proves conf=u relev=z (score=47)
  SRC: "If \( B \) satisfies 1-zero, then it must have enhanced scaling. \( B \) satisfies zero."
  DST: "Appendix A: UV scaling vs general zeros In this appendix we prove that all zeros are equivalent to enhanced scaling under some corresponding BCFW shift."
- **notes p52** → Rodina p6  rel=assumes conf=u relev=z (score=47)
  SRC: "\( B_m \) has enhanced scaling \(\longrightarrow B_m(X_{ij}^\circ) = 0 \quad \forall \, X_{ij}^\circ \) \( X_{ij}^\circ \) satisfies the same relation, e.g."
  DST: "Appendix A: UV scaling vs general zeros In this appendix we prove that all zeros are equivalent to enhanced scaling under some corresponding BCFW shift."

_…and 45 more source pages: p54, p56, p57, p58, p59, p65, p6, p7, p25, p31, p42, p55, p61, p63, p64, p20, p33, p1, p2, p8, p12, p18, p37, p38, p39, p44, p48, p53, p3, p9, p11, p21, p24, p34, p35, p41, p50, p60, p62, p10, p19, p26, p30, p32, p36_

---

## Eq.22 — s_{1234}=-s_{2345}  (Rodina p5)

**Claude claimed:** notes p10/11/5
**System landed 178 edges on Rodina p5 (±1) from 51 distinct notes pages.**

### Top notes pages the system chose (best edge per source page, top 6):

- **notes p43** → Rodina p6  rel=assumes conf=u relev=z (score=47)
  SRC: "\[ X_{i_0+1}(z) - X_{2,i_0+1}(z) + X_{2n}(z) = O(1) \]"
  DST: "This is precisely the same set of \( X_{ij} \) we found above for the zero condition! Finally we need to find all linear combinations of z-dependent \( X_{ij} \), in which the z-de"
- **notes p45** → Rodina p6  rel=proves conf=u relev=z (score=47)
  SRC: "\[ \text{(assume } i \[ (p_i + p_{i+1} + \cdots + p_{j-1})^2 \] i = 1 or i = 2"
  DST: "Since \( X_{ij}=(p_{i}+p_{i+1}+\ldots+p_{j-1})^2 \), for \( X_{ij} \) to have dependence on z, we must have \( i \leq a \leq j-1 \), otherwise the z shift cancels out."
- **notes p47** → Rodina p6  rel=assumes conf=u relev=z (score=47)
  SRC: "as \( t \to \infty \) \[ B = z^m B_m\left(X_{i}^{\infty}\right) + \mathcal{O}\left(z^{m-1}\right) \] ex: \[ B(z) = \frac{1}{X_{2_i}(z)} = \frac{1}{X_{2_i}(0) + X_{i}^{\infty} z} \]"
  DST: "Appendix A: UV scaling vs general zeros In this appendix we prove that all zeros are equivalent to enhanced scaling under some corresponding BCFW shift."
- **notes p49** → Rodina p6  rel=assumes conf=u relev=z (score=47)
  SRC: "The equations and conditions below denote important considerations in this analysis:"
  DST: "This is precisely the same set of \( X_{ij} \) we found above for the zero condition! Finally we need to find all linear combinations of z-dependent \( X_{ij} \), in which the z-de"
- **notes p51** → Rodina p6  rel=proves conf=u relev=z (score=47)
  SRC: "If \( B \) satisfies 1-zero, then it must have enhanced scaling. \( B \) satisfies zero."
  DST: "Appendix A: UV scaling vs general zeros In this appendix we prove that all zeros are equivalent to enhanced scaling under some corresponding BCFW shift."
- **notes p52** → Rodina p6  rel=assumes conf=u relev=z (score=47)
  SRC: "\( B_m \) has enhanced scaling \(\longrightarrow B_m(X_{ij}^\circ) = 0 \quad \forall \, X_{ij}^\circ \) \( X_{ij}^\circ \) satisfies the same relation, e.g."
  DST: "Appendix A: UV scaling vs general zeros In this appendix we prove that all zeros are equivalent to enhanced scaling under some corresponding BCFW shift."

_…and 45 more source pages: p54, p56, p57, p58, p59, p65, p6, p7, p25, p31, p42, p55, p61, p63, p64, p20, p33, p1, p2, p8, p12, p18, p37, p38, p39, p44, p48, p53, p3, p9, p11, p21, p24, p34, p35, p41, p50, p60, p62, p10, p19, p26, p30, p32, p36_

---

## Eq.23 — momentum identity  (Rodina p5)

**Claude claimed:** notes p4/5
**System landed 178 edges on Rodina p5 (±1) from 51 distinct notes pages.**

### Top notes pages the system chose (best edge per source page, top 6):

- **notes p43** → Rodina p6  rel=assumes conf=u relev=z (score=47)
  SRC: "\[ X_{i_0+1}(z) - X_{2,i_0+1}(z) + X_{2n}(z) = O(1) \]"
  DST: "This is precisely the same set of \( X_{ij} \) we found above for the zero condition! Finally we need to find all linear combinations of z-dependent \( X_{ij} \), in which the z-de"
- **notes p45** → Rodina p6  rel=proves conf=u relev=z (score=47)
  SRC: "\[ \text{(assume } i \[ (p_i + p_{i+1} + \cdots + p_{j-1})^2 \] i = 1 or i = 2"
  DST: "Since \( X_{ij}=(p_{i}+p_{i+1}+\ldots+p_{j-1})^2 \), for \( X_{ij} \) to have dependence on z, we must have \( i \leq a \leq j-1 \), otherwise the z shift cancels out."
- **notes p47** → Rodina p6  rel=assumes conf=u relev=z (score=47)
  SRC: "as \( t \to \infty \) \[ B = z^m B_m\left(X_{i}^{\infty}\right) + \mathcal{O}\left(z^{m-1}\right) \] ex: \[ B(z) = \frac{1}{X_{2_i}(z)} = \frac{1}{X_{2_i}(0) + X_{i}^{\infty} z} \]"
  DST: "Appendix A: UV scaling vs general zeros In this appendix we prove that all zeros are equivalent to enhanced scaling under some corresponding BCFW shift."
- **notes p49** → Rodina p6  rel=assumes conf=u relev=z (score=47)
  SRC: "The equations and conditions below denote important considerations in this analysis:"
  DST: "This is precisely the same set of \( X_{ij} \) we found above for the zero condition! Finally we need to find all linear combinations of z-dependent \( X_{ij} \), in which the z-de"
- **notes p51** → Rodina p6  rel=proves conf=u relev=z (score=47)
  SRC: "If \( B \) satisfies 1-zero, then it must have enhanced scaling. \( B \) satisfies zero."
  DST: "Appendix A: UV scaling vs general zeros In this appendix we prove that all zeros are equivalent to enhanced scaling under some corresponding BCFW shift."
- **notes p52** → Rodina p6  rel=assumes conf=u relev=z (score=47)
  SRC: "\( B_m \) has enhanced scaling \(\longrightarrow B_m(X_{ij}^\circ) = 0 \quad \forall \, X_{ij}^\circ \) \( X_{ij}^\circ \) satisfies the same relation, e.g."
  DST: "Appendix A: UV scaling vs general zeros In this appendix we prove that all zeros are equivalent to enhanced scaling under some corresponding BCFW shift."

_…and 45 more source pages: p54, p56, p57, p58, p59, p65, p6, p7, p25, p31, p42, p55, p61, p63, p64, p20, p33, p1, p2, p8, p12, p18, p37, p38, p39, p44, p48, p53, p3, p9, p11, p21, p24, p34, p35, p41, p50, p60, p62, p10, p19, p26, p30, p32, p36_

---
