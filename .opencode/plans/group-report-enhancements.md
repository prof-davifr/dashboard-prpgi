# Implementation Plan: Group Validation Report Enhancements

## Project Overview

This project is a dashboard for IFBA (Instituto Federal da Bahia) research groups (Grupos de Pesquisa). The `relatorio-gp/` module provides a validation report system that evaluates research groups against CNPq/DGP and IFBA internal criteria, calculates scoring based on production data, and generates printable PDF reports.

### Architecture

```
dashboard-PRPGI/
├── build.js              # Generates data.json + data-groups.json from raw data
├── data.json             # ~30MB, lightweight, for dashboard (git-tracked)
├── data-groups.json      # ~44MB, detailed, for reports (gitignored)
├── dados/                # Raw source data (gitignored)
│   ├── scraper-SUAPCNPQ/ # Per-campus Excel files (BAR.xlsx, SSA.xlsx, etc.)
│   ├── scraper-DGP/      # Research groups CSV (coletor_dgp_ifba.csv)
│   └── scraper-SUAPPos/  # Postgraduate students CSV
├── relatorio-gp/         # <-- THIS MODULE (what we're enhancing)
│   ├── index.html        # Report UI entry point
│   ├── script.js         # Orchestration, rendering, PDF generation
│   ├── criterios.js      # Validation engine, scoring table, criteria
│   └── style.css         # Styles + print media queries
├── src/                  # Main dashboard (DO NOT TOUCH)
├── index.html            # Main dashboard entry (DO NOT TOUCH)
└── tests/                # Jest test suite
```

### Key Constraint: DO NOT MODIFY
- `src/script.js`, `src/style.css`, `index.html` (main dashboard)
- `build.js` core logic (only add fields, don't break existing output)
- `data.json` structure (dashboard depends on it)

---

## Current Data Structures

### `data.json` (lightweight — dashboard)
```json
{
  "meta": { "minYear": 2000, "maxYear": 2026, "generatedAt": "...", "campuses": ["BAR", "SSA", ...] },
  "bibliografica": [{ "Ano": 2024, "Tipo": "Artigos...", "campus": "SSA", "Servidor": "1234567", "dedupKey": "..." }],
  "tecnica": [...],
  "inovacao": [...],
  "concluidas": [...],
  "andamento": [...],
  "grupos": [{ "Situacao": "Certificado", "AnoFormacao": "2015", "Pesquisadores": "5", "Estudantes": "2", "Area": "...", "UltimoEnvio": "...", "Unidade": "Salvador" }],
  "posgraduacao": [...]
}
```

### `data-groups.json` (detailed — reports)
```json
{
  "grupos": [{
    "Nome": "Grupo de Pesquisa em IA",
    "Situacao": "Certificado",
    "AnoFormacao": "2015",
    "Pesquisadores": "5",
    "PesquisadoresNomes": "João Silva; Maria Santos; ...",
    "Lider": "João Silva",
    "ViceLider": "Maria Santos",
    "Contato": "contato@exemplo.invalid",
    "Tecnicos": "1",
    "Estudantes": "2",
    "Area": "Ciência da Computação",
    "UltimoEnvio": "2024-06-15",
    "Unidade": "Salvador",
    "InstituicoesParceiras": "UFBA, UNEB"
  }],
  "producoes": {
    "bibliografica": [{
      "Ano": "2024",
      "Tipo": "Artigos Completos Publicados em Periódicos",
      "campus": "SSA",
      "Estrato": "A1",
      "Publicacao": "KIDA, A. A. ; LIMA, A. C. S. . High-Accuracy EMT Simulations...",
      "Periodico": "ELECTRIC POWER SYSTEMS RESEARCH",
      "ISSN": "03787796",
      "Servidor": "1317036"
    }],
    "tecnica": [...],
    "inovacao": [...],
    "concluidas": [...],
    "andamento": [...]
  },
  "meta": { "generatedAt": "...", "sourceDates": {...} }
}
```

### Source Data Field Reference

**SUAPCNPQ Excel sheets** (per campus, e.g., `dados/scraper-SUAPCNPQ/SSA.xlsx`):

| Sheet | Columns |
|-------|---------|
| Produções Bibliográficas | `#`, `Ano`, `Tipo`, `Servidor`, `Periódico/Revista`, `ISSN`, `Estrato`, `Publicação` |
| Produções Técnicas | `#`, `Ano`, `Tipo`, `Servidor`, `Publicação` |
| Registros e Patentes | `#`, `Ano`, `Tipo`, `Servidor`, `Publicação` |
| Orientações Concluídas | `#`, `Ano`, `Tipo`, `Servidor`, `Publicação` |
| Orientações em Andamento | `#`, `Ano`, `Tipo`, `Servidor`, `Publicação` |

**DGP CSV** (`dados/scraper-DGP/coletor_dgp_ifba.csv`):
`ID`, `Data Coleta`, `Nome Base`, `Situação`, `Líder`, `Vice-Líder`, `Último Envio`, `Ano Formação`, `Área`, `Instituição`, `Unidade`, `Contato`, `Pesquisadores`, `Pesquisadores (Nomes)`, `Estudantes`, `Técnicos`, `Instituições Parceiras`, `INCTs Parceiras`, `Linhas de Pesquisa`

**Important**: CSV header normalization in `build.js` removes accents and spaces:
- `Nome Base` → `NomeBase`
- `Pesquisadores (Nomes)` → `Pesquisadores(Nomes)`
- `Líder` → `Lider`
- `Vice-Líder` → `Vice-Lider`
- `Último Envio` → `UltimoEnvio`
- `Ano Formação` → `AnoFormacao`
- `Linhas de Pesquisa` → `LinhasdePesquisa`

---

## Current Code Architecture

### `relatorio-gp/criterios.js` — Validation Engine

**Exports:**
- `SCORING_TABLE` — 12 scoring categories with 50+ items, each with `id`, `desc`, `pontos`
- `CRITERIOS_CNPQ` — 8 CNPq structural criteria
- `CRITERIOS_IFBA_ESTRUTURAIS` — 7 IFBA structural criteria
- `CRITERIOS_IFBA_PONTUACAO` — 3 scoring minimum criteria (by formation time)
- `CRITERIOS_LIDER` — 2 leader activity criteria
- `getPontuacaoMinima(tempoFormacao)` — returns 6/12/20 based on years
- `getFaixaGrupo(tempoFormacao)` — returns group label
- `mapProducaoToCategoria(tipo, subtipo, estrato)` — maps production type to scoring category+item
- `class ValidadorGrupo` — main validation class

**`ValidadorGrupo` class methods:**
- `constructor(grupo, groupsData, dashboardData, periodoSelecionado)`
- `_mapCampus()` — maps group's Unidade to campus code (e.g., "Salvador" → "SSA")
- `_getPeriodBounds()` — returns `{startYear, endYear}` from period selector value
- `_filterByPeriod(arr)` — filters productions by year range
- `_filterByCampus(arr)` — filters productions by campus code
- `_getProducaoPorCategoria()` — returns all 11 production categories filtered
- `calcularPontuacao()` — calculates total points, per-member, minimum check
- `validar()` — runs all criteria, returns full validation result
- `getProducaoCruzada()` — alias for `_getProducaoPorCategoria()`
- `getMetricas()` — returns summary metrics

### `relatorio-gp/script.js` — UI Orchestration

**Global state:**
```js
const STATE = { dados: null, groupsData: null, validador: null, resultado: null };
```

**Functions:**
- `carregarDados()` — fetches both `data.json` and `data-groups.json` in parallel
- `popularGrupos()` — populates dropdown from groups list
- `executarValidacao()` — runs validation on group/period change
- `renderParecer(resultado)` — renders verdict banner
- `renderKPIs(resultado)` — renders KPI cards
- `renderPesquisadores(resultado)` — renders researcher list
- `renderPontuacao(resultado)` — renders scoring table
- `renderChecklist(resultado)` — renders CNPq + IFBA checklists
- `renderProducaoLider(resultado)` — renders leader production section
- `renderProducaoDetalhada(producao)` — renders production-by-year table
- `gerarRelatorio()` — generates PDF report via `window.open()` + `window.print()`

### `relatorio-gp/index.html` — Current UI Structure

```
header (title + subtitle)
controls (grupo-filter select, period-filter select, gerar-relatorio-btn)
main-content (hidden until group selected)
  parecer-banner (verdict)
  kpi-grid (8 KPI cards)
  validation-section: Pesquisadores do Grupo
  validation-section: Pontuação — Anexo I
  validation-section: Validação — Critérios CNPq/DGP
  validation-section: Validação — Critérios IFBA Internos
  validation-section: Produção Científica do Líder
  validation-section: Produção no Período
toast-container
scripts: criterios.js, script.js
```

### `relatorio-gp/style.css` — CSS Variables

```css
--bg: #f8f9fa; --card-bg: #ffffff; --text: #333;
--accent: #32a041; --accent-hover: #2a8a36;
--green: #2e7d32; --red: #c62828; --orange: #f57f17; --blue: #1565c0;
--gray: #607d8b; --border: #e0e0e0; --shadow: 0 2px 8px rgba(0,0,0,0.06);
```

---

## Implementation Phases

### Phase 1: Landing Page — Group Directory Table

**Goal:** Show a browsable, sortable, filterable table of ALL groups on page load. The table appears above the controls section. Clicking a row selects that group and reveals the validation panel below.

#### 1.1 Add Landing Table HTML

**File:** `relatorio-gp/index.html`

Insert a new section **between** the `<div class="controls">` and `<main id="main-content">`:

```html
<div id="landing-section">
    <div class="landing-controls">
        <input type="text" id="group-search" placeholder="Buscar por nome ou área..." />
        <select id="status-filter">
            <option value="">Todas as Situações</option>
            <option value="Certificado">Certificado</option>
            <option value="Descertificado">Descertificado</option>
            <option value="Pendente">Pendente</option>
        </select>
        <span id="group-count" class="group-count"></span>
    </div>
    <div class="table-wrapper">
        <table id="groups-table">
            <thead>
                <tr>
                    <th data-sort="id" class="sortable">#</th>
                    <th data-sort="nome" class="sortable">Nome do Grupo</th>
                    <th data-sort="area" class="sortable">Área</th>
                    <th data-sort="unidade" class="sortable">Campus/Unidade</th>
                    <th data-sort="situacao" class="sortable">Situação</th>
                    <th data-sort="pesquisadores" class="sortable">Pesquisadores</th>
                    <th data-sort="ano" class="sortable">Ano</th>
                </tr>
            </thead>
            <tbody id="groups-tbody">
                <!-- Populated by JS -->
            </tbody>
        </table>
    </div>
</div>
```

**Important:** The `<main id="main-content">` should remain `style="display:none;"` initially. The landing table is visible on load.

#### 1.2 Render Table on Load

**File:** `relatorio-gp/script.js`

Add a new function `renderGroupsTable()`:

```js
function renderGroupsTable() {
    const grupos = STATE.groupsData.grupos || [];
    const tbody = $('groups-tbody');
    const countEl = $('group-count');

    // Sort alphabetically by default
    const sorted = [...grupos].sort((a, b) => {
        const nameA = (a.Nome || a.nome || '').toUpperCase();
        const nameB = (b.Nome || b.nome || '').toUpperCase();
        return nameA.localeCompare(nameB, 'pt-BR');
    });

    STATE.sortedGroups = sorted; // Store for sorting/filtering
    STATE.selectedGroupIdx = null;

    renderTableRows(sorted);
    countEl.textContent = `${sorted.length} grupos`;
}

function renderTableRows(grupos) {
    const tbody = $('groups-tbody');
    let html = '';
    grupos.forEach((g, displayIdx) => {
        // Find the original index in STATE.groupsData.grupos for selection
        const originalIdx = STATE.groupsData.grupos.indexOf(g);
        const nome = g.Nome || g.nome || '(sem nome)';
        const area = g.Area || g.area || '';
        const unidade = g.Unidade || g.unidade || '';
        const situacao = g.Situacao || g.situacao || '';
        const pesquisadores = g.Pesquisadores || '0';
        const ano = g.AnoFormacao || 'N/A';

        html += `<tr data-idx="${originalIdx}" class="group-row">
            <td>${displayIdx + 1}</td>
            <td class="group-name">${nome}</td>
            <td>${area}</td>
            <td>${unidade}</td>
            <td><span class="status-badge status-${situacao.toLowerCase()}">${situacao}</span></td>
            <td>${pesquisadores}</td>
            <td>${ano}</td>
        </tr>`;
    });
    tbody.innerHTML = html;

    // Attach click handlers
    tbody.querySelectorAll('.group-row').forEach(row => {
        row.addEventListener('click', () => selectGroupFromTable(row));
    });
}
```

#### 1.3 Click-to-Select + Sync with Dropdown

**File:** `relatorio-gp/script.js`

Add `selectGroupFromTable()`:

```js
function selectGroupFromTable(row) {
    const idx = parseInt(row.dataset.idx);
    if (isNaN(idx)) return;

    // Remove previous selection
    document.querySelectorAll('.group-row.selected').forEach(r => r.classList.remove('selected'));
    row.classList.add('selected');
    STATE.selectedGroupIdx = idx;

    // Sync dropdown
    $('grupo-filter').value = idx;

    // Run validation
    executarValidacao();

    // Scroll to validation panel
    $('main-content').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
```

Also update `executarValidacao()` to handle the case when triggered from table click (it already works via dropdown sync, but ensure the dropdown value is respected).

#### 1.4 Search + Status Filter

**File:** `relatorio-gp/script.js`

Add `filterGroupsTable()`:

```js
function filterGroupsTable() {
    const searchTerm = ($('group-search').value || '').toLowerCase().trim();
    const statusFilter = $('status-filter').value || '';

    let filtered = STATE.sortedGroups.filter(g => {
        const nome = (g.Nome || g.nome || '').toLowerCase();
        const area = (g.Area || g.area || '').toLowerCase();
        const situacao = (g.Situacao || g.situacao || '');

        const matchesSearch = !searchTerm || nome.includes(searchTerm) || area.includes(searchTerm);
        const matchesStatus = !statusFilter || situacao === statusFilter;

        return matchesSearch && matchesStatus;
    });

    renderTableRows(filtered);
    $('group-count').textContent = `${filtered.length} de ${STATE.sortedGroups.length} grupos`;
}
```

Attach event listeners in `DOMContentLoaded`:
```js
$('group-search').addEventListener('input', filterGroupsTable);
$('status-filter').addEventListener('change', filterGroupsTable);
```

#### 1.5 Column Sorting

**File:** `relatorio-gp/script.js`

Add `setupColumnSorting()`:

```js
function setupColumnSorting() {
    const headers = document.querySelectorAll('#groups-table th.sortable');
    let currentSort = { key: null, asc: true };

    headers.forEach(th => {
        th.addEventListener('click', () => {
            const key = th.dataset.sort;
            if (currentSort.key === key) {
                currentSort.asc = !currentSort.asc;
            } else {
                currentSort.key = key;
                currentSort.asc = true;
            }

            // Update header indicators
            headers.forEach(h => h.classList.remove('sort-asc', 'sort-desc'));
            th.classList.add(currentSort.asc ? 'sort-asc' : 'sort-desc');

            const sorted = [...STATE.sortedGroups].sort((a, b) => {
                let valA, valB;
                switch (key) {
                    case 'id': return 0; // Keep original order
                    case 'nome': valA = (a.Nome || a.nome || '').toUpperCase(); valB = (b.Nome || b.nome || '').toUpperCase(); break;
                    case 'area': valA = (a.Area || a.area || '').toUpperCase(); valB = (b.Area || b.area || '').toUpperCase(); break;
                    case 'unidade': valA = (a.Unidade || a.unidade || '').toUpperCase(); valB = (b.Unidade || b.unidade || '').toUpperCase(); break;
                    case 'situacao': valA = (a.Situacao || a.situacao || '').toUpperCase(); valB = (b.Situacao || b.situacao || '').toUpperCase(); break;
                    case 'pesquisadores': valA = parseInt(a.Pesquisadores || 0); valB = parseInt(b.Pesquisadores || 0); break;
                    case 'ano': valA = parseInt(a.AnoFormacao || 0); valB = parseInt(b.AnoFormacao || 0); break;
                    default: return 0;
                }
                if (typeof valA === 'string') {
                    return currentSort.asc ? valA.localeCompare(valB, 'pt-BR') : valB.localeCompare(valA, 'pt-BR');
                }
                return currentSort.asc ? valA - valB : valB - valA;
            });

            renderTableRows(sorted);
        });
    });
}
```

Call `setupColumnSorting()` in `DOMContentLoaded` after `renderGroupsTable()`.

#### 1.6 CSS for Landing Table

**File:** `relatorio-gp/style.css`

Add these styles:

```css
/* Landing Section */
#landing-section { max-width: 1100px; margin: 0 auto; padding: 0 1.5rem 1.5rem; }
.landing-controls { display: flex; gap: 0.75rem; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; }
#group-search { flex: 1; min-width: 200px; background: var(--card-bg); color: var(--text); border: 1px solid var(--border); padding: 0.5rem 0.8rem; border-radius: 6px; font-size: 0.9rem; }
#group-search:focus { border-color: var(--accent); outline: none; }
#status-filter { background: var(--card-bg); color: var(--text); border: 1px solid var(--border); padding: 0.5rem 0.8rem; border-radius: 6px; font-size: 0.9rem; }
.group-count { font-size: 0.85rem; color: #888; margin-left: auto; }

/* Groups Table */
.table-wrapper { background: var(--card-bg); border-radius: 8px; border: 1px solid var(--border); box-shadow: var(--shadow); overflow-x: auto; }
#groups-table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
#groups-table th, #groups-table td { padding: 0.6rem 0.75rem; text-align: left; border-bottom: 1px solid var(--border); }
#groups-table th { background: #f5f5f5; font-weight: 600; font-size: 0.78rem; text-transform: uppercase; color: #666; position: sticky; top: 0; z-index: 1; }
#groups-table th.sortable { cursor: pointer; user-select: none; }
#groups-table th.sortable:hover { background: #eee; }
#groups-table th.sort-asc::after { content: ' ▲'; font-size: 0.7rem; }
#groups-table th.sort-desc::after { content: ' ▼'; font-size: 0.7rem; }
#groups-table tbody tr { transition: background 0.15s; }
#groups-table tbody tr:hover { background: #f0f7f0; }
#groups-table tbody tr.selected { background: var(--green-bg); border-left: 3px solid var(--accent); }
.group-name { font-weight: 600; color: var(--accent); }
.status-badge { font-size: 0.75rem; padding: 0.15rem 0.5rem; border-radius: 3px; font-weight: 600; }
.status-certificado { background: var(--green-bg); color: var(--green); }
.status-descertificado { background: var(--red-bg); color: var(--red); }
.status-pendente { background: var(--orange-bg); color: var(--orange); }
```

#### 1.7 Integration Checklist

- [ ] `renderGroupsTable()` called in `DOMContentLoaded` after data loads
- [ ] `filterGroupsTable()` attached to search input + status filter
- [ ] `setupColumnSorting()` called after table rendered
- [ ] `selectGroupFromTable()` syncs with dropdown and triggers validation
- [ ] Landing table visible on load; `main-content` hidden until group selected
- [ ] Table row click highlights row and scrolls to validation panel

---

### Phase 2: Arbitrary Period Selector

**Goal:** Allow any custom year range in addition to the existing presets.

#### 2.1 Add Custom Year Inputs

**File:** `relatorio-gp/index.html`

Modify the `.controls` section to add a "Personalizado" option and custom inputs:

```html
<div class="controls">
    <select id="grupo-filter">
        <option value="">Selecione um grupo...</option>
    </select>
    <div class="period-controls">
        <select id="period-filter">
            <option value="all">Todo o Período</option>
            <option value="0">Ano Atual</option>
            <option value="1">Último Ano</option>
            <option value="2">Últimos 2 Anos</option>
            <option value="5">Últimos 5 Anos</option>
            <option value="10">Últimos 10 Anos</option>
            <option value="custom">Personalizado...</option>
        </select>
        <div id="custom-period" class="custom-period" style="display:none;">
            <label>
                <span>De:</span>
                <input type="number" id="year-start" min="2000" max="2026" />
            </label>
            <label>
                <span>Até:</span>
                <input type="number" id="year-end" min="2000" max="2026" />
            </label>
            <button id="apply-custom-period" class="btn-apply">Aplicar</button>
        </div>
    </div>
    <button id="gerar-relatorio-btn" disabled>
        Gerar Relatório
    </button>
</div>
```

#### 2.2 Toggle Custom Period Visibility

**File:** `relatorio-gp/script.js`

In `DOMContentLoaded`, add event listener:

```js
$('period-filter').addEventListener('change', function() {
    const isCustom = this.value === 'custom';
    $('custom-period').style.display = isCustom ? 'flex' : 'none';
    if (!isCustom) {
        executarValidacao();
    }
});
```

#### 2.3 Apply Custom Period

**File:** `relatorio-gp/script.js`

Add event listener for the apply button:

```js
$('apply-custom-period').addEventListener('click', function() {
    const start = parseInt($('year-start').value);
    const end = parseInt($('year-end').value);
    const meta = STATE.dados.meta;
    const minYear = meta.minYear || 2000;
    const maxYear = meta.maxYear || new Date().getFullYear();

    if (isNaN(start) || isNaN(end)) {
        showToast('Preencha ambos os anos.');
        return;
    }
    if (start > end) {
        showToast('Ano início deve ser menor ou igual ao ano fim.');
        return;
    }
    if (start < minYear || end > maxYear) {
        showToast(`Período deve estar entre ${minYear} e ${maxYear}.`);
        return;
    }

    // Store custom period in STATE for _getPeriodBounds to use
    STATE.customPeriod = { start, end };
    executarValidacao();
});
```

#### 2.4 Update `_getPeriodBounds()` in `criterios.js`

**File:** `relatorio-gp/criterios.js`

Modify the `_getPeriodBounds()` method in `ValidadorGrupo` class:

**Current code (lines ~319-333):**
```js
_getPeriodBounds() {
    const meta = this.dashboardData.meta;
    const endYear = meta.maxYear || this.currentYear;
    const val = this.periodoSelecionado;
    let startYear;
    if (val === "all") {
        startYear = meta.minYear || endYear;
    } else if (val === "0") {
        startYear = endYear;
    } else {
        const n = parseInt(val);
        startYear = endYear - n + 1;
    }
    return { startYear, endYear };
}
```

**Replace with:**
```js
_getPeriodBounds() {
    const meta = this.dashboardData.meta;
    const endYear = meta.maxYear || this.currentYear;
    const val = this.periodoSelecionado;
    let startYear;

    // Check for custom period stored in global STATE (accessed via dashboardData)
    if (this.customPeriod) {
        return { startYear: this.customPeriod.start, endYear: this.customPeriod.end };
    }

    if (val === "all") {
        startYear = meta.minYear || endYear;
    } else if (val === "0") {
        startYear = endYear;
    } else {
        const n = parseInt(val);
        startYear = endYear - n + 1;
    }
    return { startYear, endYear };
}
```

**Also update the constructor** to accept custom period:

**Current constructor (lines ~292-299):**
```js
constructor(grupo, groupsData, dashboardData, periodoSelecionado) {
    this.grupo = grupo;
    this.groupsData = groupsData;
    this.dashboardData = dashboardData;
    this.periodoSelecionado = periodoSelecionado;
    this.currentYear = new Date().getFullYear();
    this.mappedCampus = this._mapCampus();
}
```

**Replace with:**
```js
constructor(grupo, groupsData, dashboardData, periodoSelecionado, customPeriod) {
    this.grupo = grupo;
    this.groupsData = groupsData;
    this.dashboardData = dashboardData;
    this.periodoSelecionado = periodoSelecionado;
    this.customPeriod = customPeriod || null;
    this.currentYear = new Date().getFullYear();
    this.mappedCampus = this._mapCampus();
}
```

#### 2.5 Update `executarValidacao()` to Pass Custom Period

**File:** `relatorio-gp/script.js`

In `executarValidacao()`, update the `ValidadorGrupo` instantiation:

**Current:**
```js
STATE.validador = new ValidadorGrupo(grupo, STATE.groupsData, STATE.dados, periodo);
```

**Replace with:**
```js
STATE.validador = new ValidadorGrupo(grupo, STATE.groupsData, STATE.dados, periodo, STATE.customPeriod || null);
```

#### 2.6 Set Custom Period Input Bounds Dynamically

**File:** `relatorio-gp/script.js`

In `DOMContentLoaded`, after data loads, set the min/max of the custom year inputs:

```js
if (dados.meta) {
    $('year-start').min = dados.meta.minYear;
    $('year-start').max = dados.meta.maxYear;
    $('year-end').min = dados.meta.minYear;
    $('year-end').max = dados.meta.maxYear;
    $('year-start').value = dados.meta.minYear;
    $('year-end').value = dados.meta.maxYear;
}
```

#### 2.7 CSS for Custom Period

**File:** `relatorio-gp/style.css`

```css
.period-controls { display: flex; flex-direction: column; gap: 0.4rem; }
.custom-period { display: flex; gap: 0.5rem; align-items: center; }
.custom-period label { display: flex; align-items: center; gap: 0.3rem; font-size: 0.85rem; color: #666; }
.custom-period input[type="number"] { width: 70px; background: var(--card-bg); border: 1px solid var(--border); padding: 0.3rem 0.5rem; border-radius: 4px; font-size: 0.85rem; }
.btn-apply { background: var(--accent); color: white; border: none; padding: 0.3rem 0.8rem; border-radius: 4px; font-size: 0.85rem; cursor: pointer; font-weight: 600; }
.btn-apply:hover { background: var(--accent-hover); }
```

#### 2.8 Update PDF Report to Show Custom Period

**File:** `relatorio-gp/script.js`

In `gerarRelatorio()`, update the period display in the report header.

**Current (around line 496):**
```js
<h2>3. Produção no Período (${resultado.periodo.inicio}–${resultado.periodo.fim})</h2>
```

**Note:** `resultado.periodo` currently returns `{startYear, endYear}` from `_getPeriodBounds()`. The property names are `startYear`/`endYear`, not `inicio`/`fim`. Fix this:

```js
<h2>3. Produção no Período (${resultado.periodo.startYear}–${resultado.periodo.endYear})</h2>
```

#### 2.9 Integration Checklist

- [ ] "Personalizado" option added to period dropdown
- [ ] Custom year inputs shown/hidden on selection
- [ ] Validation: start ≤ end, within data bounds
- [ ] `_getPeriodBounds()` handles custom period
- [ ] `ValidadorGrupo` constructor accepts `customPeriod`
- [ ] `executarValidacao()` passes custom period
- [ ] Input bounds set dynamically from `meta.minYear`/`meta.maxYear`
- [ ] PDF report shows correct period range

---

### Phase 3: Full Production Traceability Table

**Goal:** Show every production item that contributed to the group's score, with full details including which scoring rule was applied.

#### 3.1 Add HTML Section

**File:** `relatorio-gp/index.html`

Insert a new section **after** the "Pontuação — Anexo I" section and **before** the CNPq checklist:

```html
<div id="producao-completa-section" class="validation-section" style="display:none;">
    <h2>Tabela Completa de Produções</h2>
    <div id="producao-completa"></div>
</div>
```

#### 3.2 Create `renderProducaoCompleta()` Function

**File:** `relatorio-gp/script.js`

Add this new function:

```js
function renderProducaoCompleta(resultado) {
    const pont = resultado.pontuacao;
    const producoesPorCategoria = pont.producoesPorCategoria || {};
    const container = $('producao-completa');
    const section = $('producao-completa-section');

    // Check if there are any scored productions
    const totalScored = Object.values(producoesPorCategoria).reduce((sum, arr) => sum + arr.length, 0);
    if (totalScored === 0) {
        section.style.display = 'none';
        return;
    }
    section.style.display = 'block';

    let html = '<table class="full-prod-table"><thead><tr>';
    html += '<th>Ano</th>';
    html += '<th>Tipo</th>';
    html += '<th>Título / Detalhes</th>';
    html += '<th>Periódico / Evento</th>';
    html += '<th>ISSN</th>';
    html += '<th>Estrato</th>';
    html += '<th>Categoria</th>';
    html += '<th>Item</th>';
    html += '<th>Pontos</th>';
    html += '</tr></thead><tbody>';

    let grandTotal = 0;

    const categorias = Object.keys(SCORING_TABLE);
    categorias.forEach(cat => {
        const info = SCORING_TABLE[cat];
        const items = producoesPorCategoria[cat] || [];

        if (items.length > 0) {
            // Category subheader
            html += `<tr class="prod-category-header"><td colspan="9">${info.label} (${items.length} itens)</td></tr>`;

            items.forEach(p => {
                const titulo = p.titulo || '';
                const truncated = titulo.length > 150 ? titulo.substring(0, 150) + '...' : titulo;
                const periodico = p.periodico || '';
                const issn = p.issn || '';
                const estrato = p.estrato || '';
                const itemId = p.itemId || '';
                const itemDesc = p.itemDesc || '';
                const pontos = p.pontos || 0;

                grandTotal += pontos;

                html += `<tr>`;
                html += `<td>${p.ano || ''}</td>`;
                html += `<td>${p.tipo || ''}</td>`;
                html += `<td class="prod-title" title="${titulo.replace(/"/g, '&quot;')}">${truncated}</td>`;
                html += `<td>${periodico}</td>`;
                html += `<td>${issn}</td>`;
                html += `<td>${estrato}</td>`;
                html += `<td class="prod-cat">${info.label}</td>`;
                html += `<td><code>${itemId}</code><br><small>${itemDesc}</small></td>`;
                html += `<td class="prod-pontos">${pontos}</td>`;
                html += `</tr>`;
            });
        }
    });

    // Total row
    html += `<tr class="prod-total-row">`;
    html += `<td colspan="8"><strong>Total de Pontos</strong></td>`;
    html += `<td class="prod-pontos"><strong>${grandTotal}</strong></td>`;
    html += `</tr>`;

    html += '</tbody></table>';
    container.innerHTML = html;
}
```

#### 3.3 Call from `executarValidacao()`

**File:** `relatorio-gp/script.js`

In `executarValidacao()`, add the call:

```js
function executarValidacao() {
    // ... existing code ...
    renderParecer(STATE.resultado);
    renderKPIs(STATE.resultado);
    renderPesquisadores(STATE.resultado);
    renderPontuacao(STATE.resultado);
    renderProducaoCompleta(STATE.resultado);  // <-- ADD THIS
    renderChecklist(STATE.resultado);
    renderProducaoLider(STATE.resultado);
    renderProducaoDetalhada(STATE.validador.getProducaoCruzada());
    // ...
}
```

#### 3.4 CSS for Full Production Table

**File:** `relatorio-gp/style.css`

```css
/* Full Production Traceability Table */
.full-prod-table { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
.full-prod-table th, .full-prod-table td { padding: 0.4rem 0.6rem; text-align: left; border-bottom: 1px solid var(--border); vertical-align: top; }
.full-prod-table th { background: #f5f5f5; font-weight: 600; font-size: 0.75rem; text-transform: uppercase; color: #666; position: sticky; top: 0; z-index: 1; }
.full-prod-table td:last-child { text-align: right; font-family: 'SF Mono', 'Fira Code', monospace; font-weight: 600; }
.prod-category-header { background: #f0f0f0; font-weight: 700; }
.prod-category-header td { border-top: 2px solid var(--border); padding: 0.5rem 0.6rem; font-size: 0.85rem; }
.prod-title { max-width: 350px; word-break: break-word; }
.prod-cat { font-size: 0.78rem; color: #666; }
.prod-pontos { font-size: 0.9rem; color: var(--accent); }
.prod-total-row { background: var(--green-bg); font-weight: 700; }
.prod-total-row td { border-top: 2px solid var(--green); padding: 0.6rem; }
.full-prod-table tbody tr:hover { background: #f9f9f9; }
.full-prod-table code { font-size: 0.78rem; background: #f5f5f5; padding: 0.1rem 0.3rem; border-radius: 3px; }
.full-prod-table small { color: #888; font-size: 0.75rem; }
```

#### 3.5 Include in PDF Report

**File:** `relatorio-gp/script.js`

In `gerarRelatorio()`, add a function to render the full production table in the PDF:

```js
const renderProducaoCompletaHTML = () => {
    const producoesPorCategoria = pont.producoesPorCategoria || {};
    let html = '<table style="width:100%;border-collapse:collapse;font-size:8pt;"><thead><tr style="background:#f5f5f5;">';
    html += '<th style="border:1px solid #ddd;padding:3px 5px;text-align:left;">Ano</th>';
    html += '<th style="border:1px solid #ddd;padding:3px 5px;text-align:left;">Tipo</th>';
    html += '<th style="border:1px solid #ddd;padding:3px 5px;text-align:left;">Título</th>';
    html += '<th style="border:1px solid #ddd;padding:3px 5px;text-align:left;">Periódico</th>';
    html += '<th style="border:1px solid #ddd;padding:3px 5px;text-align:left;">ISSN</th>';
    html += '<th style="border:1px solid #ddd;padding:3px 5px;text-align:left;">Estrato</th>';
    html += '<th style="border:1px solid #ddd;padding:3px 5px;text-align:left;">Item</th>';
    html += '<th style="border:1px solid #ddd;padding:3px 5px;text-align:right;">Pts</th>';
    html += '</tr></thead><tbody>';

    let grandTotal = 0;
    const categorias = Object.keys(SCORING_TABLE);

    categorias.forEach(cat => {
        const info = SCORING_TABLE[cat];
        const items = producoesPorCategoria[cat] || [];
        if (items.length > 0) {
            html += `<tr style="background:#f0f0f0;"><td colspan="8" style="border:1px solid #ddd;padding:4px 5px;font-weight:700;">${info.label} (${items.length})</td></tr>`;
            items.forEach(p => {
                const titulo = (p.titulo || '').length > 80 ? (p.titulo || '').substring(0, 80) + '...' : (p.titulo || '');
                grandTotal += p.pontos || 0;
                html += `<tr>`;
                html += `<td style="border:1px solid #ddd;padding:2px 5px;">${p.ano || ''}</td>`;
                html += `<td style="border:1px solid #ddd;padding:2px 5px;font-size:7pt;">${p.tipo || ''}</td>`;
                html += `<td style="border:1px solid #ddd;padding:2px 5px;font-size:7pt;">${titulo}</td>`;
                html += `<td style="border:1px solid #ddd;padding:2px 5px;font-size:7pt;">${p.periodico || ''}</td>`;
                html += `<td style="border:1px solid #ddd;padding:2px 5px;">${p.issn || ''}</td>`;
                html += `<td style="border:1px solid #ddd;padding:2px 5px;">${p.estrato || ''}</td>`;
                html += `<td style="border:1px solid #ddd;padding:2px 5px;font-size:7pt;">${p.itemId || ''}</td>`;
                html += `<td style="border:1px solid #ddd;padding:2px 5px;text-align:right;">${p.pontos || 0}</td>`;
                html += `</tr>`;
            });
        }
    });

    html += `<tr style="background:#e8f5e9;"><td colspan="7" style="border:1px solid #ddd;padding:4px 5px;font-weight:700;">Total</td><td style="border:1px solid #ddd;padding:4px 5px;text-align:right;font-weight:700;">${grandTotal}</td></tr>`;
    html += '</tbody></table>';
    return html;
};
```

Then insert it into the PDF HTML, **after** the "Pontuação (Anexo I)" section and **before** the CNPq criteria:

```html
<h2>4. Pontuação (Anexo I)</h2>
${renderPontuacaoHTML()}

<h2>5. Tabela Completa de Produções</h2>
${renderProducaoCompletaHTML()}

<h2>6. Validação — Critérios CNPq/DGP</h2>
${renderChecklistHTML(criteriosCNPQ)}

<h2>7. Validação — Critérios IFBA</h2>
${renderChecklistHTML(criteriosIFBA)}

<h2>8. Parecer Final</h2>
```

Update the section numbers accordingly (previously 5→6, 6→7, 7→8).

#### 3.6 Integration Checklist

- [ ] New HTML section added to `index.html`
- [ ] `renderProducaoCompleta()` function created
- [ ] Called from `executarValidacao()`
- [ ] Section hidden when no scored productions exist
- [ ] CSS styles for table, category headers, total row
- [ ] PDF report includes full production table
- [ ] Section numbers updated in PDF (5→8)

---

### Phase 4: Build.js Enhancement — Add Missing Fields

**Goal:** Ensure `data-groups.json` includes `Linhas de Pesquisa` for groups, which is present in the DGP CSV but not currently extracted.

#### 4.1 Add `LinhasPesquisa` to Detailed Groups

**File:** `build.js`

In the detailed groups mapping (around line 471-494), add the `LinhasPesquisa` field.

**Current code:**
```js
return {
  Nome: r["NomeBase"] || "",
  Situacao: r["Situacao"],
  AnoFormacao: r["AnoFormacao"],
  Pesquisadores: r["Pesquisadores"],
  PesquisadoresNomes: r["Pesquisadores(Nomes)"] || "",
  Lider: r["Lider"] || r["Lider"] || "",
  ViceLider: r["Vice-Lider"] || r["ViceLider"] || "",
  Contato: r["Contato"] || "",
  Tecnicos: r["Tecnicos"] || r["Tecnicos"] || "",
  Estudantes: r["Estudantes"],
  Area: r["Area"],
  UltimoEnvio: r["UltimoEnvio"],
  Unidade: unidade,
  InstituicoesParceiras: r["InstituiesParceiras"] || r["InstituicoesParceiras"] || ""
};
```

**Add:**
```js
LinhasPesquisa: r["LinhasdePesquisa"] || ""
```

**Note:** The CSV header `Linhas de Pesquisa` is normalized to `LinhasdePesquisa` by `parseCSV()` (accents removed, spaces removed).

#### 4.2 Regenerate Data

After modifying `build.js`, run:
```bash
node build.js
```

Verify the output:
```bash
node -e "const d = require('./data-groups.json'); console.log(d.grupos[0].LinhasPesquisa);"
```

#### 4.3 Verify Production Fields

Confirm that `data-groups.json` productions already have all needed fields:

```bash
node -e "
const d = require('./data-groups.json');
const p = d.producoes.bibliografica[0];
console.log('Fields:', Object.keys(p));
"
```

Expected output: `Ano`, `Tipo`, `campus`, `Estrato`, `Publicacao`, `Periodico`, `ISSN`, `Servidor`

All fields needed for Phase 3 are already present.

#### 4.4 Integration Checklist

- [ ] `LinhasPesquisa` added to detailed groups in `build.js`
- [ ] `node build.js` runs successfully
- [ ] `data-groups.json` contains `LinhasPesquisa` for groups
- [ ] Production fields verified (all present)

---

### Phase 5: Integration & Polish

**Goal:** Tie everything together, test edge cases, run tests.

#### 5.1 Test Landing Table

- Load `/relatorio-gp/` — table should appear immediately with all groups
- Search for a group name — table should filter
- Search for an area — table should filter
- Change status filter — table should filter
- Click column headers — should sort ascending/descending
- Click a row — should highlight, sync dropdown, show validation panel, scroll down
- Verify performance with 100+ groups (should be instant, it's client-side filtering)

#### 5.2 Test Custom Period

- Select "Personalizado" — inputs should appear
- Enter invalid range (start > end) — should show toast error
- Enter out-of-range years — should show toast error
- Enter valid custom range — validation should run with that period
- Verify scoring table, production table, and checklist reflect the custom period
- Generate PDF — period should show correctly in header

#### 5.3 Test Production Traceability Table

- Select a group with known productions
- Verify the full production table appears
- Verify category subheaders match scoring categories
- Verify each row shows: Ano, Tipo, Título, Periódico, ISSN, Estrato, Categoria, Item, Pontos
- Verify total matches the KPI total
- Verify table is hidden when no scored productions exist

#### 5.4 Test PDF Report

- Generate report for a group with productions
- Verify all sections present: Dados, Pesquisadores, Produção, Pontuação, Tabela Completa, CNPq, IFBA, Parecer
- Verify section numbering is correct (1-8)
- Verify full production table is included
- Verify custom period shows correctly
- Test print/PDF via browser print dialog
- Check page breaks between sections

#### 5.5 Run Test Suite

```bash
npm test
```

All 144 tests should pass. If any fail, investigate and fix.

#### 5.6 Regenerate Data (if build.js changed)

```bash
node build.js
```

Verify output sizes:
- `data.json` — should remain ~30MB
- `data-groups.json` — should be ~44MB (may increase slightly with new fields)

#### 5.7 Integration Checklist

- [ ] Landing table works with search, filter, sort, click
- [ ] Custom period validates and applies correctly
- [ ] Full production table shows all scored items with details
- [ ] PDF report includes all sections with correct numbering
- [ ] All 144 tests pass
- [ ] Data regenerated and verified

---

## File Change Summary

| File | Phase | Changes |
|------|-------|---------|
| `relatorio-gp/index.html` | 1, 2, 3 | Add landing table HTML, custom period inputs, full production section |
| `relatorio-gp/script.js` | 1, 2, 3, 5 | Add `renderGroupsTable`, `filterGroupsTable`, `setupColumnSorting`, `selectGroupFromTable`, custom period handling, `renderProducaoCompleta`, update `executarValidacao`, update `gerarRelatorio` |
| `relatorio-gp/criterios.js` | 2 | Update `ValidadorGrupo` constructor and `_getPeriodBounds()` |
| `relatorio-gp/style.css` | 1, 2, 3 | Add landing table styles, custom period styles, full production table styles |
| `build.js` | 4 | Add `LinhasPesquisa` to detailed groups |
| `data-groups.json` | 4 | Regenerated with new field |

---

## Dependencies & Execution Order

```
Phase 1 (Landing Table)  ──┐
Phase 2 (Custom Period)  ──┼──→ Phase 5 (Integration & Testing)
Phase 3 (Production Table)─┤
Phase 4 (Build.js tweaks) ─┘
```

Phases 1-4 are **independent** and can be implemented in any order. Phase 5 depends on all four being complete.

**Recommended order:** 1 → 2 → 3 → 4 → 5

---

## Important Notes & Gotchas

1. **CSV Header Normalization**: `build.js` normalizes CSV headers by removing accents and spaces. `Linhas de Pesquisa` becomes `LinhasdePesquisa`. Always check the normalized key name.

2. **`Publicação` Field**: Contains formatted author + title string (e.g., `"KIDA, A. A. ; LIMA, A. C. S. . High-Accuracy EMT Simulations..."`). This is used as the "Título/Detalhes" in the production table. Do NOT try to parse authors separately unless explicitly requested.

3. **`Servidor` Field**: Contains IFBA server ID(s) extracted from `VinculoQueryset` strings. Multi-author productions are duplicated with one `Servidor` ID per row.

4. **Campus Mapping**: `_mapCampus()` in `criterios.js` maps group's `Unidade` to campus codes using `CAMPUS_TO_CITY`. This mapping must stay in sync with the campus code table in `AGENTS.md`.

5. **Deduplication**: `build.js` uses `dedupKey` for deduplication. The scoring engine in `criterios.js` also uses `seenDedupKeys` Set to avoid double-counting.

6. **Unverifiable Criteria**: IFBA-02, IFBA-04, IFBA-05, IFBA-06, IFBA-07 are marked `verificado: false` and show "Não verificado". They are excluded from failure counts. Do NOT change this behavior.

7. **`data.json` vs `data-groups.json`**: The dashboard uses `data.json` (lightweight). The report module uses BOTH files. Never break the `data.json` structure.

8. **No External Dependencies**: The project uses vanilla JS, no frameworks. Do NOT add any npm packages.

9. **Print Styles**: The PDF report uses `@media print` CSS. Test print output carefully — page breaks, table overflow, and font sizes matter.

10. **Git**: `data-groups.json` is in `.gitignore`. `data.json` IS tracked. Never commit raw `dados/` contents.

---

## Testing Commands

```bash
# Build data
node build.js

# Run tests
npm test

# Run specific test pattern
npm test -- parseCSV

# Start dev server
npm start
# Then visit: http://localhost:8080/relatorio-gp/
```

---

## Verification Checklist (After All Phases)

- [ ] `/relatorio-gp/` loads with landing table visible
- [ ] Table shows all groups with correct data
- [ ] Search filters by name and area
- [ ] Status filter works
- [ ] Column sorting works (asc/desc)
- [ ] Clicking a row selects group and shows validation
- [ ] Dropdown syncs with table selection
- [ ] "Personalizado" period option works
- [ ] Custom period validates correctly
- [ ] Scoring reflects custom period
- [ ] Full production table appears with all details
- [ ] Production table total matches KPI
- [ ] PDF report includes all 8 sections
- [ ] PDF shows custom period correctly
- [ ] `npm test` passes (144/144)
- [ ] `data.json` still works for dashboard
- [ ] `data-groups.json` has `LinhasPesquisa` field
