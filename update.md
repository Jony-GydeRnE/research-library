# Update.md — Gyde Research Library

A rolling knowledge log of the project. **Newest entries at the top.** Read top-to-bottom to catch up on where the project stands without scrolling through commit history.

Maintained by Claude Code (CC) on a ~3-5-response cadence. Bad attempts that got fixed in the same session are not listed — only the final state of each session's work matters. Older sections are trimmed to one-line summaries when their detail is fully superseded; key decisions and target metrics are preserved so future sessions can recall them. Commit messages handle the comprehensive change record.


## 2026-04-11 late evening — Synonym normalization layer (the architectural fix for vocabulary alignment)

The fix the user wanted after the morning's "manual patches don't survive a regen" finding. Built a concept layer in `services/taxonomyService.js` so the edge resolver matches on canonical concepts instead of raw tag strings. **Result: 16 cross-book edges, 0 wrong, on a clean LLM-regenerated Book 2 with all manual patches reverted — i.e. higher edge precision than the manual-patch state, AND it works for any future regen automatically.**

### Approach — concept catalog, not alias map

Each context tag is mapped to a SET of canonical concepts via marker-substring matching. The set model (not single canonical) is intentional: a compound tag like `hidden_zero_factorisation` legitimately belongs to BOTH `hidden_zeros` and `factorization`. Two tags match when their concept sets intersect.

Concept catalog covers the physics topics in our current corpus:
`hidden_zeros, splitting, factorization, kinematic_mesh, abhy_associahedron, nlsm, tr_phi3, yang_mills, string_amplitude, uv_scaling, bcfw, adler_zero, uniqueness_conjecture, soft_theorem, causal_diamond, kinematic_shift, scaffolding, planar_variables, discovery`

Markers were bootstrapped from the actual frequency distribution of contextTags in MongoDB (1326 distinct strings across the 4-book corpus). Coverage philosophy: a tag with no concept matches maps to itself as a singleton, so unknown tags retain exact-match behavior. The concept layer is **strictly additive — never lossy**.

### Two side-fixes that were necessary

The synonym layer alone got us to 16 edges with 1 still wrong (Rodina p1 tr_phi3_conjecture → Book 2 p50 Outlook instead of p49 ansatz). Two pieces of resolver scoring needed tightening:

1. **Removed the tag-richness bonus.** It was capped at +0.05 for 5+ tags but outweighed the order tiebreaker (capped at 0.001), making tag-stuffed Outlook chunks beat correct body chunks on the same overlap. The right tiebreak is "earlier chunk wins" (closer to the definition), not "more tags wins".

2. **Stem-tolerant text matching.** The chunk text matcher used `phrase = "hidden zeros"` substring search. Half the corpus spells it `"hidden zeroes"` (British). The token fallback gave only 0.5 partial credit, which let an American-spelling chunk in the Outlook beat a British-spelling chunk in the body on textBonus alone. Now token-prefix matching gives full credit, so `"factorize" ≈ "factorization"`, `"zeros" ≈ "zeroes"`, etc.

### Empirical result (no manual chunk patches at all — clean LLM regen state + synonym layer)

**16 edges total** (was 11 with exact-string matching). **5 NEW edges** that were impossible before:

| New edge | Target | Verdict |
|---|---|---|
| G/W p4 nlsm + massless_zeros | Book 2 p19 Section 4.1 NLSM zeros | bullseye |
| G/W p11 mNLSM even-point | Book 2 p4 NLSM intro | acceptable |
| Understanding p29 factorization_3_splits | Book 2 p32 zero causal diamond factorization | bullseye |
| Understanding p29 factorization_near_zero | Book 2 p12 amplitude_vanishing | bullseye |
| **Understanding p34 YM zeros + splitting** | **Book 2 p45 gluon amplitude zeros** | **bullseye** |

**Bullseye improvements on existing edges:**

- **Rodina p1 tr_phi3_conjecture → Book 2 p49 ansatz/uniqueness**: "we can further impose our hidden zeroes. Quite remarkably we have found..." (was: previously landed on Outlook)
- **G/W p1 kinematic_mesh → Book 2 p6 "2.1 The kinematic mesh"**: the actual section header (was: Section 5 gluon-zeros chunk)
- **G/W p10 UV behaviour → Rodina p6 OUTLOOK literally saying "we showed hidden amplitude zeros are in fact closely related to UV scaling"**: the most semantically perfect cross-book match in the entire graph

**Final tally: 11 bullseye / 3 acceptable / 2 routing-to-abstract / 0 wrong.** The two abstract-routing cases (Understanding p2 → Book 2 p1) are arguably semantically correct: the source says "discovered in [6]" and the abstract IS the discovery announcement.

### What this enables architecturally

- Future Book 2 regens won't destroy edge quality the way they did this morning. The resolver normalizes vocabulary at match time — the LLM only needs to be locally consistent.
- New books added to the library will produce good edges automatically, as long as their LLM-tagged concepts overlap with the catalog markers.
- The catalog can grow as new concepts appear. Bootstrap query is in the file header for refreshing when the corpus shifts.
- **No more per-chunk manual patches needed.** The 95% precision target is reachable through pure resolver code, not data hand-tuning.

### Open follow-ups
1. Live click-through test of all 16 cross-book citations in the app.
2. Notes ingestion (LaTeX OCR + auto-citation to Rodina passages). Architecture is ready.
3. Process geometric-background through the span pipeline so G/W [31] gets a real body target.
4. Defer: upload speed, arXiv crawler, multi-tier prompt system.


## 2026-04-11 evening — Book 2 LLM regen experiment + per-book Info & stats modal

Two pieces this round. The first one is the more important finding: **a clean LLM regeneration of Book 2 produced WORSE edge precision than the manual targeted tag patch from earlier in the day, contradicting Claude's prediction.** The second is a UX feature the user asked for so they can sense-check ingestion quality and rough $ spend per book.

### 1. Book 2 LLM regen experiment — empirical finding

Per Claude's recommendation: ran `generateSpansForBook(book2._id)` which wipes spans, regenerates them (58 pages, 1104 spans, 7.4 minutes, ~$0.30), regenerates chunks, citation spans, bibliography, edges. Then re-ran `resolveSEdgesForLibrary` so other books' edges point to the fresh chunk IDs.

**Result: regression.** Down from 12 edges at ~95% to 11 edges at ~75%:
- 5 edges that were `f` (overlap=2) dropped back to `j` (overlap=1)
- "Discovery + hidden_zeros" Understanding-zeros edges went BACK to landing on the p1 abstract instead of Section 3.1, because the LLM tagged the new abstract chunk as `[hidden_zeros, discovery, observation]` (giving the abstract a 2-tag overlap with the source span, while no body chunk had both tags)
- Lost the `tr_phi3_conjecture` / `uniqueness_conjecture` body target entirely — no chunk in the regen had those tags, even though p49 0e8e1d *is* the chunk that discusses the ansatz uniqueness conjecture
- The Section 3.1 examples chunk on p11 (0e8a96) ended up tagged just `[tr_phi3_zeros, feynman_diagrams]`, which is more specific than the old `amplitude_zeros` but doesn't match any source span tag — so Rodina p2's `amplitude_zeros` edge stopped being able to find it

**Why:** the LLM tagging spans/chunks doesn't know which chunks are *citation targets*. It tags for narrative coherence ("what's this paragraph about"), which is the right local objective but the wrong global one. The result is more semantically precise tags that don't match the *vocabulary* the source spans (in *other* books) use to refer to the same content. This is a vocabulary-alignment problem, not a specificity problem.

**Recovery:** re-applied targeted tag iteration on the new chunk IDs (same 6 chunks as the morning patch, mapped to new IDs). Edges back to 11 at ~95%, with all the previously-fixed body targets restored. The regen *did* leave behind some genuinely better tag vocabulary in places (e.g. `tr_phi3_zeros` instead of `amplitude_zeros`, `gluon_zeros` instead of `polarization_vectors`), but the citation-target chunks needed manual hints to bridge to the source-side vocabulary.

**Lessons for the next iteration:**
- Don't rely on regen alone to improve citation matching. Regen is a good baseline but loses any manual tag work — a Book 2 regen invalidates every targeted patch we've ever made.
- The right long-term fix is either (a) a tag-vocabulary normalization layer in the resolver that maps `tr_phi3_zeros ≈ amplitude_zeros ≈ hidden_zeros` so the LLM's narrative tags match the source-side vocabulary, OR (b) a post-regen "citation-target enrichment" pass that walks every source-side span tag and ensures at least one body chunk in each potentially-cited book has that tag explicitly.
- Targeted manual iteration is currently the highest-quality lever we have. Worth persisting between regens — could store as a `tagOverrides` field on the chunk so future regens preserve them.

Cost log: 1 Book 2 regen ≈ 7m, ~$0.30 (vision was already cached, so this was span-only).

### 2. Kebab menu + Info & stats modal on All Files page

User flagged that the All Files page had no working kebab — confirmed it had no kebab at all. Added the same three-dot menu the collections page already had, with one new item: **Info & stats**.

**New endpoint** `GET /api/books/:id/stats` (`controllers/booksController.js`) returns:
- counts: pages, vision pages, chunks, spans, tags, edges in/out
- distributions for chunks/page, spans/page, tags/chunk, tags/span — each with mean, median, stddev, min/max
- cost estimate (rough, per-page constants in the controller)
- storage: source bytes (PDF on disk if local, else extracted text), metadata bytes (sum of stringified pages+chunks+spans+edges+book), and the (source+metadata)/source ratio the user explicitly asked about
- retrievalMs: how long the aggregation took

**Modal** (in `views/files.ejs` and mirrored to `views/collections.ejs`): a wide modal with a 6-card stats grid, distribution table, cost breakdown, storage list, and a retrieval-time footnote. Uses existing app theme variables so it adopts space/nebula/midnight automatically.

Cost constants (`COST_PER_VISION_PAGE = 0.015`, `COST_PER_SPAN_PAGE = 0.005`, `COST_PER_METADATA = 0.01`) are pegged to current GPT-4o pricing and the Vision doc estimate. They will drift; treat as order-of-magnitude. The modal note tells the user this.

### Open follow-ups (priority order)
1. **Live click-through test** of all 11 cross-book citations in the app (still the next user-facing milestone — was deferred from this morning).
2. **Tag-vocabulary normalization** — either a synonym layer in the resolver or persistent `tagOverrides` so manual patches survive regens. This is the path to 100% precision without hand-tuning every chunk.
3. After UI test passes: notes ingestion (LaTeX OCR + auto-citation to Rodina passages).
4. Process geometric-background through the span pipeline so G/W [31] gets a real body target.
5. Defer: upload speed (background-resumable jobs), arXiv crawler, multi-tier prompt system.


## 2026-04-11 PM — Bibliography column fix + Book 2 targeted tag iteration (75% → ~95% edge precision)

Two pieces of work this session, both aimed at sharpening the 12 cross-book edges to bulletproof quality before adding more books or features.

### 1. Bibliography column-aware extraction (`services/bibliographyService.js`)

Claude (other agent) audited the 12 edges and claimed 4 of 12 pointed to wrong books — specifically that G/W [9] should be `arXiv:2309.15913` not `2312.16282`. **Verified directly against the source PDF: hallucinated.** G/W [9] is literally `arXiv:2312.16282` in the source. Claude had mixed up which book the entries belonged to.

But the verification surfaced an actual bug on a *different* book: Rodina's `bibEntries` had column-interleaved arxiv IDs because pdf-parse reads 2-column bibliographies horizontally and merges left/right columns. Rodina [1]'s rawText had `"arXiv:2405.09608 [hep-th]. (2004), arXiv:hep-th/0403047."` — two arxiv IDs from two different references mashed into one entry.

**Fix**: rewrote `extractBibliography` and `extractBookIdentifiers` to use `pdfjs-dist` legacy build when the local PDF is on disk. New helpers:
- `extractPagesWithColumns(pdfPath, startPage, endPage)` — groups text items by y-coordinate, sorts by x within each line, decides 1-col vs 2-col, emits all left-column lines then all right-column lines for 2-col pages.
- `resolveBookPdfPath(book)` — finds local PDF given `s3Key`.
- `findArxivId` now also matches the bare-bracket form `[hep-th/0412308]` / `[2312.16282]` used by JHEP and Zhou's bib.

**Column detection** (after three iterations): count items that START a new text run on each line and track how many start in the page mid-band (x in 0.40w..0.60w). Threshold: `midband >= 8` AND `ratio >= 0.15`. Two earlier attempts failed — naive midpoint split truncated Zhou [8], crossing-lines heuristic misclassified G/W as 1-column because side-by-side [9] and [31] entries shared a y. Two-column extraction also has a `hasGapAtBoundary` check to avoid merging two same-y entries from different columns.

Verification: Zhou p52 → 1-COL ✓, G/W p13/p14 → 2-COL ✓. All 5 books extract correctly. G/W [9]/[11]/[17]/[31] keys restored to their original positions with clean rawText.

### 2. Book 2 targeted tag iteration (no code change — DB writes only)

The remaining edge quality issue: 5 of 12 edges were landing on the **Outlook chunk b04d0a (p50)** or the **Abstract chunk b048cc (p1)** instead of the right body sections. Diagnosis: Outlook had `hidden_zeros` as a tag (too broad — its actual content is "future directions"), and Abstract had both `hidden_zeros` and `discovery` so it won 2-tag overlap against any "hidden_zeros + discovery" span.

Targeted updates to 8 chunks (no whole-book regen):
- **b04d0a p50 Outlook** — removed `hidden_zeros`, added `future_directions`
- **b04d49 p52 Outlook-ish deformations** — removed `hidden_zeros`, added `future_work`
- **b048cc p1 Abstract** — removed `hidden_zeros` AND `discovery`, added `paper_overview`
- **b048ea p3 hidden zeros relationships** — added `hidden_zeros`, `hidden_zeros_discovery`, `discovery`
- **b048f6 p4 hidden_zeros + amplitude_poles** — added `hidden_zeros_introduction`, `splitting`, `discovery`
- **b0499b p11 Section 3.1 examples** — added `hidden_zeros`, `splitting`
- **b04cf8 p49 ansatz uniqueness** — added `uniqueness_conjecture`, `tr_phi3_conjecture`, `amplitude_determination`, `unique_amplitude`
- **b04be7 p39 uniqueness theorem** — added `uniqueness_conjecture`, `tr_phi3_conjecture`

After re-resolution: all 5 wrong edges now land on the correct body sections (p4 Section 3.1 hidden zeros intro, p11 Section 3.1 examples, p49 uniqueness conjecture). Confidences upgraded from `j` (overlap=1) to `f` (overlap=2) on the fixed edges. **Plus an emergent edge**: G/W p10 (`hidden_zeros, uv_behaviour, massive_theories`) → Rodina p1 — a real cross-book connection where G/W's massive theory UV behavior cites against Rodina's "hidden zeros = UV scaling" thesis.

Edge count stays at 12 but precision is now ~95%+. No edges hit p50 or p1 anymore.

### Open follow-ups (per Claude/user direction)
- Open the live app and click through every cross-book citation — does the split-screen open to the right page, does the callout box highlight the right text? This is the user-facing test.
- After UI test passes: notes ingestion (LaTeX OCR + auto-citation to Rodina passages). The infrastructure exists; this is the next-build moat.
- Process geometric-background through the span pipeline so edges can point to it (G/W [31] currently has no body-side target).
- Defer: upload speed (background-resumable jobs), arXiv crawler, multi-tier prompt system.


## 2026-04-11 — Edge quality cleanup pass: text-keyword scoring, body boost, author backfill

User went to sleep with two pieces of feedback to act on:
- Abstract penalty too harsh — make body content positive-boosted instead of penalizing abstracts
- AI confused authors ("Cao et al." for Rodina paper) — every book needs explicit author metadata

Plus my own audit revealed: chunk #69 (Section 3.1 of Book 2 — the textbook target) has tags `[abhy_associahedron, amplitude_zeros, feynman_diagrams, five_point_amplitude, kinematic_locus]`. **NO `hidden_zeros` tag** even though the section is literally about the zeros of hidden amplitudes. So the resolver couldn't pick it for any Rodina span tagged `hidden_zeros`. Fixing this without re-regenerating Book 2 required adding a new signal: text-keyword matching.

### Changes

**`services/edgeResolverService.js`**
- **New `tagTextMatchScore(sourceTags, targetText)`** — treats the citing span's tags as keywords and searches for them as phrases (or all-tokens-present) inside the candidate chunk's source text. So a span tagged `hidden_zeros` can find chunks that contain "hidden zeros" or "zeros" + (other tag tokens) in their text, even when the chunk doesn't have `hidden_zeros` as an explicit tag.
- **Floor changed**: was `if (overlap === 0) continue` — now `if (overlap === 0 && textMatchRaw === 0) continue`. Chunks with tag overlap OR text match are valid candidates.
- **Page penalty flipped to body boost**: page 1 = 0 (neutral, abstracts remain honest fallbacks), page 2 = +0.05, page 3 = +0.10, pages 4+ = +0.15. Per user note: *"abstracts get zero bonus, body sections get a small positive boost. Something beats nothing."*
- **Minimum score floor of 1.0**: drops weak `conf=z` fallback edges that sneak through with overlap=0 + tiny text match. Better to emit zero edges than to point at the wrong chunk.
- **Tightened `isBibliographyLine`**: catches very short spans starting with `[N]` (truncation artifacts like `"[8] N."`), spans starting with `→` or `•`, and spans containing email addresses with low word count.

**`services/citationSpanService.js`**
- Synthetic citation spans now grouped **by sentence**, not by reference key. A sentence citing `[15], [22], [23]` produces ONE span tagged with all three `citation_to_ref_*` tags, not three duplicate spans with the same text. This eliminates duplicate edges from the same source sentence to the same target.

**`services/claudeService.js` — author handling**
- `renderBookMetadata` now emits `author=` as an XML attribute on `<book_metadata>` AND a dedicated `Author:` line below it. Both are present so the AI can't miss it.
- New BASE_PROMPT section `AUTHOR ATTRIBUTION — IMPORTANT` instructing the model to always read the author from the metadata block and never invent or cross-attribute.

**`models/Book.js` author backfill (one-time)**
All 5 real books now have explicit author fields:
- Rodina (2406.04234) → "Laurentiu Rodina"
- Arkani-Hamed/Cao/Dong/Figueiredo/He (2312.16282) → full author tuple
- Gonzales/Ward (2601.16860) → "Mariana Carrillo Gonzalez, Freddie Ward"
- Arkani-Hamed/Bai/He/Yan (1711.09102) → full tuple
- Zhou (Understanding zeros) → "Kang Zhou"

**Note on author confusion in earlier audits:** I had been calling the Zhou paper "Cao" because Cao is an author cited heavily in its bibliography. The actual author is **Kang Zhou**. Past Update.md sections calling it "Cao" are incorrect. Going forward I use "Zhou".

### Verification — 9 high-quality cross-book edges

After all fixes:

| # | Citing span | Target | Confidence |
|---|---|---|---|
| 1 | Rodina s14 *"shocking discovery...termed hidden zeros [15]"* | Book2 #362 p50 (Outlook) | j |
| 2 | Rodina s15 *"in [15] it was conjectured these zeros are sufficient"* | Book2 #362 p50 (Outlook — **correct per Claude's audit**) | j |
| 3 | ⭐ Rodina s8 *"In [15], it was proposed ordered amplitudes for Tr(φ³)/NLSM/YM vanish"* | **Book2 #69 p11 (Section 3.1)** | j |
| 4 | G/W *"construction of [9], where it was discovered"* | Book2 #362 p50 (Outlook) | j |
| 5 | ⭐ G/W *"geometric origin via ABHY associahedron [9]"* | **Book2 #55 p9 (associahedron def)** | j |
| 6 | G/W *"absence of relevant poles"* | Book2 #263 p39 | j |
| 7 | Zhou *"amazing property called hidden zeros [8]"* | Book2 #0 p1 (abstract, overlap=2) | f |
| 8 | Zhou *"hidden zeros found in [8] for Tr(φ³)/NLSM/YM"* | Book2 #0 p1 (abstract) | f |
| 9 | ⭐ Zhou *"via a simple shift of kinematic variables [8]"* | **Book2 #118 p18 (Adler zero / NLSM)** | j |

**4 textbook wins, 5 acceptable, 0 obvious errors, 0 conf=z fallbacks, 0 bib-line noise.** Cleanest edge set we've had.

The Rodina #69 win specifically required the new text-keyword signal: chunk #69 didn't have `hidden_zeros` as a tag but its source text contains "zeros and factorizations" + "amplitudes" + "Tr(φ³)" — text matching gave it a score of 1.401 which beats the no-overlap chunks.

### Open issues — current core tasks (per Jony's personal note + sleep instructions)

1. **Book 2 chunk #69 still doesn't match every "hidden zeros" Rodina span.** Two of the Rodina edges still hit chunk #362 instead of chunk #69. The fundamental issue is metadata granularity: chunk #69's tags don't include `hidden_zeros` even though that's what the section is about. Fix path: targeted prompt iteration on Book 2 specifically, OR a post-pass that augments chunk tags from chunk text.
2. **Faster perceived upload.** Current pipeline takes 10-30 min before user can interact. Goal: PDF appears in reader instantly with whatever's available (pdf-parse rawText → vision HTML → spans → chunks → edges) and progressively upgrades in the background. Reader needs a fallback that renders rawText when htmlContent isn't ready. SSE progress endpoint for live page-by-page updates.
3. **Notes ingestion (LaTeX OCR + auto-citation).** User has stylus notes on Rodina ready to test. Vision pipeline → LaTeX → spans → chunks → automatic edges to the cited paper passages. This is the data moat.
4. **arXiv crawler.** Activated from inside a collection. Reads collection instructions + chats + book metadata, queries arXiv for related papers, judge model ranks them, user approves top N (capped) for ingestion. Each ingested paper auto-resolves any pending bib stubs that match its arxivId.
5. **Granularity prompt sweep.** Multi-tier prompt system (short / medium / long / very long) with different re-injection frequencies. User said: *"depends on how long it can go with minimal prompts without hallucinating, ill give examples when i wake up."* Waiting on user input.

---

## 2026-04-10 Late PM 4 — Metadata + edge quality fixes (ChatGPT + Claude feedback)

ChatGPT audited Rodina pages 1-5 against the actual PDF and found six metadata defects. Claude audited the 7 cross-book edges and found a critical bug + abstract bias + bib-line noise. Both correct. Both addressed.

### CRITICAL: vision OCR was mangling arXiv IDs

Direct comparison of pdf-parse output against the live DB rawText (which gets overwritten by vision):
- Rodina page 8 PDF: `arXiv:2312.16282`, `arXiv:2309.15913`
- Rodina page 8 in DB: `arXiv:2312.12682`, `arXiv:2309.13539`

Vision (GPT-4o vision) is OCR'ing dense bibliography pages from rendered images and confusing digit shapes (`6`→`1`, `5`→`3`/`9`). **Vision is unreliable for digit-perfect citation matching.**

**Fix:** `bibliographyService.js` now reads `page.rawTextLegacy` (preserved pdf-parse output) instead of `page.rawText` (vision-overwritten) for both bibliography parsing AND front-matter identifier extraction. New `pickBibSource(page)` helper enforces this. The Page schema preserves rawTextLegacy specifically for cases like this — it's now the canonical source for any pipeline that needs digit-perfect text.

**Result:**
- Rodina now has its own arxivId: `2406.04234`
- Rodina [15] correctly resolves to Book 2 (arXiv:2312.16282)
- NEW match: Gonzales/Ward [17] → Rodina (only possible now that Rodina has an arxivId)
- 5 resolved bib keys library-wide, up from 3

### Edge resolver tuning (Claude's other concerns)

`services/edgeResolverService.js`:
- **Page-depth penalty** — page 1 −0.15, page 2 −0.07. Gentle per user feedback ("minus 10 points emphasis on abstract is harsh, it shouldn't be negative, and something is better than nothing if no book gives a match"). Abstracts can still win when overlap=2 OR when no deeper chunk has any overlap; they're deprioritized, not excluded.
- **Structural-type boost** — definitions/theorems/lemmas/propositions get +0.15, proofs/corollaries +0.10. Citation targets are usually formal results.
- **Order-bonus arithmetic bug fixed** — was `0.0001 * (10000 - chunkIndex)` which gave chunk #0 a +1.0 boost (a primary signal). Now `0.001 - 0.000001 * chunkIndex` (max 0.001, pure tiebreaker).
- **Bibliography-line filter** — spans whose text starts with `[N] H. Author` pattern are skipped. Removed 3 noise edges that were just bib entries pointing back to "this paper exists."

### Metadata prompt rules (ChatGPT's concerns)

`prompts/span-generation-short.txt` and `span-generation-full.txt` both gained a "CONTEXT TAG QUALITY RULES" section:
1. **SPECIFICITY** — tag each span with what THAT SENTENCE is about, not the broad section topic. Avoid the same broad tag on every span.
2. **NORMALIZATION** — pick one canonical name per concept; don't write `uv_scaling`, `enhanced_uv_scaling`, and `uv_bcfw_scaling` for the same idea.
3. **SEARCH-CLASS PRECISION** — L only when the text uses a hand-wave phrase AND does NOT subsequently prove it. B only when the assertion is NOT proved here AND NOT cited.

Re-regenerated all 4 books with the new rules. Direct verification on Rodina:
- Page 1 span 14 `"In this Letter we will prove this conjecture..."` → role=preview ✅ (was proof)
- Page 5 span 10 `"1."` → role=remark, tags=[proof_step_label] ✅ (was proof)
- Page 3 spans now split into 3 semantic groups (`zeros_vs_bcfw_shifts`, `kinematic_data`, `zero_condition`) instead of every span being tagged `zeros_bcfw_equivalence`
- Page 5 spans 7-9 (bare claim assertions) tagged `N` instead of `Bm` because the next page proves them — search-class precision rule respected

### Final coverage numbers (post-regen)

| Book | Pages | Spans | Chunks | Tag% | Role% | Search% |
|---|---|---|---|---|---|---|
| Rodina (9pp) | 9/9 | 218 | 90 | 100% | 96% | 11% |
| Arkani-Hamed (58pp) | 58/58 | 1057 | 418 | 98% | 97% | 9% |
| Gonzales/Ward (14pp) | 14/14 | 469 | 241 | 83% | 99% | 27% |
| Cao (52pp) | 52/52 | 940 | 384 | 96% | 97% | 11% |

Search class % dropped slightly (was 23-29%, now 9-27%) — that's the new search-class precision rule kicking in. Fewer false-positive L/B tags is the goal, not a higher %.

### Final edge resolution: 9 cross-book edges, 3 textbook wins

| # | Edge | Quality |
|---|---|---|
| ⭐ | **Rodina p2 [15] → Book 2 chunk #69 p11** (Section 3.1: "Zeros and Factorizations of Tr(φ³) Tree Amplitudes – two simple examples") | PERFECT — exactly the section where the cited content is defined and proved |
| ⭐ | **G/W p2 [9] → Book 2 chunk #55 p9** (associahedron definition) | EXCELLENT — "geometric origin via ABHY associahedron" → chunk tagged `associahedron_definition, abhy_associahedron` |
| ⭐ | **Cao p43 [8] → Book 2 chunk #118 p18** (Adler zero / NLSM) | GOOD — "via a simple shift of kinematic variables [8]" → chunk on `adler_zero_soft_limits, nlsm_amplitudes` |
| × 4 | spans about "the discovery" → chunk #362 p50 (Book 2 future-work section) | acceptable, limited by Book 2's chunk-tag granularity |
| × 2 | Cao spans → chunk #0 p1 (abstract) with overlap=2, conf=f | acceptable for general references |

**Library totals:** 2,684 spans, 1,133 chunks, 9 cross-book Edge documents (all `method='lexical'`, all `resolved=true`).

### Next up

- AI context integration: `renderBookMetadata` includes edges so the chat can naturally cite them via `[[cite]]` (~30 lines)
- Reader UI clickable cross-book navigation
- Granularity re-pass on Book 2 chunk tags to tighten the imperfect edges
- (Per user's note below) notes ingestion via LaTeX OCR + arXiv crawler

---

JONY/THE USER MAKING THIS APP PERSONAL NOTE TO CC:

its 3am not pm.  super late.  damn, 3:56am lol.  Jony committing a personal note for future developments coming up:

two biggest issues right now: quality of the metadata span tags, and the quality of the edges.  Maybe minus 10 points emphasis on abstract is harsh, it shouldn't be negative, and something is better than nothing if no book gives a match and the relation is given an honest 50% or lower confidence.  Then we can point to an abstract that sounds related but that is an exception.

Now once we have those 2 things fixed, then we get a cooler possibility to open right away: 

1. I have amazing notes explaining every background and simple computations for so many steps for Rodina's hidden zero paper. They are written with a stylus and converted to PDF. I uploaded my notes to the research-library repository/folder.  Goal: app needs to process notes at upload and convert the paper into latex code, need an LLM call or some other tool. Open for ideas. But this is important. People will alwys take pictures of their notes. We must get the images and turn it into readable latex that we can annotize with spans and chunks, and the system must *autoatically* know where to to "highlight" in Rodinas page.  In other words this "highlight" is a system-generated citation pointing to my notes. The system must intelligently read, and understand the paper and notes and accurately match the parts in the notes with the parts in the paper that it supports.  We do that 100%, we are GOLD.

2.  After that beast of a task, we must build the crawler.  I want to scrape arXiv for more papers by Rodina and Arkani Hamid and that world.  Lets hone in and specialize in their work and find up to date hot research along with pedagoical supporting material that helps mid-tier grad students understand each step.  We must create the chunks for the papers we scrape that are relevant to our current discussions.  One way to do this is to allow me, as a user, to activate scraping from inside a collection.  If I can do that and the scraper can see the files in the collection, it can read other chats (oh yeah, chats should be able to read other chats within their scope like Claude and chats that are not in any collection should have access to read any chat whatever), and read instructions in the collection, and then go and look for supporting material and create a ranked list that we must be able to click a button to see.  Maybe in the right side of UI while in a collection, where users can find the chats listed, the button clicked can show us a list of papers we might want to scrape.  before the scraper shows its ranking, we have a Judge model of high quality make sure the ranking is good by checking and giving a certified percentage of confidence from 1 through 26: z = 100%.  and as a user, I can click on multiple at a time and approve it and scrape them, or scrape the top 20 at once. we need a cap to how many.  

# end my  personal log. please review this CLaude Code.  Trust this is the next step once we get metadata and edges to 95%+ quality and usefulness.
---

## 2026-04-10 Late PM 3 — First cross-book edges + bibliography pipeline

The metadata layer is no longer just metadata — **the first real cross-book edges exist in the database**. 7 edges, all from `lexical` matching of S-tagged citations in Cao and Gonzales/Ward back to Book 2 (Arkani-Hamed). Architecture validated end-to-end with zero LLM calls.

### Pipeline shipped (3 new services + Book schema additions)

**`models/Book.js`** — three new fields:
- `arxivId` — extracted from front matter, normalized (no version suffix, no `arXiv:` prefix). Indexed.
- `doi` — same normalization. Indexed.
- `bibEntries[]` — parsed bibliography per book: `{key, rawText, authors, year, arxivId, doi, resolvedBookId}`. `resolvedBookId` points to the matched Book in the library (null if no match yet).

**`services/bibliographyService.js`** (NEW)
- `extractBookIdentifiers(bookId)` — scans first 3 pages for arXiv ID and DOI, persists on Book.
- `extractBibliography(bookId)` — finds the references section by walking pages from the END backwards looking for `[1]` anchor, parses `[N]` entries, normalizes per-entry arXiv/DOI, persists on Book.bibEntries.
- `matchBibliographyToLibrary(bookId)` — for each bibEntry, matches arXiv-exact → DOI-exact against other books in the library, sets `resolvedBookId`.
- `processBookBibliography(bookId)` — orchestrates the three above.
- Critical regex fix during build: bibliography entries CONTAIN `[hep-th]` brackets inside arXiv IDs, so the original `[^\[]+?` parser truncated entries at the first `[`. Replaced with `[\s\S]+?` + lookahead `(?=\[\d+\]|$)` — only NUMERIC `[N]` markers count as entry boundaries.
- DOI regex now allows `()` characters because JHEP-style DOIs are `10.1007/JHEP03(2025)154`. Trailing punctuation stripped in normalization.

**`services/edgeResolverService.js`** (NEW)
- `extractCitationKeys(spanText)` — pulls numeric refs from span text. Handles single `[15]`, ranges `[26-31]`, comma-lists `[5,6,8]`.
- `findBestTargetChunk(targetBookId, citingSpan)` — lexical scoring: raw context-tag overlap is the primary signal, target tag count + earlier chunkIndex are tiebreakers. **Returns null if zero overlap** (no fallback — better to emit zero edges than wrong ones).
- `relationshipFromRole(role)` — maps citing span's role to Edge.relationshipType. Default `assumes`. proof/result → `extends`, definition → `uses_definition`.
- `overlapToConfidence(overlap)` — overlap≥4 → `a`, =3 → `c`, =2 → `f`, =1 → `j`.
- `resolveSEdgesForBook(sourceBookId)` — walks every S-tagged span, extracts citation keys, looks up resolved bib entries, finds best target chunks, creates Edge documents. Clears existing `method='lexical'` edges first so it's idempotent.
- `resolveSEdgesForLibrary()` — runs the resolver on every book.

### Verification — first 7 cross-book edges in the DB

| From | To | Conf | Citing context |
|---|---|---|---|
| **Cao [8] → Book 2 chunk #0 p1** | **f** | **"amazing property of tree level amplitudes called hidden zeros…"** (overlap=2) |
| Cao [8] → Book 2 chunk #0 p1 | j | "The hidden zeros found in [8] are for Tr(φ³)…" |
| Cao [8] → Book 2 chunk #2 p2 | j | bibliography reference line |
| Gonzales/Ward [9] → Book 2 chunk #0 p1 | j | "In this letter, we will focus on the construction of [9]…" |
| Gonzales/Ward [9] → Book 2 chunk #0 p1 | j | "These zeros also have a geometric origin…" |
| Gonzales/Ward [9] → Book 2 chunk #2 p2 | j | bibliography reference line |
| Gonzales/Ward [11] → Book 2 chunk #2 p2 | j | bibliography reference line |

All 7 edges target Book 2 (Arkani-Hamed) because it's the oldest and most-cited paper in the library. The Cao edge with overlap=2 is the canonical "this works" example: Cao asserts hidden zeros were found in [8], the resolver maps [8] to Book 2 by arXiv ID, and the target chunk is literally Book 2's abstract introducing hidden zeros.

### Notable: Rodina cites 35 papers with arXiv IDs but matches NONE

Rodina's `[15]` is `arXiv:2312.12682` (different Arkani-Hamed paper from the same month as Book 2's `2312.16282`) — these are real, distinct papers by the same author group. We don't have `2312.12682` in the library, so it can't resolve. **This is a feature, not a bug**: it's exactly the case where the future crawler would auto-fetch the cited paper from arXiv, ingest it, and back-resolve every pending edge.

Rodina also cites multiple Rodina-authored papers, none of which we have. The asymmetry is just chronology — Book 2 (2023) is the upstream source that everyone else cites; Rodina (2024+) cites things upstream of itself, not the other library books.

### Short-prompt fix (also in this commit)

Two role-disambiguation rules added to `prompts/span-generation-short.txt` and the same to `prompts/span-generation-full.txt`:
1. **preview vs proof** — "we will prove that…", "we now show…", "in this section we establish…" → `preview`. Reserve `proof` for actual derivation steps.
2. **definition vs background vs section heading** — "INTRODUCTION", "AMPLITUDE ZEROS", "Conventions" → `background` (or omit role). Reserve `definition` for spans that DEFINE a math object.
3. **numeric labels** — span text that's just `"1."`, `"2."`, `"(3)"` is NOT a proof step. Skip role or use remark.

Re-regenerated Rodina to verify. Section headings (`INTRODUCTION`, `REVIEW OF AMPLITUDE PROPERTIES`, `YANG-MILLS POLARIZATION STRUCTURES`) are now correctly tagged `background`. "In this Letter we will prove this conjecture..." is now `preview`. A few "we prove" announcements still leak into `proof` but that's a long-tail refinement.

### What's NOT in this commit (next up)

- **AI context integration**: `renderBookMetadata` doesn't yet include edges. Once it does, the chat will be able to list cross-book edges and the AI's existing `[[cite]]` mechanism will naturally render cross-book citations as clickable links. ~30 lines in claudeService.js + a BASE_PROMPT update.
- **Reader UI for cross-book navigation**: clicking a chat citation that points to a different book should open the split-screen reader on that book at the target chunk. The infrastructure already exists (split-screen reader is shared); we just need the URL to point at the target book.
- **Bibliography parser improvements**: still doesn't extract `title` for entries (physics-paper bib entries rarely have explicit titles — they go author/journal/year). Author similarity matching as a fallback for entries without arXiv IDs is the next refinement.
- **Embedding-based candidate ranking**: lexical overlap is good enough to validate the architecture, but the final ranker should use embeddings or a Nano LLM call for fuzzy matches. Per Vision §4.3.

### Step 4 status

| Sub-step | State |
|---|---|
| Bibliography extraction | ✅ Working |
| Library matching (arXiv exact) | ✅ Working — 3 resolved keys across 4 books |
| S-class edge resolver | ✅ Working — 7 real edges in DB |
| Edge model populated | ✅ |
| AI context includes edges | ⏭ Next commit |
| Reader UI clickable cross-book navigation | ⏭ Next commit |
| Category I (same-book) resolver | ⏭ |
| Category B (broad search) resolver | ⏭ |
| Crawler for unresolved S entries (e.g. Rodina's `2312.12682`) | ⏭ Future |

---

## 2026-04-10 PM 2 — Quality audit + Step 4 unblocked

Sampled 12 pages (3 per book × 4 books) to check whether the regenerated metadata is **semantically accurate**, not just syntactically present.

### Verdict
Tags are accurate ~90-95% of the time. The audit confirms:
- **Citation → S** works (Rodina p1: `"in [15] it was conjectured..." → role=citation, search=S` ✅)
- **Internal ref → I** works (`"see Appendix A" → search=Ia` ✅)
- **B for unjustified claims** works (mathematical assertions without proof get `Bn`/`Bm`)
- **L for logical gaps** works (algebraic expansions with elided steps get `Ls`)
- **Tag content matches span text**: `hidden_zeros, boundary_propagators, kinematic_mesh, f_polynomial, stringy_integral, integral_evaluation` all align with what the text actually says
- **Confidence letters ARE being assigned by the model** — we see `Bn`, `Bm`, `Bp`, `Ia`, `Ib`, `Ls`, `Lt`, `Iv` distributed across spans, not a single confidence applied uniformly. The model is making graded judgments. Not yet *calibrated* (we haven't run a judge), but they're real signals.

### Quality issues observed (~5-10% of spans, none blocking)
- **Section numbers mis-tagged as `proof`** — spans whose entire text is `"1."`, `"2."`, `"3."` get `role=proof` because the model reads numeric labels as proof-step markers. Affects ~2-3% of spans across the audit.
- **`role=(none)` gaps** — ~3-5% of spans have no role assigned (parser couldn't extract one even though the model output something).
- **`proof` vs `preview` confusion** for "we will prove X" announcement sentences.
- **Bibliography pages collapse to 1 span** with `(none)` tags. The 60-sentence cap eats them. ~4 pages library-wide.
- **Cao p27 over-uses `background`** for dense math that's really equation/derivation content.

These are refinements, not structural failures. Edge classification is unblocked.

### Judge model — decision

**Not building it yet.** Reasoning:
- The deterministic enrichment gate **never fired** during regens (every page hit ratio 1.00). The prompt + session reset + format gate are catching format-collapse drift on their own.
- Cost is not the blocker. Per Vision §5.5 a 10%-sample judge pass for the whole library is **~$0.40 one-time** — well below the Vision doc's $0.55/book estimate because our library is smaller.
- The judge would catch *semantic* errors that the deterministic gate can't (the section-number-as-proof class). Those are 5-10% of spans, not catastrophic.
- The right time to build the judge is **after** edge classification starts producing edges. Then the judge can grade spans AND edges in one pass, and its feedback informs both layers simultaneously.
- **Calibration of confidence letters** can come for free from the edge pipeline itself: when Opus actually finds justifying edges for 50% of `Bn`-tagged spans, that's empirical confirmation. No separate calibration run needed.

### Step 4 unblocked

Metadata layer is healthy enough to start prototyping the **edge resolution pipeline**. 539 non-N spans across the library is enough to validate Vision §4.3:
- **143 S spans** point to specific external sources (these books cite each other heavily — first edges may resolve immediately)
- **54 I spans** point to internal references in the same book (Category I is the cheapest to validate first per Vision §4.3)
- **279 B spans** are uncited assertions for broad search
- **63 L spans** are logical gaps awaiting notes (Phase 5 territory)

**Next step:** stand up `candidateService` + `classificationService` for Category I first. Use Rodina (9pp, 6 I-spans) as the validation book. If the Y/N + relevance + confidence format from Vision §4.3 fires correctly on Rodina's I spans, expand to S and B.

### Cadence rule update

Update.md is now **newest-first** with older sections trimmed to one-line summaries. New entries go at the TOP under the preamble. The cadence rule is documented in persistent memory at `feedback_update_md_cadence.md`.

---

## 2026-04-10 PM — Span pipeline shipped, full library regenerated

Metadata layer rebuilt across all 4 books. Final coverage:

| Book | Pages | Spans | Chunks | Page% | Tag% | Role% | Search% | Chunks-tagged |
|---|---|---|---|---|---|---|---|---|
| Rodina (9pp) | 9 | 207 | 101 | 100% | 95% | 97% | 29% | 90% |
| Arkani-Hamed (58pp) | 58 | 948 | 443 | 100% | 99% | 98% | 23% | 100% |
| Gonzales/Ward (14pp) | 14 | 318 | 150 | 100% | 97% | 98% | 23% | 98% |
| Cao (52pp) | 52 | 775 | 370 | 100% | 98% | 95% | 24% | 99% |

Library totals: **2,248 spans, 1,064 chunks, 539 non-N search-class assignments** (B=279, S=143, L=63, I=54).

Vs. baseline before the rework: page coverage 14-33% → 100%; span tags 2-68% → 95-99%; chunks tagged 3-67% → 90-100%; search classes 0-8% → 23-29%. The S=143 number is the one that proves the parser fix worked — it was 0 before.

### Key decisions preserved for future sessions
- **`SPAN_SESSION_MAX_PAGES = 8`** — forces full prompt re-injection every 8 pages. Was `SPAN_SESSION_MAX_CHUNKS = 200` (counted as pages, never fired).
- **Three-pass quality gate in `generateSpansForPage`**: initial → empty-retry → enrichment-retry. Pass 2/3 force a session reset on recovery.
- **DSL parser accepts `S` bare** (Vision §3.2: S has no confidence suffix). Old parser regex `/^[LISB][a-z]$/` silently rejected bare S.
- **`generateSpansForBook` auto-chains into `generateChunksForBook`** at the end. No more two-step regen.
- **`SPAN_MIN_ENRICHED_RATIO = 0.5`** — page output is "drifted" if <50% of parsed spans carry any metadata. Triggers retry with full prompt.
- **`SPAN_MAX_SENTENCES_PER_CALL = 60`** — was 30, was silently truncating dense pages. Pages still exceeding 60 emit a warning. Bibliography pages with 120-190 sentences still get truncated and produce 1-3 spans — known minor issue.

### Known minor issues (deferred)
- ~4 pages library-wide hit the 60-sentence cap (bibliography, dense appendix). Fix: split into multiple LLM calls.
- Span-to-sentence ratio is closer to 1:1 than the Vision doc's 1:3-5. Inflates span counts. Tunable later.
- Section numbers like `"1."` mis-tagged as `proof`. Tunable in prompt or via judge model when it ships.
- `judgeService.js` still doesn't exist. See decision rationale in the section above.

---

## 2026-04-09 → 2026-04-10 AM — UI/UX shell + chat + investigation

Earlier work in this project window. Trimmed to what future sessions might need to recall.

### Shipped end-to-end
- **Reader citation callout box** that wraps the matched paragraph + absorbs trailing display-math and equation-number siblings. Never breaks MathJax (block-level wrapping only). 4-pass matcher with prefix ladder + alnum-strip LaTeX fallback.
- **Vision HTML normalization** in `visionService.js` wraps `\[...\]` in `<div class="math-display">` so display math absorbs correctly downstream.
- **Chat citation contract** — text between `[[cite]]` tags is the verbatim quote (not "open in book"). Parser at `views/chat.ejs:199-219` reads inner text for both display and `?highlight=` URL.
- **Per-span / per-chunk tag distinction** in `renderBookMetadata` — `chunk_tags:` and `span_tags=[…]` are syntactically distinct labels. Chat BASE_PROMPT format renders chunk tags at `### Page N, Chunk #M` headers and span tags inline under each span.
- **AI context: notes per scope** — `renderBookNotes(bookId)` flows through book/collection/highlight scopes via `renderBookMetadata`. `getLibraryNotes()` for All Files orphan chats. Library scope also dumps per-book `renderBookMetadata` so "show me metadata for book X" works from anywhere.
- **All Files restructure** — sidebar nav "Chats"/"Collections" → "All Chats"/"All Files". The "All Books" pseudo-collection is filtered everywhere (sidebar lists, chat move/copy picker) but kept as a DB record because uploads auto-add to it. New routes: `GET /files`, `GET /files/notes`, `GET /files/notebook/:bookId`. New views `files.ejs` and `files-notebook.ejs`. Notebook view loads MathJax + auto-wraps bare LaTeX in `\[...\]`.
- **Notebook page pill + quote blockquote** open the reader in the split-screen panel via `chat-split-reader.js` (shared with chat citations).
- **Collections chevron toggle** — separate click target from the row's nav link. State persisted per-collection in `localStorage`.
- **Chat kebab menu** — Move to / Copy to / Delete. Copy uses new `POST /api/chat/:id/copy` that clones messages but takes a new `collectionId`, leaving the original untouched.
- **Settings modal + 3-theme picker** — `space` (default), `nebula`, `midnight`. Inline theme loader in `layout-start.ejs` runs before CSS to prevent FOUC. Three themes keyed off `data-theme` on `<html>`. The reader has its own mini-sidebar that doesn't share `sidebar.ejs` — settings gear isn't there yet.

### Workflow rules in persistent memory
- **Auto-commit + push** after every code edit with detailed message describing what + why. Commit history is the running log.
- **Update.md cadence** — newest-first, no duplicates, every ~3 substantive responses. Trim older entries to one-line summaries when superseded.

### Spec/vision references (don't restate the docs themselves)
- **`Vision.md`** in repo root — the source of truth for architecture decisions. §4.1 covers @@ span system + N/L/I/S/B triage, §4.3 covers cross-reference resolution pipeline, §5 covers cost economics. Always check this before designing new metadata or edge work.
- **`Gyde-research-libarary-specs.md`** — the developer spec. §3 specifies the @@ span DSL format in detail, §4 specifies Span/Chunk/Page schemas.
