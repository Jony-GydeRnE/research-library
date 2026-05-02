# Edge Audit — 2026-05-02

Sample: 50 edges (universe 3406).
Model: claude-opus-4-6.
Duration: 173s.
Input tokens: 53368, output tokens: 2096.
Estimated cost (Opus 4.7 rates): $0.32.

## Headline

- correct:    0 / 41 = 0.0%
- borderline: 0 / 41 = 0.0%
- wrong:      41 / 41 = 100.0%
- unparseable: 9

## Per-bucket precision

| bucket | total | correct | borderline | wrong | precision |
|---|---:|---:|---:|---:|---:|
| assumes|high | 2 | 0 | 0 | 2 | 0.0% |
| assumes|mid | 1 | 0 | 0 | 1 | 0.0% |
| proves|high | 4 | 0 | 0 | 4 | 0.0% |
| proves|mid | 6 | 0 | 0 | 6 | 0.0% |
| uses_definition|high | 28 | 0 | 0 | 28 | 0.0% |

## Companion

Per-edge verdicts in `reports/2026-05-02/edge-audit-lagrangians-n50.csv`.