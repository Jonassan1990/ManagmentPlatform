# M4B-A Visual Regression Notes

**Baseline (before):** M4A audit screenshots under `docs/acceptance-assets/m4a/screenshots/`  
**After:** `docs/acceptance-assets/m4ba/screenshots/`  
**Raw capture:** `artifacts/m4ba-visual/result.json`

## Brand identity (computed)

| Token / surface | Expected | Observed |
|---|---|---|
| `--sidebar` | `#102a43` → `rgb(16, 42, 67)` | PASS |
| `--accent` / `--color-primary` | `#0f4c5c` | PASS |
| `--bg` | `#f4f6f8` | PASS |
| Focus ring | 2px solid primary | PASS (`outlineStyle: solid`, `rgb(15, 76, 92)`) |
| `prefers-reduced-motion` rule | Present in CSSOM | PASS |

## Pages checked

| Page | Result |
|---|---|
| Portfolio Dashboard | PASS — no layout regression |
| Portfolio Explorer | PASS |
| PI & Capacity | PASS |
| PI Planning board | PASS |
| Scenario Comparison | PASS |
| PI Review | PASS |
| Initiative detail | PASS |
| Project detail | PASS |

## Verdict

No significant layout regression. Token introduction is visually compatible with existing navy/teal identity. Focus visibility improved (global `:focus-visible`).
