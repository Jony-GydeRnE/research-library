# reports/

Dated logs of session outputs — benchmark scores, edge audits, example tables, query dumps, and anything else from the terminal that is hard to reconstruct after the fact.

**Purpose:** the terminal is lossy when the Fold syncs from the Mac, and CC's chat tables can scroll past before you see them. Anything that isn't a commit message or a code change lives here so it survives.

## Convention

- One folder per session: `reports/YYYY-MM-DD/`
- Within a session folder:
  - `_summary.md` — one-page narrative of what happened
  - `benchmark-scores.md` — tier A/B/C scores at each checkpoint in the session
  - `edges-<Nscore>pct-<audit-name>.md` — example tables at a specific benchmark state
  - Raw query dumps welcome: `query-<description>.md`
- If two sessions happen on the same day, suffix with `-01`, `-02`.

## CC standing order (in CLAUDE.md)

After any session that produces structured data from a DB query, a benchmark run, or an edge audit, CC writes the output to `reports/YYYY-MM-DD/<slug>.md` BEFORE the final chat response, and links it from the chat summary. Commit messages still get the prose narrative; reports/ holds the data tables the chat would otherwise swallow.

## Index

### 2026-04-11 — Fix 2 + Fix 3 + Rejection/Context/Floor
- `2026-04-11/_summary.md` — 76.5% → 93.8% in one session across three commits
- `2026-04-11/benchmark-scores.md` — Tier B/C at all three checkpoints
- `2026-04-11/edges-82pct-full-audit.md` — top15 best, bottom10 worst, by-relationship, B-rational, D-subsets, triangulation, locality, amplitude (all at the 82.7% state, before rejection landed)
- `2026-04-11/edges-93pct-themed.md` — 5 B-rational + 5 triangulation/locality/amplitude at the 93.8% state (post-rejection)
- `2026-04-11/ground-truth-verification.md` — 23-row verification of the user's Claude-sourced ground-truth mapping of Rodina equations → notes PDF pages. **3/23 claims content-verified, 19/23 edges exist.** Claude's PDF page numbers were wrong because the "newest-first file order" assumption was wrong; edges happen to still land because the claimed pages coincidentally contain amplitude-adjacent content.
- `2026-04-11/ground-truth-inverse-view.md` — for each of 23 equations, the list of notes pages the SYSTEM actually routed edges from, ranked by edge score. Shows the real content locations.
- `2026-04-11/analysis-equation-failures.md` — deep analysis of why p40/42/43 (eq.9-11), p57-59 (eq.14), and p51-53 (eq.15-18) appear to miss but mostly don't. Covers code flow, cosine ranking, picker prompt behavior, and resolution-granularity problem. **No code changes, just reasoning.**
- `2026-04-11/mapping-user-pages-to-rodina.md` — **THE ACTUAL MAPPING.** For notes pages p18-29, p40-43, p51-53, p57-59: every chunk on each page (content + tags), every edge to Rodina (target page, chunk, equation, relationship, conf/relev), and a summary table of primary targets. 675 lines.
