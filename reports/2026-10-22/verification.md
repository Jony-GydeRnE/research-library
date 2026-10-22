# Audit verification

Baseline: `083c03717b4ef58ca756ac8e2932d0ac391fa5a1`.
Audit start: 2026-10-22 09:58:25 UTC.

## Reproduction and regression evidence

| Suite | Result | What it establishes |
|---|---:|---|
| `npm test` | 20 passed | Service contracts, bounded graph traversal, asynchronous chat completion, SSE/DOM rendering, reader navigation, note save/page/load behavior |
| `npm run test:integration` | 11 passed | Real Mongo persistence for chunk ranges, structural types, provider preflight, citation overlays, job readiness, read-only integrity reporting, and preserving previous edges after returned/thrown picker errors |
| JavaScript parse sweep | 87 tracked files parsed | Syntax only; not runtime correctness |
| EJS compile sweep | 14 templates compiled | Template syntax; main chat additionally rendered/executed in DOM tests |
| `git diff --check` | Passed | No whitespace patch errors |

The initial 11 foundation regressions and four initial database regressions failed before their corresponding fixes. Additional reader, split-chat, readiness, and notes failures were reproduced before repair. Two note-matching cases reproduced the partial-run replacement bug before their guard was added. The later successful-readiness, main-chat rendering/security, and integrity-audit cases validate new behavior and are not all claimed as pre-patch failures.

Synthetic test data includes no private paper content. Real Mongo tests create a new ephemeral server, never use `MONGODB_URI`, and drop only that disposable database between cases. External model calls and PDF rendering are doubled. The test helper loads real service source with explicit I/O doubles, not a rewritten algorithm.

## Environment and limits

- Node v24.19.0; disposable MongoDB 8.2.6. Tests use `--nounixsocket` because this environment does not allow the Mongo Unix socket, while loopback TCP works.
- `jsdom` and `mongodb-memory-server` were added as development dependencies. Use Node 24 for this test configuration. First integration run may download the Mongo test binary; cached subsequent runs are faster. This is not a production Mongo dependency.
- npm resolved two existing transitive packages while adding the test tools: `@mongodb-js/saslprep` 1.4.6 → 1.6.1 and `semver` 7.7.4 → 7.8.5. No direct production dependency version range was intentionally changed.
- `npm ci --ignore-scripts --no-audit --no-fund` installed the original application dependencies; test dependencies were installed subsequently with scripts disabled. Native install hooks were therefore not production-tested.
- Chromium download failed. No screenshot/visual, mobile, MathJax layout, real provider, macOS renderer, or full upload-to-answer acceptance test was completed.
- No live database inspection or repair, production reprocessing, paid API use, or deployment was performed.
- Passing tests demonstrate the repaired cases, not overall product completeness or semantic graph accuracy.

## Dependency audit

The baseline npm audit returned 16 affected packages: 1 critical, 8 high, 6 moderate, 1 low. This is advisory-package counting, not 16 demonstrated vulnerabilities in the application.

Examples include proxy-addr, multer, sharp, pdfjs-dist, mongoose, and transitive packages. Exposure depends on enabled code paths and deployment. No `npm audit fix --force` was run. A separate compatible-upgrade pass should assess reachability and verify upload/render/storage behavior; an unrelated dependency-major rewrite was not bundled with these repairs.

## Re-running

```sh
npm ci
npm test
npm run test:integration
```

For an actual-library structural audit, use the separate read-only command described in `foundation-audit.md`, against a snapshot or with read-only credentials. Do not mistake synthetic test success for a clean bill of health for existing research data.
