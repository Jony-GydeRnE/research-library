# Metadata Logic — How Spans and Chunks Get Built, in English

Written 2026-04-12. Research-only pass. No code changes in this document. Its purpose is to explain, step by step, how a PDF page becomes the chunks/spans/tags/edges you see in the Chunks reader mode, so you can reason about *why* the current output looks the way it does (mostly 1-span chunks, orphaned context like "these novel perspectives", dense sentences that should produce 4-5 spans becoming 1).

For every stage I name the file, the function, and the line range, translate the code into plain English, and quote the relevant prompt verbatim so you can see what the LLM was actually asked to do. At the end there is a diagnosis mapping each observed defect to the specific place in the pipeline that causes it.

---

## 0. The seven-stage pipeline

A PDF goes through seven stages, each owned by a different service. Only stages 3 and 4 produce spans/chunks; everything before sets them up, everything after consumes them.

```
1.  pdfService      — PDF file -> raw text per page (pdf-parse / pdfjs)
2.  visionService   — PDF page image -> HTML per page (GPT-4o vision)
3.  spanService     — page text/HTML -> numbered sentences -> LLM DSL -> Span docs
4.  chunkService    — Span docs -> grouped -> Chunk docs (with sourceText)
5.  embeddingService — chunk & span text -> OpenAI embeddings
6.  funnelService   — spans+chunks -> cosine -> picker LLM -> Edge docs
7.  noteIngestionService — notes PDFs -> matched against source paper chunks -> Edge docs
```

**Key conceptual point.** Spans are made *before* chunks. A span is not a piece of a chunk — a chunk is the *assembly* of already-existing spans. The LLM is never asked "here's a chunk, decompose it into spans". It is asked "here are numbered sentences of a page, emit one DSL line per span". The chunker then groups consecutive spans into chunks using structural rules. This ordering will matter when we diagnose the defects.

---

## 1. Stage 2 — Vision to HTML (`services/visionService.js`, `services/htmlService.js`)

### What happens
`visionService.convertPageWithVision()` renders a PDF page to PNG, sends it to GPT-4o with a prompt telling it to output an HTML block for the page that preserves LaTeX in `\(...\)` / `\[...\]` form, wraps paragraphs in `<p>`, and normalizes display equations. It returns **one HTML string per page** — that's the whole output. No sentence-level segmentation, no chunk boundaries, no span annotations. Just HTML.

`htmlService.convertPageToHtml()` is the non-vision fallback. It splits raw text on blank lines, wraps the results in `<p>` tags, and wraps `$...$` as inline math. Again, one HTML block per page. No sentence splitting.

### Why it matters for the defects you're seeing
**The vision stage carries no semantic structure forward.** It produces a flat paragraph-and-equation stream. Every semantic decision downstream — what is a span, what is a chunk, whether a pronoun has an antecedent — happens in stages 3 and 4 working from this flat text. If the page has a strong conceptual break in the middle, nothing in the vision output records that fact; the sentence splitter in stage 3 has to re-discover it.

---

## 2. Stage 3 — Span Generation (`services/spanService.js`)

This is the stage where "what is the semantic unit" is decided. It's also the stage where the one-span-per-sentence pattern you're seeing originates.

### 2.1 Sentence numbering — `numberSentences()` (lines 107-114)

The function takes page text and splits on a single regex:

```js
text.split(/(?<=\.)\s+|\n\n+/).filter(s => s.trim())
```

In English: split whenever a period is followed by whitespace, **or** on blank lines. Then filter out anything that's only whitespace. Number the survivors 1, 2, 3, ... and build a string like:

```
[1] The Lagrangian is L = ...
[2] Applying the Euler-Lagrange equations gives ...
[3] We use the Mandelstam variables ...
```

This numbered string is what gets handed to the LLM, and the indices `[1]`, `[2]`, `[3]` are the `sentenceStart` / `sentenceEnd` fields you see in Span documents. **The units are "sentences on this page", 1-indexed.**

**This is the first point where your defect is seeded.** The splitter is deliberately simple. It does two things wrong for math/physics text:

- **It treats every period-space as a sentence boundary.** So "L = (1/2) m s_dot_r^2" is one sentence, but if a chunk has three such equations in a row, they become three separately-numbered sentences — and since each sentence becomes its own span (see 2.3 below), you get three 1-span chunks in a row.
- **It has no concept of "semantic unit" above the sentence level.** A paragraph that builds one idea over five sentences becomes five numbered sentences, and the LLM-plus-chunker will then usually produce five single-sentence spans and split them into multiple chunks (see 3.2 below on `CHUNK_MAX_SPANS=3`).

There is no LaTeX protection in the splitter, but for the data we looked at that's not the main bug — the main bug is that period-space is too fine a boundary for dense physics prose.

### 2.2 Session state and the two prompts (lines 57-76)

The system keeps a running "session" counter of how many pages have been span-annotated in a row. On page 0 it uses the **full prompt** (`span-generation-full.txt`, 209 lines of instructions + ~20 worked examples). On every subsequent page up to `SPAN_SESSION_MAX_PAGES = 8` it uses the **short prompt** (`span-generation-short.txt`, 99 lines). Then it resets. The theory is that the LLM remembers the format from the full prompt and can run on the short prompt for a while to save tokens.

This is also why there's a quality gate (see 2.5) — after a few pages on the short prompt, the model tends to drift: it stops emitting tags, stops emitting role, and produces lines that are just a bare sentence range. If the fraction of such "junk" lines crosses `SPAN_MIN_ENRICHED_RATIO = 0.5`, the page is retried with the full prompt.

**Why this matters for your defect.** The drift problem is real and I can see why the quality gate was needed. But notice what neither prompt tells the model: neither prompt tells it to emit *multiple spans for the same sentence*. Both prompts say "one line per span" and treat each line as a per-sentence annotation. We'll come back to this.

### 2.3 The DSL and the parser — `parseSpanOutput()` (lines 122-252)

The LLM is asked to output one line per span, formatted as:

```
SENTENCE_RANGE CONTEXT_TAGS ROLE_TAG [DECLARATIVE_TAGS] [SEARCH_CLASS]
```

e.g. `2 euler_lagrange_equations result Lv`.

The parser reads the output line by line. For each line:

1. Take the first token as the sentence range. If it's `"5"`, the span covers sentence 5 only. If it's `"1-3"`, the span covers sentences 1, 2, 3 (inclusive).
2. Walk the remaining tokens. Tokens matching `/^[LISB][a-z]?$/` are search-class tags (`Ld`, `Lv`, `Lp`, `Iv`, `Br`, bare `S`). Tokens matching `/^[pacerqskxdv]\d+(\.\d+)?$/` are declarative tags (`p14.3`, `r7.2`). Tokens that are exactly one of 14 known role names (`claim`, `background`, `definition`, `proof`, ...) are the role. Everything else matching `/^[a-z][a-z0-9_]*$/` is a context tag.
3. Create **one Span document** with `sentenceStart`, `sentenceEnd`, `contextTags` (a flat array), `role`, `declarativeTags`, `searchClass`, `gapType`.

**This is the second and most important point where your defect is structurally enforced.** Notice the shape: one DSL line becomes exactly one Span document. There is no mechanism by which the parser could produce two spans for the same sentence range from one DSL line. In principle the LLM *could* output two lines both starting with `1` and the parser would dutifully create two span documents both with `sentenceStart=sentenceEnd=1` — but neither prompt asks for this, and nothing downstream merges or deduplicates them.

### 2.4 Materializing `spanText` — `runSpanLLMCall()` (lines 263-288)

After the parser produces the Span-ready objects (with indices but no text), the service slices the numbered-sentences array to fill in `spanText`:

```js
const start = Math.max(0, (s.sentenceStart || 1) - 1);
const end   = Math.min(sentences.length, s.sentenceEnd || s.sentenceStart || 1);
s.spanText = sentences.slice(start, end).map(x => x.text).join(' ').trim();
```

So if the LLM emitted `2 euler_lagrange_equations result Lv`, the parser produces a span with `sentenceStart=sentenceEnd=2`, and then this code copies sentence [2] of the page text verbatim into `spanText`. **That's why `span.spanText` is never truncated or reformatted — it is always whole sentences lifted from the page text by index.**

### 2.5 The quality gate — `isSpanEnriched`, `enrichmentRatio` (lines 78-99)

A span is "enriched" if it has at least one of: a context tag, a role, a declarative tag, or a non-N search class. A page is retried with the full prompt if fewer than half its spans are enriched. This is a drift-recovery mechanism, not a semantic quality mechanism. A page where every span is a single sentence with one generic tag and no gap markers will pass the gate even if it's semantically thin.

### 2.6 The full prompt — `prompts/span-generation-full.txt` (verbatim, condensed to the relevant parts)

Lines 1-3 set the contract:
> You are annotating academic text with structured span tags. For each group of sentences, output one line in this compressed DSL format:
> `SENTENCE_RANGE CONTEXT_TAGS ROLE_TAG [DECLARATIVE_TAGS] [SEARCH_CLASS]`

Lines 5-6 define the unit:
> Sentence range: "1-3" or just "5" (1-indexed within the chunk)
> Context tags (lowercase_underscored): concept labels. Examples: free_propagator, amplitude_zeros, zariski_topology

Lines 40-46 are the quality rules for context tags:
> - **SPECIFICITY**: tag each span with what THAT SENTENCE is actually about, not the broad topic of the surrounding section. [...] Avoid putting the same broad tag on every span in a chunk — distinct sentences should have distinct tags. Tags drive the edge graph, and every distinct concept needs its own anchor.
> - **NORMALIZATION**: pick one canonical name per concept.

Lines 48-65 are the "aggressive gap detection" section that tells the LLM to tag missing definitions, missing derivations, and missing proofs with `Ld` / `Lv` / `Lp`. This is the rule the prompt considers most important:

> - **AGGRESSIVE GAP DETECTION (the most important rule in this prompt):**
>     For every equation, result, claim, definition, or derivation step that is stated without full justification IN THIS PAGE, add an L-class tag with a TYPE letter:
>         Ld = missing definition (uses a concept without defining it)
>         Lv = missing derivation (states a result without showing the steps)
>         Lp = missing proof (asserts without proving)
> [...]
> EVERY chunk should produce AT LEAST one L-tag UNLESS the chunk is purely self-contained

And the examples — lines 99-110:
```
Example input:
[1] Let k be an algebraically closed field.
[2] An affine n-space over k is the set of all n-tuples of elements of k.
[3] Definition 1.1: An affine algebraic variety is the set of common zeros of a collection of polynomials.
[4] The Zariski topology is defined by taking closed sets to be the algebraic varieties.
[5] This is well-known; see [Hart77, Ch. II] for details.

Example output:
1-2 algebraically_closed_field affine_space background
3 affine_algebraic_variety definition
4 zariski_topology definition
5 zariski_topology citation S
```

And lines 153-161:
```
Example input (Rodina-style — terms used without definition):
[1] We consider Tr(φ³) ordered amplitudes A(1,2,…,n) written in terms of planar invariants Xᵢⱼ.
[2] The Mandelstam invariants sᵢⱼ = (pᵢ+pⱼ)² and the non-planar invariants cᵢⱼ also play a role.
[3] These objects form a complete basis for the kinematic space.

Example output:
1 tr_phi3_amplitudes color_ordering planar_invariants definition Ld Ld
2 mandelstam_invariants nonplanar_invariants definition Ld Ld
3 kinematic_basis claim Lp
```

**Read that last example carefully.** Sentence [1] contains three distinct concepts — `tr_phi3_amplitudes`, `color_ordering`, `planar_invariants`. The example answer treats them as **one span with three context tags**, not as three separate spans. *This is the pattern the LLM is being trained to imitate.* The prompt explicitly puts multiple concepts into a single span as a flat array of tags. There is no example anywhere in either prompt that demonstrates emitting two DSL lines for one sentence to split it into multiple concept-specific spans.

Compare this to your observation about "Tree amplitudes are rational functions of Lorentz invariant dot products of momenta" — you want that to become 4-5 spans. The prompt tells the model to produce one span with 4-5 context tags instead. That's exactly what you're seeing in the data.

### 2.7 The short prompt — `prompts/span-generation-short.txt` (verbatim, relevant parts)

Line 1 — the contract:
> Continue annotating in the compressed DSL format. **One line per span.**

The short prompt says "one line per span" directly. Same bias reinforced more compactly.

---

## 3. Stage 4 — Chunk Derivation (`services/chunkService.js`)

### 3.1 `generateChunksForBook()` (lines 102-197)

In English: load all spans for the book, sort by `(pageNumber, sentenceStart)`, then walk through them and decide for each consecutive pair whether to start a new chunk or extend the current one. The decision is made by `shouldBreakChunk()`.

### 3.2 `shouldBreakChunk()` (lines 48-83) — **this is where 1-span chunks are born**

Translated to English, in priority order:

1. **Empty current group** → don't break (no chunk to break from).
2. **Different page** → always break. Chunks cannot cross page boundaries.
3. **Structural boundary from page regex annotations** → break, but with an exception for proof following a theorem/definition (they stay together).
4. **Gap of more than 3 sentences** between the last span's end and the next span's start → break. This is supposed to catch blank lines or section breaks.
5. **Current group already has 3 spans** (`CHUNK_MAX_SPANS = 3`) → break. This is the hard cap.
6. **If the next span has any declarative tags AND `CHUNK_SPLIT_ON_DECLARATIVE` is enabled (it is, true by default)** → break. Any span that claims to prove, assume, contradict, extend, etc. something gets its own chunk.
7. **If the next span has a non-N search class AND `CHUNK_SPLIT_ON_SEARCH_CLASS` is enabled (it is, true by default)** → break. Any span flagged as a gap (`L`), internal ref (`I`), external citation (`S`), or broad search (`B`) gets its own chunk.

**Rules 6 and 7 are the direct mechanical cause of your "1-span chunk" complaint.** Here's why: the full prompt (§2.6 above) tells the LLM that *EVERY chunk should produce AT LEAST one L-tag*. So almost every span the LLM generates in physics-heavy text ends up with some search-class letter on it — `Ld`, `Lv`, `Lp`, `Br`, `S`. And then the chunker reads rule 7 and says "this span has a non-N search class, break into its own chunk." The result: most spans become 1-span chunks *because the prompt succeeded at aggressive gap tagging*. The two systems are in direct tension:

- The prompt wants dense gap-tagging on every sentence.
- The chunker wants to break on every gap-tagged span.
- Combined: chunk = span = sentence. You never get a chunk that groups related sentences together.

This also explains why a paragraph that builds one idea over five sentences produces 5 chunks of 1 span each. Each sentence gets a search class, each search-classed span triggers rule 7, each rule-7 break produces a new 1-span chunk.

### 3.3 `inferStructuralType()` (lines 17-43)

After the spans are grouped, the chunker picks a structural type:

- If any span has a context tag matching `theorem`, `definition`, `proof`, `example`, `remark`, `lemma`, `notation`, or `equation` → that's the type.
- Otherwise check the page's regex annotations for a structural kind overlapping this span range.
- Otherwise default to `narrative`.

**"Narrative" is the residue, not a decision.** It's what a chunk gets when no span told the chunker what kind of chunk this is. Most chunks are narrative by default. Your intuition — "whether definition, theorem, or narrative, that seems more like a tag" — matches what the code actually does. The structural type already *is* derived from span tags; the chunker just reads the tags and surfaces one of them as the `structuralType` field. Making `narrative` a regular tag rather than a special field would be a one-line semantic change.

### 3.4 `getSourceText()` (lines 88-97)

Builds the chunk's text by slicing `page.rawText` with the same sentence-splitter used in span numbering:

```js
const sentences = page.rawText.split(/(?<=\.)\s+|\n\n+/).filter(s => s.trim());
const start = Math.max(0, sentenceStart - 1);
const end = Math.min(sentences.length, sentenceEnd);
return sentences.slice(start, end).join(' ').trim();
```

**This guarantees index alignment** — the chunk's `sourceText` is assembled from the same numbered sentences the spans refer to. So `chunk.sourceText` and the sum of `span.spanText` always cover the same sentences.

### 3.5 No pronoun reference check — "these novel perspectives"

The chunker has **no logic that looks at the first word of a chunk to check for a pronoun referent.** A chunk can start with "These novel perspectives...", "This observation...", "It follows that..." and the chunker doesn't know or care that the referent is in the previous chunk.

When rule 5/6/7 fires between sentence N and sentence N+1, whatever antecedent existed in sentence N is now in a different chunk from the pronoun in sentence N+1. The reader of the chunks view sees the orphan. Fixing it is not trivial — it requires either (a) a pre-pass that detects dangling pronouns and forces the chunker to keep them in the same chunk as their antecedent, or (b) a post-pass that notices dangling pronouns and merges the two adjacent chunks. Neither exists.

---

## 4. Stage 6 — Edges (`services/funnelService.js`, summarized)

Out of scope for this report — but worth noting: the edge system is downstream of chunks/spans and inherits their defects. When a funnel picker sees a 1-span chunk that's just "Tree amplitudes are rational functions...", it ranks candidates by that span's single tag. If the span had been split into 5 concept-specific sub-spans, each of them could have pulled its own edge toward the right definition chunk. The current chunk-level edge vs span-level edge confusion you've seen in the UI partly exists because the funnel writes `fromChunkId` and the noteIngestionService writes `fromSpanId`, and neither writes both consistently. But the structural issue underneath is that when the chunk has 1 span, there's no useful difference between chunk-level and span-level — they're the same unit.

---

## 5. Diagnosis — each observed defect mapped to its cause

### Defect A: "The vast majority of chunks have only one span"

**Direct cause**: `shouldBreakChunk()` rule 7 — any span with a non-N search class starts a new chunk. Combined with the full prompt's aggressive-gap-detection rule ("EVERY chunk should produce AT LEAST one L-tag"), nearly every span ends up with a search class, nearly every span therefore starts a new chunk.

**Secondary cause**: Rule 5 — `CHUNK_MAX_SPANS = 3` caps chunks at three spans even if no other break fires.

**Where to fix**: Either relax rule 7 (don't break on search class; search classes are triage signals, not semantic boundaries), or change the prompt contract so that gap tags are stored on the *chunk* rather than forcing a new chunk. The second is cleaner but requires prompt + parser changes. The first is a two-line config flip and would let chunks grow to 3 spans naturally (from rule 5) for most narrative content.

### Defect B: "A sentence with 4-5 concepts becomes 1 span"

**Direct cause**: The DSL contract is "one line per span" and the parser creates exactly one Span document per DSL line. The prompts' worked examples (§2.6 lines 159-161) explicitly put multiple concepts into one span as a flat `contextTags` array rather than emitting multiple spans for the same sentence.

**Where to fix**: This is a prompt change, not a code change. The parser *already* allows multiple DSL lines with overlapping sentence ranges; nothing downstream merges them. A new example in both prompts showing "one concept per span, duplicate the sentence range when needed" would change the model's behavior. E.g. for "Tree amplitudes are rational functions of Lorentz invariant dot products of momenta":
```
1 tree_amplitudes definition Ld
1 rational_functions_of_invariants claim
1 lorentz_invariants definition Ld
1 dot_product definition Ld
1 particle_momenta definition Ld
```
Five spans, same sentence range, five distinct concept anchors, five places an edge can point at. The parser would accept this unchanged.

### Defect C: "These novel perspectives" — chunk starts with a pronoun, antecedent is in previous chunk

**Direct cause**: No pronoun-reference check anywhere. Rule 7 (break on search class) will cheerfully split a paragraph between sentences N and N+1 even if sentence N+1 starts with "These" or "This" referring to something in sentence N.

**Where to fix**: Post-pass in the chunker. Before emitting a chunk break, check if the first word of the next span's text is a pronoun or demonstrative (`these`, `this`, `that`, `those`, `it`, `they`, `such`). If yes, merge with the previous chunk regardless of the break rule. This is a ~15-line addition to `shouldBreakChunk()`. Pair it with a "minimum chunk length" rule — never emit a chunk of fewer than ~20 words unless it's explicitly a definition or theorem boundary.

### Defect D: "'Narrative' is noisy — it's really just a missing-tag residue"

**Direct cause**: `inferStructuralType()` returns `'narrative'` as a sentinel when no span has a structural-type-like tag. It's already derived from span tags — it's just surfaced as a special field because the schema predates the context-tag system.

**Where to fix**: Either (a) treat `narrative` as the absence of a structural-type tag in the UI (which I already partially did — the Chunks view now suppresses the "narrative" chip), or (b) drop the `structuralType` field entirely and let the UI look for any structural tag (`theorem`, `definition`, etc.) in the chunk's context tags. Option (b) is the clean version but requires a schema migration; option (a) is a UI-only patch. You already lean toward making these tags.

### Defect E: "Chunks feel incomplete — missing LaTeX, abrupt endings"

**Direct cause**: Usually not a truncation bug — usually just chunks that end cleanly at a sentence boundary inside a dense equation cascade. But rule 5 (`CHUNK_MAX_SPANS = 3`) can cut a natural unit in half if the unit has 4+ sentences. Rule 7 (search class → new chunk) can cut a definition off from its derivation because the derivation sentence has an `Lv` tag.

**Where to fix**: Tied to Defect A's fix. Stop breaking on search class; let chunks grow to the natural `CHUNK_MAX_SPANS` cap; optionally bump `CHUNK_MAX_SPANS` from 3 to 5-8 for narrative prose (keep 3 for definition/theorem blocks).

### Defect F: "Missing definitions aren't linked"

**Direct cause**: The span generator correctly emits `Ld` tags. The funnel correctly has a pathway for note-citation edges to match gaps to definitions. But the gap-to-definition matching happens at the *chunk* level, and when a definition lives in a chunk with 10 other things (because the chunker didn't cleanly separate it), the match is diluted. Conversely, when a use-site lives in a 1-span chunk by itself, the match is precise but the surrounding context is lost.

**Where to fix**: This is Defect A + Defect B + a Subject Tutor. The agent-archetypes vision doc describes it exactly: Subject Tutors maintain a canonical definition node per concept, and any span with a matching `contextTag` gets a free edge to that definition via dictionary lookup, with no LLM call. That's the "once tagged, always tagged" intuition you had. The data model already supports it (contextTags are stored per span). What's missing is:
1. A "canonical definitions" collection — `{concept: 'tree_amplitudes', definitionChunkId: <some chunk>, confidence: 'z'}`.
2. A sweep that for every span with `contextTag: 'tree_amplitudes'`, emits an edge `uses_definition → canonical-definition-chunk(tree_amplitudes)` with confidence `z` — no LLM call, no cosine search, pure lookup.
3. A "tree amplitudes has no canonical definition yet in the library" flag when step 2 returns nothing, which becomes a crawler target.

---

## 6. Summary of the structural tension

The most important thing this report says is that **the prompt and the chunker are pulling in opposite directions.**

- The prompt wants every sentence to be aggressively tagged with gap markers (`Ld`, `Lv`, `Lp`, `B`, `S`) so the resolver has triage signals to work with.
- The chunker treats any gap marker as a structural break, making every tagged sentence its own chunk.
- Result: chunks collapse to single sentences, natural paragraph-level reasoning is lost, and the "find me the 5 concepts in this sentence" multi-span decomposition never happens because the DSL and its examples both teach the LLM to flatten concepts into a single span's tag array.

The fix is not a single line. It's three coordinated changes:

1. **Chunker**: stop breaking on search class. Let chunks grow to the natural cap. Add pronoun-aware boundary merging.
2. **Prompt**: add a worked example showing one-concept-per-span with overlapping sentence ranges. Keep aggressive gap tagging but store gaps at the span level where they belong without forcing chunk breaks.
3. **Canonical definitions**: build the Subject Tutor's dictionary table so `contextTag` → canonical definition edges are a DB lookup, not an LLM inference. This is the "once tagged, always tagged" idea from your feedback.

All three changes sit inside the current data model. None of them require schema migration. Re-ingesting the 6 existing books after these three changes is the quickest way to validate whether the defects disappear without building GR further on a broken foundation.

---

## 7. Appendix — full file-and-line citations

| Subject | File | Key functions / lines |
|---|---|---|
| Sentence numbering | `services/spanService.js` | `numberSentences()` 107-114 |
| Session / prompt switching | `services/spanService.js` | `startNewSession`, `shouldResetSession` 57-76 |
| DSL parser | `services/spanService.js` | `parseSpanOutput()` 122-252 |
| `spanText` materialization | `services/spanService.js` | `runSpanLLMCall()` 263-288 |
| Quality gate | `services/spanService.js` | `isSpanEnriched`, `enrichmentRatio` 78-99 |
| Per-page pipeline | `services/spanService.js` | `generateSpansForPage()` 309-420 |
| Full prompt | `prompts/span-generation-full.txt` | 209 lines, quoted in §2.6 |
| Short prompt | `prompts/span-generation-short.txt` | 99 lines, quoted in §2.7 |
| Chunk break rules | `services/chunkService.js` | `shouldBreakChunk()` 48-83 |
| Structural type inference | `services/chunkService.js` | `inferStructuralType()` 17-43 |
| Chunk source text assembly | `services/chunkService.js` | `getSourceText()` 88-97 |
| Chunk-building loop | `services/chunkService.js` | `generateChunksForBook()` 102-197 |
| Chunk config constants | `config/pipeline.js` | `CHUNK_MAX_SPANS`, `CHUNK_SPLIT_ON_DECLARATIVE`, `CHUNK_SPLIT_ON_SEARCH_CLASS` |
| Session reset cadence | `config/pipeline.js` | `SPAN_SESSION_MAX_PAGES = 8`, `SPAN_MIN_ENRICHED_RATIO = 0.5` |

---

*End of report. This is research-only; no code was changed. The recommended next step before resuming Phase B of GR is the three-part fix in §6: relax the chunker's search-class break rule, add a multi-concept decomposition example to both prompts, and scaffold the canonical-definition dictionary for the Subject Tutor. Then re-ingest the 6 current books and verify the chunks view shows multi-span chunks, no orphaned pronouns, and visible `uses_definition` edges.*
