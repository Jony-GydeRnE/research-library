# Notes Vision Quality Loop — Spec

Written 2026-04-12. **Spec only — no code yet.** Review before CC builds.

The current vision pipeline produces ugly HTML from handwritten / stylus notes PDFs: every equation ends up on its own line, each wrapped in a black-box visual container even when the original had two equations on one line, subscripts sometimes drop, display math and inline math get flattened to the same layout, and the result barely resembles the source page. This spec describes a quality loop that produces faithful, beautiful HTML for notes-kind books specifically, using Opus for LaTeX generation and a separate judge model for visual accuracy verification, with a critique-and-redo cycle until each page passes a 95% accuracy bar.

This is **not** a replacement for the existing vision pipeline — it is a notes-specific upgrade path that activates when `book.kind === 'notes'` and otherwise leaves papers / textbooks alone. Papers produced by journals already render acceptably under the current pipeline.

---

## 0. Why this needs its own pipeline

The existing pipeline (`services/visionService.js`) sends one page image to GPT-4o with a standard HTML-generation prompt and takes the output verbatim. This works for typeset PDFs because GPT-4o already knows how to OCR cleanly-typeset mathematics. It fails on handwritten notes because:

- Handwritten math is genuinely harder. The model degrades to "equation per line" as a safe default.
- There is no feedback loop — if the output is wrong, nothing notices.
- The prompt does not know it's processing notes, so it doesn't try harder on layout fidelity.
- The system has no ground truth to check against other than the image itself, which is expensive to re-verify mid-pipeline.

The quality loop proposed here uses the strongest available LLM for generation, the strongest available vision model for verification, and iterates until the output matches. It is slower and more expensive per page (~5x) but produces output Jony wants to actually read, which the current pipeline demonstrably does not.

---

## 1. Pipeline shape

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│   PDF page  ──rasterize──▶  PNG (source image)              │
│                                                              │
│          ┌──────────────────┐                                │
│          │                  │                                │
│          ▼                  │ (retry with critique)          │
│   GENERATE step             │                                │
│   Opus vision +             │                                │
│   LaTeX-first prompt        │                                │
│          │                  │                                │
│          ▼                  │                                │
│   Candidate HTML            │                                │
│   + rendered preview PNG    │                                │
│          │                  │                                │
│          ▼                  │                                │
│   JUDGE step                │                                │
│   Sonnet or Opus judge      │                                │
│   Compares source PNG vs    │                                │
│   preview PNG              │                                 │
│          │                  │                                │
│          ▼                  │                                │
│   {accuracy, critique} ─────┘                                │
│          │                                                   │
│          ▼ accuracy >= 0.95                                  │
│                                                              │
│   Accept → persist Page.htmlContent                         │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

Each stage is independently replaceable. The GENERATE step can later be swapped to a fine-tuned LaTeX-specialist without touching the JUDGE step. The JUDGE step can be replaced with a cheaper model without touching GENERATE.

---

## 2. First-attempt mode vs per-page mode

Per Jony's explicit instruction: **the first generation pass does the entire notes PDF in one go**. Opus receives all page images and produces HTML for all pages in a single call, under the assumption that context coherence helps (the model sees what concepts were defined on page 1 when rendering page 12).

If the first pass passes the judge for every page, we're done — one Opus call covered the whole book.

If any page fails the judge, subsequent retries happen **one page at a time**. The judge's critique for that specific page is included in the retry prompt. Other pages that already passed are left alone. This keeps retry cost bounded per failure and prevents a single bad page from forcing a full re-render.

```
first attempt:  PDF -> Opus(whole book) -> N HTML pages -> judge each
                                                            ↓
                                  for each failed page: Opus(page + critique) -> judge
                                                            ↓
                                                (up to MAX_RETRIES, default 3)
```

---

## 3. The GENERATE prompt

New file: `prompts/notes-vision-generate.txt`. Goals:

- **LaTeX-first.** Every piece of math goes into `\(...\)` or `\[...\]` so MathJax renders it. Inline math stays inline. Display math stays display. No black-box equation wrappers.
- **Preserve layout.** If two equations sit side by side on the source page, emit them in the same paragraph with `\quad` or inside a single `\[... \quad ...\]` block. If one equation is numbered and the other isn't, keep that asymmetry.
- **Faithful prose flow.** Handwritten notes often have sentences that wrap around equations. The HTML should preserve "and therefore we have \(X = Y\) which implies..." as a single `<p>` element, not three fragments.
- **Figure awareness.** When the source has a diagram, emit a `<figure>` placeholder with a description attribute (the diagram itself isn't re-rendered in HTML; it's just marked for the user to view in the original-PDF mode).
- **Numbering preservation.** Equation labels `(1)`, `(2)` and section numbers `3.2` appear exactly where they did in the source.
- **Minimal CSS.** Only structural elements (`<p>`, `<h2>`, `<figure>`, `<em>`). No inline styles. No black backgrounds. The reader already has a stylesheet and equations should inherit from it.

The prompt's worked example is a photograph of a notes page (hand-drawn Feynman diagram + two equations side by side + prose wrapping around them) with the canonical HTML output. This is the teaching signal — Opus matches the style of the example.

Verbatim prompt shape (to be written during implementation; outline here):

```
You are converting a photograph of an academic researcher's
handwritten / stylus-drawn notes page into clean, beautiful,
mathematically-faithful HTML. You are NOT an OCR engine — you
are a typesetter.

RULES:
1. Every math expression becomes LaTeX inside \(...\) for
   inline or \[...\] for display. Never emit images of math.
   Never wrap math in boxes.
2. Preserve the SPATIAL layout of the source. Equations that
   are side by side stay side by side. Use \quad and aligned
   environments. Don't default to one equation per line.
3. Preserve prose flow. A paragraph is a paragraph, not a
   sequence of standalone equations with captions.
4. Use minimal HTML: <p>, <h2>, <ul>/<li>, <figure> for
   diagram placeholders. No inline styles. No black boxes.
   No <div class="equation"> wrappers — let MathJax handle it.
5. Figure out what the notation actually means. If the source
   uses a subscript, the LaTeX has a subscript. If the source
   has \partial, output \partial, not ∂ or derivative.

OUTPUT: one HTML block per page separated by
<!-- PAGE N -->. No prose outside the HTML.

EXAMPLE: [image of a Rodina notes page with two side-by-side
equations and prose] →
<p>We recall the BCFW shift...</p>
<p>\[ p_i \to p_i + zq, \quad p_j \to p_j - zq \]</p>
<p>which acts on the planar invariants as \(X_{ij} \to
X_{ij}(z)\)...</p>
```

---

## 4. The JUDGE step

A separate LLM call whose only job is to compare the generated HTML (rendered to a preview PNG) against the original source PNG and emit an accuracy score + critique.

**Input to the judge:**
- The source page PNG (original PDF rasterized)
- The preview PNG (Opus's HTML rendered to an image via a headless browser + MathJax)
- The generated HTML source (for the judge to cite specific lines in its critique)

**Output:**
```
ACCURACY: 0.00-1.00
VERDICT: PASS | FAIL
CRITIQUE:
  - <specific issue 1 with location and what's wrong>
  - <specific issue 2 ...>
  - ...
WHICH PARTS ARE FINE:
  - <positive observations the retry prompt should preserve>
```

The judge's critique is structured so the retry prompt can quote it directly. Examples:

```
ACCURACY: 0.78
VERDICT: FAIL
CRITIQUE:
  - Two equations on source line 4 are side by side (\(a^2 + b^2 = c^2\) and
    \(E = mc^2\)) but the HTML puts them on separate lines.
  - The subscript on \(X_{1,3}\) in paragraph 2 is missing
    the second index; the source shows \(X_{1,3}\) but the
    HTML has \(X_1\).
  - The diagram in the top-right is not marked as a <figure>.
  - Equation (3) is numbered in the source but unnumbered
    in the HTML.
WHICH PARTS ARE FINE:
  - Paragraph 1 prose flow is correct.
  - Equations 1 and 2 rendered cleanly inline.
```

**Judge model selection**: start with Claude Sonnet 4 (cheaper than Opus, still strong at visual comparison). If quality issues persist, swap to Opus. The judge runs once per page per attempt, so its cost is comparable to the generate step.

**Threshold**: `NOTES_VISION_JUDGE_THRESHOLD = 0.95` per Jony's spec. Anything below = retry.

---

## 5. HTML → preview PNG (rendering the candidate)

The judge needs a PNG of what the HTML looks like rendered, so it can compare against the source page visually. This requires a headless browser pass:

1. Launch Puppeteer (or Playwright) against a minimal HTML template with MathJax loaded.
2. Inject the candidate HTML.
3. Wait for MathJax typeset to complete.
4. Screenshot the rendered viewport at the same aspect ratio as the source page.
5. Pass the PNG to the judge alongside the source PNG.

**Dependencies to add** (new):
- `puppeteer` OR `playwright` (Puppeteer is smaller, already widely used, ~250MB install)
- A minimal render template at `prompts/notes-render-template.html` with MathJax CDN loaded

**Alternative if headless browser is too heavy**: use `mathjax-node` to server-side-render the math to SVG, then compose into a page image via `sharp`. Avoids the browser dependency but is more fragile on edge cases (display math inside paragraphs, complex aligned environments). I lean toward Puppeteer for robustness.

**Caching**: the preview PNG is cached per `(bookId, pageNumber, attemptNumber)` in the filesystem at `/tmp/notes-preview/<bookId>/page-<n>-attempt-<k>.png`. Overwritten on retry. Deleted after a successful judge pass.

---

## 6. The retry loop

```
for attempt in 1..NOTES_VISION_MAX_RETRIES (default 3):
  if attempt === 1:
    # Whole-book first attempt
    result = opusGenerateWholeBook(pdf_images)
  else:
    # Per-failed-page retry with critique
    result = opusRetryPage(
      pdf_image=failed_page_image,
      prior_html=prior_attempt_html,
      critique=judge_critique,
      prior_accuracy=judge_accuracy,
    )

  for each page in result:
    preview_png = renderToPng(page.html)
    verdict = judge(source_png=page.source_png,
                    preview_png=preview_png,
                    html=page.html)
    if verdict.accuracy >= NOTES_VISION_JUDGE_THRESHOLD:
      mark page as PASS
    else:
      mark page as FAIL with critique

  if all pages PASS:
    commit htmlContent for every page
    exit

  if attempt == NOTES_VISION_MAX_RETRIES:
    commit BEST-effort html (highest-accuracy attempt) with
      a banner "This page has known rendering issues — click
      'View original' to see the source image."
    exit
```

The retry prompt for a single page includes: the original PNG, the prior HTML attempt, the judge's critique, and the judge's "WHICH PARTS ARE FINE" list. The instruction is "fix the critique items without regressing the fine parts". This is the same pattern as iterative code review.

**Hard ceiling**: 3 attempts per page. Beyond that, commit the best attempt with a banner. The user can manually request another round via the kebab.

---

## 7. Data model additions

All nullable, no migration.

**`Page` schema**:
```
notesVisionAttempts        Number default 0
notesVisionLastJudgeScore  Number default null
notesVisionStatus          enum ['untouched','running','passed','best-effort','failed'] default 'untouched'
notesVisionCritique        String default null       // last judge critique if failed
notesVisionVersion         Number default 0          // bump to force re-render
```

**`Book` schema** additions:
```
notesVisionStatus: {
  totalPages: Number,
  passedPages: Number,
  bestEffortPages: Number,
  totalCostUsd: Number,
  lastRunAt: Date,
  version: Number,
}
```

No new collections.

---

## 8. When this runs

**Trigger rules:**
- Only for books with `kind === 'notes'`. Papers / textbooks keep using the existing vision pipeline.
- Automatically on upload of a notes-kind book (new path in `services/jobService.js`).
- Manually from the kebab on the Files page: "Re-render notes HTML" — for books uploaded before this feature shipped.
- Automatically when `NOTES_VISION_VERSION` config bumps and a manual sweep is triggered (same pattern as `QUALITY_SWEEP_VERSION`).

**Does NOT trigger:**
- On every edit to a notes book.
- On routine chunks/spans re-generation.
- On metadata sweeps (the metadata pipeline operates on text, not HTML).

---

## 9. Cost model

Per-page cost depends on the attempt count:

| Attempt | Model | Cost per page |
|---|---|---|
| 1 (whole-book, amortized) | Opus vision | ~$0.08-0.15 |
| 1 judge | Sonnet vision | ~$0.01-0.02 |
| 2 (per-page retry) | Opus vision | ~$0.05-0.10 |
| 2 judge | Sonnet vision | ~$0.01-0.02 |
| 3 (per-page retry) | Opus vision | ~$0.05-0.10 |
| 3 judge | Sonnet vision | ~$0.01-0.02 |

Expected average: ~80% of pages pass on attempt 1, ~15% on attempt 2, ~5% at best-effort after 3. Per-page weighted cost: ~$0.12-0.25.

For a 50-page notes PDF: ~$6-12 first-run cost. Worst case (all pages require 3 attempts): ~$25-50. Per the $150K library budget this is trivially small.

**Cost ceiling**: `NOTES_VISION_COST_WARN_PER_BOOK_USD = 20`. Pause and confirm above this.

---

## 10. Failure modes

**Puppeteer won't launch** (missing Chromium, permissions, etc.): fall back to accepting the Opus output without visual judging. Log a warning. The HTML still goes through — it's just not verified. This is better than refusing to ingest the book.

**Judge disagrees with itself on reruns** (accuracy jitters between passes due to prompt noise): introduce a stability check — require two consecutive passing scores before committing. For v1, accept the first passing score and move on; add the stability check if we see jitter in practice.

**Opus produces invalid HTML** (unclosed tags, malformed LaTeX): run the candidate through a basic HTML validator (`htmlparser2` or similar) and a LaTeX sanity check (`\(` balance, `\[` balance) before sending to the judge. If either fails, treat it as an automatic FAIL with critique "HTML is malformed: <error>" and retry.

**Page has no math and no diagrams** (pure prose): the quality loop still runs but should pass trivially on attempt 1. The judge's threshold is layout + faithful text, not math complexity.

**Catastrophic page** (3 attempts all fail): commit the best-attempt HTML plus a visible banner at the top of the page in the reader: "This page couldn't be re-rendered cleanly — click 'View original' for the source image." The banner links to PDF mode at that page.

---

## 11. Observability

**New field on stats modal** (under the existing notes block):
```
Notes Vision Quality
  Last run:    2026-04-12 18:42 (version 1)
  Pages:       50 total
     Passed:      42
     Best-effort:  5
     Failed:       3
  Cost:        $9.80
  Re-run button
```

**Server logs**:
```
[notesVision] book <id> attempt 1 of 3: rendering 50 pages
[notesVision] book <id> attempt 1 result: 42/50 passed, 8 failed
[notesVision] book <id> attempt 2 of 3: retrying 8 failed pages
[notesVision] ... (per-page attempt 2 lines)
[notesVision] book <id> attempt 3 of 3: retrying 3 failed pages
[notesVision] book <id> DONE: 47 passed, 3 best-effort, $9.80 total
```

**Debug artifacts on best-effort failures**:
Save `/tmp/notes-debug/<bookId>/page-<n>-attempt-<k>/` containing:
- `source.png` — the original
- `preview.png` — the rendered
- `attempt.html` — the HTML Opus produced
- `critique.txt` — the judge's critique
- `meta.json` — accuracy, cost, retry count

This lets us iterate on the prompts post-hoc by looking at real failures.

---

## 12. What is NOT in v1

- **Incremental repair.** The loop re-renders whole pages, not individual equations. A page with one bad equation still gets a full-page retry. Fine-grained equation repair is a v2 optimization.
- **Style transfer.** We don't try to make the HTML "look like" the source in font/color — we just try to make it accurate. Typography inherits from the existing reader stylesheet.
- **Diagram transcription.** Hand-drawn diagrams become `<figure>` placeholders with a description. Actually rendering the diagram as SVG from a description is a v2 feature.
- **Cross-page coherence in retries.** When a page retries, the retry prompt only sees that page's image and critique, not the neighboring pages. Whole-book first attempts DO see all pages at once, which is where coherence benefits live. Per-page retries are deliberately isolated to keep cost bounded.
- **Fine-tuned LaTeX specialist.** Using Opus for v1. A fine-tuned model trained on LaTeX/handwriting pairs would be better but requires data collection. Deferred.
- **Concurrent page processing.** Single-threaded for v1 (same reason as the quality sweep). A parallel worker pool is a later optimization.

---

## 13. Build order

1. **Spec review** — this doc.
2. **Renderer prototype** (standalone script, no integration). Given an HTML string and a source PNG, produce a preview PNG via Puppeteer. Validate on 5 hand-picked test pages from Jony's notes library.
3. **Judge prototype** (standalone script). Given source PNG + preview PNG + HTML, call Sonnet and return a parsed verdict. Validate the critique format is useful.
4. **Generate prompt iteration**. Write `prompts/notes-vision-generate.txt` and test it on 5 hand-picked pages with no retry loop. Compare Opus output quality to the existing vision pipeline's output. Iterate on the prompt until the judge's first-attempt accuracy averages > 0.85 on the test set.
5. **Retry-with-critique prompt**. Write the retry template. Test on 3 pages that failed the first attempt. Verify the retry prompt leads to accuracy improvement, not just different kinds of errors.
6. **End-to-end pipeline wiring.** New service `services/notesVisionService.js` integrating generate → render → judge → retry. Agenda job `notes-vision-repair`.
7. **Kebab UI + stats modal integration.**
8. **Live validation** on Jony's Lagrangians notes book. If passing rate is above 80% on attempt 1, ship. Otherwise iterate on the prompt.

Each step has its own validation gate. We don't move forward if the previous step doesn't meet its bar.

---

## 14. Open questions

1. **Puppeteer vs mathjax-node SSR for the renderer.** Puppeteer is more robust; mathjax-node is lighter. I lean Puppeteer. Decision before build.

2. **Judge model: Sonnet or Opus.** Sonnet is cheaper and likely sufficient for "does the rendered preview match the source?". Opus is overkill for visual comparison. I lean Sonnet.

3. **First-attempt whole-book vs per-page.** Jony's spec says whole book first. This is correct for context coherence but has a downside: if one page causes Opus to run out of output tokens, the whole book attempt fails. Mitigation: if the whole-book response is truncated (finishReason === 'max_tokens'), automatically fall back to per-page for the remaining pages in attempt 1. Doesn't count as a retry.

4. **Retry isolation.** Per-page retries don't see neighboring pages' HTML. Should they? Benefit: coherent notation across pages. Cost: 2-3x retry token budget. I lean no for v1.

5. **Judge threshold for best-effort.** At what accuracy do we accept a best-effort commit instead of retrying? I lean: best attempt's accuracy must be ≥ 0.70, otherwise we fail the page entirely and fall back to the existing vision pipeline's output. This prevents committing garbage as "best effort".

6. **Kebab wording.** "Re-render notes HTML" / "Improve notes display" / "Refine notes rendering". I lean "Improve notes display".

7. **Manual override flag.** A way to force-accept a page Opus produces even if the judge flags it. Useful when the judge is being pedantic about layout minutiae the user doesn't care about. I lean: add `forceAccept: true` in the manual kebab "Accept current version" button per page in the stats modal.

8. **Where to store the source page PNGs.** They're already produced by the existing vision pipeline for PDF-mode rendering at `/images/<bookId>/page-<n>.png`. Reuse them rather than re-rasterize. Saves time.

---

## 15. What this solves

The user's complaint was:
> every single equation even the ones that should be side by side or in the same line are a new line and each equation is in a black box when in reality we don't need any of those boxes — this is not chunk view it is html view.

Root causes in the current pipeline:
- GPT-4o vision prompt doesn't care about layout fidelity beyond "the text is correct".
- No visual verification step.
- No retry loop, so a bad output is the final output.
- The reader's CSS wraps math in visible containers (`.math-display`, the black box).

This spec addresses all four:
- LaTeX-first prompt with layout examples that teach side-by-side rendering and prose flow.
- Judge model that sees the preview and critiques layout specifically.
- Retry loop that incorporates the critique.
- No CSS changes needed because the new prompt emits `\(...\)` / `\[...\]` directly and the reader's stylesheet already knows how to render MathJax output without extra containers. (If there IS a black-box style somewhere, we fix it in the same v1.)

---

*End of spec. Answer §14's questions, then CC builds in the order of §13.*
