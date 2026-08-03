# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Static, single-page dashboard (vanilla JS, Chart.js, Leaflet) for IFBA's PRPGI (Pró-Reitoria de Pesquisa, Pós-Graduação e Inovação), visualizing research, innovation, and postgraduate indicators. No backend — a Node ETL script (`build.js`) pre-processes raw Excel/CSV exports into static `data.json`/`data-groups.json` files consumed directly by the frontend. Deployed via GitHub Pages on push to `main`.

## ⚠️ Critical: IFBA ≠ IFBaiano

Two completely different federal institutions:
- **IFBA** = Instituto Federal de Educação, Ciência e Tecnologia **da Bahia** (Salvador HQ, ~25 campuses). **This dashboard covers only IFBA.**
- **IFBaiano** = Instituto Federal **Baiano** — separate institution (Guanambi, Catu, Itapetinga, etc.)

Any new data source integration **must** verify the `Instituição` field contains `"IFBA"` before processing. The DGP CSV pipeline in `build.js` already enforces this guard.

## Commands

- `node scripts/build.js` (or `npm run build`) — process `.xlsx`/`.csv` files from `dados/` into `data.json` and `data-groups.json`
- `npm start` — dev server on port 8080 (`live-server`)
- `npm test` — run Jest unit tests
- `npm test -- <pattern>` — run focused tests (e.g. `npm test -- parseCSV`)

Always run `node scripts/build.js` and `npm test` after touching the ETL pipeline or any campus/source mapping.

## Data pipeline (`build.js`)

`build.js` recursively scans `dados/` (gitignored raw source, organized by scraper subdirectory) and produces two committed outputs:

- **`dados/scraper-SUAPCNPQ/`** — per-campus Lattes export, `{CAMPUS_CODE}.xlsx`, 5 fixed sheets mapped via `SHEET_MAP` (bibliográfica, técnica, inovação, orientações concluídas/andamento). Campus code = filename stem.
- **`dados/scraper-DGP/`** — research groups CSV. Build auto-selects the newest file whose name starts with `coletor` and doesn't end in `_old.csv` (`selectDgpGroupsCsvFiles`); other coletor files are ignored.
- **`dados/scraper-SUAPPos/`** — postgraduate students CSV, timestamped filename (`alunos_pos_*.csv`).
- **`dados/ic/`** — IC/ICT projects Excel (PNP/SETEC-MEC), one sheet per cycle (`Ciclo YYYY-YYYY`), processed separately from per-campus files (fixed column indices, not headers).
- **`data.json`** (~31 MB, tracked in git — required for GitHub Pages) — lightweight arrays consumed by the dashboard: `bibliografica`, `tecnica`, `inovacao`, `concluidas`, `andamento`, `grupos`, `posgraduacao`, `ic`, plus `meta` (campuses, year range, source file dates).
- **`data-groups.json`** (~63 MB, tracked in git) — detailed re-processing with resolved servidor names/IDs and group memberships, used only by the separate `relatorio-grupos-pesquisa` project, not the main dashboard.

Key mechanics to know before touching the pipeline:
- **Servidor extraction**: the `Servidor` field is a stringified queryset (`<Vinculo: Nome (ID) (Servidor)>`); IDs (7+ digit regex) and names are extracted to support multi-author expansion (one record per author) and cross-source name resolution (Lattes ↔ DGP).
- **Dedup key**: title normalized (NFD, lowercase, strip accents/non-alphanumeric, 150 chars) — used by the frontend's "Desduplicar" toggle to collapse multi-author records.
- **Campus normalization** happens in three different places with different logic — see below.
- Never commit raw `dados/` contents (gitignored); after adding files there, regenerate with `node scripts/build.js` and check the printed size/campus list/record counts.

Full pipeline documentation (data provenance, column mappings, business rules, glossary) lives in `docs/proveniencia-dados.md` — consult it before adding a new data source.

## Campus code mapping — three places, must stay in sync

| Mapping | File | Name |
|---|---|---|
| Campus code → city | `src/script.js` | `CAMPUS_TO_CITY` |
| City → coordinates | `src/script.js` | `IFBA_COORDS` |
| City → code (IC + Pós sheets) | `build.js` | `campusMap` |
| Test copies of the above | `tests/helpers/browserEnv.js` | own `CAMPUS_TO_CITY`/`IFBA_COORDS` |

If you add/rename a campus, update all of these together. Known unresolved discrepancy: `tests/helpers/browserEnv.js` maps `UBA` → `"UBATÃ"` while `src/script.js` uses `"UBAITABA"` — reconcile if you touch either file. IC campus overrides: `REI`→`SSA` (Reitoria), `PAF`→`PA` (Paulo Afonso typo).

Campus codes cover 25 IFBA campuses (BAR, BRU, CAM, CFO, EC, EUN, FS, ILH, IRE, JAC, JAG, JEQ, JUA, LF, PA, PIS, PS, SAJ, SAM, SEA, SF, SSA, UBA, VAL, VC) — see the full city table in `docs/proveniencia-dados.md` §5.

## Frontend architecture

- No build step for frontend — `index.html` loads `src/script.js`, `src/style.css`, `src/posgraduacao.js`, `src/pesquisadores.js` directly, plus Chart.js/Leaflet/SheetJS via CDN.
- Data flow: `data.json` fetched with a stale-while-revalidate Cache API pattern → `STATE.raw.*` (the 8 arrays) → `processData()` (re-run on every filter change: period, campus, dedup toggle, relative-metrics toggle) → `STATE.filtered.*` → per-tab `renderKPIs*()` / `renderCharts*()` (Chart.js) / `renderGenericMap()` (Leaflet) / table generators.
- Tabs map to data sources roughly 1:1 (Produção Científica → `bibliografica`, Produção Técnica → `tecnica`, Inovação → `inovacao`, Grupos de Pesquisa/Pesquisadores → `grupos` + productions, Orientações → `concluidas`+`andamento`, Pós-Graduação → `posgraduacao`, IC → `ic`).
- "p/ Servidor" (relative metrics) toggle divides KPIs/charts/map values by the count of distinct active `Servidor` IDs in the current period/campus selection.
- Small categories (<2%) in evolution/pie charts get aggregated into "Outras" (bibliográfica types, técnica types, inovação types, IC areas).
- Postgraduate-specific business rules (cohort maturity thresholds, situação bucketing) live in `src/posgraduacao.js` — see `docs/proveniencia-dados.md` §6.4–6.5 rather than re-deriving from code.

## Testing

- `tests/build.test.js` covers `scripts/build.js` pure functions (`findFiles`, `parseCSV`, `getSourceKey`, `registerSourceFile`, DGP CSV selection, `SHEET_MAP`, `SOURCE_LABELS`).
- `tests/script.utils.test.js` / `tests/posgraduacao.test.js` cover frontend utilities using a custom VM-based browser stub (`tests/helpers/browserEnv.js`) — no real browser or jsdom.

## Checklist for adding a new data source

(from `docs/proveniencia-dados.md` §9.2)

1. New subdirectory under `dados/` named after the scraper
2. Add entry to `SOURCE_LABELS` in `scripts/build.js`
3. Implement processing in `scripts/build.js` `main()`
4. Add array to `result` in `scripts/build.js` and to `STATE.raw` in `src/script.js`
5. Verify the IFBA (not IFBaiano) filter is applied
6. Add a tab in `index.html` (button + content section)
7. Add render functions (KPIs, charts, map, table)
8. Verify campus mapping is consistent across all three locations above
9. Update `docs/proveniencia-dados.md`
10. Run `node scripts/build.js` and `npm test`

## Monorepo & subtree push

This project lives inside a monorepo at `/home/davi/projetos/PRPGI/dashboard-PRPGI/` and is also published independently to `prof-davifr/dashboard-prpgi` via `git subtree`.

Push to the standalone repo (run from the monorepo root, `/home/davi/projetos`):
```
git subtree push --prefix=PRPGI/dashboard-PRPGI dashboard main
```
Only history under `PRPGI/dashboard-PRPGI/` is pushed. Sibling projects with the same subtree setup: `PRPGI/scraper-DGP/` → `scraper-dgp` remote, `PRPGI/relatorio-grupos-pesquisa-PRPGI/` → `relatorio-grupos` remote.

## TODO.md

This project maintains a `TODO.md` at the root for task planning/tracking — keep it updated. The root `TODO.md` at `/home/davi/projetos/` consolidates TODOs from all subprojects automatically; run `python3 /home/davi/projetos/_gen_sumula.py` to regenerate the consolidated summary after editing this project's `TODO.md`.
