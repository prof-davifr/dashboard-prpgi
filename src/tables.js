// tables.js — tabelas detalhadas por aba e exportação para Excel.

// =====================
// Table Functions
// =====================

// Toggle table visibility
function toggleTable(containerId, btn) {
  const container = document.getElementById(containerId);
  const isActive = container.classList.contains('active');
  container.classList.toggle('active');
  btn.textContent = isActive ? '✅ Exibir Tabela Detalhada por Campus/Ano' : '❌ Ocultar Tabela Detalhada';
}

// Generate campus x year table for a given dataset
function generateCampusYearTable(data, containerId, label, useServidorCount = false) {
  const container = $(containerId);
  if (!container) return;

  // Group by campus and year
  const campusYearData = {};
  const years = new Set();
  const campuses = new Set();

  data.forEach(r => {
    const year = r["Ano"];
    const campus = r.campus;
    if (!year || !campus) return;

    years.add(year);
    campuses.add(campus);

    if (!campusYearData[campus]) campusYearData[campus] = {};
    campusYearData[campus][year] = (campusYearData[campus][year] || 0) + 1;
  });

  const sortedYears = Array.from(years).sort();
  const sortedCampuses = Array.from(campuses).sort();

  // Get total active researchers per campus (across ALL data sources) for fair comparison
  let campusPesquisadores = {};
  if (useServidorCount) {
    // Combine all sources to get total active researchers per campus
    const allData = [...STATE.filtered.bibliografica, ...STATE.filtered.tecnica, ...STATE.filtered.concluidas, ...STATE.filtered.andamento];
    campusPesquisadores = getServidoresPerCampus(allData);
  }

  const relativeMode = isRelativeMetricsEnabled();

  // Build table HTML
  // A <caption> dá à tabela um nome acessível — sem ela, um leitor de tela
  // anuncia só "tabela" e o usuário não sabe qual indicador está lendo.
  let html = `<table class="data-table"><caption>${label} por campus e ano</caption><thead><tr><th scope="col">Campus</th>`;
  sortedYears.forEach(y => {
    html += `<th scope="col">${y}</th>`;
  });
  html += '<th scope="col">Total</th></tr></thead><tbody>';

  sortedCampuses.forEach(campus => {
    const campusName = CAMPUS_TO_CITY[campus] || campus;
    html += `<tr><th scope="row">${campusName} (${campus})</th>`;

    let total = 0;
    sortedYears.forEach(year => {
      const count = campusYearData[campus]?.[year] || 0;
      total += count;

      let displayValue = count;
      // Divide by total active researchers at this campus (not just those with production in this category)
      if (relativeMode && campusPesquisadores[campus] && campusPesquisadores[campus] > 0) {
        displayValue = (count / campusPesquisadores[campus]).toFixed(2);
      }

      html += `<td>${displayValue}</td>`;
    });

    // Total column
    let totalDisplay = total;
    if (relativeMode && campusPesquisadores[campus] && campusPesquisadores[campus] > 0) {
      totalDisplay = (total / campusPesquisadores[campus]).toFixed(2);
    }
    html += `<td><strong>${totalDisplay}</strong></td>`;

    html += '</tr>';
  });

  html += '</tbody></table>';

  const relativeNote = relativeMode ? '<p style="margin-top:0.5rem;font-size:0.85rem;color:#666;">* Valores normalizados por total de pesquisadores ativos em cada campus (considerando todas as fontes)</p>' : '';
  container.innerHTML = html + relativeNote;
}

// Render tables for each tab
function renderTables() {
  renderTableCientifica();
  renderTableTecnica();
  renderTableInovacao();
  renderTableGrupos();
  renderTablePesquisadores();
  renderTableOrientacoes();
  renderTableIC();
}

function renderTableCientifica() {
  generateCampusYearTable(STATE.filtered.bibliografica, 'table-cientifica-content', 'Produção Científica', true);
}

function renderTableTecnica() {
  generateCampusYearTable(STATE.filtered.tecnica, 'table-tecnica-content', 'Produção Técnica', true);
}

function renderTableInovacao() {
  generateCampusYearTable(STATE.filtered.inovacao, 'table-inovacao-content', 'Inovação', true);
}

function renderTableGrupos() {
  // For grupos, we use "Ano Formação" instead of "Ano"
  const container = $('table-grupos-content');
  if (!container) return;

  const data = STATE.filtered.grupos;
  const campusYearData = {};
  const years = new Set();
  const campuses = new Set();

  data.forEach(r => {
    const year = parseInt(r["AnoFormacao"], 10);
    const unidade = r["Unidade"] || "";
    // Map unidade to campus code (longest-city-first, same as filters)
    const campus = mapUnidadeToCampus(unidade);
    
    if (!year || !campus) return;
    
    years.add(year);
    campuses.add(campus);
    
    if (!campusYearData[campus]) campusYearData[campus] = {};
    campusYearData[campus][year] = (campusYearData[campus][year] || 0) + 1;
  });

  const sortedYears = Array.from(years).sort();
  const sortedCampuses = Array.from(campuses).sort();

  let html = '<table class="data-table"><caption>Grupos de pesquisa por campus e ano de formação</caption><thead><tr><th scope="col">Campus</th>';
  sortedYears.forEach(y => {
    html += `<th scope="col">${y}</th>`;
  });
  html += '<th scope="col">Total</th></tr></thead><tbody>';

  sortedCampuses.forEach(campus => {
    const campusName = CAMPUS_TO_CITY[campus] || campus;
    html += `<tr><th scope="row">${campusName} (${campus})</th>`;
    
    let total = 0;
    sortedYears.forEach(year => {
      const count = campusYearData[campus]?.[year] || 0;
      total += count;
      html += `<td>${count}</td>`;
    });
    html += `<td><strong>${total}</strong></td></tr>`;
  });

  html += '</tbody></table>';
  container.innerHTML = html;
}

function renderTableOrientacoes() {
  const allData = [...STATE.filtered.concluidas, ...STATE.filtered.andamento];
  generateCampusYearTable(allData, 'table-orientacoes-content', 'Orientações', true);
}

function renderTableIC() {
  const container = $('table-ic-content');
  if (!container) return;
  const data = STATE.filtered.ic;
  const campusYearData = {};
  const years = new Set();
  const campuses = new Set();

  data.forEach(r => {
    const year = r.ano;
    const campus = r.campus;
    if (!year || !campus) return;
    years.add(year);
    campuses.add(campus);
    if (!campusYearData[campus]) campusYearData[campus] = {};
    campusYearData[campus][year] = (campusYearData[campus][year] || 0) + 1;
  });

  const sortedYears = Array.from(years).sort();
  const sortedCampuses = Array.from(campuses).sort();

  let html = '<table class="data-table"><caption>Projetos de Iniciação Científica por campus e ano</caption><thead><tr><th scope="col">Campus</th>';
  sortedYears.forEach(y => { html += `<th scope="col">${y}</th>`; });
  html += '<th scope="col">Total</th></tr></thead><tbody>';

  sortedCampuses.forEach(campus => {
    const campusName = CAMPUS_TO_CITY[campus] || campus;
    html += `<tr><th scope="row">${campusName} (${campus})</th>`;
    let total = 0;
    sortedYears.forEach(year => {
      const count = campusYearData[campus]?.[year] || 0;
      total += count;
      html += `<td>${count}</td>`;
    });
    html += `<td><strong>${total}</strong></td></tr>`;
  });

  html += '</tbody></table>';
  container.innerHTML = html;
}

function exportTableToExcel(tableContainerId, filename) {
  const container = document.getElementById(tableContainerId);
  if (!container) return;
  const table = container.querySelector('table');
  if (!table) {
    alert("Tabela ainda não foi renderizada.");
    return;
  }
  
  // SheetJS: convert HTML table to workbook
  const wb = XLSX.utils.table_to_book(table, { sheet: "Dados" });
  
  // Generate and download
  XLSX.writeFile(wb, filename + ".xlsx");
}
