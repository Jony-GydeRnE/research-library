update.md
 as of April10-12-17am 2026

 Claude Code writes:

 I've read the Vision doc and the spec doc end-to-end, and run the diagnostic against your live database. I have a clear picture now. No code changes yet — you asked for strategy first and that's what this
  message is.

  ---
  Diagnostic results (from your live DB, just now)

  Book                                            Pages  Chunks  Spans  Page%   span-tags%   span-roles%   span-search%   chunk-tag distribution
  ─────────────────────────────────────────────── ─────  ──────  ─────  ─────   ──────────   ───────────   ────────────   ──────────────────────
  Hidden zeros equivalent to enhanced UV (Rodina)    9      5      52    33%        65%          58%           8%         23, 0, 0, 0, 0
  Hidden zeros for particle/string amps               58     77    211    28%         2%           2%           0%         4, 4, 0, 0, ... (75 zeros)
  Hidden Zeroes in Massive Theories (Gonzales/Ward)   14      9     22    14%        68%          68%           5%         4, 5, 3, 3, 1, 3, 0, 0, 0
  Understanding zeros/splittings (Cao et al.)         52     33     88    15%         6%           6%           0%         5, 3, 0, 0, ... (31 zeros)

  Three things are wrong and they're all in the span generation pipeline, not the chat prompt, not the renderer, not the UI:

  Problem 1 — Page coverage is ~14–33%

  Only 14–33% of pages in any book actually have spans. For a 58-page book, 42 pages have zero spans. Those pages contribute nothing to the metadata layer, so the AI has nothing to cite from them and the
  edge graph can't touch them. The likely causes (need to verify in the spanService code + logs):
  - Vision failed silently on some pages → rawText empty → spanService skipped them (we see this in the 0453305 logs)
  - DSL parser silently dropping malformed lines
  - Page loop erroring out mid-book and not recovering

  Problem 2 — Session drift destroys tag quality after the first chunk

  Look at the chunk-tag distribution columns: 23, 0, 0, 0, 0 / 4, 4, 0, 0, ... / 5, 3, 0, 0, .... The pattern is identical across three of the four books: the LLM produces good tags for the first 1-2 chunks,
   then stops emitting contextTags entirely.

  The Vision doc predicted exactly this: "Each session typically covers 50-200 chunks before needing a reset... This is the primary mechanism for maintaining consistent metadata quality at scale." The judge
  model system is supposed to detect quality drops and force a new session with the full prompt. That mechanism either isn't running or isn't triggering. The 22-span Rodina book (small) is the outlier at 65%
   because it fits in one session before drift; the 77-chunk Arkani-Hamed book falls off a cliff at 2% because drift hits chunk 3.

  Book 3 (Gonzales/Ward) is a useful control — small enough (14 pages, 9 chunks) that tags make it through 6 of 9 chunks before fading. That's what a short-session book looks like without forced resets.

  Problem 3 — Search classes (N/L/I/S/B) are essentially absent

  0, 0, 1, 4 search classes per book. This is the one that matters most for the actual product. The Vision doc is explicit:

  ▎ "The @@ span system + N/L/I/S/B triage... Ensures only the right chunks are compared at the right cost." — §9 What Makes This Different
  ▎ "This classification determines which chunks enter which comparison pipeline and at what cost. It is the primary cost-control mechanism in the entire system." — §4.1

  Without search classes, the edge classification pipeline (Phase 3 in your spec, and the entire thesis of "edges are the product") has nothing to work from. The triage system simply can't fire. There are
  also zero Edge documents right now, which is consistent with this.

  ---
  Where we are vs. the big picture

  Mapping what's built to the Vision doc architecture (§4):

  ┌──────────────────────────────────────────────┬─────────────────────────────────────────────────────┬──────────────────────────────────────────────────────────────────┐
  │                  Component                   │                Vision doc reference                 │                              State                               │
  ├──────────────────────────────────────────────┼─────────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────┤
  │ PDF + vision HTML extraction                 │ §4.1 "Page-Level Processing via Vision Models"      │ ✅ Working                                                       │
  ├──────────────────────────────────────────────┼─────────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────┤
  │ Structured rendered document view            │ §4.1 "Rendered HTML/text view as primary"           │ ✅ Working (reader)                                              │
  ├──────────────────────────────────────────────┼─────────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────┤
  │ Structural type detection (regex pre-LLM)    │ §4.1 "Structural Type Detection (Pre-LLM, Free)"    │ ✅ Built (structuralAnnotations)                                 │
  ├──────────────────────────────────────────────┼─────────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────┤
  │ @@ span annotation system                    │ §4.1 "The @@ Span Annotation System and Output DSL" │ ⚠️  Built, producing degraded output                              │
  ├──────────────────────────────────────────────┼─────────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────┤
  │ Search-class tags (N/L/I/S/B)                │ §4.1 "Search-Class Tags"                            │ ❌ Almost entirely absent from data                              │
  ├──────────────────────────────────────────────┼─────────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────┤
  │ Chunks derived from spans                    │ §4.1 "Chunks Derived from Spans"                    │ ✅ Built                                                         │
  ├──────────────────────────────────────────────┼─────────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────┤
  │ Embeddings on chunks + tagged spans          │ §4.1 "Embedding Generation"                         │ ⚠️  Built but unused without edges                                │
  ├──────────────────────────────────────────────┼─────────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────┤
  │ Judge model / session cycling                │ §4.2 "Quality Convergence Cycle"                    │ ❌ Not firing — the root cause of Problem 2                      │
  ├──────────────────────────────────────────────┼─────────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────┤
  │ Cross-reference resolution (I/S/B pipelines) │ §4.3                                                │ ❌ Not built (blocked by Problem 3)                              │
  ├──────────────────────────────────────────────┼─────────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────┤
  │ Edge classification + reciprocal/transitive  │ §4.4                                                │ ❌ Not built                                                     │
  ├──────────────────────────────────────────────┼─────────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────┤
  │ AI research partner (grounded chat)          │ §4.6                                                │ ✅ Working, but ungrounded on edge data because there aren't any │
  ├──────────────────────────────────────────────┼─────────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────┤
  │ Note ingestion as bulk source                │ §4.5                                                │ ❌ Not built (Phase 5 of spec)                                   │
  └──────────────────────────────────────────────┴─────────────────────────────────────────────────────┴──────────────────────────────────────────────────────────────────┘

  In one sentence: the UI/UX shell is excellent, the vision extraction is solid, the AI chat is grounded on notes beautifully — but the span/triage layer, which is the actual product per your own vision doc,
   is 15% baked, and the edge graph that the whole moat depends on can't be built on top of metadata this sparse.

  You wrote it yourself in the previous message: "without tags, there is nothing to categorize the span and thus the span doesn't exist." That is literally what the data shows: 186 spans in your library have
   no tags and effectively no identity in the graph sense.

  ---
  What I think we should focus on

  Nothing but the span pipeline until the coverage numbers look like the Vision doc targets. Everything else — more chat features, more theme polish, more notebook tweaks, the edge graph, the crawler, the
  marketplace — is downstream of this.

  Proposed three-step plan:

  Step 1 — Deep-dive the span pipeline (investigation, no code changes)

  Read spanService.js, chunkService.js, the judge model, and the session-management code end-to-end. Answer specifically:
  - Why are pages getting skipped? (Is it empty rawText after vision? Parse errors? Early return? Session state corruption?)
  - Is shouldResetSession() actually being called? What's the trigger threshold?
  - Is the judge model running at all? If yes, is it finding drift but the reset handler isn't executing?
  - Does the DSL parser silently drop lines that don't match the regex? If so, that would explain Problem 2 — the LLM might be outputting tags in a slightly different format that parses as empty.
  - Is the short prompt losing the tag instructions by not referencing them explicitly?

  Also re-read the raw DSL logs you already have from 0453305 to see what the LLM is actually producing on chunks 2, 3, 4, 5 of Book 2 when the tags drop off.

  Step 2 — Fix the pipeline (code changes)

  Based on Step 1, probably some combination of:
  - Force a session reset every N chunks (unconditionally, not waiting for the judge) so the full prompt — including the tag instructions — hits the LLM regularly
  - Strengthen the short prompt so it still reminds about tags every call, not just at session start
  - Quality gate at the parser level: if a span comes back with no context tags AND no search class AND no declarative tags, reject the parse and retry with the full prompt
  - Fix the page coverage gap: audit why pages are being skipped and cover each failure mode
  - Make the judge model actually run if it isn't, or fix its trigger if it is
  - Emphasize search-class tags in the prompt (the current span prompt treats them as optional; they should be mandatory for every non-N span, with B/L defaulting to something if the model declines to assign
   one)

  Step 3 — Regenerate everything and re-run the diagnostic

  Target numbers before we call it done:
  - Page coverage: ≥90%
  - Spans with contextTags: ≥80% (the Vision doc estimates ~95% of spans should have at least one context tag)
  - Chunk-tag distribution: tags present in ≥80% of chunks (not just the first 2)                             
  - Spans with search class: ≥35–50% (per §5.4 of Vision: 55% N + 16% L + 20% I + 0-15% S + 2-7% B, so 35-50% non-N is the target)
  - One book end-to-end working well enough to validate the edge classification pipeline on a small scale                         

  Step 4 (future) — Edge classification                                                                                                                                                                        
  
  Once metadata is healthy, start building candidateService + classificationService for I-class spans first (same-book resolution — cheapest and highest signal). Prove the Y/N + relevance + confidence format
   from §4.3 of the Vision doc works on real data. Then expand to S and B.
                                                                                                                                                                                                               
  What I'd deliberately NOT touch right now                                                                                                                                                                    
   
  - Chat prompt iteration (the last 3 commits were all BASE_PROMPT format tweaks; the real issue was never the format, it was that the data is sparse)                                                         
  - Reader UI refinements                                   
  - Notebook feature expansion                                                                                                                                                                                 
  - Theme/palette work                                                                                                                                                                                         
  - The settings panel
  - New scope additions                                                                                                                                                                                        
                                                                                                                                                                                                               
  These are all good, but they're rearranging furniture in a house where the foundation isn't poured yet.

---

## 2026-04-10 PM — Span pipeline rework (Step 2 of the plan above)

User gave the green light. The three problems identified in the strategy
above are now fixed in code. Nothing regenerated yet — the DB still
holds the old bad spans. The user needs to trigger regeneration to see
the new numbers.

### What shipped

**`config/pipeline.js`**
- `SPAN_MAX_SENTENCES_PER_CALL` 30 → 60. Was silently truncating dense
  pages.
- `SPAN_SESSION_MAX_CHUNKS` (200, counted as pages despite the name)
  replaced by `SPAN_SESSION_MAX_PAGES` = 8. Forces a full-prompt
  re-injection every 8 pages instead of never.
- New `SPAN_MIN_ENRICHED_RATIO` = 0.5. A page's output is considered
  drifted if fewer than half of its parsed spans carry any metadata
  beyond a sentence range.
- New `SPAN_RETRY_ON_EMPTY` = true. Pages that parse to zero spans
  retry with the full prompt.

**`prompts/span-generation-short.txt`**
- Completely rewritten. The old 3-line prompt was missing ROLE_TAG
  (required in the full prompt format), had no examples, and didn't
  mention search classes. The new version:
  - Explicitly requires at least one context tag, exactly one role
    tag from the enumerated list
  - Describes L/I/S/B search classes with confidence suffixes
  - Includes a worked 4-sentence example showing all tag types in
    action (citation, preview, proof reference, logical gap)
  - Tells the model to omit the search-class tag only for routine
    self-contained sentences (implicit N)

**`services/spanService.js`**
- Session counter renamed `chunksInSession` → `pagesInSession`
  (conceptual clarity — it was always counting pages).
- `shouldResetSession()` now reads `SPAN_SESSION_MAX_PAGES`.
- `startNewSession(reason)` logs why the session reset fired: book
  start / SPAN_SESSION_MAX_PAGES cap reached / empty-output recovery /
  low-enrichment recovery.
- New `isSpanEnriched(span)` / `enrichmentRatio(spans)` helpers.
- Extracted `runSpanLLMCall()` so Pass 1 / Pass 2 / Pass 3 share one
  code path with no DB write duplication.
- `generateSpansForPage` is now a 3-pass quality-gated pipeline:
  1. Pass 1 — run with full prompt (session start) or short prompt.
  2. Pass 2 — if Pass 1 parsed zero spans AND SPAN_RETRY_ON_EMPTY,
     retry with full prompt. Forces a session reset on recovery.
  3. Pass 3 — if enrichment ratio < SPAN_MIN_ENRICHED_RATIO AND we
     didn't already use the full prompt, retry with full prompt.
     Accept the retry result if it beats the original. Force a
     session reset on recovery.
- Added verbose per-page logging: pass number, prompt type, parse
  count, enrichment ratio. Plus a truncation warning when a page has
  more sentences than SPAN_MAX_SENTENCES_PER_CALL.

### What was deliberately not built

- **`judgeService.js`** — still doesn't exist. The deterministic
  enrichment gate catches the current failure mode (total format
  collapse) cheaper and faster than an Opus-based judge. Judge model
  is better for subtle drift in an otherwise-healthy pipeline, which
  is the next problem, not today's. Config tokens for JUDGE_MODEL
  etc. remain for the follow-up.
- **Data regeneration.** Code is fixed; DB still has the old bad
  spans. Next action: `POST /api/books/:bookId/generate-spans` (or
  whichever route triggers the book's span pipeline) to produce
  clean data and verify against the target numbers.

### Target numbers for verification (unchanged from strategy)

- Page coverage: ≥ 90%
- Spans with context tags: ≥ 80%
- Chunk-tag distribution: tags present in ≥ 80% of chunks
- Spans with search class: ≥ 35%

### New cadence rule

Update.md is now maintained automatically. Every ~3 responses a new
section is appended at the bottom summarizing landmark changes. Bad
attempts that were later fixed are not listed — only the final state
of each session's work matters. Read this file end-to-end to catch
up without scrolling through commit history.
