function renderKPIsPesquisadores() {
  // Get all researchers from all sources
  const allIdsArray = [];
  [STATE.filtered.bibliografica, STATE.filtered.tecnica, STATE.filtered.concluidas, STATE.filtered.andamento].forEach(arr => {
    arr.forEach(r => {
      if (r["Servidor"]) {
        allIdsArray.push(r["Servidor"]);
      }
    });
  });
  const totalPesquisadores = new Set(allIdsArray).size;
  
  // Get production counts
  const totalProducaoCientifica = STATE.filtered.bibliografica.length;
  const totalProducaoTecnica = STATE.filtered.tecnica.length;
  const totalOrientacoes = STATE.filtered.concluidas.length + STATE.filtered.andamento.length;
  
  // Calculate averages per researcher
  const relativeMode = isRelativeMetricsEnabled();
  let producaoMediaDisplay = totalProducaoCientifica;
  let orientacoesMediaDisplay = totalOrientacoes;
  
  if (relativeMode && totalPesquisadores > 0) {
    producaoMediaDisplay = formatRelativeValue(totalProducaoCientifica, totalPesquisadores);
    orientacoesMediaDisplay = formatRelativeValue(totalOrientacoes, totalPesquisadores);
  }
  
  const cientificaPesquisadores = extractServidorIds(STATE.filtered.bibliografica).size;
  const tecnicaPesquisadores = extractServidorIds(STATE.filtered.tecnica).size;

  $('kpi-pesquisadores').innerHTML = `
    <div class="kpi-card">
      <div class="kpi-label">Pesquisadores Ativos</div>
      <div class="kpi-value">${totalPesquisadores}</div>
      <div class="kpi-help">Total de pesquisadores únicos que produziram em pelo menos um ano do período selecionado</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Produção Média${relativeMode ? '/Pesquisador' : ''}</div>
      <div class="kpi-value">${producaoMediaDisplay}</div>
      <div class="kpi-help">${relativeMode ? 'Média de produções por pesquisador no período total' : 'Total de produções científicas no período'}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Pesquisadores com Produção Científica</div>
      <div class="kpi-value">${cientificaPesquisadores}</div>
      <div class="kpi-help">Pessoas únicas com ao menos uma produção bibliográfica no período</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Pesquisadores com Produção Técnica</div>
      <div class="kpi-value">${tecnicaPesquisadores}</div>
      <div class="kpi-help">Pessoas únicas com ao menos uma produção técnica no período</div>
    </div>
  `;
}

function renderChartsPesquisadores() {
  // Evolution of active researchers over time
  const yearsMap = {};
  const allData = [...STATE.filtered.bibliografica, ...STATE.filtered.tecnica, ...STATE.filtered.concluidas, ...STATE.filtered.andamento];
  
  allData.forEach(r => {
    const y = r["Ano"];
    const srv = r["Servidor"];
    if (!y || !srv) return;
    if (!yearsMap[y]) yearsMap[y] = new Set();
    yearsMap[y].add(srv);
  });
  
  const sortedYears = Object.keys(yearsMap).sort();
  const researcherCounts = sortedYears.map(y => yearsMap[y].size);
  
  createChart("chart-pesquisadores-evolucao", "line", {
    labels: sortedYears,
    datasets: [{
      label: "Pesquisadores Ativos",
      data: researcherCounts,
      borderColor: "#9C27B0",
      backgroundColor: "rgba(156, 39, 176, 0.1)",
      fill: true,
      tension: 0.3
    }]
  }, {
    scales: {
      x: { ticks: { color: '#555' } },
      y: { ticks: { color: '#555' }, beginAtZero: true }
    }
  });
  
  // Distribution by campus
  const campusCount = {};
  allData.forEach(r => {
    if (r["Servidor"] && r.campus) {
      if (!campusCount[r.campus]) campusCount[r.campus] = new Set();
      campusCount[r.campus].add(r["Servidor"]);
    }
  });
  
  const campusLabels = Object.keys(campusCount).map(c => CAMPUS_TO_CITY[c] || c);
  const campusValues = Object.values(campusCount).map(set => set.size);
  
  createChart("chart-pesquisadores-campus", "bar", {
    labels: campusLabels,
    datasets: [{
      label: "Pesquisadores por Campus",
      data: campusValues,
      backgroundColor: "#4D90FE"
    }]
  }, {
    scales: {
      x: { ticks: { color: '#555' } },
      y: { ticks: { color: '#555' }, beginAtZero: true }
    }
  });
  
  // Production by type (pie chart)
  const productionTypes = {
    "Artigos": STATE.filtered.bibliografica.filter(r => (r["Tipo"]||"").includes("Artigos Completos Publicados em Periódicos")).length,
    "Livros/Capítulos": STATE.filtered.bibliografica.filter(r => (r["Tipo"]||"").includes("Livros") || (r["Tipo"]||"").includes("Capítulos")).length,
    "Técnica": STATE.filtered.tecnica.length,
    "Orientações": STATE.filtered.concluidas.length + STATE.filtered.andamento.length
  };
  
  createChart("chart-pesquisadores-producao", "pie", {
    labels: Object.keys(productionTypes),
    datasets: [{
      data: Object.values(productionTypes),
      backgroundColor: ["#4D90FE", "#F44336", "#4CAF50", "#FFC107"]
    }]
  });
  
  // Researchers by area (from DGP groups)
  const areaCount = {};
  STATE.filtered.grupos.forEach(r => {
    const area = (r["Área"]||"").split(";")[0].trim() || "Outra";
    const pesqCount = parseInt(r["Pesquisadores"]||0);
    areaCount[area] = (areaCount[area]||0) + pesqCount;
  });
  
  createChart("chart-pesquisadores-area", "pie", {
    labels: Object.keys(areaCount),
    datasets: [{
      data: Object.values(areaCount),
      backgroundColor: ["#9C27B0", "#00BCD4", "#E91E63", "#FF9800", "#795548", "#607D8B"]
    }]
  });
  
  // Map of researchers by city
  renderGenericMap(STATE.filtered.grupos, 'map-pesquisadores', "#9C27B0", "Pesquisadores");
}
function renderTablePesquisadores() {
  // Combine all data sources for researchers
  const allData = [...STATE.filtered.bibliografica, ...STATE.filtered.tecnica, ...STATE.filtered.concluidas, ...STATE.filtered.andamento];
  generateCampusYearTable(allData, 'table-pesquisadores-content', 'Pesquisadores', true);
}
