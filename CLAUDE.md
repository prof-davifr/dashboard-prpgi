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

- `npm run build` — process `.xlsx`/`.csv` files from `dados/` into `data.json` and `data-groups.json`
- `node scripts/refresh-inovacao.js <inpi.csv>` — **required after every build**: fills the `inovacao` array from the INPI CSV. The build leaves it empty on purpose (see below)
- `npm run validate` — check the committed `data.json` (structure, campus codes, absence of personal data)
- `npm start` — dev server on port 8080 (`live-server`)
- `npm test` — run Jest unit tests
- `npm test -- <pattern>` — run focused tests (e.g. `npm test -- parseCSV`)

Always run `npm run build`, `npm run validate` and `npm test` after touching the ETL pipeline or any campus/source mapping. CI (`.github/workflows/ci.yml`) runs the last two on every push.

## Data pipeline (`build.js`)

`build.js` recursively scans `dados/` (gitignored raw source, organized by scraper subdirectory) and produces two committed outputs:

- **`dados/scraper-SUAPCNPQ/`** — per-campus Lattes export, `{CAMPUS_CODE}.xlsx`, 5 fixed sheets mapped via `SHEET_MAP` (bibliográfica, técnica, inovação, orientações concluídas/andamento). Campus code = filename stem.
- **`dados/scraper-DGP/`** — research groups CSV. Build auto-selects the newest file whose name starts with `coletor` and doesn't end in `_old.csv` (`selectDgpGroupsCsvFiles`); other coletor files are ignored.
- **`dados/scraper-SUAPPos/`** — postgraduate students CSV, timestamped filename (`alunos_pos_*.csv`).
- **`dados/ic/`** — IC/ICT projects Excel (PNP/SETEC-MEC), one sheet per cycle (`Ciclo YYYY-YYYY`), processed separately from per-campus files (fixed column indices, not headers).
- **INPI (`scraper-INPI`)** — the `inovacao` array does **not** come from `dados/` at all. It comes from a CSV produced by the sibling `scraper-INPI` repo, applied by `scripts/refresh-inovacao.js`. `SHEET_MAP` deliberately omits `'registros e patentes'`, so `npm run build` emits `inovacao: []`.
- **`data.json`** (~32 MB, tracked in git — required for GitHub Pages) — lightweight arrays consumed by the dashboard: `bibliografica`, `tecnica`, `inovacao`, `concluidas`, `andamento`, `grupos`, `posgraduacao`, `ic`, plus `meta` (campuses, year range, source file dates). **Public — must never contain personal data** (see below).
- **`data-groups.json`** (~64 MB, **gitignored**) — detailed re-processing with resolved servidor names/IDs and group memberships, used only by the separate `relatorio-grupos-pesquisa` project, not the main dashboard. Contains names and contacts, so it is regenerated locally with `npm run build` rather than committed.

### LGPD — `data.json` is published

`data.json` is served publicly by GitHub Pages, so `build.js` strips or pseudonymizes every personal field:

- `posgraduacao`: `nome`, `matricula`, `email_academico`, `email_pessoal` are **not emitted**; `dedupKey` is a pseudonymized matrícula.
- `ic`: `orientador` and `bolsista` are pseudonyms — the dashboard only uses them for distinct counts (`renderKPIsIC`).
- Lattes datasets already carry only the SIAPE ID in `Servidor`, never a name.

`pseudonymize()` (top of `scripts/build.js`) hashes with a salt kept in two unversioned places: `.build-salt` at the repo root (what the build reads) and `~/.config/dashboard-prpgi/build-salt` (backup, outside the tree). Both `0600` — it is a secret; with it, the pseudonyms are brute-forceable.

`loadOrCreateSalt()` handles three cases: local salt present (backs it up if the copy is missing), local missing but backup present (**restores**, keeping pseudonyms stable), neither present (generates both and warns). The backup exists because a reclone or a new machine would otherwise silently mint a new salt and rewrite every pseudonym — a 21 MB diff with no real data change.

Before adding any field to `data.json`, check it against this rule — `npm run validate` and `tests/build.test.js` will fail the build/CI if a name/matrícula/e-mail field reappears.

Key mechanics to know before touching the pipeline:
- **Servidor extraction**: the `Servidor` field is a stringified queryset (`<Vinculo: Nome (ID) (Servidor)>`); IDs (7+ digit regex) and names are extracted to support multi-author expansion (one record per author) and cross-source name resolution (Lattes ↔ DGP).
- **Dedup key**: title normalized (NFD, lowercase, strip accents/non-alphanumeric, 150 chars), then hashed to 16 hex by `shortHash()` — the frontend only compares these for equality, and the full strings were 15.8 MB of a 32 MB file. **`inovacao` keeps the long key**: `scripts/comparar_pi.js` parses the INPI number out of it (`numerodoregistro…dataderegistro`).
- **`shortHash` vs `pseudonymize`**: `shortHash` has no salt (public titles, must be reproducible by anyone running the build); `pseudonymize` is salted (personal data, must not be brute-forceable).
- **Validation is blocking**: `main()` runs `validate()` from `scripts/validate-data.js` on the result and exits non-zero *before* writing, so a broken `data.json` never reaches GitHub Pages.
- **Only CSVs from known sources are processed** — a `.csv` under `dados/` that is neither DGP nor pós-graduação is skipped and listed. Previously anything unrecognized fell through into the research-groups path.
- **Campus normalization** — see below.
- Never commit raw `dados/` contents (gitignored); after adding files there, regenerate with `npm run build` and check the printed size/campus list/record counts.

Full pipeline documentation (data provenance, column mappings, business rules, glossary) lives in `docs/proveniencia-dados.md` — consult it before adding a new data source.

## Inovação comes from the INPI, not from Lattes (ago/2026)

The tab used to count what each researcher declared in their own Lattes CV: 988
records, against the ~160 the INPI knows under the institution's CNPJ. Most were
someone else's intellectual property. The source is now the INPI itself.

- **Robot**: sibling repo `scraper-INPI` — four bases (patents, software,
  industrial designs, trademarks), two CNPJs (IFBA `10764307000112` and CEFET-BA
  `13941232000196`, the former name).
- **Applied by**: `scripts/refresh-inovacao.js <inpi.csv>`, which mirrors
  `scripts/refresh-grupos.js` (validate before write, skip write when unchanged).
- **Automated by**: `.github/workflows/refresh-inovacao.yml`, monthly.
- **`npm run build` leaves `inovacao` empty.** Always follow it with
  `refresh-inovacao.js`, or the tab ships blank.
- **Campus cascade**: the INPI never gives a campus. Level 1 matches the INPI
  number against the Lattes record; level 2 resolves the author's name to a
  SIAPE; level 3 omits `campus` entirely (never invent an `NA` code —
  `CODIGOS_VALIDOS` in `scripts/validate-data.js` would reject it).
- **`inpi-campus.json`** (committed) carries the cascade's result so CI can
  attribute campus without `dados/`. Level 1 erases itself after the first run —
  it queries the very Lattes records the run replaces — so the map is not an
  optimization, it is the only thing that survives.

Full endpoint details, pePI quirks, and the two bases the INPI does not let
anyone query live in `docs/proveniencia-dados.md` §2.5.

## Campus code mapping — `src/shared.js` is the single source

| Mapping | Name |
|---|---|
| Campus code → city | `CAMPUS_TO_CITY` |
| City → coordinates | `IFBA_COORDS` (keys are accent-free uppercase) |
| DGP `Unidade` → campus code | `mapUnidadeToCampus` |
| City → coordinates lookup | `lookupCoords` |
| Accent/case normalization | `normalizeText` |

`src/shared.js` is loaded as a plain global script **before** `script.js` in `index.html`, and via `require()` from Node (build scripts and tests) through a UMD footer. Adding or renaming a campus is a one-file change.

The only mapping still living elsewhere is `campusMap` in `scripts/build.js` (city → code for the IC and Pós sheets), which maps Title-Case city names from those spreadsheets. IC campus overrides: `REI`→`SSA` (Reitoria), `PAF`→`PA` (Paulo Afonso typo).

**Do not reintroduce local copies of these mappings.** `tests/campus-filter.test.js` used to keep its own `mapUnidadeToCampus` without accent normalization; it passed while the real implementation failed, which is what hid the "grupos sem campus" bug (ago/2026). Tests import from `src/shared.js`, and `tests/helpers/browserEnv.js` loads it into the VM context exactly like the browser does.

Campus codes cover 25 IFBA campuses (BAR, BRU, CAM, CFO, EC, EUN, FS, ILH, IRE, JAC, JAG, JEQ, JUA, LF, PA, PIS, PS, SAJ, SAM, SEA, SF, SSA, UBA, VAL, VC) — see the full city table in `docs/proveniencia-dados.md` §5.

## Frontend architecture

- No build step for frontend — `index.html` loads plain global scripts in a fixed order, plus Chart.js/Leaflet/SheetJS via CDN. **The order matters**: each file defines globals the later ones consume.

| File | Responsibility |
|---|---|
| `src/shared.js` | campus mappings (see above) — first, everything depends on it |
| `src/core.js` | `STATE`, `$`, date/format helpers, servidor counts, tab switching, modals, toast |
| `src/filters.js` | `processData()` — the single filtering entry point |
| `src/charts.js` | `createChart` + every `renderKPIs*` / `renderCharts*` |
| `src/maps.js` | `renderGenericMap` + the expanded-map modal |
| `src/tables.js` | `generateCampusYearTable`, `renderTable*`, Excel export |
| `src/pesquisadores.js`, `src/posgraduacao.js` | per-tab logic |
| `src/cache.js` | `initDashboard` + Cache API load — last, uses all renderers |

`tests/helpers/browserEnv.js` exposes `loadDashboard(ctx)`, which loads this same list into the VM context in the same order. Use it instead of pointing at a single module.
- Data flow: `data.json` fetched with a stale-while-revalidate Cache API pattern → `STATE.raw.*` (the 8 arrays) → `processData()` (re-run on every filter change: period, campus, dedup toggle, relative-metrics toggle) → `STATE.filtered.*` → per-tab `renderKPIs*()` / `renderCharts*()` (Chart.js) / `renderGenericMap()` (Leaflet) / table generators.
- Tabs map to data sources roughly 1:1 (Produção Científica → `bibliografica`, Produção Técnica → `tecnica`, Inovação → `inovacao`, Grupos de Pesquisa/Pesquisadores → `grupos` + productions, Orientações → `concluidas`+`andamento`, Pós-Graduação → `posgraduacao`, IC → `ic`).
- "p/ Servidor" (relative metrics) toggle divides KPIs/charts/map values by the count of distinct active `Servidor` IDs in the current period/campus selection.
- Small categories (<2%) in evolution/pie charts get aggregated into "Outras" (bibliográfica types, técnica types, inovação types, IC areas).
- Postgraduate-specific business rules (cohort maturity thresholds, situação bucketing) live in `src/posgraduacao.js` — see `docs/proveniencia-dados.md` §6.4–6.5 rather than re-deriving from code.

## Testing

- `tests/build.test.js` covers `scripts/build.js` pure functions (`findFiles`, `parseCSV`, `getSourceKey`, `registerSourceFile`, DGP CSV selection, `pseudonymize`, `SHEET_MAP`, `SOURCE_LABELS`) plus the LGPD guard asserting `data.json` carries no personal fields.
- `tests/script.utils.test.js` / `tests/posgraduacao.test.js` cover frontend utilities using a custom VM-based browser stub (`tests/helpers/browserEnv.js`) — no real browser or jsdom.
- `tests/campus-filter.test.js` runs the real `mapUnidadeToCampus` from `src/shared.js` against the committed `data.json`. To check the guard still bites, break accent normalization in `src/shared.js` and confirm the suite fails.
- `tests/comparar-pi.test.js` covers the DINOV × dashboard matching functions. Its end-to-end block **self-disables** when `dados/validacao/…CONCEDIDOS.csv` is absent (the CI case). Note `describe.skip` does not work for this — Jest still executes the block body — hence the plain `if`.
- `tests/acessibilidade.test.js` asserts the ARIA tab pattern, canvas labels, dialog semantics, table `caption`/`scope`, and computes WCAG contrast ratios from `src/style.css`. A new chart without an `aria-label` fails the suite.
- No render function is covered by unit tests. For real verification, drive Chrome over the DevTools Protocol (`--headless=new --remote-debugging-port=9222`) and assert on the live DOM. Plain `--dump-dom`/`--virtual-time-budget` does **not** work here: it snapshots before `data.json` finishes loading, so the page looks stuck on "Carregando dados…" even when nothing is wrong.

## Checklist for adding a new data source

(from `docs/proveniencia-dados.md` §9.2)

1. New subdirectory under `dados/` named after the scraper
2. Add entry to `SOURCE_LABELS` in `scripts/build.js`
3. Implement processing in `scripts/build.js` `main()`
4. Add array to `result` in `scripts/build.js` and to `STATE.raw` in `src/script.js`
5. Verify the IFBA (not IFBaiano) filter is applied
6. Add a tab in `index.html` (button + content section)
7. Add render functions (KPIs, charts, map, table)
8. Verify campus mapping goes through `src/shared.js` (no new local copies)
9. Verify no personal data reaches `data.json` — strip or `pseudonymize()` names, matrículas and e-mails
10. Update `docs/proveniencia-dados.md`
11. Run `npm run build`, `npm run validate` and `npm test`

## Repository layout

This is a **standalone repository** (`prof-davifr/dashboard-prpgi`), not a subtree of a monorepo — `git push origin main` is the whole story. Sibling projects (`scraper-DGP`, `scraper-SUAPPos`, `scraper-SUAPCNPQ`, `scraper-INPI`, `relatorio-grupos-pesquisa`) are independent repos alongside this one in `/home/davi/projetos/repos-independentes/`; files move between them through the filesystem (`dados/`, `data-groups.json`, the INPI CSV), not through git.

## TODO.md

This project maintains a `TODO.md` at the root for task planning/tracking — keep it updated. The root `TODO.md` at `/home/davi/projetos/` consolidates TODOs from all subprojects automatically; run `python3 /home/davi/projetos/_gen_sumula.py` to regenerate the consolidated summary after editing this project's `TODO.md`.
