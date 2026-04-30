# Post-Graduation Dashboard Implementation - Todo List

## Project Status
**Overall Progress**: 100% Complete  
**Current Phase**: Shipped  maintenance only  
**Last Updated**: 2026-04-30

## Implementation Phases

###  Phase 1: Data Integration - COMPLETED
- [x] Update `build.js` to process post-graduation CSV
- [x] Add `posgraduacao` array to `data.json` structure
- [x] Parse and normalize post-graduation data fields
- [x] Extract year/semester from `ano/periodo_letivo`
- [x] Derive `categoria` from `modalidade` and `curso`
- [x] Create `curso_simplificado` by cleaning course names
- [x] Normalize campus codes
- [x] Fix CSV parsing for quoted fields with commas
- [x] Test data generation (2,448 records processed)

###  Phase 2: UI Foundation - COMPLETED
- [x] Add 7th tab button "Ps-Graduao" to navigation
- [x] Create tab content with 3 horizontal subtabs:
  - [x] Viso Geral (Overview)
  - [x] Por Curso (By Course)
  - [x] Por Campus (By Campus)
- [x] Add CSS for subtab styling
- [x] Create HTML structure for all subtabs with:
  - [x] KPI grid placeholders
  - [x] Chart canvas elements
  - [x] Selector dropdowns for course/campus subtabs
  - [x] Map container for geographic visualization

###  Phase 3: Filter System - COMPLETED
- [x] Add post-graduation filters to filter panel:
  - [x] `posgrad-categoria-filter` (Mestrado/Doutorado/Especializao)
  - [x] `posgrad-status-filter` (Matriculado/Concludo/Cancelado/etc.)
  - [x] `posgrad-campus-filter`
  - [x] `posgrad-curso-filter`
  - [x] `posgrad-matured-only-toggle`
- [x] Implement filter visibility logic (show only on post-graduation tab)
- [x] Extend `processData()` to handle post-graduation filters
- [x] Create `filterPosGraduacao()` function in `processData()`
- [x] Add post-graduation data to `STATE.filtered`
- [x] Add event listeners for all 5 post-graduation filters
- [x] Implement `updateFilterVisibility()` function
- [x] Add filter reset when switching away from post-graduation tab
- [x] Hide `unique-toggle` on post-graduation tab (dedup handled differently)

###  Phase 4: Visualization Engine - COMPLETED

#### 4.1 Core Rendering Functions
- [x] **`renderChartsPosGraduacao()`**  main dispatch, defaults to Viso Geral
- [x] **`ensureCanvasElements()`**  validates required canvas IDs, shows inline error if any are missing
- [x] **`renderPosGraduacaoOverview(data)`**  overview subtab controller
- [x] **`renderPosGraduacaoByCourse(data)`**  course subtab controller
- [x] **`renderPosGraduacaoByCampus(data)`**  campus subtab controller

#### 4.2 KPI Calculation Functions
- [x] **`renderKPIsPosGraduacaoOverview(data)`**  8 KPI cards (active, regular flow, pending active, mature cohorts, completion rate, attrition rate, pending active rate, programs)
- [x] **`renderKPIsPosGraduacaoByCourse(data, selectedCourse)`**  5 KPI cards
- [x] **`renderKPIsPosGraduacaoByCampus(data, selectedCampus)`**  6 KPI cards

#### 4.3 Chart Rendering Functions
- [x] **`renderPosGraduacaoEvolution(data)`**  stacked bar by year  category
- [x] **`renderPosGraduacaoDistributions(data)`**  doughnut (situation buckets) + grouped bar (rates by category)
- [x] **`renderPosGraduacaoTopCoursesAndMap(data)`**  horizontal bar (risk by program) + bar (risk by campus)
- [x] **`renderPosGraduacaoCompletionRate(data)`**  line chart: completion/attrition/overdue rates by cohort year
- [x] **`renderPosGraduacaoCourseCharts(data, selectedCourse)`**  stacked bar + doughnut + line
- [x] **`renderPosGraduacaoCampusCharts(data, selectedCampus)`**  horizontal bar + grouped bar + doughnut

#### 4.4 Helper Functions
- [x] **`populateCourseSelector()`**  fills `posgrad-curso-filter` from raw data
- [x] **`populateCampusSelector()`**  fills `posgrad-campus-filter` from raw data
- [x] **`calculateCompletionRates(data)`**  returns `{completion, attrition, overdue}` by cohort year
- [x] **`getChartColors(count)`**  cycling 10-color palette

###  Phase 5: Data Binding - COMPLETED
- [x] `posgrad-curso-filter` connected to `renderPosGraduacaoByCourse()` and `filterPosGraduacao()`
- [x] `posgrad-campus-filter` connected to `renderPosGraduacaoByCampus()` and `filterPosGraduacao()`
- [x] All 5 filter change events call `processData()` which re-renders
- [x] Default selections: "all" for all selectors; mature-only toggle checked by default
- [x] Selectors repopulated on every `renderChartsPosGraduacao()` call

###  Phase 6: Polish & Testing - COMPLETED
- [x] All filter combinations produce non-negative counts
- [x] Traceability panel explains active filters and data base
- [x] Edge cases: zero-data cohorts return 0%, not NaN (guarded by `base > 0` checks)
- [x] Responsive layout with 68 KPI cards per subtab
- [x] Canvas error inline message added for missing HTML elements
- [x] Filter state resets correctly when leaving post-graduation tab

## Technical Notes

### Completion Rate Methodology
- **Cohort maturity threshold**: Mestrado  2 years, Doutorado  4 years, Especializao  2 years
- **Completion rate** = Concludos (mature cohorts) / Total mature cohorts  100
- **Attrition rate** = Cancelado/Desligado/Evaso/Abandono/Falecido / Total mature cohorts  100
- **Pending active** = Matriculado in mature cohorts (overdue students)

### Double-Filter Clarification
`posgrad-curso-filter` acts simultaneously as:
1. A **global data filter** inside `filterPosGraduacao()` in `processData()`  reduces `STATE.filtered.posgraduacao`
2. A **view selector** inside `renderPosGraduacaoByCourse()`  re-filters the already-filtered array

This is intentional and harmless: applying the same criterion twice on pre-filtered data produces the same result. Resetting the filter when leaving the tab prevents stale state from affecting other tabs.

### Color Scheme
- **Mestrado**: `#4D90FE` (blue)
- **Doutorado**: `#F44336` (red)
- **Especializao**: `#4CAF50` (green)
- **Em Fluxo Regular**: `#4CAF50`
- **Pendncia Ativa**: `#FF9800`
- **Evaso/Desligamento**: `#F44336`
- **Concludo**: `#4D90FE`

### Key Files
- `build.js`  Data processing (COMPLETE)
- `index.html`  UI structure (COMPLETE)
- `src/script.js`  Core logic and visualization (COMPLETE)
- `src/posgraduacao.js`  Post-graduation module (COMPLETE)
- `data.json`  Generated data file (~27 MB, git-ignored)
- `src/style.css`  Styling (COMPLETE)

---
*Last updated: 2026-04-30*