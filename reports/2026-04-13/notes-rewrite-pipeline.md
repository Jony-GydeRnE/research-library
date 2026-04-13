# Notes-rewrite pipeline — first full pass

Date: 2026-04-13
Scope: Lagrangians & Euler-Lagrange Equation notes book
(`69d9ce81aa83b8b11c1837dd`) → linked to Hidden zeros for particle/string
amplitudes (`69d6622b12ac83f9752b4ca9`).

## What this session did

Built the first version of the notes-to-Rodina-rewrite pipeline. Previous
approach (vision-transcribe the notes verbatim) produced sloppy LaTeX,
broken equations, and "undefined" pages. Replaced with: retrieve the top-K
most relevant passages from the linked source paper, hand them to Claude
alongside the notes page image + extracted text, ask Claude to rewrite
the page as clean expository HTML/LaTeX in Rodina's voice with inline
`[[cite]]` tags.

Core files:

- `prompts/notes-rewrite.txt` — system prompt teaching the rewrite rules
  (voice, LaTeX rigor, citation-grounding requirements, no-fabrication).
- `scripts/rewrite-notes-page.js` — one-shot rewrite (single page, writes
  to `/tmp`, does NOT touch DB). Used for iteration.
- `scripts/rewrite-notes-pages-batch.js` — batch rewrite with prompt
  caching + Opus/Sonnet routing. Writes to `Page.htmlContent`, backs up
  originals to `Page.htmlContentLegacy`.
- `public/rewrite-preview.html` — standalone preview that renders a
  rewritten page with MathJax on a dark background, no reader.css
  leakage.

## Results on pages 1 + 3 (first test, Opus-only, no cache)

| | page 1 | page 3 |
|---|---|---|
| input tokens | 5,208 | 4,789 |
| output tokens | 1,703 | 1,883 |
| wall | 30.4s | 32.3s |

Batch total for 2 pages: **$0.4189**, **66.5s**, at Opus 4.6 pricing
(~$0.21/page).

Page 1 result: reorganized the free-particle-in-polar-coordinates notes
into clean Cartesian→polar→EL→Noether→functionals→action→field-theory
flow. Fixed the original's broken derivatives
(`\dot{x} = \dot{x} - r\sin\theta\,\dot{\theta}` → correct).
LaTeX rendered cleanly with MathJax. Emitted zero `[[cite]]` tags — the
top-12 Rodina chunks by cosine were not about Lagrangians, so Claude
correctly refused to fabricate citations. This is the honest answer for
pure prereq pages.

## The 33-missing-page bug (and fix)

Notes book had `pageCount: 65` but only 32 Page documents existed in
Mongo. Root cause: the original ingestion ran vision in parallel batches
of 20 and the burst saturated gpt-4o TPM (30k tokens/min). Pages
27-65 hit 429s that the orchestrator logged to `ErrorLog` but never
retried. Every page-N.png exists on disk — vision rendering was fine,
it was the vision→HTML API call that failed.

Two fixes shipped:

1. **`scripts/fill-missing-pages.js`** — one-shot repair for the
   Lagrangians book. Serially re-runs vision on every page-N.png that
   lacks a corresponding Page document. Ran in 350s, repaired 33/33
   pages, zero failures.
2. **Auto-recovery hook in `services/jobService.js`** — new
   `reconcilePages()` helper called at the end of `generate-html`,
   right before the book transitions to `status='ready'`. Scans the
   book's image directory, compares against Page records, serially
   retries anything missing or `visionProcessed=false`. Up to 2
   rounds, 800ms delay between calls to stay under TPM. This is the
   durable fix so future uploads self-heal.

## Cost-reduction levers shipped in the rewrite batch script

1. **Prompt caching** — the ~2.5k-token system prompt is marked
   `cache_control: ephemeral`. First call writes the cache (~25%
   premium), every subsequent call within 5 minutes reads it at a
   90% discount. Per-model cost breakdown now reports
   `in / out / cacheRead / cacheWrite` separately.
2. **Opus/Sonnet routing** — simple regex against Rodina-native
   vocabulary (hidden zero, BCFW, Tr(φ³), kinematic mesh, scattering
   amplitude, Feynman, Yang-Mills, NLSM, factorization, unitarity,
   locality, residue/pole, UV scaling, pion/gluon, soft theorems,
   gauge invariance). Pages that contain any of those terms route to
   Opus 4.6 (the bridge pages that matter). Everything else —
   prereq Lagrangian mechanics, Gaussian integrals, intro path
   integrals — routes to Sonnet 4.6 (5x cheaper, indistinguishable
   for straight exposition).

Expected effect on a 65-page notes book with mostly prereq content:
~60% cost reduction vs Opus-only without caching. Target: ~$0.08/page,
down from $0.21/page in the first test.

## What still isn't done

- Chunking + embedding + edge-generation for the 33 newly-filled
  pages. The rewrite pipeline still runs on them because it falls
  back to `rawText` when no chunks exist, but the note-citation
  edges from those pages don't exist yet. Phase 2 pipeline needs
  to be re-run on this book (separate job).
- Figure cropping is still Approach A (ask vision for data-bbox) —
  only affects NEW uploads, existing pages need reprocessing.
- Citation click → wrong page bug is still open. Plan: if the rewrite
  preserves `pageNumber` as the anchor, the existing jump logic
  should just work. Will verify after the full 65-page rewrite
  lands in the DB.

## Files changed

```
models/Page.js                        +htmlContentLegacy field
prompts/notes-rewrite.txt             NEW — rewrite system prompt
prompts/page-to-html.txt              data-bbox instructions
public/rewrite-preview.html           NEW — standalone preview shell
scripts/fill-missing-pages.js         NEW — 33-page repair script
scripts/rewrite-notes-page.js         NEW — one-shot rewriter
scripts/rewrite-notes-pages-batch.js  NEW — batch rewriter + caching + routing
scripts/reprocess.js                  figureService signature fix
services/figureService.js             rewritten to use vision bbox
services/jobService.js                +reconcilePages() auto-recovery
```
