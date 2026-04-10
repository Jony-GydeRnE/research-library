# Update.md — Gyde Research Library

A rolling knowledge log of the project. **Newest entries at the top.** Read top-to-bottom to catch up on where the project stands without scrolling through commit history.

Maintained by Claude Code on a ~3-response cadence. Bad attempts that got fixed in the same session are not listed — only the final state of each session's work matters. Older sections are trimmed to one-line summaries when their detail is fully superseded; key decisions and target metrics are preserved so future sessions can recall them. Commit messages handle the comprehensive change record.

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
