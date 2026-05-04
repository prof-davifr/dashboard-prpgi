// script.js – PRPGI Dashboard core logic
// Data is pre-built into data.json by build.js (run: npm run build)


const STATE = {
  raw: {
    bibliografica: [],
    tecnica: [],
    inovacao: [],
    concluidas: [],
    andamento: [],
    grupos: [],
    posgraduacao: []
  },
  filtered: {},
  charts: {},
  leafMaps: {},
  minYear: 1947,
  maxYear: new Date().getFullYear()
};

// Utilities for DOM
const $ = id => document.getElementById(id);

document.getElementById('year').textContent = new Date().getFullYear();

function formatDateTimePtBr(isoString) {
  if (!isoString) return "não disponível";
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return "não disponível";
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function renderSourceUpdates(meta) {
  const sourceDates = meta && meta.sourceDates ? meta.sourceDates : {};
  const entries = Object.values(sourceDates)
    .sort((a, b) => (a.label || '').localeCompare(b.label || '', 'pt-BR'))
    .map(source => `${source.label}: ${formatDateTimePtBr(source.modifiedAt)}`);

  const text = entries.length > 0
    ? `Fontes: ${entries.join(' | ')}`
    : 'Fontes: não disponível';

  if ($('source-updates-display')) $('source-updates-display').textContent = text;
  if ($('source-updates-modal')) $('source-updates-modal').textContent = `Atualização por fonte: ${entries.length > 0 ? entries.join(' | ') : 'não disponível'}.`;
}

// Tab switching
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const previousActiveTab = document.querySelector('.tab-btn.active');
    const switchingToPosGraduacao = e.target.dataset.target === 'tab-posgraduacao';
    const switchingFromPosGraduacao = previousActiveTab && previousActiveTab.dataset.target === 'tab-posgraduacao';
    const switchingToPesquisadores = e.target.dataset.target === 'tab-pesquisadores';

    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    e.target.classList.add('active');
    $(e.target.dataset.target).classList.add('active');

    // Fix for Leaflet maps in hidden tabs
    setTimeout(() => {
      Object.values(STATE.leafMaps).forEach(m => {
        if (m) m.invalidateSize();
      });
    }, 100);

    // Reset post-graduation filters if switching away from that tab
    if (switchingFromPosGraduacao && !switchingToPosGraduacao) {
      const posgradFilters = ['posgrad-categoria-filter', 'posgrad-status-filter', 'posgrad-campus-filter', 'posgrad-curso-filter'];
      posgradFilters.forEach(id => {
        const elem = $(id);
        if (elem && elem.value !== 'all') {
          elem.value = 'all';
        }
      });
      if ($('posgrad-matured-only-toggle')) $('posgrad-matured-only-toggle').checked = true;
      processData();
    }

    // Re-render post-graduation charts if that tab is now active
    if (switchingToPosGraduacao) {
      renderChartsPosGraduacao();
    }
    
    // Re-render pesquisadores charts if that tab is now active
    if (switchingToPesquisadores) {
      renderChartsPesquisadores();
    }
  });
});



// Extract distinct Servidor ID
function extractServidorIds(records) {
  const ids = new Set();
  records.forEach(r => {
    if (r["Servidor"]) ids.add(r["Servidor"]);
  });
  return ids;
}

// Get count of distinct servidores per campus
function getServidoresPerCampus(records) {
  const campusMap = {}; // campus -> Set of servidor IDs
  records.forEach(r => {
    if (r["Servidor"] && r.campus) {
      if (!campusMap[r.campus]) campusMap[r.campus] = new Set();
      campusMap[r.campus].add(r["Servidor"]);
    }
  });
  // Convert Sets to counts
  const result = {};
  Object.keys(campusMap).forEach(campus => {
    result[campus] = campusMap[campus].size;
  });
  return result;
}

// Get total distinct servidores across all campuses
function getTotalServidores(records) {
  return extractServidorIds(records).size;
}

// Get total active researchers across ALL data sources (for relative metrics divisor)
function getTotalActiveResearchers() {
  const allIdsArray = [];
  [STATE.filtered.bibliografica, STATE.filtered.tecnica, STATE.filtered.concluidas, STATE.filtered.andamento].forEach(arr => {
    arr.forEach(r => {
      if (r["Servidor"]) {
        allIdsArray.push(r["Servidor"]);
      }
    });
  });
  return new Set(allIdsArray).size;
}

// Check if relative metrics mode is active
function isRelativeMetricsEnabled() {
  const toggle = $('relative-metrics-toggle');
  return toggle ? toggle.checked : false;
}

// Format relative metric value (with 2 decimal places)
function formatRelativeValue(value, divisor) {
  if (divisor === 0 || divisor === null || divisor === undefined) return '0';
  const result = value / divisor;
  return result.toFixed(2);
}

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

function processData() {
  const filterVal = $('period-filter').value;
  const uniqueOnly = $('unique-toggle') ? $('unique-toggle').checked : false;

  let startYear = STATE.minYear;
  const endYear = STATE.maxYear;

  if (filterVal !== 'all') {
    const filterNum = parseInt(filterVal);
    if (filterNum === 0) {
      // Current year only
      startYear = endYear;
    } else if (filterNum === 1) {
      // Last year only (previous calendar year)
      startYear = endYear - 1;
    } else {
      // Last N years (5, 10)
      startYear = endYear - filterNum + 1;
    }
  }

  const campusVal = $('campus-filter').value;
  
  // Check if post-graduation tab is active
  const isPosGraduacaoTab = $('tab-posgraduacao') && 
                           $('tab-posgraduacao').classList.contains('active');
  
  // Post-graduation specific filters - only get values if on post-graduation tab
  let categoriaVal = 'all';
  let statusVal = 'all';
  let posgradCampusVal = 'all';
  let posgradCursoVal = 'all';
  let maturedOnly = true;
  
  if (isPosGraduacaoTab) {
    categoriaVal = $('posgrad-categoria-filter') ? $('posgrad-categoria-filter').value : 'all';
    statusVal = $('posgrad-status-filter') ? $('posgrad-status-filter').value : 'all';
    posgradCampusVal = $('posgrad-campus-filter') ? $('posgrad-campus-filter').value : 'all';
    posgradCursoVal = $('posgrad-curso-filter') ? $('posgrad-curso-filter').value : 'all';
    maturedOnly = $('posgrad-matured-only-toggle') ? $('posgrad-matured-only-toggle').checked : true;
  }

  const filterPeriodAndCampus = arr => arr.filter(r => {
    // Year filter (if it has "Ano")
    if (r["Ano"]) {
        const y = parseInt(r["Ano"], 10);
        const inPeriod = !isNaN(y) && y >= startYear && y <= endYear;
        if (!inPeriod) return false;
    }

    // Campus filter
    if (campusVal === 'all') return true;
    
    // For Lattes data (Excel) tagged with campus
    if (r.campus) return r.campus === campusVal;

    // For DGP data (CSV) - map Unidade to campus code
    let rCampus = "";
    if (r["Unidade"]) {
      const u = r["Unidade"].toUpperCase();
      Object.entries(CAMPUS_TO_CITY).forEach(([code, city]) => {
        if (u.includes(city)) rCampus = code;
      });
    }
    return rCampus === campusVal;
  });

  const filterGroupsCampus = arr => arr.filter(r => {
    if (campusVal === 'all') return true;
    let rCampus = "";
    if (r["Unidade"]) {
      const u = r["Unidade"].toUpperCase();
      Object.entries(CAMPUS_TO_CITY).forEach(([code, city]) => {
         if (u.includes(city)) rCampus = code;
      });
    }
    return rCampus === campusVal;
  });

  // Post-graduation filter function
  const filterPosGraduacao = arr => arr.filter(r => {
    const status = normalizePosGraduacaoStatus(r.situacao);
    const cohortYear = parseInt(r.ano, 10);
    const isMature = isPosGraduacaoMature(r);
    
    // Campus filter (tab-local filter first, then global fallback when local is all)
    const effectiveCampus = posgradCampusVal !== 'all' ? posgradCampusVal : campusVal;
    if (effectiveCampus !== 'all' && r.campus !== effectiveCampus) return false;

    // Program filter
    if (posgradCursoVal !== 'all' && (r.curso || '').trim() !== posgradCursoVal) return false;
    
    // Categoria filter
    if (categoriaVal !== 'all' && r.categoria !== categoriaVal) return false;
    
    // Status filter
    if (statusVal !== 'all' && status !== statusVal) return false;

    // Only cohorts mature enough to expect an outcome (default on)
    if (maturedOnly && !isMature) return false;

    // Guard against invalid cohort year
    if (Number.isNaN(cohortYear)) return false;
    
    return true;
  });

  const filterUnique = arr => {
    if (!uniqueOnly) return arr;
    
    const seen = new Set();
    const result = [];
    
    for (const r of arr) {
      const key = r.dedupKey;
      if (!key) {
        result.push(r);
        continue;
      }
      
      if (!seen.has(key)) {
        seen.add(key);
        result.push(r);
      }
    }
    return result;
  };

  STATE.filtered = {
    bibliografica: filterUnique(filterPeriodAndCampus(STATE.raw.bibliografica)),
    tecnica: filterUnique(filterPeriodAndCampus(STATE.raw.tecnica)),
    inovacao: filterUnique(filterPeriodAndCampus(STATE.raw.inovacao)),
    concluidas: filterUnique(filterPeriodAndCampus(STATE.raw.concluidas)),
    andamento: filterUnique(filterPeriodAndCampus(STATE.raw.andamento)),
    grupos: filterGroupsCampus(STATE.raw.grupos),
    posgraduacao: filterPosGraduacao(STATE.raw.posgraduacao)
  };

// Main initialization
  renderKPIsCientifica();
  renderChartsCientifica();
  renderKPIsTecnica();
  renderChartsTecnica();
  renderKPIsInovacao();
  renderChartsInovacao();
  renderKPIsGrupos();
  renderChartsGrupos();
  renderKPIsPesquisadores();
  renderChartsPesquisadores();
  renderKPIsOrientacoes();
  renderChartsOrientacoes();
  
  // Render tables
  renderTables();

  // Render post-graduation if tab is active
  if ($('tab-posgraduacao') && $('tab-posgraduacao').classList.contains('active')) {
    renderChartsPosGraduacao();
  }
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
  
  // Pie: Qualis
  const qualisMap = {};
  data.forEach(r => {
    let q = (r["Estrato"]||"").trim();
    if(!q || q==="-" || q==="Não informado") q = "Sem Estrato";
    qualisMap[q] = (qualisMap[q]||0)+1;
  });
  createChart("chart-cientifica-pie", "doughnut", {
    labels: Object.keys(qualisMap),
    datasets: [{
      data: Object.values(qualisMap),
      backgroundColor: ["#1B5E20","#4CAF50","#81C784","#C8E6C9","#FFCDD2","#EF9A9A","#F44336","#D32F2F","#263238","#B0BEC5"]
    }]
  });

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
    <div class="kpi-card"><div class="kpi-label">Total Produções${labelSuffix}</div><div class="kpi-value">${totalDisplay}</div></div>
    <div class="kpi-card"><div class="kpi-label">Apresentações${labelSuffix}</div><div class="kpi-value">${apresentacoesDisplay}</div></div>
    <div class="kpi-card"><div class="kpi-label">Cursos/Eventos${labelSuffix}</div><div class="kpi-value">${cursosDisplay}</div></div>
  `;
}

// Shared precise coordinates for all IFBA cities
// This dashboard covers IFBA (Instituto Federal da Bahia) only.
// Do NOT add coordinates for IFBaiano (Instituto Federal Baiano) campuses.
const IFBA_COORDS = {
  "SALVADOR": [-12.9714, -38.5014],
  "FEIRA DE SANTANA": [-12.2666, -38.9666],
  "VITÓRIA DA CONQUISTA": [-14.8661, -40.8394],
  "VITORIA DA CONQUISTA": [-14.8661, -40.8394],
  "ILHÉUS": [-14.7889, -39.0494],
  "ILHEUS": [-14.7889, -39.0494],
  "ITABUNA": [-14.7869, -39.2800],
  "JEQUIÉ": [-13.8580, -40.0830],
  "JEQUIE": [-13.8580, -40.0830],
  "VALENÇA": [-13.3700, -39.0730],
  "VALENCA": [-13.3700, -39.0730],
  "SANTO AMARO": [-12.5445, -38.7135],
  "CAMAÇARI": [-12.6975, -38.3241],
  "CAMACARI": [-12.6975, -38.3241],
  "SIMÕES FILHO": [-12.7844, -38.4025],
  "SIMOES FILHO": [-12.7844, -38.4025],
  "IRECÊ": [-11.3040, -41.8557],
  "IRECE": [-11.3040, -41.8557],
  "BARREIRAS": [-12.1528, -44.9900],
  "BRUMADO": [-14.2045, -41.6663],
  "EUNÁPOLIS": [-16.3720, -39.5815],
  "EUNAPOLIS": [-16.3720, -39.5815],
  "JACOBINA": [-11.1818, -40.5181],
  "JUAZEIRO": [-9.4124, -40.5055],
  "PAULO AFONSO": [-9.4005, -38.2163],
  "SANTO ANTÔNIO DE JESUS": [-12.9680, -39.2618],
  "SANTO ANTONIO DE JESUS": [-12.9680, -39.2618],
  "SEABRA": [-12.4187, -41.7702],
  "EUCLIDES DA CUNHA": [-10.5085, -39.0150],
  "UBABAITABA": [-14.2255, -39.3245],
  "JAGUAQUARA": [-13.5283, -39.9713],
  "PORTO SEGURO": [-16.4442, -39.0644],
  "CAMPO FORMOSO": [-10.5100, -40.3200],
  "LAURO DE FREITAS": [-12.8967, -38.3286],
  "POLO DE INOVAÇÃO SALVADOR": [-12.9714, -38.5014],
  "POLO DE INOVACAO SALVADOR": [-12.9714, -38.5014]
};

const CAMPUS_TO_CITY = {
  "BAR": "BARREIRAS", "BRU": "BRUMADO", "CAM": "CAMAÇARI", "CFO": "CAMPO FORMOSO", 
  "EC": "EUCLIDES DA CUNHA", "EUN": "EUNÁPOLIS", "FS": "FEIRA DE SANTANA", 
  "ILH": "ILHÉUS", "IRE": "IRECÊ", "JAC": "JACOBINA", "JAG": "JAGUAQUARA", 
  "JEQ": "JEQUIÉ", "LF": "LAURO DE FREITAS", "SAM": "SANTO AMARO", "SEA": "SEABRA",
  "SF": "SIMÕES FILHO", "UBA": "UBAITABA", "VAL": "VALENÇA", "VC": "VITÓRIA DA CONQUISTA", 
  "SAJ": "SANTO ANTÔNIO DE JESUS", "JUA": "JUAZEIRO", "PA": "PAULO AFONSO",
  "PIS": "POLO DE INOVAÇÃO SALVADOR", "PS": "PORTO SEGURO", "SSA": "SALVADOR"
};

function lookupCoords(city) {
  if(!city) return null;
  const norm = city.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  return IFBA_COORDS[city] || IFBA_COORDS[norm] || null;
}

function renderGenericMap(data, mapId, color, label, pesquisadoresData = null) {
  if (STATE.leafMaps[mapId]) {
    STATE.leafMaps[mapId].remove();
  }

  const mapElement = $(mapId);
  if (!mapElement) return;

  const bahiaBounds = [[-16.0, -46.0], [-8.0, -34.0]];
  const m = L.map(mapId, {
    maxBounds: bahiaBounds,
    minZoom: 5,
    maxBoundsViscosity: 1.0
  }).setView([-12.50, -41.50], 6);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; CARTO'
  }).addTo(m);
  STATE.leafMaps[mapId] = m;

  const cityCount = {};
  data.forEach(r => {
    // If it's DGP data, it has city/unidade; if it's Lattes, it has Servidor field with campus
    let city = "";
    if (r["Unidade"] || r["Cidade"]) {
      city = (r["Unidade"] || r["Cidade"]).trim().toUpperCase();
    } else if (r.campus) {
      city = CAMPUS_TO_CITY[r.campus] || r.campus;
    }
    if (city) cityCount[city] = (cityCount[city] || 0) + 1;
  });

  // Calculate pesquisadores per city if relative data is provided
  const cityPesquisadores = {};
  if (pesquisadoresData) {
    Object.entries(pesquisadoresData).forEach(([campus, count]) => {
      const city = CAMPUS_TO_CITY[campus] || campus;
      if (city) {
        cityPesquisadores[city] = (cityPesquisadores[city] || 0) + count;
      }
    });
  }

  const counts = Object.values(cityCount);
  const maxCount = counts.length > 0 ? Math.max(...counts) : 1;
  const minRadius = 6;
  const maxRadius = 35;

  const relativeMode = isRelativeMetricsEnabled();

  Object.entries(cityCount).forEach(([city, count]) => {
    const latlng = lookupCoords(city);
    if (!latlng) return; // Hide unknown cities

    // Normalize area (using sqrt) strictly proportional to the max count observed
    // This perfectly distinguishes 10000 from 1000
    const normalizedRadius = minRadius + (Math.sqrt(count) / Math.sqrt(maxCount)) * (maxRadius - minRadius);

    // Calculate relative value if mode is enabled and we have researcher data
    let popupContent = `<b>${city}</b><br>${count} ${label}`;
    if (relativeMode && cityPesquisadores[city] && cityPesquisadores[city] > 0) {
      const relativeValue = (count / cityPesquisadores[city]).toFixed(2);
      popupContent += ` (${relativeValue}/pesquisador)`;
    }

    L.circleMarker(latlng, {
      radius: normalizedRadius,
      fillColor: color,
      color: "#fff",
      weight: 1,
      fillOpacity: 0.7
    }).addTo(m).bindPopup(popupContent);
  });
}

function renderKPIsInovacao() {
  // Use raw instead of filtered for innovation if instructions demand "próprio período", but we'll use filtered array
  const data = STATE.filtered.inovacao;
  const total = data.length;
  $('kpi-inovacao').innerHTML = `
    <div class="kpi-card"><div class="kpi-label">Total de Registros (PI)</div><div class="kpi-value">${total}</div></div>
  `;
}

function renderChartsInovacao() {
  const data = STATE.filtered.inovacao;
  
  // Evo 1: Patentes e Softwares
  const patentes = data.filter(r => {
    const t = (r["Tipo"]||"").toLowerCase();
    return t.includes("patente") || t.includes("software") || t.includes("computador");
  });
  processEvolucao(patentes, "chart-inovacao-evo-1");
  
  // Evo 2: Marcas e Outros
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
        label: "Total Ativos (Acumulado)",
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
          text: 'Total Ativos Acumulado',
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
    <div class="kpi-card"><div class="kpi-label">Média Pesquisadores/Grupo</div><div class="kpi-value">${avgPesq}</div></div>
    <div class="kpi-card"><div class="kpi-label">Média Estudantes/Grupo</div><div class="kpi-value">${avgEst}</div></div>
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
// Tab: Pesquisadores
// =====================


// =====================
// Toast notification
// =====================

function showToast(message, durationMs = 6000) {
  const container = $('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  container.appendChild(toast);
  // Trigger animation
  requestAnimationFrame(() => toast.classList.add('toast--visible'));
  setTimeout(() => {
    toast.classList.remove('toast--visible');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  }, durationMs);
}

async function initDashboard() {
  try {
    $('loading-text').innerText = "Carregando dados...";
    const cacheName = 'dashboard-prpgi-v1';
    const jsonUrl = 'data.json';
    let data;

    try {
      const cache = await caches.open(cacheName);
      let cachedResp = await cache.match(jsonUrl);
      
      if (cachedResp) {
        data = await cachedResp.json();
        // Background validation (Stale-While-Revalidate)
        fetch(jsonUrl).then(async networkResp => {
          if (networkResp.ok) {
            const networkData = await networkResp.clone().json();
            if (networkData.meta && data.meta && networkData.meta.generatedAt !== data.meta.generatedAt) {
              await cache.put(jsonUrl, networkResp);
              showToast('Dados atualizados em segundo plano. Recarregue a página para ver as novidades.');
            }
          }
        }).catch(err => console.log('Background fetch failed', err));
      } else {
        const resp = await fetch(jsonUrl);
        if (!resp.ok) {
          $('loading-text').innerText = "Erro: data.json não encontrado. Execute 'npm run build' primeiro.";
          return;
        }
        await cache.put(jsonUrl, resp.clone());
        data = await resp.json();
      }
    } catch (e) {
      // Fallback
      console.warn('Cache API indísponivel, fallback para fetch tradicional', e);
      const resp = await fetch(jsonUrl);
      if (!resp.ok) {
        $('loading-text').innerText = "Erro: data.json não encontrado. Execute 'npm run build' primeiro.";
        return;
      }
      data = await resp.json();
    }
    // Populate raw state from pre-built JSON
    STATE.raw.bibliografica = data.bibliografica || [];
    STATE.raw.tecnica = data.tecnica || [];
    STATE.raw.inovacao = data.inovacao || [];
    STATE.raw.concluidas = data.concluidas || [];
    STATE.raw.andamento = data.andamento || [];
    STATE.raw.grupos = data.grupos || [];
    STATE.raw.posgraduacao = data.posgraduacao || [];

    // Set period labels from metadata
    if (data.meta) {
      STATE.minYear = data.meta.minYear;
      STATE.maxYear = data.meta.maxYear;
      const updatedText = formatDateTimePtBr(data.meta.generatedAt);
      if ($('last-update-display')) $('last-update-display').textContent = updatedText;
      if ($('last-update-modal')) $('last-update-modal').textContent = updatedText;
      renderSourceUpdates(data.meta);
      const currentYear = STATE.maxYear;
      const select = $('period-filter');
      select.innerHTML = `
        <option value="all">Todo o Período (${data.meta.minYear}-${data.meta.maxYear})</option>
        <option value="0">Ano Atual (${currentYear})</option>
        <option value="1">Último Ano (${currentYear - 1})</option>
        <option value="5">Últimos 5 Anos (${currentYear - 4}-${currentYear})</option>
        <option value="10">Últimos 10 Anos (${currentYear - 9}-${currentYear})</option>
      `;
    }

    $('period-filter').addEventListener('change', processData);
    $('campus-filter').addEventListener('change', processData);
    $('unique-toggle').addEventListener('change', processData);
    
    // Relative metrics toggle - re-renders KPIs and tables without re-fetching data
    if ($('relative-metrics-toggle')) {
      $('relative-metrics-toggle').addEventListener('change', () => {
        renderKPIsCientifica();
        renderKPIsTecnica();
        renderKPIsGrupos();
        renderKPIsInovacao();
        renderKPIsOrientacoes();
        renderKPIsPesquisadores();
        renderTables();
      });
    }
    
    // Post-graduation filter event listeners
    ['posgrad-categoria-filter', 'posgrad-status-filter', 'posgrad-campus-filter', 'posgrad-curso-filter', 'posgrad-matured-only-toggle']
      .forEach(id => {
        const elem = $(id);
        if (elem) elem.addEventListener('change', processData);
      });
    
    // Subtabs event listeners
    document.querySelectorAll('.sub-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const subtarget = e.target.dataset.subtarget;
        // Update active subtab
        document.querySelectorAll('.sub-tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.subtab-content').forEach(c => c.classList.remove('active'));
        e.target.classList.add('active');
        $(subtarget).classList.add('active');
        
        // Re-render post-graduation charts for the new subtab
        if ($('tab-posgraduacao') && $('tab-posgraduacao').classList.contains('active')) {
          renderChartsPosGraduacao();
        }
      });
    });
    
    // Update filter visibility based on active tab
    updateFilterVisibility();
    
    // Re-run updateFilterVisibility when tabs change
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', updateFilterVisibility);
    });

    $('loading').style.display = 'none';
    processData();
  } catch(e) {
    $('loading-text').innerText = "Erro ao carregar os arquivos.";
    console.error(e);
  }
}

// Update filter visibility based on active tab
function updateFilterVisibility() {
  const activeTab = document.querySelector('.tab-btn.active');
  if (!activeTab) return;
  
  const isPosGraduacaoTab = activeTab.dataset.target === 'tab-posgraduacao';
  const periodFilter = $('period-filter');
  
  // Show/hide unique toggle (not needed for post-graduation)
  const uniqueToggle = $('unique-toggle');
  if (uniqueToggle) {
    uniqueToggle.parentElement.style.display = isPosGraduacaoTab ? 'none' : 'flex';
  }
  if (periodFilter) {
    periodFilter.style.display = isPosGraduacaoTab ? 'none' : '';
  }
}

function getChartColors(count) {
  const palette = ["#4D90FE", "#F44336", "#4CAF50", "#FFC107", "#9C27B0", "#00BCD4", "#E91E63", "#FF9800", "#795548", "#607D8B"];
  return Array.from({ length: count }, (_, index) => palette[index % palette.length]);
}


// Methodology Modal
document.addEventListener('DOMContentLoaded', () => {
  const modalBtn = document.getElementById('methodology-btn');
  const modal = document.getElementById('methodology-modal');
  const modalClose = document.getElementById('modal-close');

  if (modalBtn && modal) {
    modalBtn.addEventListener('click', () => {
      modal.classList.add('active');
      document.body.style.overflow = 'hidden';
      // Update year display
      document.getElementById('min-year-display').textContent = STATE.minYear;
      document.getElementById('max-year-display').textContent = STATE.maxYear;
    });
  }

  if (modalClose && modal) {
    modalClose.addEventListener('click', () => {
      modal.classList.remove('active');
      document.body.style.overflow = '';
    });
  }

  // Close on overlay click
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
      }
    });
  }

  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal && modal.classList.contains('active')) {
      modal.classList.remove('active');
      document.body.style.overflow = '';
    }
  });
});

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
  let html = '<table class="data-table"><thead><tr><th>Campus</th>';
  sortedYears.forEach(y => {
    html += `<th>${y}</th>`;
  });
  html += '<th>Total</th></tr></thead><tbody>';

  sortedCampuses.forEach(campus => {
    const campusName = CAMPUS_TO_CITY[campus] || campus;
    html += `<tr><td>${campusName} (${campus})</td>`;

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
    // Map unidade to campus code
    let campus = "";
    Object.entries(CAMPUS_TO_CITY).forEach(([code, city]) => {
      if (unidade.toUpperCase().includes(city)) campus = code;
    });
    
    if (!year || !campus) return;
    
    years.add(year);
    campuses.add(campus);
    
    if (!campusYearData[campus]) campusYearData[campus] = {};
    campusYearData[campus][year] = (campusYearData[campus][year] || 0) + 1;
  });

  const sortedYears = Array.from(years).sort();
  const sortedCampuses = Array.from(campuses).sort();

  let html = '<table class="data-table"><thead><tr><th>Campus</th>';
  sortedYears.forEach(y => {
    html += `<th>${y}</th>`;
  });
  html += '<th>Total</th></tr></thead><tbody>';

  sortedCampuses.forEach(campus => {
    const campusName = CAMPUS_TO_CITY[campus] || campus;
    html += `<tr><td>${campusName} (${campus})</td>`;
    
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

window.addEventListener("DOMContentLoaded", initDashboard);
