# Edge Audit — 2026-05-02

Sample: 20 edges (universe 3406).
Model: claude-opus-4-6.
Duration: 79s.
Input tokens: 23756, output tokens: 1184.
Estimated cost (Opus 4.7 rates): $0.15.

## Headline

- correct:    2 / 15 = 13.3%
- borderline: 10 / 15 = 66.7%
- wrong:      3 / 15 = 20.0%
- unparseable: 5

## Per-bucket precision

| bucket | total | correct | borderline | wrong | precision |
|---|---:|---:|---:|---:|---:|
| assumes|high | 1 | 0 | 1 | 0 | 0.0% |
| assumes|mid | 1 | 0 | 1 | 0 | 0.0% |
| proves|high | 3 | 0 | 2 | 1 | 0.0% |
| proves|mid | 3 | 0 | 1 | 2 | 0.0% |
| uses_definition|high | 7 | 2 | 5 | 0 | 28.6% |

## Companion

Per-edge verdicts in `reports/2026-05-02/edge-audit-lagrangians-n20-fixed.csv`.