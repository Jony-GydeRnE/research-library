# Notes Rewrite and Vision — Index

Everything related to turning notes PDFs into faithful, beautiful HTML lives here. Two parallel tracks:

- **Pipeline v1 (shipped 2026-04-13)** — retrieve-top-K-and-rewrite. Opus sees the notes page + top-K Rodina chunks and produces expository HTML in Rodina's voice with inline `[[cite]]` tags. Implemented as `scripts/rewrite-notes-pages-batch.js`. Per-page cost ~$0.21 Opus-only, target ~$0.08 with Sonnet routing + prompt caching.
- **Pipeline v2 (spec only, not built)** — generate → render → judge → retry loop. Opus emits LaTeX-first HTML, Puppeteer renders it to a PNG, Sonnet compares the rendered PNG to the source image and returns an accuracy score + critique. Retries with the critique until accuracy ≥ 0.95 or 3 attempts. See `notes-vision-quality-loop-spec.md`.

The two are complementary, not competing. v1 is about *what the notes say* (translated into Rodina's vocabulary). v2 is about *what the notes LOOK like* (faithful side-by-side equations, preserved spatial layout, no black-box wrappers). A fully-featured notes pipeline would run v1 for semantic content and v2 for visual fidelity.

## Files in this folder

| File | What it is | Status |
|---|---|---|
| `notes-vision-quality-loop-spec.md` | Design doc for v2 (judge-driven retry loop). 419 lines. 8 open questions to answer before build. | **Spec, no code** |
| This README | Index + how v1 and v2 fit together | — |

## Files elsewhere (referenced from here)

| File | What it is |
|---|---|
| `reports/2026-04-13/notes-rewrite-pipeline.md` | Session log from the day v1 shipped. Cost numbers, 33-page repair bug, prompt-caching + routing details, files changed. |
| `reports/Cost analysis/cost-analysis.md` | Consolidated cost model across all pipelines (vision, spans, chunks, rewrites, chat, quality sweep, edges). |
| `reports/Cost analysis/PRice-4-pix.md` | Earlier cost-reduction brainstorm (prompt caching, Sonnet routing, missing-page fix). Superseded by cost-analysis.md for the canonical numbers. |
| `prompts/notes-rewrite.txt` | v1 system prompt — teaches Rodina voice + citation-grounding + no-fabrication rules. |
| `prompts/page-to-html.txt` | Existing vision prompt used during first-pass ingestion. The v2 spec proposes replacing this with a LaTeX-first prompt. |
| `prompts/page-to-html-notes.txt` | Vision variant for handwritten/stylus pages (currently in use on notes books). |
| `scripts/rewrite-notes-page.js` | One-shot rewriter (single page, writes to /tmp, does NOT touch DB). Used for iteration. |
| `scripts/rewrite-notes-pages-batch.js` | Batch rewriter with prompt caching and Opus/Sonnet routing. Writes to `Page.htmlContent`, backs up originals to `Page.htmlContentLegacy`. |
| `scripts/fill-missing-pages.js` | One-shot repair for notes books with sparse Page coverage (TPM-failed pages). |
| `services/jobService.js` → `reconcilePages()` | Durable auto-recovery hook that re-runs vision on any missing pages at the end of `generate-html`. Shipped 2026-04-13. |

## Open questions / decisions to make before building v2

Answer these in `notes-vision-quality-loop-spec.md` §14 before CC starts:

1. Puppeteer vs mathjax-node for rendering HTML to preview PNGs
2. Sonnet vs Opus for the judge
3. Whole-book first attempt — fallback to per-page on token truncation?
4. Retry isolation vs cross-page coherence
5. Best-effort accuracy floor
6. Kebab wording
7. Manual override / force-accept flag per page
8. Reuse existing per-page PNGs from the ingestion pipeline
