# AGENTS.md – Dashboard PRPGI

## ⚠️ Critical: IFBA ≠ IFBaiano

These are **two completely different federal institutions**:
- **IFBA** = Instituto Federal de Educação, Ciência e Tecnologia **da Bahia** — headquarters in Salvador, ~25 campuses across Bahia. **This is what this dashboard covers.**
- **IFBaiano** = Instituto Federal **Baiano** — a separate institution with its own campuses (Guanambi, Catu, Itapetinga, Santa Inês, etc.).

Any new data source integration **must** verify `Instituição` contains `"IFBA"` before processing. The `build.js` DGP CSV pipeline already enforces this guard.

## Campus Code Map (IFBA only)

| Code | City |
|------|------|
| BAR | Barreiras |
| BRU | Brumado |
| CAM | Camaçari |
| CFO | Campo Formoso |
| EC | Euclides da Cunha |
| EUN | Eunápolis |
| FS | Feira de Santana |
| ILH | Ilhéus |
| IRE | Irecê |
| JAC | Jacobina |
| JAG | Jaguaquara |
| JEQ | Jequié |
| JUA | Juazeiro |
| LF | Lauro de Freitas |
| PA | Paulo Afonso |
| PIS | Polo de Inovação Salvador |
| PS | Porto Seguro |
| SAJ | Santo Antônio de Jesus |
| SAM | Santo Amaro |
| SEA | Seabra |
| SF | Simões Filho |
| SSA | Salvador |
| UBA | Ubaitaba |
| VAL | Valença |
| VC | Vitória da Conquista |

## Commands

- `node build.js` — Process `.xlsx` and `.csv` files from `dados/` into `data.json` (no npm script; direct Node invocation)
- `npm start` — Start dev server on port 8080 (live-server)
- `npm test` — Run Jest unit tests

## Data & Build

- `dados/` contains raw source files organized by scraper subdirectory:
  - `scraper-SUAPCNPQ/` — Per-campus Excel files named `[CAMPUS_CODE]-2000-2026.xlsx`
  - `scraper-DGP/` — Research groups CSV (`coletor_dgp_ifba.csv`)
  - `scraper-SUAPPos/` — Postgraduate students CSV (`alunos_pos_*.csv`)
- `build.js` recursively scans `dados/` for `.xlsx` and `.csv` files, extracts campus code from filename prefix, and produces a single `data.json` (~30 MB).
- `data.json` **is tracked in git** (required for GitHub Pages). Never commit raw `dados/` contents — it is gitignored.
- After placing new files in `dados/`, always regenerate with `node build.js` and verify the output size and campus list.

## Frontend & Development

- Static dashboard: `index.html`, `src/script.js`, `src/style.css`, `src/posgraduacao.js`, `src/pesquisadores.js`. No build step for frontend changes.
- `archive/server.py` is legacy; use `npm start` for development.
- Deploy: push to main branch triggers GitHub Pages update at https://prof-davifr.github.io/dashboard-prpgi/

## Consistency Requirements

- **CAMPUS_TO_CITY** and **IFBA_COORDS** in `src/script.js` must exactly match the campus code table above. If you add or rename a campus, update both the table and these objects simultaneously.
- **Test helpers** (`tests/helpers/browserEnv.js`) contain their own copies of `CAMPUS_TO_CITY` and `IFBA_COORDS` used by Jest VM tests. These must also be kept in sync with `src/script.js`. Note: current `browserEnv.js` maps `UBA` to `UBATÃ` while `src/script.js` uses `UBAITABA` — reconcile this discrepancy if touching either file.
- `build.js` uses `xlsx` (SheetJS) to read Excel; ensure all campus files are `.xlsx` (not `.xls`).

## Testing

- Jest unit tests cover `build.js` pure functions (`findFiles`, `parseCSV`, `getSourceKey`, `registerSourceFile`, `SHEET_MAP`, `SOURCE_LABELS`) and `src/script.js` utilities.
- Tests use a custom VM-based browser context (`tests/helpers/browserEnv.js`) that stubs DOM and Leaflet/Chart.js — no real browser or jsdom required.
- Run focused tests with `npm test -- <pattern>` (e.g., `npm test -- parseCSV`).