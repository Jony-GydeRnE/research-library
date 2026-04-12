# Analysis: Why Specific Equations Appear to Miss — No Code, Just Logic and Data

Written 2026-04-11 at the user's request. Examines why notes p40/42/43 (eq.9-11), p57-59 (eq.14), and p51-53 (eq.15-18) may appear to miss their Rodina targets. Also examines the procedural logic, code flow, and micro-LLM prompt behavior that governs whether an edge gets created.

---

## 1. Notes p40, p42, p43 → Rodina eq.9-11 (X_{ij} types, X⁰, X∞ on Rodina p3)

### Do the edges exist?

**Yes.** The system DOES have edges from all three pages to Rodina p3 (±1).

Key evidence from `ground-truth-inverse-view.md`, Eq.10 and Eq.11 entries:

| source | target | rel | conf/relev | |
|---|---|---|---|---|
| **notes p43** → **Rodina p3** | `X_{2n}^{(∞)} = -2 q·P₁` → `X^{(∞)}_{2,n} = -q·p₁ (11)` | proves | u/z | **BULLSEYE for eq.11** — verbatim equation match |
| **notes p40** → **Rodina p2** | `Pick pᵢ, pⱼ... Send pᵢ→pᵢ+zq` → BCFW shift eq.(4) | proves | u/z | Correct content but lands on **p2 not p3** — see below |
| notes p42 | in the "51 more source pages" pool for Rodina p3 | — | lower score | Edge exists but didn't make the top 6 in the report |

### Why did the verification report say "EDGE MISSING" for eq.9-11?

**Because the verification script checked Claude's claimed pages (p13/14), not the user's pages (p40/42/43).** Claude's ground-truth table said p13-14 contain the eq.9-11 content. It doesn't. p13 is 5-point Mandelstam expansions, p14 is polar coordinates. The script correctly found "no edge from p13/14 to Rodina p3" and marked it MISSING. This is a ground-truth table bug, not a system bug.

If the script had checked p40/42/43 instead, it would have found the edges and marked them COVERED.

### Why does p40 land on Rodina p2 instead of p3?

This is the interesting structural question. Notes p40 contains BCFW shift definitions: `Pick pᵢ, pⱼ among the external momenta... Send pᵢ→pᵢ+zq, pⱼ→pⱼ-zq`. This is the SAME notation used in both:

- **Rodina p2 i24** (eq.4 — the BCFW shift definition): `pᵢ → pᵢ+zq, pⱼ → pⱼ-zq, (4), with pᵢ·q = pⱼ·q = q² = 0`
- **Rodina p3 i43** (eq.9 — which X_{ij} are affected by the shift): "the only X_{ij} affected by either the related shift or the zero are of three possible types..."

The picker sees 12 candidate chunks from Rodina. Both the p2 BCFW definition and the p3 "affected X_{ij}" chunk are in the candidate pool. But the **cosine similarity between "pᵢ→pᵢ+zq" and the p2 BCFW definition is higher** than between "pᵢ→pᵢ+zq" and the p3 "three types of X_{ij}" chunk, because the p2 chunk uses the exact same notation verbatim. The p3 chunk doesn't mention the shift directly — it talks about WHICH variables are affected.

This is a **resolution granularity problem**: notes p40 has BOTH the shift definition AND the "which X_{ij} are affected" derivation, but the vision-processed chunks split them. The shift-definition chunk (i405) embeds to p2 BCFW, and the affected-invariants chunk (probably i410ish — on the same page but different chunk index) should embed to p3. The per-chunk matching can't see that both belong to a single derivation.

**Why p43 succeeds where p40 doesn't for eq.11:** p43 contains the actual result equation `X_{2n}^{(∞)} = -2q·P₁`, which is close to Rodina p3's eq.(11) `X^{(∞)}_{2,n} = -q·p₁`. The notation is sufficiently similar that cosine ranking puts the p3 eq.11 chunk above the p2 BCFW chunk. The picker correctly picks the p3 target.

**Why p42 is lower-scored:** likely p42 contains intermediate derivation steps rather than the result equations. Intermediate steps are harder for the picker to route because they don't contain the recognizable "punch-line" notation that the paper's equation chunks have.

### Procedural root cause (code flow)

The funnel in `services/noteIngestionService.js` matchNotesToSourceBooks does:

1. For each note chunk, compute cosine similarity against ALL source-paper chunks.
2. Take top 25 by cosine.
3. Send top 12 to GPT-4o-mini picker.
4. Picker picks one and returns `<chunk_letter><relationship><confidence><relevance>`.

The picker sees each note chunk **independently** — it doesn't see "this chunk is on the same page as the BCFW shift chunk you just processed." So when it sees the shift-definition chunk (i405) from p40, it picks the p2 BCFW definition. When it sees the result-equation chunk (from p43), it picks the p3 eq.11 chunk. This is actually correct per-chunk behavior. The issue is that the USER thinks of "notes p40-43" as a single derivation that should ALL land on eq.9-11, but the system processes each chunk independently and some chunks embed better to the definition (p2) than to the consequence (p3).

### Prompt-level explanation

The `edge-pick.txt` prompt says: "Section header chunks (texts starting with '3.1 X' or 'Theorem 1') are CANONICAL citation targets... prefer theorem / definition structural types."

This is exactly what happens: the p2 BCFW definition chunk IS a canonical target for notation like `pᵢ→pᵢ+zq`. The prompt doesn't say "prefer the target where the SOURCE's derivation CONCLUDES" — it says "prefer where the cited concept is INTRODUCED." For a BCFW shift, that's p2. The X_{ij} consequences on p3 are downstream, not the introduction point.

This is a **defensible but imperfect** design choice. The user's mental model is "my notes derive eq.9-11 so they should land on eq.9-11," but the picker's mental model is "the source chunk uses BCFW notation, so it should land where BCFW notation is defined." Both are valid; they just disagree on the RESOLUTION point.

---

## 2. Notes p57-59 → Rodina eq.14 (three equivalences, Rodina p4)

### Do the edges exist?

**Yes.** The inverse view for Eq.14 shows:

> System landed 184 edges on Rodina p4 (±1) from 55 distinct notes pages.

And p57, p58, p59 are all in the extended source-page list for edges landing on Rodina p4 (±1).

The best edge from **p57 → Rodina p6** (not p4): notes p57 i584 "Let X_{i,j}^{∞} denote the coefficient of the largest power of z appearing in X_{i,j}(z)" → Rodina p6 i89 z-dependence condition. This is uses_definition conf=z relev=z. The picker routes p57 to the Appendix A proof on p6 rather than the theorem statement on p4 because the notation `X^{∞}` is more verbatim-similar to the Appendix A content.

The best edge from **p58 → Rodina p6** (not p4) similarly: notes p58 contains B(X) decomposition content that the picker routes to the Appendix A's UV-scaling discussion.

The best edge from **p59 → Rodina p3**: notes p59 i597 `[example]` "B is a rational function and m is the largest power..." → Rodina p3 i52 "any rational function built from planar invariants X_{ij}..." This IS the eq.14 neighborhood (p3-4 has the core theorem), landing at score u/z.

So **p59 hits eq.14 territory, but p57/58 get pulled to p6 Appendix A** because their notation matches the Appendix more closely than the theorem statement. Same resolution-granularity issue: the Appendix proves what the theorem states, and a derivation chunk containing `X^{∞}` notation embeds closer to the proof (which uses `X^{∞}` throughout) than to the theorem statement (which summarizes the result in prose).

### Why the split between p3-4 and p6

Rodina's paper has two places where the same equivalence appears:

- **p3-4**: the theorem statement + initial proof ("we will prove that any rational function... satisfies a zero condition iff it also satisfies both a subset enhanced UV scaling and a subset zero")
- **p6** (Appendix A): the detailed proof ("In this appendix we prove that all zeros are equivalent to enhanced scaling under some corresponding BCFW shift")

The system correctly identifies both as valid targets. Your notes p57-59 contain the detailed derivation, which notation-matches the detailed proof (p6) better than the theorem statement (p3-4). This is actually CORRECT behavior — the derivation-style content should land where the derivation lives in the paper.

The benchmark item for eq.14 targets Rodina p4 specifically, but the system routes the derivation to p6 where the equivalent proof is. Both p4 and p6 discuss the same theorem; the benchmark just happens to index by the theorem-statement page rather than the proof page.

---

## 3. Notes p51, p52, p53 → Rodina eq.15-18 (B-cascade / enhanced scaling, Rodina p4)

### Do the edges exist?

**Yes — these are among the BEST edges in the entire graph.** From the 93.8% edge audit (`edges-93pct-themed.md`) and the inverse view:

| source | target | rel | conf/relev | verdict |
|---|---|---|---|---|
| **notes p51 i513** "B is an homogeneous rational function of the Xᵢ. Collect B into subterms depending on how they scale under the shift:" | **Rodina p3 i53** "Take B any homogenous rational function of Xᵢⱼ... Collect in subsets Bₗ all individual terms of B that under the shift..." | uses_definition | r/z | **VERBATIM BULLSEYE** — the two passages describe the same decomposition word-for-word |
| **notes p51 i516** "where Bₘ contains all terms that scale like zᵐ (as z→∞). Prop." | **Rodina p6 i84** Appendix A UV scaling vs zeros | proves | r/z | ✅ Correct — the proposition statement → the proof |
| **notes p51** → Rodina p3 | `P₂ → P₂ + zq` → "each k-zero turns out to have a natural corresponding BCFW shift" | uses_definition | **z/z** | **Top-scored** edge for the p3 group |
| **notes p52 i540** "Bₘ has enhanced scaling → Bₘ(Xᵢⱼ°)=0 ∀ Xᵢⱼ°..." | **Rodina p6 i84** Appendix A | assumes | z/s at 82%, u/z at 93% | ✅ Bullseye |
| **notes p53 i542** "Bₘ(X*ⱼ)=0 ∀ X^Λ_ν, Bₘ satisfies 1-zero" | **Rodina p2 i28** "1-zero: c_{i1}=0 for i∈{3..n-1}..." | uses_definition | z/u | ✅ Bullseye |
| **notes p53 i549** `[definition]` "let B' = B - Bₘ = Bₘ₋₁ + ..." | **Rodina p3 i54** "B = Bₘ + Bₘ₋₁ + Bₘ₋₂ + ... (13)" | uses_definition | r/z | ✅ **BULLSEYE for eq.13 → cascade** |

**These are the crown jewel of the entire edge graph.** The system hits Rodina p3 i52/i53/i54 (the eq.13/14/15 theorem body) AND Rodina p6 i84 (the Appendix A proof) with high confidence from notes p51/52/53. Every major equation in the B-cascade (eq.13-18) has at least one bullseye edge originating from this page cluster.

The only nuance: some edges land on Rodina p3 (theorem statement) while others land on p6 (Appendix A proof). The benchmark scorer counts BOTH as correct when using TW=1 (which tolerates ±1 page). At TW=0 strict, the p6-landing edges are PARTIAL for items targeting p4, but they're genuinely good matches — just to the proof instead of the theorem.

---

## 4. Summary: what's really happening and what's a ground-truth-table artifact

### Edges that genuinely exist and the system is correct about:

| User's claim | System's finding | Notes |
|---|---|---|
| p43 explains eq.11 (X∞ values) | ✅ p43 → Rodina p3 with VERBATIM eq.11 match | The benchmark scored this as COVERED in the 93.8% run |
| p51/52/53 explain eq.15-18 (B-cascade) | ✅ Multiple bullseye edges from all three pages | Top-scored edges in the entire graph |
| p57-59 explain the eq.14 proof | ✅ Edges exist, but land on Rodina p6 (Appendix A proof) not p4 (theorem statement) | Both discuss the same theorem — p6 is the proof, p4 is the statement |

### Why things APPEAR to miss when they don't:

1. **The ground-truth verification script checked Claude's wrong page numbers (p13/14 for eq.9-11), not the user's correct page numbers (p40/42/43).** This made eq.9/10/11 look like EDGE MISSING when they're actually EDGE EXISTS.

2. **The benchmark scorer (score_benchmark.js) uses its own notes-page expectation column (NW=2 window around a reference page, e.g. p45).** Notes p43 falls within the p45±2 window and is COVERED. But notes p40 falls OUTSIDE p45±2 and is PARTIAL — even though p40 content about BCFW shifts is genuinely relevant to eq.9.

3. **The picker routes derivation steps to where the notation is DEFINED (often Rodina p2 BCFW or p6 Appendix A) rather than to where the CONSEQUENCE is stated (Rodina p3-4 theorem).** This is structurally correct from a citation-target perspective but disagrees with the user's mental model of "my derivation of eq.X should land on eq.X."

### Procedural and prompt-level reasons for the routing behavior:

**Code flow** (`services/noteIngestionService.js` direction 1):
- Each notes chunk is matched INDEPENDENTLY. There's no "page-level coherence" step that says "all chunks on notes p40 should prefer the same Rodina target." If two chunks on the same page embed to different Rodina pages, each gets its own edge. This is by design (the funnel is chunk-level) but it means a multi-step derivation spanning chunks i405-i415 might split across Rodina p2 and p3.

**Cosine ranking** (`services/funnelService.js` layer 2):
- Top-25 candidates are ranked by cosine similarity to the source chunk's embedding. A BCFW shift notation chunk (`pᵢ→pᵢ+zq`) embeds closer to Rodina's BCFW definition (p2 i24) than to the "affected invariants" taxonomy (p3 i43), because the embedding model (text-embedding-3-small) is sensitive to verbatim notation overlap. The p3 chunk discusses CONSEQUENCES of the shift in different notation, which cosine ranks lower.

**Picker prompt** (`prompts/edge-pick.txt`):
- "Section header chunks are CANONICAL citation targets" + "prefer theorem / definition structural types" = the picker is biased toward where a concept is INTRODUCED, not where its consequences are worked out. For a notes chunk containing BCFW shift notation, the canonical target is the BCFW definition (p2), not the downstream X_{ij} analysis (p3).
- The NOTES-SOURCE SPECIAL RULE says "pick the relationship that describes what the target chunk provides TO the note." For a shift-notation chunk, the BCFW definition PROVIDES the notation the note is using → `uses_definition` to p2. The "affected X_{ij}" chunk USES the notation but provides a DIFFERENT concept (the taxonomy of affected variables). The prompt doesn't have a rule for "prefer the chunk that is the GOAL of the derivation" — it prefers the chunk that SOURCED the notation.

**What would fix the routing for eq.9-11 specifically:**
- A "derivation-goal" heuristic: if a sequence of notes chunks on the same page starts with notation definitions and ends with a result equation, route the RESULT chunk to the paper's corresponding result, and route the definition chunks to the paper's definition. This requires page-level chunk grouping, which the current per-chunk-independent flow can't do.
- Alternatively: widen the benchmark NW window to ±5 for items like eq.9-11 where the notes derivation spans p40-43 but the benchmark expects p45. At NW=5, p40 is WITHIN the window and these items score as COVERED. This is the simplest fix to the BENCHMARK METRIC without changing the system.

---

## 5. Candidate future actions (not done yet, per user's "no code" instruction)

1. **Fix the benchmark scorer's notes-page expectation for eq.9-11.** The current benchmark expects notes p45 (from the original 81-item gap map). If the user confirms that the real notes content for eq.9-11 is on p40/42/43, update the benchmark's `notePages` column for items 14/15/16 to `[40, 42, 43]`. This is a 3-line edit in `scripts/score_benchmark.js`.

2. **Consider page-level edge grouping.** Instead of routing each chunk independently, group consecutive chunks on the same notes page into a "derivation unit" and route the unit to the Rodina chunk that best matches the unit's CONCLUSION. This is architecturally more complex but would fix the p40 → p2 routing issue.

3. **Add a prompt rule for derivation-conclusion preference.** Something like: "If the source contains step-by-step algebraic manipulation leading to a result, prefer the candidate that contains the RESULT rather than the one that contains the STARTING notation." This would be a single-paragraph addition to `edge-pick.txt` and might shift the p40 routing from p2 to p3 without architectural changes.
