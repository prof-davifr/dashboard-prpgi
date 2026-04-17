# Post-Graduation Dashboard Implementation - Todo List

## Project Status
**Overall Progress**: 60% Complete  
**Current Phase**: Phase 4 - Visualization Engine  
**Last Updated**: 2026-04-16

## Implementation Phases

### ✅ Phase 1: Data Integration - COMPLETED
- [x] Update `build.js` to process post-graduation CSV
- [x] Add `posgraduacao` array to `data.json` structure
- [x] Parse and normalize post-graduation data fields
- [x] Extract year/semester from `ano/periodo_letivo`
- [x] Derive `categoria` from `modalidade` and `curso`
- [x] Create `curso_simplificado` by cleaning course names
- [x] Normalize campus codes
- [x] Fix CSV parsing for quoted fields with commas
- [x] Test data generation (2,448 records processed)

### ✅ Phase 2: UI Foundation - COMPLETED
- [x] Add 6th tab button "Pós-Graduação" to navigation
- [x] Create tab content with 3 horizontal subtabs:
  - [x] Visão Geral (Overview)
  - [x] Por Curso (By Course)
  - [x] Por Campus (By Campus)
- [x] Add CSS for subtab styling
- [x] Create HTML structure for all subtabs with:
  - [x] KPI grid placeholders
  - [x] Chart canvas elements
  - [x] Selector dropdowns for course/campus subtabs
  - [x] Map container for geographic visualization

### ✅ Phase 3: Filter System - COMPLETED
- [x] Add post-graduation filters to filter panel:
  - [x] `categoria-filter` (Mestrado/Doutorado/Especialização)
  - [x] `status-filter` (Matriculado/Concluído/Cancelado/etc.)
- [x] Implement filter visibility logic (show only on post-graduation tab)
- [x] Extend `processData()` to handle post-graduation filters
- [x] Create `filterPosGraduacao()` function
- [x] Add post-graduation data to `STATE.filtered`
- [x] Add event listeners for new filters
- [x] Implement `updateFilterVisibility()` function
- [x] Add filter reset when switching away from post-graduation tab
- [x] Remove redundant `curso-filter` from filter panel (conflicted with subtab selector)

### 🔄 Phase 4: Visualization Engine - IN PROGRESS

#### 4.1 Core Rendering Functions
- [x] **`renderChartsPosGraduacao()`** - Main dispatch function
  - [x] Basic structure implemented
  - [x] Handle default to "Visão Geral" subtab
  - [ ] Add error handling for missing canvas elements
  - [x] Switch between subtabs: Overview, Course, Campus

- [x] **`renderPosGraduacaoOverview(data)`** - Overview subtab controller
- [x] **`renderPosGraduacaoByCourse(data)`** - Course subtab controller  
- [x] **`renderPosGraduacaoByCampus(data)`** - Campus subtab controller

#### 4.2 KPI Calculation Functions
- [ ] **`renderKPIsPosGraduacaoOverview(data)`** - Overview subtab KPIs
  - [ ] Calculate: Total de Alunos
  - [ ] Calculate: Alunos Ativos (Matriculado)
  - [ ] Calculate: Alunos Concluídos
  - [ ] Calculate: Taxa de Conclusão = Concluídos / (Total - Ativos) * 100
  - [ ] Format and display 4 KPI cards in `kpi-posgraduacao-overview`

- [ ] **`renderKPIsPosGraduacaoByCourse(data, selectedCourse)`** - Course subtab KPIs
  - [ ] Calculate: Total no Curso
  - [ ] Calculate: Ativos no Curso
  - [ ] Calculate: Concluídos no Curso
  - [ ] Calculate: Taxa do Curso
  - [ ] Display course name in KPI titles (truncate if >30 chars)
  - [ ] Display in `kpi-posgraduacao-curso`

- [ ] **`renderKPIsPosGraduacaoByCampus(data, selectedCampus)`** - Campus subtab KPIs
  - [ ] Calculate: Total no Campus
  - [ ] Calculate: Cursos no Campus (unique count of `curso`)
  - [ ] Calculate: Concluídos no Campus
  - [ ] Calculate: Taxa do Campus
  - [ ] Display campus name in KPI titles
  - [ ] Display in `kpi-posgraduacao-campus`

#### 4.3 Chart Rendering Functions

**Overview Subtab Charts:**
- [ ] **`renderPosGraduacaoEvolution(data)`** - Stacked bar chart
  - [ ] Aggregate by year and category (Mestrado/Doutorado/Especialização)
  - [ ] Use colors: #4D90FE (Mestrado), #F44336 (Doutorado), #4CAF50 (Especialização)
  - [ ] Stacked bar chart showing evolution 2016-2026

- [ ] **`renderPosGraduacaoDistributions(data)`** - Two pie charts
  - [ ] Status distribution pie chart (Matriculado, Concluído, Cancelado, etc.)
  - [ ] Category distribution pie chart (Mestrado, Doutorado, Especialização)
  - [ ] Use consistent color palette

- [ ] **`renderPosGraduacaoTopCoursesAndMap(data)`** - Bar chart + Map
  - [ ] Top 10 courses bar chart (horizontal)
  - [ ] Leaflet map showing student distribution by campus
  - [ ] Use `renderGenericMap()` function

- [ ] **`renderPosGraduacaoCompletionRate(data)`** - Line chart
  - [ ] Implement 3 completion rate approaches:
    1. Annual completion rate
    2. Cumulative completion rate  
    3. Cohort-based completion rate (with assumptions)
  - [ ] Line chart showing all 3 approaches over time

**Course Subtab Charts:**
- [ ] **`renderPosGraduacaoCourseCharts(data, selectedCourse)`**
  - [ ] Evolution of selected course (line chart)
  - [ ] Status distribution for course (pie chart)
  - [ ] Campus distribution for course (bar chart)

**Campus Subtab Charts:**
- [ ] **`renderPosGraduacaoCampusCharts(data, selectedCampus)`**
  - [ ] Evolution of selected campus (line chart)
  - [ ] Top courses at campus (horizontal bar chart)
  - [ ] Category distribution at campus (pie chart)

#### 4.4 Helper Functions
- [ ] **`populateCourseSelector()`** - Populate `curso-selector` dropdown
  - [ ] Extract unique courses from `STATE.raw.posgraduacao`
  - [ ] Filter out empty/null course names
  - [ ] Sort alphabetically
  - [ ] Add event listener for changes (calls `renderChartsPosGraduacao()`)
  - [ ] Truncate long course names (>50 chars) in dropdown display
  - [ ] Mark as initialized with `data-listener-added` attribute

- [ ] **`populateCampusSelector()`** - Populate `campus-selector` dropdown
  - [ ] Extract unique campuses from `STATE.raw.posgraduacao`
  - [ ] Filter out empty/null campus codes
  - [ ] Sort alphabetically
  - [ ] Add event listener for changes (calls `renderChartsPosGraduacao()`)
  - [ ] Mark as initialized with `data-listener-added` attribute

- [ ] **`calculateCompletionRates(data)`** - Implement 3 approaches
  - [ ] **Annual Rate**: Students completed in year / Total students in year × 100
  - [ ] **Cumulative Rate**: Total completed by year / Total enrolled by year × 100
  - [ ] **Cohort Rate**: Students completed in year / Students who started in (year - completion_time) × 100
    - Assumptions: Mestrado (2 years), Doutorado (4 years), Especialização (1.5 years)
  - [ ] Return object: `{ annual: {...}, cumulative: {...}, cohort: {...} }`

- [ ] **`getChartColors(count)`** - Color palette helper
  - [ ] Use existing palette: `["#4D90FE", "#F44336", "#4CAF50", "#FFC107", "#9C27B0", "#00BCD4", "#E91E63", "#FF9800", "#795548", "#607D8B"]`
  - [ ] Return array of colors cycling through palette
  - [ ] Match existing dashboard color patterns

### ⏳ Phase 5: Data Binding - PENDING

#### 5.1 Selector Integration
- [ ] Connect `curso-selector` to course subtab rendering
- [ ] Connect `campus-selector` to campus subtab rendering
- [ ] Ensure selectors update when filters change
- [ ] Handle "all" selection in both selectors

#### 5.2 Filter Integration
- [ ] Ensure `categoria-filter` updates all charts
- [ ] Ensure `status-filter` updates all charts
- [ ] Test filter combinations work across all subtabs

#### 5.3 Initialization
- [ ] Populate selectors on first tab activation
- [ ] Set default selections ("all" for both selectors)
- [ ] Ensure charts render correctly on initial load

#### 5.4 Performance Optimization
- [ ] Cache aggregated data where possible
- [ ] Consider debouncing filter changes
- [ ] Optimize loops for 2,448 records

### ⏳ Phase 6: Polish & Testing - PENDING

#### 6.1 Functional Testing
- [ ] Test all filter combinations
- [ ] Test all subtab switches
- [ ] Test selector interactions
- [ ] Test with edge cases (empty data, single record)

#### 6.2 UI/UX Testing
- [ ] Verify responsive design on mobile
- [ ] Test chart readability
- [ ] Verify color consistency
- [ ] Check loading states

#### 6.3 Performance Testing
- [ ] Test page load time with post-graduation data
- [ ] Test filter response time
- [ ] Test chart rendering performance

#### 6.4 Bug Fixes & Polish
- [ ] Add error handling for chart creation
- [ ] Add loading indicators
- [ ] Add tooltips for complex metrics
- [ ] Ensure consistent formatting
- [ ] Fix any console errors

## Technical Details

### Color Scheme
- **Mestrado**: `#4D90FE` (blue)
- **Doutorado**: `#F44336` (red)
- **Especialização**: `#4CAF50` (green)
- **Other**: `#FFC107` (yellow)

### Chart Types
- **Evolution**: Stacked bar charts (follow `processEvolucao()` pattern)
- **Distributions**: Pie/doughnut charts (follow `processTipos()` pattern)
- **Rankings**: Horizontal bar charts
- **Trends**: Line charts
- **Maps**: Leaflet integration (use existing `renderGenericMap()`)

### Data Structure
```javascript
// Post-graduation record structure
{
  nome: "Student Name",
  matricula: "20162640001",
  curso: "MESTRADO PROFISSIONAL EM ENGENHARIA DE SISTEMAS E PRODUTOS",
  curso_original: "64 - MESTRADO PROFISSIONAL EM ENGENHARIA DE SISTEMAS E PRODUTOS (Salvador)",
  campus: "SSA",
  polo: "",
  situacao: "Concluído",
  email_academico: "",
  email_pessoal: "email@gmail.com",
  ano: 2016,
  semestre: 2,
  ano_periodo: "2016.2",
  modalidade: "Mestrado",
  categoria: "Mestrado",
  dedupKey: "20162640001"
}
```

### Key Files
- `build.js` - Data processing (COMPLETE)
- `index.html` - UI structure (COMPLETE)
- `script.js` - Logic and visualization (IN PROGRESS)
- `data.json` - Generated data file (~27MB)
- `style.css` - Styling (subtabs added)

## Open Questions & Decisions Needed

### Completion Rate Calculation
1. **Cohort Approach Assumptions** - Are these acceptable?
   - Mestrado: 2 years completion time
   - Doutorado: 4 years completion time
   - Especialização: 1.5 years completion time

2. **Empty State Handling** - How to handle no data?
   - Show "No data available" message
   - Show empty charts with placeholder text
   - Hide charts entirely

3. **Initial View Defaults**
   - Default subtab: "Visão Geral"
   - Default course selector: "Todos os Cursos"
   - Default campus selector: "Todos os Campi"

4. **Chart Interactions**
   - Basic tooltips (Chart.js default)
   - No click-to-filter initially (can add later)
   - Responsive resizing

## Next Steps

### Immediate (Phase 4 Completion)
1. Implement KPI calculation functions
2. Implement basic chart rendering functions
3. Implement helper functions (selectors, completion rates)
4. Test core functionality

### Short-term (Phase 5)
1. Connect selectors to rendering
2. Ensure filter integration works
3. Optimize performance

### Long-term (Phase 6)
1. Comprehensive testing
2. UI/UX polish
3. Bug fixes and optimization

## Notes
- Follow existing patterns from other dashboard tabs for consistency
- Use `STATE.filtered.posgraduacao` for all chart data
- Reuse existing utility functions (`createChart()`, `renderGenericMap()`)
- Test incrementally after each major function implementation
- Monitor console for JavaScript errors during development

## Progress Tracking
- **Total Tasks**: 45 items
- **Completed**: 8 items (18%)
- **In Progress**: 4 items (9%)
- **Pending**: 33 items (73%)
- **Blocked**: 0 items (0%)

### Completion Estimates:
- **Phase 4 (Visualization)**: 2-3 hours
- **Phase 5 (Data Binding)**: 1 hour  
- **Phase 6 (Polish & Testing)**: 1-2 hours
- **Total Remaining**: 4-6 hours

### Critical Path:
1. Implement KPI functions (1 hour)
2. Implement basic chart functions (1 hour)
3. Implement helper functions (1 hour)
4. Connect selectors and test (1 hour)
5. Polish and fix bugs (1-2 hours)

---
*Last updated: 2026-04-16*  
*To update progress: Mark items with [x] for complete, [ ] for pending*