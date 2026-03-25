// script.js – PRPGI Dashboard core logic

const DATA_PATH = "dados/";
// All valid campus files from list
const EXCEL_FILES = [
  "BAR_1947_2027.xls", "BRU_1947_2027.xls", "CAM_1947_2027.xls", "CFO_1947_2027.xls", 
  "EC_1947_2027.xls", "EUN_1947_2027.xls", "FS_1947_2027.xls", "ILH_1947_2027.xls", 
  "IRE_1947_2027.xls", "JAC_1947_2027.xls", "JAG_1947_2027.xls", "JEQ_1947_2027.xls", 
  "SAM_1947_2027.xls", "SEA_1947_2027.xls", "SF_1947_2027.xls", "SSA_1947_2027.xls",
  "UBA_1947_2027.xls", "VAL_1947_2027.xls", "VC_1947_2027.xls"
];
const CSV_FILE = "coletor_dgp_ifba.csv";

const STATE = {
  raw: {
    bibliografica: [],
    tecnica: [],
    inovacao: [],
    concluidas: [],
    andamento: [],
    grupos: []
  },
  filtered: {},
  charts: {},
  leafMaps: {}
};

// Utilities for DOM
const $ = id => document.getElementById(id);

document.getElementById('year').textContent = new Date().getFullYear();

// Tab switching
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
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
  });
});

async function loadExcelSheets(fileName) {
  try {
    const resp = await fetch(DATA_PATH + fileName);
    if (!resp.ok) return null;
    const arrayBuffer = await resp.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);
    const workbook = XLSX.read(data, { type: "array" });
    
    const getSheet = name => {
      let shName = workbook.SheetNames.find(s => s.trim().toLowerCase() === name.toLowerCase());
      if (!shName) return [];
      return XLSX.utils.sheet_to_json(workbook.Sheets[shName], { raw: false, defval: null });
    };

    const campusCode = fileName.split('_')[0];
    const addCampus = arr => arr.map(r => ({ ...r, campus: campusCode }));

    return {
      bibliografica: addCampus(getSheet("Produções Bibliográficas")),
      tecnica: addCampus(getSheet("Produções Técnicas")),
      inovacao: addCampus(getSheet("Registros e Patentes")),
      concluidas: addCampus(getSheet("Orientações Concluídas")),
      andamento: addCampus(getSheet("Orientações em Andamento"))
    };
  } catch(e) {
    console.warn("Failed to load or parse " + fileName, e);
    return null;
  }
}

async function loadCSV(fileName) {
  try {
    const resp = await fetch(DATA_PATH + fileName);
    const text = await resp.text();
    const rows = text.split("\n").map(r => r.trim()).filter(r => r);
    const headers = rows[0].split(",");
    return rows.slice(1).map(line => {
      // Very basic CSV parsing (ignoring quotes for simplicity of DGP extract)
      const cols = line.split('","').map(c => c.replace(/^"|"$/g, ''));
      if(cols.length === 1) {
          // fallback if not quoted
          let fallback = line.split(",");
          const obj = {};
          headers.forEach((h,i) => obj[h.trim()] = fallback[i]);
          return obj;
      }
      const obj = {};
      headers.forEach((h,i) => obj[h.replace(/^"|"$/g, '').trim()] = cols[i]);
      return obj;
    });
  } catch(e){
    console.error("CSV error", e);
    return [];
  }
}

// Extract distinct Servidor ID
function extractServidorIds(records) {
  const ids = new Set();
  records.forEach(r => {
    const srv = r["Servidor"];
    if (!srv) return;
    const match = srv.match(/(\d{7,})/);
    if (match) ids.add(match[1]);
  });
  return ids;
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
  const currentYear = new Date().getFullYear();
  let startYear = 1947;
  
  if (filterVal !== 'all') {
    startYear = currentYear - parseInt(filterVal) + 1;
    if(filterVal == "1") startYear = 2025;
    if(filterVal == "2") startYear = 2024;
    if(filterVal == "5") startYear = 2021;
    if(filterVal == "10") startYear = 2016;
  }
  const endYear = 2027;

  const campusVal = $('campus-filter').value;

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

  // Fuzzy deduplication: extract key from 'Publicação' (full citation) or 'Título' 
  // Similarity using Jaro–Winkler-style by comparing first 150 chars normalized
  const strSimilarity = (a, b) => {
    if (!a || !b) return 0;
    if (a === b) return 1;
    const longer = a.length > b.length ? a : b;
    const shorter = a.length > b.length ? b : a;
    if (longer.length === 0) return 1;
    // Simple edit-distance-based similarity
    const editDist = (s, t) => {
      const m = s.length, n = t.length;
      const dp = Array.from({length: m+1}, (_, i) => [i, ...Array(n).fill(0)]);
      for(let j = 0; j <= n; j++) dp[0][j] = j;
      for(let i = 1; i <= m; i++) for(let j = 1; j <= n; j++)
        dp[i][j] = s[i-1] === t[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
      return dp[m][n];
    };
    return (longer.length - editDist(longer, shorter)) / longer.length;
  };

  const normalizeKey = r => {
    // Prefer Título field if present; otherwise use start of Publicação (first 150 chars)
    const raw = r["Título"] || r["Nome"] || (r["Publicação"] || "").substring(0, 150);
    if (!raw) return "";
    // Strong normalization: remove all non-alphanumeric, lowercase, and trim
    return raw.toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Remove accents
      .replace(/[^a-z0-9]/gi, "")
      .substring(0, 150);
  };

  const filterUnique = arr => {
    if (!uniqueOnly) return arr;
    
    const seen = new Set();
    const result = [];
    
    for (const r of arr) {
      const key = normalizeKey(r);
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
    grupos: filterGroupsCampus(STATE.raw.grupos)
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
  renderKPIsOrientacoes();
  renderChartsOrientacoes();
}

function renderKPIsCientifica() {
  const data = STATE.filtered.bibliografica;
  const total = data.length;
  const artigos = data.filter(r => (r["Tipo"]||"").includes("Artigos Completos Publicados em Periódicos")).length;
  const livros = data.filter(r => {
    const t = (r["Tipo"]||"");
    return t.includes("Livros") || t.includes("Capítulos");
  }).length;
  const a1a2 = data.filter(r => ["A1","A2"].includes((r["Estrato"]||"").trim())).length;
  const servidores = extractServidorIds(data).size;

  $('kpi-cientifica').innerHTML = `
    <div class="kpi-card"><div class="kpi-label">Produções</div><div class="kpi-value">${total}</div></div>
    <div class="kpi-card"><div class="kpi-label">Artigos</div><div class="kpi-value">${artigos}</div></div>
    <div class="kpi-card"><div class="kpi-label">Livros/Capítulos</div><div class="kpi-value">${livros}</div></div>
    <div class="kpi-card"><div class="kpi-label">Qualis A1/A2</div><div class="kpi-value">${a1a2}</div></div>
    <div class="kpi-card"><div class="kpi-label">Servidores Ativos</div><div class="kpi-value">${servidores}</div></div>
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
  const allTypesSet = new Set();
  Object.values(yearsMap).forEach(v => Object.keys(v).forEach(t => allTypesSet.add(t)));
  const allTypes = Array.from(allTypesSet);
  
  const colors = ["#4D90FE", "#F44336", "#4CAF50", "#FFC107", "#9C27B0", "#00BCD4", "#E91E63", "#FF9800", "#795548", "#607D8B"];
  
  const datasetsEvo = allTypes.map((t, i) => ({
    label: t.length > 40 ? t.substring(0,40)+"..." : t,
    data: sortedYears.map(y => yearsMap[y][t] || 0),
    backgroundColor: colors[i % colors.length]
  }));

  createChart(idChart, "bar", {
    labels: sortedYears,
    datasets: datasetsEvo
  }, {
    scales: { 
      x: { stacked: true, ticks: {color:'#555'} }, 
      y: { stacked: true, ticks: {color:'#555'} } 
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
  createChart(idChart, "pie", {
    labels: Object.keys(typeMap).map(l => l.length>40 ? l.substring(0,40)+"..." : l),
    datasets: [{
      data: Object.values(typeMap),
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

  // Map
  renderGenericMap(data, 'map-cientifica', "#4CAF50", "Produções Científicas");
}

function renderChartsTecnica() {
  const data = STATE.filtered.tecnica;
  
  // Evolução Temporal (Todas as Categorias)
  processEvolucao(data, "chart-tecnica-evolucao");
  
  // Pie: Tipos
  processTipos(data, "chart-tecnica-pie");

  // Map
  renderGenericMap(data, 'map-tecnica', "#1b5e20", "Produções Técnicas");
}

function renderKPIsTecnica() {
  const data = STATE.filtered.tecnica;
  const total = data.length;
  const apresentacoes = data.filter(r => (r["Tipo"]||"").includes("Apresentação de Trabalho")).length;
  const cursos = data.filter(r => {
    const t = (r["Tipo"]||"");
    return t.includes("Curso") || t.includes("Organização de Evento");
  }).length;
  
  const typesSet = new Set();
  data.forEach(r => { if(r["Tipo"]) typesSet.add(r["Tipo"]); });

  $('kpi-tecnica').innerHTML = `
    <div class="kpi-card"><div class="kpi-label">Total Produções</div><div class="kpi-value">${total}</div></div>
    <div class="kpi-card"><div class="kpi-label">Apresentações</div><div class="kpi-value">${apresentacoes}</div></div>
    <div class="kpi-card"><div class="kpi-label">Cursos/Eventos</div><div class="kpi-value">${cursos}</div></div>
    <div class="kpi-card"><div class="kpi-label">Diversidade (Tipos)</div><div class="kpi-value">${typesSet.size}</div></div>
  `;
}

// Shared precise coordinates for all IFBA cities
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
  "UBATÃ": [-14.2255, -39.3245],
  "UBATA": [-14.2255, -39.3245],
  "JAGUAQUARA": [-13.5283, -39.9713],
  "PORTO SEGURO": [-16.4442, -39.0644],
  "CAMPO FORMOSO": [-10.5100, -40.3200]
};

const CAMPUS_TO_CITY = {
  "BAR": "BARREIRAS", "BRU": "BRUMADO", "CAM": "CAMAÇARI", "CFO": "CAMPO FORMOSO", 
  "EC": "EUCLIDES DA CUNHA", "EUN": "EUNÁPOLIS", "FS": "FEIRA DE SANTANA", 
  "ILH": "ILHÉUS", "IRE": "IRECÊ", "JAC": "JACOBINA", "JAG": "JAGUAQUARA", 
  "JEQ": "JEQUIÉ", "SAM": "SANTO AMARO", "SEA": "SEABRA", "SF": "SIMÕES FILHO", 
  "UBA": "UBATÃ", "VAL": "VALENÇA", "VC": "VITÓRIA DA CONQUISTA", 
  "SAJ": "SANTO ANTÔNIO DE JESUS", "JUA": "JUAZEIRO", "PA": "PAULO AFONSO",
  "PS": "PORTO SEGURO", "SSA": "SALVADOR"
};

function lookupCoords(city) {
  if(!city) return null;
  const norm = city.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  return IFBA_COORDS[city] || IFBA_COORDS[norm] || null;
}

function renderGenericMap(data, mapId, color, label) {
  if (STATE.leafMaps[mapId]) {
    STATE.leafMaps[mapId].remove();
  }
  
  const mapElement = $(mapId);
  if (!mapElement) return;

  const m = L.map(mapId).setView([-12.50, -41.50], 6);
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
    } else if (r["Servidor"]) {
      const campusMatch = r["Servidor"].match(/\(([A-Z]{2,4})\)/);
      if (campusMatch) {
         const abbr = campusMatch[1];
         city = CAMPUS_TO_CITY[abbr] || abbr;
      }
    }
    if (city) cityCount[city] = (cityCount[city] || 0) + 1;
  });

  Object.entries(cityCount).forEach(([city, count]) => {
    const latlng = lookupCoords(city);
    if (!latlng) return; // Hide unknown cities

    L.circleMarker(latlng, {
      radius: Math.min(Math.max(count * 0.5, 6), 35),
      fillColor: color,
      color: "#fff",
      weight: 1,
      fillOpacity: 0.7
    }).addTo(m).bindPopup(`<b>${city}</b><br>${count} ${label}`);
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

  // Map
  renderGenericMap(data, 'map-inovacao', "#9C27B0", "Registros de PI");
}

function renderChartsGrupos() {
  const data = STATE.filtered.grupos;
  
  // Evo 1: Grupos Criados por Ano
  const yearsMap = {};
  data.forEach(r => {
    const y = parseInt(r["Ano Formação"], 10);
    if(y) yearsMap[y] = (yearsMap[y]||0) + 1;
  });
  const sortedYears = Object.keys(yearsMap).sort();
  createChart("chart-grupos-evo-1", "bar", {
    labels: sortedYears,
    datasets: [{ label: "Novos Grupos", data: sortedYears.map(y => yearsMap[y]), backgroundColor: "#4CAF50" }]
  });
  
  // Evo 2: Grupos Ativos (Acumulado)
  const yearsEvoFormed = {};
  const yearsEvoDeleted = {};
  let earliestYear = 2100;
  let latestYear = new Date().getFullYear();
  data.forEach(r => {
    const formedYear = parseInt(r["Ano Formação"], 10);
    if (formedYear && formedYear < earliestYear) earliestYear = formedYear;
    if (formedYear) yearsEvoFormed[formedYear] = (yearsEvoFormed[formedYear] || 0) + 1;
    const status = (r["Situação"]||"").toLowerCase();
    if (status.includes("excluí") || status.includes("exclui")) {
        const lastEnvio = r["Último Envio"] || "";
        const matchYear = lastEnvio.match(/(\d{4})/);
        if(matchYear) yearsEvoDeleted[matchYear[1]] = (yearsEvoDeleted[matchYear[1]] || 0) + 1;
    }
  });
  const sortedYearsGrupos = [];
  const cumulativeData = [];
  let currentTotal = 0;
  if (earliestYear !== 2100) {
    for (let y = earliestYear; y <= latestYear; y++) {
      sortedYearsGrupos.push(y.toString());
      currentTotal += (yearsEvoFormed[y] || 0) - (yearsEvoDeleted[y] || 0);
      cumulativeData.push(currentTotal);
    }
  }
  createChart("chart-grupos-evo-2", "line", {
    labels: sortedYearsGrupos,
    datasets: [{ label: "Total Ativos", data: cumulativeData, borderColor: "#2196F3", tension: 0.3, fill: false }]
  });
  
  // Pie: Áreas
  const areaMap = {};
  data.forEach(r => {
    let a = (r["Área"] || "Não informada").split(";")[0];
    areaMap[a] = (areaMap[a]||0)+1;
  });
  createChart("chart-grupos-pie", "doughnut", {
    labels: Object.keys(areaMap).map(l => l.length>30 ? l.substring(0,30)+"..." : l),
    datasets: [{ data: Object.values(areaMap), backgroundColor: ["#9C27B0","#E91E63","#FF9800","#00BCD4","#4CAF50"] }]
  });

  // Map
  renderGenericMap(data, 'map-grupos', "#00BCD4", "Grupos de Pesquisa");
}

function renderKPIsGrupos() {
  const data = STATE.filtered.grupos;
  const total = data.length;
  const certificados = data.filter(r => (r["Situação"]||"").includes("Certificado")).length;
  let totalPesq = 0, totalEst = 0;
  data.forEach(r => {
    totalPesq += parseInt(r["Pesquisadores"]||0);
    totalEst += parseInt(r["Estudantes"]||0);
  });
  const avgPesq = total ? (totalPesq/total).toFixed(1) : 0;
  const avgEst = total ? (totalEst/total).toFixed(1) : 0;

  $('kpi-grupos').innerHTML = `
    <div class="kpi-card"><div class="kpi-label">Total de Grupos</div><div class="kpi-value">${total}</div></div>
    <div class="kpi-card"><div class="kpi-label">Certificados</div><div class="kpi-value">${certificados}</div></div>
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

  // Map
  renderGenericMap(STATE.filtered.grupos, 'map-orientacoes', "#E91E63", "Pesquisadores (aprox.)");
}

function renderKPIsOrientacoes() {
  const concluidas = STATE.filtered.concluidas;
  const andamento = STATE.filtered.andamento;
  const combined = [...concluidas, ...andamento];
  const totalConcluidas = concluidas.length;
  const totalAndamento = andamento.length;
  const total = combined.length;

  const allIdsArray = [];
  [STATE.filtered.bibliografica, STATE.filtered.tecnica, concluidas, andamento].forEach(arr => {
    arr.forEach(r => {
      const srv = r["Servidor"];
      if (srv) {
        const m = srv.match(/(\d{7,})/);
        if(m) allIdsArray.push(m[1]);
      }
    });
  });
  const totalPesquisadores = new Set(allIdsArray).size;

  $('kpi-orientacoes').innerHTML = `
    <div class="kpi-card"><div class="kpi-label">Pesquisadores (Ativos)</div><div class="kpi-value">${totalPesquisadores}</div></div>
    <div class="kpi-card"><div class="kpi-label">Total de Orientações</div><div class="kpi-value">${total}</div></div>
    <div class="kpi-card"><div class="kpi-label">Concluídas</div><div class="kpi-value">${totalConcluidas}</div></div>
    <div class="kpi-card"><div class="kpi-label">Em Andamento</div><div class="kpi-value">${totalAndamento}</div></div>
  `;
}

async function initDashboard() {
  try {
    $('loading-text').innerText = "Baixando dados DGP...";
    STATE.raw.grupos = await loadCSV(CSV_FILE);

    $('loading-text').innerText = "Lendo tabelas de todos os campi (isso pode levar alguns instantes)...";
    
    // Load campuses concurrently
    const promises = EXCEL_FILES.map(f => loadExcelSheets(f));
    const results = await Promise.all(promises);
    
    results.forEach(res => {
      if(!res) return;
      STATE.raw.bibliografica.push(...res.bibliografica);
      STATE.raw.tecnica.push(...res.tecnica);
      if(res.inovacao) STATE.raw.inovacao.push(...res.inovacao);
      STATE.raw.concluidas.push(...res.concluidas);
      STATE.raw.andamento.push(...res.andamento);
    });

    $('period-filter').addEventListener('change', processData);
    $('campus-filter').addEventListener('change', processData);
    $('unique-toggle').addEventListener('change', processData);

    $('loading').style.display = 'none';
    processData();
  } catch(e) {
    $('loading-text').innerText = "Erro ao carregar os arquivos.";
    console.error(e);
  }
}

window.addEventListener("DOMContentLoaded", initDashboard);
