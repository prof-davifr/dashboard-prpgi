// charts.js — KPIs e gráficos Chart.js de todas as abas.
//
// createChart() destrói o gráfico anterior do mesmo canvas antes de recriar —
// sem isso o Chart.js vaza instâncias a cada refiltragem.

// Chart configuration generator
function createChart(ctxId, type, data, options = {}) {
  const ctx = document.getElementById(ctxId);
  if (!ctx) return null;
  if (STATE.charts[ctxId]) {
    STATE.charts[ctxId].destroy();
  }
  STATE.charts[ctxId] = new Chart(ctx, {
    type: type,
    data: data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#444' } },
        title: { display: false }
      },
      ...options
    }
  });
}

function renderKPIsCientifica() {
  const data = STATE.filtered.bibliografica;
  const total = data.length;
  const artigos = data.filter(r => (r["Tipo"]||"").includes("Artigos Completos Publicados em Periódicos")).length;
  const livros = data.filter(r => {
    const t = (r["Tipo"]||"");
    return t.includes("Livros") || t.includes("Capítulos");
  }).length;
  const totalPesquisadoresAtivos = getTotalActiveResearchers();

  const relativeMode = isRelativeMetricsEnabled();
  const labelSuffix = relativeMode ? '/Pesquisador' : '';

  let producaoDisplay = total;
  let artigosDisplay = artigos;
  let livrosDisplay = livros;

  // Use total active researchers as divisor for fair comparison across categories
  if (relativeMode && totalPesquisadoresAtivos > 0) {
    producaoDisplay = formatRelativeValue(total, totalPesquisadoresAtivos);
    artigosDisplay = formatRelativeValue(artigos, totalPesquisadoresAtivos);
    livrosDisplay = formatRelativeValue(livros, totalPesquisadoresAtivos);
  }

  $('kpi-cientifica').innerHTML = `
    <div class="kpi-card"><div class="kpi-label">Produções${labelSuffix}</div><div class="kpi-value">${producaoDisplay}</div></div>
    <div class="kpi-card"><div class="kpi-label">Artigos${labelSuffix}</div><div class="kpi-value">${artigosDisplay}</div></div>
    <div class="kpi-card"><div class="kpi-label">Livros/Capítulos${labelSuffix}</div><div class="kpi-value">${livrosDisplay}</div></div>
  `;
}

function processEvolucao(data, idChart) {
  const yearsMap = {};
  data.forEach(r => {
    const y = r["Ano"];
    const t = r["Tipo"] || "Outros";
    if(!y || isNaN(y)) return;
    if(!yearsMap[y]) yearsMap[y] = {};
    yearsMap[y][t] = (yearsMap[y][t]||0) + 1;
  });
  const sortedYears = Object.keys(yearsMap).sort();

  // Compute total per type and grand total
  const typeTotals = {};
  let grandTotal = 0;
  Object.values(yearsMap).forEach(yearData => {
    Object.entries(yearData).forEach(([type, count]) => {
      typeTotals[type] = (typeTotals[type]||0) + count;
      grandTotal += count;
    });
  });

  // Determine small types (<2% of grand total)
  const threshold = 0.02 * grandTotal;
  const smallTypes = new Set();
  Object.entries(typeTotals).forEach(([type, total]) => {
    if (total < threshold) smallTypes.add(type);
  });

  // Find existing "Outras" category to merge with (case-insensitive)
  let existingOutras = null;
  Object.keys(typeTotals).forEach(type => {
    if (type.toLowerCase().startsWith('outras') || type.toLowerCase().startsWith('outros')) {
      existingOutras = type;
    }
  });

  // Create mapping to aggregated type
  const typeToAgg = {};
  const targetOutras = existingOutras || "Outras";
  Object.keys(typeTotals).forEach(type => {
    typeToAgg[type] = smallTypes.has(type) ? targetOutras : type;
  });

  // Build aggregated years map
  const aggYearsMap = {};
  sortedYears.forEach(y => {
    aggYearsMap[y] = {};
    Object.entries(yearsMap[y]).forEach(([type, count]) => {
      const aggType = typeToAgg[type];
      aggYearsMap[y][aggType] = (aggYearsMap[y][aggType]||0) + count;
    });
  });

  // Get unique aggregated types
  const aggTypesSet = new Set();
  Object.values(aggYearsMap).forEach(v => Object.keys(v).forEach(t => aggTypesSet.add(t)));
  const aggTypes = Array.from(aggTypesSet);

  const colors = ["#4D90FE", "#F44336", "#4CAF50", "#FFC107", "#9C27B0", "#00BCD4", "#E91E63", "#FF9800", "#795548", "#607D8B"];

  const datasetsEvo = aggTypes.map((t, i) => ({
    label: t.length > 40 ? t.substring(0,40)+"..." : t,
    data: sortedYears.map(y => aggYearsMap[y][t] || 0),
    backgroundColor: colors[i % colors.length]
  }));

  createChart(idChart, "bar", {
    labels: sortedYears,
    datasets: datasetsEvo
  }, {
    scales: {
      x: { stacked: true, ticks: {color:'#555'} },
      y: { stacked: true, ticks: {color:'#555'} }
    },
    plugins: {
      legend: { position: 'bottom', labels: { color: '#444' } }
    }
  });
  return colors;
}

function processTipos(data, idChart, colors) {
  const typeMap = {};
  data.forEach(r => {
    const t = r["Tipo"] || "Outros";
    typeMap[t] = (typeMap[t]||0)+1;
  });

  // Aggregate small types (<2%) into "Outras" (merge with existing if present)
  const grandTotal = Object.values(typeMap).reduce((sum, v) => sum + v, 0);
  const threshold = 0.02 * grandTotal;
  const smallTypes = new Set();
  Object.entries(typeMap).forEach(([type, total]) => {
    if (total < threshold) smallTypes.add(type);
  });

  let existingOutras = null;
  Object.keys(typeMap).forEach(type => {
    if (type.toLowerCase().startsWith('outras') || type.toLowerCase().startsWith('outros')) {
      existingOutras = type;
    }
  });

  const targetOutras = existingOutras || "Outras";
  const aggMap = {};
  Object.entries(typeMap).forEach(([type, count]) => {
    const aggType = smallTypes.has(type) ? targetOutras : type;
    aggMap[aggType] = (aggMap[aggType]||0) + count;
  });

  createChart(idChart, "pie", {
    labels: Object.keys(aggMap).map(l => l.length>40 ? l.substring(0,40)+"..." : l),
    datasets: [{
      data: Object.values(aggMap),
      backgroundColor: colors || ["#4D90FE", "#F44336", "#4CAF50", "#FFC107", "#9C27B0", "#00BCD4", "#E91E63"]
    }]
  });
}

function renderChartsCientifica() {
  const data = STATE.filtered.bibliografica;
  
  // Evolução Temporal (Todas as Categorias)
  processEvolucao(data, "chart-cientifica-evolucao");
  
  // Map - show relative values using total active researchers per campus
  const cientificaPesquisadores = getServidoresPerCampus(STATE.filtered.bibliografica);
  renderGenericMap(data, 'map-cientifica', "#4CAF50", "Produções Científicas", cientificaPesquisadores);
}

function renderChartsTecnica() {
  const data = STATE.filtered.tecnica;

  // Evolução Temporal (Todas as Categorias)
  processEvolucao(data, "chart-tecnica-evolucao");

  // Pie: Tipos
  processTipos(data, "chart-tecnica-pie");

  // Map - show relative values using total active researchers per campus
  const tecnicaPesquisadores = getServidoresPerCampus(STATE.filtered.tecnica);
  renderGenericMap(data, 'map-tecnica', "#1b5e20", "Produções Técnicas", tecnicaPesquisadores);
}

function renderKPIsTecnica() {
  const data = STATE.filtered.tecnica;
  const total = data.length;
  const apresentacoes = data.filter(r => {
    const t = (r["Tipo"]||"").toLowerCase();
    return t.includes("apresentaç") || t.includes("apresentac");
  }).length;
  const cursos = data.filter(r => {
    const t = (r["Tipo"]||"").toLowerCase();
    return t.includes("curso") || t.includes("organização") || t.includes("organizacao");
  }).length;

  const totalPesquisadoresAtivos = getTotalActiveResearchers();
  const relativeMode = isRelativeMetricsEnabled();
  const labelSuffix = relativeMode ? '/Pesquisador' : '';

  let totalDisplay = total;
  let apresentacoesDisplay = apresentacoes;
  let cursosDisplay = cursos;

  // Use total active researchers as divisor for fair comparison
  if (relativeMode && totalPesquisadoresAtivos > 0) {
    totalDisplay = formatRelativeValue(total, totalPesquisadoresAtivos);
    apresentacoesDisplay = formatRelativeValue(apresentacoes, totalPesquisadoresAtivos);
    cursosDisplay = formatRelativeValue(cursos, totalPesquisadoresAtivos);
  }

  $('kpi-tecnica').innerHTML = `
    <div class="kpi-card"><div class="kpi-label">Total de Produções${labelSuffix}</div><div class="kpi-value">${totalDisplay}</div></div>
    <div class="kpi-card"><div class="kpi-label">Apresentações${labelSuffix}</div><div class="kpi-value">${apresentacoesDisplay}</div></div>
    <div class="kpi-card"><div class="kpi-label">Cursos/Eventos${labelSuffix}</div><div class="kpi-value">${cursosDisplay}</div></div>
  `;
}

function renderKPIsInovacao() {
  const data = STATE.filtered.inovacao;
  const total = data.length;
  // A fonte é o INPI, que dá o titular e os autores mas nunca o campus. Quando
  // nenhum autor casa com a base do SUAP, o registro fica sem campus: some do
  // mapa e da tabela por campus, mas continua no total. O KPI abaixo torna essa
  // diferença visível, em vez de deixar a soma do mapa parecer errada.
  const semCampus = data.filter(r => !r["campus"]).length;
  $('kpi-inovacao').innerHTML = `
    <div class="kpi-card"><div class="kpi-label">Total de Registros (PI)</div><div class="kpi-value">${total}</div></div>
    <div class="kpi-card"><div class="kpi-label">Sem Campus Atribuído</div><div class="kpi-value">${semCampus}</div></div>
  `;
}

function renderChartsInovacao() {
  const data = STATE.filtered.inovacao;
  
  // Evo 1: Patentes e Softwares — as duas bases de maior volume no INPI
  const patentes = data.filter(r => {
    const t = (r["Tipo"]||"").toLowerCase();
    return t.includes("patente") || t.includes("software") || t.includes("computador");
  });
  processEvolucao(patentes, "chart-inovacao-evo-1");

  // Evo 2: Marcas e Desenhos Industriais. O gráfico ficou vazio enquanto a aba
  // vinha do Lattes: não havia nenhuma marca declarada, e só 6 desenhos.
  const marcas = data.filter(r => {
    const t = (r["Tipo"]||"").toLowerCase();
    return !t.includes("patente") && !t.includes("software") && !t.includes("computador");
  });
  processEvolucao(marcas, "chart-inovacao-evo-2");
  
  // Pie: Tipos
  processTipos(data, "chart-inovacao-pie");

  // Map - show relative values using total active researchers per campus
  const inovacaoPesquisadores = getServidoresPerCampus(STATE.filtered.inovacao);
  renderGenericMap(data, 'map-inovacao', "#9C27B0", "Registros de PI", inovacaoPesquisadores);
}

function renderChartsGrupos() {
  const data = STATE.filtered.grupos;

  // Combined chart with Dual Y-axis: Created/Deleted (left) + Cumulative Total (right)
  const yearsCreated = {};
  const yearsDeleted = {};
  const yearsCumulative = {};
  let earliestYear = 2100;
  let latestYear = new Date().getFullYear();

  // Calculate created groups by year
  data.forEach(r => {
    const formedYear = parseInt(r["AnoFormacao"], 10);
    if (formedYear && formedYear < earliestYear) earliestYear = formedYear;
    if (formedYear) yearsCreated[formedYear] = (yearsCreated[formedYear] || 0) + 1;
  });

  // Calculate deleted groups by year (using UltimoEnvio as approximation)
  data.forEach(r => {
    const status = (r["Situacao"]||"").toLowerCase();
    if (status.includes("excluí") || status.includes("exclui")) {
        const lastEnvio = r["UltimoEnvio"] || "";
        const matchYear = lastEnvio.match(/(\d{4})/);
        if(matchYear) yearsDeleted[matchYear[1]] = (yearsDeleted[matchYear[1]] || 0) + 1;
    }
  });

  // Build sorted years and cumulative data
  const sortedYears = [];
  const createdData = [];
  const deletedData = [];
  const cumulativeData = [];
  let currentTotal = 0;

  if (earliestYear !== 2100) {
    for (let y = earliestYear; y <= latestYear; y++) {
      sortedYears.push(y.toString());
      const created = yearsCreated[y] || 0;
      const deleted = yearsDeleted[y] || 0;
      createdData.push(created);
      deletedData.push(deleted);
      currentTotal += created - deleted;
      cumulativeData.push(currentTotal);
    }
  }

  // Create dual Y-axis chart
  createChart("chart-grupos-evo-combined", "bar", {
    labels: sortedYears,
    datasets: [
      {
        label: "Novos Grupos",
        data: createdData,
        backgroundColor: "#4CAF50",
        yAxisID: 'y',
        order: 2
      },
      {
        label: "Excluídos",
        data: deletedData,
        backgroundColor: "#F44336",
        yAxisID: 'y',
        order: 3
      },
      {
        label: "Total de Ativos (Acumulado)",
        data: cumulativeData,
        type: "line",
        borderColor: "#2196F3",
        backgroundColor: "rgba(33, 150, 243, 0.1)",
        tension: 0.3,
        fill: false,
        yAxisID: 'y1',
        order: 1
      }
    ]
  }, {
    scales: {
      x: {
        ticks: { color: '#555' }
      },
      y: {
        type: 'linear',
        display: true,
        position: 'left',
        title: {
          display: true,
          text: 'Grupos Criados/Excluídos',
          color: '#555'
        },
        ticks: { color: '#555', beginAtZero: true },
        beginAtZero: true
      },
      y1: {
        type: 'linear',
        display: true,
        position: 'right',
        title: {
          display: true,
          text: 'Total de Ativos Acumulado',
          color: '#555'
        },
        ticks: { color: '#555', beginAtZero: true },
        beginAtZero: true,
        grid: {
          drawOnChartArea: false
        }
      }
    }
  });

  // Pie: Áreas
  const areaMap = {};
  data.forEach(r => {
    let a = (r["Area"] || "Não informada").split(";")[0];
    areaMap[a] = (areaMap[a]||0)+1;
  });
  createChart("chart-grupos-pie", "doughnut", {
    labels: Object.keys(areaMap).map(l => l.length>30 ? l.substring(0,30)+"..." : l),
    datasets: [{ data: Object.values(areaMap), backgroundColor: ["#9C27B0","#E91E63","#FF9800","#00BCD4","#4CAF50"] }]
  });

  // Map - For grupos, use pesquisadores count from groups data
  renderGenericMap(data, 'map-grupos', "#00BCD4", "Grupos de Pesquisa");
}

function renderKPIsGrupos() {
  const data = STATE.filtered.grupos;
  const total = data.length;
  const certificados = data.filter(r => (r["Situacao"]||"").includes("Certificado")).length;
  const excluidos = data.filter(r => (r["Situacao"]||"") === "Excluído").length;
  const emPreenchimento = data.filter(r => (r["Situacao"]||"") === "Em preenchimento").length;
  const naoAtualizado = data.filter(r => (r["Situacao"]||"").includes("Não-atualizado")).length;
  const aguardandoCert = data.filter(r => (r["Situacao"]||"") === "Aguardando certificação").length;
  let totalPesq = 0, totalEst = 0;
  data.forEach(r => {
    totalPesq += parseInt(r["Pesquisadores"]||0);
    totalEst += parseInt(r["Estudantes"]||0);
  });
  const avgPesq = total ? (totalPesq/total).toFixed(1) : 0;
  const avgEst = total ? (totalEst/total).toFixed(1) : 0;

  $('kpi-grupos').innerHTML = `
    <div class="kpi-card"><div class="kpi-label">Certificados</div><div class="kpi-value">${certificados}</div></div>
    <div class="kpi-card"><div class="kpi-label">Excluídos</div><div class="kpi-value">${excluidos}</div></div>
    <div class="kpi-card"><div class="kpi-label">Em Preenchimento</div><div class="kpi-value">${emPreenchimento}</div></div>
    <div class="kpi-card"><div class="kpi-label">Não Atualizados (>12m)</div><div class="kpi-value">${naoAtualizado}</div></div>
    <div class="kpi-card"><div class="kpi-label">Aguardando Certificação</div><div class="kpi-value">${aguardandoCert}</div></div>
    <div class="kpi-card"><div class="kpi-label">Média de Pesquisadores/Grupo</div><div class="kpi-value">${avgPesq}</div></div>
    <div class="kpi-card"><div class="kpi-label">Média de Estudantes/Grupo</div><div class="kpi-value">${avgEst}</div></div>
  `;
}

function renderChartsOrientacoes() {
  const concluidas = STATE.filtered.concluidas;
  const andamento = STATE.filtered.andamento;
  
  // Evo 1: Concluídas
  processEvolucao(concluidas, "chart-orientacoes-evo-1");
  
  // Evo 2: Em Andamento
  processEvolucao(andamento, "chart-orientacoes-evo-2");
  
  // Pie: Nível
  processTipos([...concluidas, ...andamento], "chart-orientacoes-pie");

  // Map - Using grupos data for researcher distribution
  renderGenericMap(STATE.filtered.grupos, 'map-orientacoes', "#E91E63", "Pesquisadores (aprox.)");
}

function renderKPIsOrientacoes() {
  const concluidas = STATE.filtered.concluidas;
  const andamento = STATE.filtered.andamento;
  const combined = [...concluidas, ...andamento];
  const totalConcluidas = concluidas.length;
  const totalAndamento = andamento.length;
  const total = combined.length;

  const totalPesquisadoresAtivos = getTotalActiveResearchers();
  const relativeMode = isRelativeMetricsEnabled();
  const labelSuffix = relativeMode ? '/Pesquisador' : '';

  let totalDisplay = total;
  let concluidasDisplay = totalConcluidas;
  let andamentoDisplay = totalAndamento;

  // Use total active researchers as divisor for fair comparison
  if (relativeMode && totalPesquisadoresAtivos > 0) {
    totalDisplay = formatRelativeValue(total, totalPesquisadoresAtivos);
    concluidasDisplay = formatRelativeValue(totalConcluidas, totalPesquisadoresAtivos);
    andamentoDisplay = formatRelativeValue(totalAndamento, totalPesquisadoresAtivos);
  }

  $('kpi-orientacoes').innerHTML = `
    <div class="kpi-card"><div class="kpi-label">Total de Orientações${labelSuffix}</div><div class="kpi-value">${totalDisplay}</div></div>
    <div class="kpi-card"><div class="kpi-label">Concluídas${labelSuffix}</div><div class="kpi-value">${concluidasDisplay}</div></div>
    <div class="kpi-card"><div class="kpi-label">Em Andamento${labelSuffix}</div><div class="kpi-value">${andamentoDisplay}</div></div>
  `;
}

// =====================
// Tab: IC (Iniciação Científica)
// =====================

function renderKPIsIC() {
  const data = STATE.filtered.ic;
  const total = data.length;
  const bolsistasUnicos = new Set(data.map(r => r.bolsista).filter(Boolean)).size;
  const orientadoresUnicos = new Set(data.map(r => r.orientador).filter(Boolean)).size;
  const campiComIC = new Set(data.map(r => r.campus).filter(Boolean)).size;
  const modais = {};
  data.forEach(r => {
    const m = r.modalidade || 'Outra';
    modais[m] = (modais[m] || 0) + 1;
  });
  const modalEntries = Object.entries(modais).sort((a, b) => b[1] - a[1]);

  $('kpi-ic').innerHTML = `
    <div class="kpi-grid">
      <div class="kpi-card"><div class="kpi-label">Total de Projetos</div><div class="kpi-value">${total}</div></div>
      <div class="kpi-card"><div class="kpi-label">Bolsistas Únicos</div><div class="kpi-value">${bolsistasUnicos}</div></div>
      <div class="kpi-card"><div class="kpi-label">Orientadores Únicos</div><div class="kpi-value">${orientadoresUnicos}</div></div>
      <div class="kpi-card"><div class="kpi-label">Campi com IC</div><div class="kpi-value">${campiComIC}</div></div>
    </div>
    <div class="kpi-grid" style="display:flex;flex-wrap:wrap;justify-content:center;gap:1rem">
      ${modalEntries.map(([m, c]) => `<div class="kpi-card" style="flex:0 0 auto;min-width:140px"><div class="kpi-label">${m}</div><div class="kpi-value">${c}</div></div>`).join('')}
    </div>
  `;
}

function renderChartsIC() {
  const data = STATE.filtered.ic;

  // Evolution: projects per year
  const yearMap = {};
  data.forEach(r => {
    const y = r.ano;
    if (!y) return;
    yearMap[y] = (yearMap[y] || 0) + 1;
  });
  const sortedYears = Object.keys(yearMap).sort();
  createChart('chart-ic-evolucao', 'bar', {
    labels: sortedYears,
    datasets: [{
      label: 'Projetos de IC',
      data: sortedYears.map(y => yearMap[y]),
      backgroundColor: '#4D90FE'
    }]
  }, {
    scales: {
      x: { ticks: { color: '#555' } },
      y: { ticks: { color: '#555', beginAtZero: true } }
    },
    plugins: {
      legend: { display: false }
    }
  });

  // Pie: modalidade
  const modalMap = {};
  data.forEach(r => {
    const m = r.modalidade || 'Outra';
    modalMap[m] = (modalMap[m] || 0) + 1;
  });
  createChart('chart-ic-modalidade', 'doughnut', {
    labels: Object.keys(modalMap),
    datasets: [{
      data: Object.values(modalMap),
      backgroundColor: ['#4D90FE', '#F44336', '#4CAF50', '#FFC107', '#9C27B0']
    }]
  });

  // Pie: área do conhecimento
  const areaMap = {};
  data.forEach(r => {
    const a = r.area_conhecimento || 'Não informada';
    areaMap[a] = (areaMap[a] || 0) + 1;
  });
  // Aggregate small areas (<2%) into "Outras"
  const grandTotal = Object.values(areaMap).reduce((s, v) => s + v, 0);
  const threshold = 0.02 * grandTotal;
  const smallAreas = new Set();
  Object.entries(areaMap).forEach(([area, count]) => {
    if (count < threshold) smallAreas.add(area);
  });
  const aggAreaMap = {};
  Object.entries(areaMap).forEach(([area, count]) => {
    const key = smallAreas.has(area) ? 'Outras' : area;
    aggAreaMap[key] = (aggAreaMap[key] || 0) + count;
  });
  createChart('chart-ic-area', 'pie', {
    labels: Object.keys(aggAreaMap),
    datasets: [{
      data: Object.values(aggAreaMap),
      backgroundColor: ['#4D90FE', '#F44336', '#4CAF50', '#FFC107', '#9C27B0', '#00BCD4', '#E91E63', '#FF9800']
    }]
  });

  // Pie: fomento
  const fomentoMap = {};
  data.forEach(r => {
    const f = r.fomento || 'Não informado';
    fomentoMap[f] = (fomentoMap[f] || 0) + 1;
  });
  const fomentoTotal = Object.values(fomentoMap).reduce((s, v) => s + v, 0);
  const fomentoThreshold = 0.02 * fomentoTotal;
  const smallFomento = new Set();
  Object.entries(fomentoMap).forEach(([f, c]) => {
    if (c < fomentoThreshold) smallFomento.add(f);
  });
  const aggFomentoMap = {};
  Object.entries(fomentoMap).forEach(([f, c]) => {
    const key = smallFomento.has(f) ? 'Outros' : f;
    aggFomentoMap[key] = (aggFomentoMap[key] || 0) + c;
  });
  createChart('chart-ic-fomento', 'doughnut', {
    labels: Object.keys(aggFomentoMap),
    datasets: [{
      data: Object.values(aggFomentoMap),
      backgroundColor: ['#4D90FE', '#F44336', '#4CAF50', '#FFC107', '#9C27B0', '#00BCD4', '#E91E63', '#FF9800']
    }]
  });

  // Map: geographic distribution
  renderGenericMap(data, 'map-ic', '#FF9800', 'Projetos de IC');
}
