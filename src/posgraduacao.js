function getPosGraduacaoCategoryColor(category) {
  const colors = {
    "Mestrado": "#4D90FE",
    "Doutorado": "#F44336",
    "Especialização": "#4CAF50",
    "Especializao": "#4CAF50", // alias p/ dados antigos (pré-normalização)
    "Outro": "#FFC107"
  };
  return colors[category] || "#607D8B";
}

function truncateText(text, maxLength = 40) {
  if (!text) return "Não informado";
  return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
}

function normalizePosGraduacaoStatus(status) {
  return (status || "").trim() || "Não informado";
}

// Duração padrão do curso, em MESES, para o prazo de integralização do ciclo
// (Plataforma Nilo Peçanha — PNP). Mestrado/Doutorado: prazos máximos de bolsa da
// CAPES (Portaria CAPES nº 76/2010, art. 10 — 24/48 meses). Especialização
// (lato sensu): Resolução CNE/CES nº 1/2018 (carga mínima de 360 h, art. 7º, I),
// operacionalizada em 18 meses.
//
// PNP "retenção crítica" (GRM PNP 2020): o ciclo de matrícula só é analisado
// 1 ano após o término previsto (prazo de integralização + 12 meses de graça).
const PNP_RETENCAO_CRITICA_MESES = 12;
function getPosGraduacaoDurationMonths(category) {
  const durations = {
    "Mestrado": 24,
    "Doutorado": 48,
    "Especialização": 18,
    "Especializao": 18 // alias p/ dados antigos (pré-normalização do build)
  };
  return durations[category] || 24;
}

// Referência "hoje" para maturidade: período (ano+semestre) mais recente
// presente nos dados. Cacheado. Em testes (sem STATE.raw.posgraduacao) cai
// para o 2º semestre de STATE.maxYear.
let _posgradRefMonths = null;
function getPosGraduacaoRefMonths() {
  if (_posgradRefMonths !== null) return _posgradRefMonths;
  const raw = (STATE.raw && STATE.raw.posgraduacao) || [];
  let ref = null;
  raw.forEach(r => {
    const y = parseInt(r.ano, 10);
    if (Number.isNaN(y)) return;
    const s = parseInt(r.semestre, 10);
    const m = y * 12 + (Number.isNaN(s) ? 0 : (s - 1) * 6);
    if (ref === null || m > ref) ref = m;
  });
  if (ref === null) ref = STATE.maxYear * 12 + 6; // fallback: 2º semestre
  _posgradRefMonths = ref;
  return ref;
}

function isPosGraduacaoMature(record) {
  const year = parseInt(record.ano, 10);
  if (Number.isNaN(year)) return false;
  const semestre = parseInt(record.semestre, 10);
  const entryMonths = year * 12 + (Number.isNaN(semestre) ? 0 : (semestre - 1) * 6);
  return (getPosGraduacaoRefMonths() - entryMonths) >=
    (getPosGraduacaoDurationMonths(record.categoria) + PNP_RETENCAO_CRITICA_MESES);
}

function isPosGraduacaoAttritionStatus(status) {
  return ['Cancelado', 'Desligado', 'Evasão', 'Abandono', 'Falecido'].includes(status);
}

function normalizePosGraduacaoOutcome(status) {
  if (status === 'Concluído') return 'Concluinte';
  if (status === 'Matriculado') return 'Em curso';
  if (isPosGraduacaoAttritionStatus(status)) return 'Evadido';
  return 'Outros';
}

function getPosGraduacaoSituationBucket(record) {
  const status = normalizePosGraduacaoStatus(record.situacao);
  if (status === 'Concluído') return 'Concluinte';
  if (isPosGraduacaoAttritionStatus(status)) return 'Evadido';
  if (status === 'Matriculado') {
    return isPosGraduacaoMature(record) ? 'Retido' : 'Em curso';
  }
  return 'Outros';
}

function renderPosGraduacaoTraceability(data) {
  const area = $('posgrad-traceability');
  if (!area) return;

  const matured = data.filter(isPosGraduacaoMature).length;
  const selectedCategoria = $('posgrad-categoria-filter') ? $('posgrad-categoria-filter').value : 'all';
  const selectedStatus = $('posgrad-status-filter') ? $('posgrad-status-filter').value : 'all';
  const selectedCampus = $('posgrad-campus-filter') ? $('posgrad-campus-filter').value : 'all';
  const selectedCurso = $('posgrad-curso-filter') ? $('posgrad-curso-filter').value : 'all';
  const maturedOnly = $('posgrad-matured-only-toggle') ? $('posgrad-matured-only-toggle').checked : true;

  area.innerHTML = `
    <details open>
      <summary><strong>Como os indicadores são calculados</strong></summary>
      <p><strong>Base atual:</strong> ${data.length} registros no recorte; ${matured} em ciclos de matrícula encerrados.</p>
      <p><strong>Filtros ativos:</strong> Categoria=${selectedCategoria}; Status=${selectedStatus}; Campus=${selectedCampus}; Programa=${selectedCurso}; Somente ciclos encerrados=${maturedOnly ? 'sim' : 'não'}.</p>
      <ul>
        <li><strong>Conclusão Ciclo (CCiclo):</strong> Concluintes / matrículas do ciclo.</li>
        <li><strong>Evasão Ciclo (EvCiclo):</strong> Evadidos / matrículas do ciclo.</li>
        <li><strong>Retenção Ciclo (RCiclo):</strong> Retidos / matrículas do ciclo.</li>
        <li><strong>Índice de Eficiência Acadêmica (IEA):</strong> CCiclo + (CCiclo ÷ (CCiclo + EvCiclo)) × RCiclo.</li>
      </ul>
    </details>
  `;
}

function formatPercent(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "0%";
  return `${value.toFixed(1)}%`;
}

function calculateCompletionRate(total, active, completed) {
  const denominator = total - active;
  if (denominator <= 0) return 0;
  return (completed / denominator) * 100;
}

function buildPosGraduacaoKpi(label, value, helpText = "", tooltipText = "") {
  const tooltipAttr = tooltipText ? ` title="${tooltipText.replace(/"/g, '&quot;')}"` : '';
  return `
    <div class="kpi-card">
      <div class="kpi-label"${tooltipAttr}>${label}</div>
      <div class="kpi-value">${value}</div>
      ${helpText ? `<div class="kpi-help">${helpText}</div>` : ""}
    </div>
  `;
}

function getSortedNumericYears(data) {
  return Array.from(
    new Set(
      data
        .map(r => parseInt(r.ano, 10))
        .filter(y => !Number.isNaN(y))
    )
  ).sort((a, b) => a - b);
}

function countBy(data, getter) {
  const counts = {};
  data.forEach(record => {
    const key = getter(record);
    counts[key] = (counts[key] || 0) + 1;
  });
  return counts;
}

function populateCourseSelector(data = STATE.raw.posgraduacao) {
  const selector = $('posgrad-curso-filter');
  if (!selector || selector.options.length > 1) return; // Already populated

  const previousValue = selector.value || 'all';
  const courses = Array.from(
    new Set(
      data
        .map(r => (r.curso || "").trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b, 'pt-BR'));

  selector.innerHTML = '<option value="all">Todos os Programas</option>';
  courses.forEach(course => {
    const option = document.createElement('option');
    option.value = course;
    option.textContent = truncateText(course, 50);
    option.title = course;
    selector.appendChild(option);
  });

  selector.value = courses.includes(previousValue) ? previousValue : 'all';

}

function populateCampusSelector(data = STATE.raw.posgraduacao) {
  const selector = $('posgrad-campus-filter');
  if (!selector || selector.options.length > 1) return; // Already populated

  const previousValue = selector.value || 'all';
  const campuses = Array.from(
    new Set(
      data
        .map(r => (r.campus || "").trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b, 'pt-BR'));

  selector.innerHTML = '<option value="all">Todos os Campi</option>';
  campuses.forEach(campus => {
    const option = document.createElement('option');
    option.value = campus;
    option.textContent = `${CAMPUS_TO_CITY[campus] || campus} (${campus})`;
    option.title = option.textContent;
    selector.appendChild(option);
  });

  selector.value = campuses.includes(previousValue) ? previousValue : 'all';

}

function calculateCompletionRates(data) {
  const years = getSortedNumericYears(data);
  const completion = {};
  const attrition = {};
  const overdue = {};

  years.forEach(year => {
    const cohort = data.filter(r => parseInt(r.ano, 10) === year);
    const matured = cohort.filter(isPosGraduacaoMature);
    const base = matured.length;
    if (base === 0) {
      completion[year] = 0;
      attrition[year] = 0;
      overdue[year] = 0;
      return;
    }
    const done = matured.filter(r => normalizePosGraduacaoStatus(r.situacao) === 'Concluído').length;
    const lost = matured.filter(r => isPosGraduacaoAttritionStatus(normalizePosGraduacaoStatus(r.situacao))).length;
    const active = matured.filter(r => normalizePosGraduacaoStatus(r.situacao) === 'Matriculado').length;
    completion[year] = (done / base) * 100;
    attrition[year] = (lost / base) * 100;
    overdue[year] = (active / base) * 100;
  });

  return { completion, attrition, overdue };
}

// Índice de Eficiência Acadêmica (IEA) — GRM PNP 2020:
// IEA = Conclusão Ciclo + (Conclusão Ciclo / (Conclusão Ciclo + Evasão Ciclo)) × Retenção Ciclo.
// A parcela adicional projeta quantos retidos provavelmente concluirão, usando a
// razão de concluintes sobre os não retidos (concluintes + evadidos).
function calculateIEAciclo(cciclo, evciclo, rciclo) {
  const c = Number.isFinite(cciclo) ? cciclo : 0;
  const e = Number.isFinite(evciclo) ? evciclo : 0;
  const r = Number.isFinite(rciclo) ? rciclo : 0;
  const resolved = c + e;
  if (resolved <= 0) return c;
  return c + (c / resolved) * r;
}

function ensureCanvasElements(ids) {
  const missing = ids.filter(id => !$(id));
  if (missing.length > 0) {
    console.warn('Missing post-graduation canvas elements:', missing.join(', '));
    // Show inline error in the active subtab content so users get visible feedback
    const activeContent = document.querySelector('.subtab-content.active');
    if (activeContent && !activeContent.querySelector('.canvas-error')) {
      const msg = document.createElement('p');
      msg.className = 'canvas-error';
      msg.style.cssText = 'color:#c62828;background:#ffebee;padding:0.75rem 1rem;border-radius:6px;margin:1rem 0;font-weight:600;';
      msg.textContent = `Gráfico não disponível — elemento HTML não encontrado: ${missing.join(', ')}`;
      activeContent.prepend(msg);
    }
    return false;
  }
  // Remove any previously shown error if all canvases are present
  document.querySelectorAll('.canvas-error').forEach(el => el.remove());
  return true;
}

function renderKPIsPosGraduacaoOverview(data) {
  const total = data.length;
  const active = data.filter(r => normalizePosGraduacaoStatus(r.situacao) === 'Matriculado').length;
  const matured = data.filter(isPosGraduacaoMature);
  const maturedDone = matured.filter(r => normalizePosGraduacaoStatus(r.situacao) === 'Concluído').length;
  const maturedLost = matured.filter(r => isPosGraduacaoAttritionStatus(normalizePosGraduacaoStatus(r.situacao))).length;
  const pendingActive = matured.filter(r => normalizePosGraduacaoStatus(r.situacao) === 'Matriculado').length;
  const regularFlow = data.filter(r => normalizePosGraduacaoStatus(r.situacao) === 'Matriculado' && !isPosGraduacaoMature(r)).length;
  const programs = new Set(data.map(r => (r.curso || '').trim()).filter(Boolean)).size;
  const completionRate = matured.length > 0 ? (maturedDone / matured.length) * 100 : 0;
  const attritionRate = matured.length > 0 ? (maturedLost / matured.length) * 100 : 0;
  const pendingActiveRate = matured.length > 0 ? (pendingActive / matured.length) * 100 : 0;

  const iea = calculateIEAciclo(completionRate, attritionRate, pendingActiveRate);
  $('kpi-posgraduacao-overview').innerHTML = `
    ${buildPosGraduacaoKpi('Matriculados (M)', active, '', 'Alunos com status Matriculado no recorte atual.')}
    ${buildPosGraduacaoKpi('Em curso', regularFlow, '', 'Alunos matriculados dentro do prazo de integralização do ciclo (ainda não retidos).')}
    ${buildPosGraduacaoKpi('Retidos', pendingActive, '', 'Alunos matriculados além do prazo de integralização + 1 ano (retenção crítica, PNP).')}
    ${buildPosGraduacaoKpi('Ciclos encerrados', matured.length, 'Base dos indicadores por ciclo (PNP)', 'Ciclos de matrícula com término previsto há 1 ano ou mais: Mestrado>=24+12, Doutorado>=48+12, Especialização>=18+12 meses.')}
    ${buildPosGraduacaoKpi('Conclusão Ciclo (CCiclo)', formatPercent(completionRate), '', 'Concluintes / matrículas do ciclo (PNP).')}
    ${buildPosGraduacaoKpi('Evasão Ciclo (EvCiclo)', formatPercent(attritionRate), '', 'Evadidos / matrículas do ciclo (PNP).')}
    ${buildPosGraduacaoKpi('Retenção Ciclo (RCiclo)', formatPercent(pendingActiveRate), '', 'Retidos / matrículas do ciclo (PNP).')}
    ${buildPosGraduacaoKpi('Índice de Eficiência Acadêmica (IEA)', formatPercent(iea), '', 'CCiclo + projeção dos retidos que concluirão (PNP).')}
    ${buildPosGraduacaoKpi('Programas no Recorte', programs, '', 'Quantidade de programas após aplicação dos filtros.')}
  `;
}

function renderKPIsPosGraduacaoByCourse(data, selectedCourse) {
  const total = data.length;
  const matured = data.filter(isPosGraduacaoMature);
  const active = matured.filter(r => normalizePosGraduacaoStatus(r.situacao) === 'Matriculado').length;
  const completed = matured.filter(r => normalizePosGraduacaoStatus(r.situacao) === 'Concluído').length;
  const lost = matured.filter(r => isPosGraduacaoAttritionStatus(normalizePosGraduacaoStatus(r.situacao))).length;
  const completionRate = matured.length > 0 ? (completed / matured.length) * 100 : 0;
  const attritionRate = matured.length > 0 ? (lost / matured.length) * 100 : 0;
  const courseLabel = selectedCourse === 'all' ? 'Todos os Programas' : truncateText(selectedCourse, 30);

  $('kpi-posgraduacao-curso').innerHTML = `
    ${buildPosGraduacaoKpi(`Alunos no Recorte`, total, '', 'Total de alunos do programa selecionado após filtros.')}
    ${buildPosGraduacaoKpi(`Ciclos encerrados`, matured.length, '', 'Ciclos de matrícula do programa com término previsto há 1 ano ou mais.')}
    ${buildPosGraduacaoKpi(`Conclusão Ciclo (CCiclo)`, formatPercent(completionRate), '', 'Concluintes / matrículas dos ciclos encerrados do programa.')}
    ${buildPosGraduacaoKpi(`Evasão Ciclo (EvCiclo)`, formatPercent(attritionRate), '', 'Evadidos / matrículas dos ciclos encerrados do programa.')}
    ${buildPosGraduacaoKpi(`Retidos`, active, '', 'Alunos ainda matriculados em ciclos encerrados (retenção crítica) do programa.')}
  `;
}

function renderKPIsPosGraduacaoByCampus(data, selectedCampus) {
  const total = data.length;
  const active = data.filter(r => normalizePosGraduacaoStatus(r.situacao) === 'Matriculado').length;
  const matured = data.filter(isPosGraduacaoMature);
  const completed = matured.filter(r => normalizePosGraduacaoStatus(r.situacao) === 'Concluído').length;
  const lost = matured.filter(r => isPosGraduacaoAttritionStatus(normalizePosGraduacaoStatus(r.situacao))).length;
  const backlog = matured.filter(r => normalizePosGraduacaoStatus(r.situacao) === 'Matriculado').length;
  const uniqueCourses = new Set(data.map(r => (r.curso || "").trim()).filter(Boolean)).size;
  const completionRate = matured.length > 0 ? (completed / matured.length) * 100 : 0;
  const attritionRate = matured.length > 0 ? (lost / matured.length) * 100 : 0;
  const campusLabel = selectedCampus === 'all' ? 'Todos os Campi' : (CAMPUS_TO_CITY[selectedCampus] || selectedCampus);

  $('kpi-posgraduacao-campus').innerHTML = `
    ${buildPosGraduacaoKpi(`Total em ${campusLabel}`, total, '', 'Total de alunos do campus no recorte atual.')}
    ${buildPosGraduacaoKpi(`Programas`, uniqueCourses, '', 'Quantidade de programas no campus após filtros.')}
    ${buildPosGraduacaoKpi(`Conclusão Ciclo (CCiclo)`, formatPercent(completionRate), '', 'Concluintes / matrículas dos ciclos encerrados do campus.')}
    ${buildPosGraduacaoKpi(`Evasão Ciclo (EvCiclo)`, formatPercent(attritionRate), '', 'Evadidos / matrículas dos ciclos encerrados do campus.')}
    ${buildPosGraduacaoKpi(`Retidos`, backlog, '', 'Alunos ainda matriculados em ciclos encerrados no campus (retenção crítica).')}
    ${buildPosGraduacaoKpi(`Matriculados Hoje`, active, '', 'Alunos Matriculados no campus no recorte atual.')}
  `;
}

function renderPosGraduacaoEvolution(data) {
  const years = getSortedNumericYears(data);
  const categories = ['Mestrado', 'Doutorado', 'Especialização', 'Outro'];
  const countsByYear = {};

  data.forEach(record => {
    const year = parseInt(record.ano, 10);
    if (Number.isNaN(year)) return;
    const category = categories.includes(record.categoria) ? record.categoria : 'Outro';
    if (!countsByYear[year]) countsByYear[year] = {};
    countsByYear[year][category] = (countsByYear[year][category] || 0) + 1;
  });

  createChart('chart-posgraduacao-evolucao', 'bar', {
    labels: years,
    datasets: categories
      .filter(category => data.some(record => (record.categoria || 'Outro') === category))
      .map(category => ({
        label: category,
        data: years.map(year => countsByYear[year]?.[category] || 0),
        backgroundColor: getPosGraduacaoCategoryColor(category)
      }))
  }, {
    scales: {
      x: { stacked: true, ticks: { color: '#555' } },
      y: { stacked: true, ticks: { color: '#555' }, beginAtZero: true }
    }
  });
}

function renderPosGraduacaoDistributions(data) {
  const statusCounts = countBy(data, getPosGraduacaoSituationBucket);
  const statusLabels = ['Concluinte', 'Em curso', 'Retido', 'Evadido', 'Outros']
    .filter(label => (statusCounts[label] || 0) > 0);
  const categoryRows = ['Mestrado', 'Doutorado', 'Especialização'].map(category => {
    const rows = data.filter(r => (r.categoria || 'Outro') === category && isPosGraduacaoMature(r));
    const base = rows.length;
    const active = rows.filter(r => normalizePosGraduacaoStatus(r.situacao) === 'Matriculado').length;
    const lost = rows.filter(r => isPosGraduacaoAttritionStatus(normalizePosGraduacaoStatus(r.situacao))).length;
    const done = rows.filter(r => normalizePosGraduacaoStatus(r.situacao) === 'Concluído').length;
    return {
      category,
      completionRate: base > 0 ? (done / base) * 100 : 0,
      attritionRate: base > 0 ? (lost / base) * 100 : 0,
      pendingActiveRate: base > 0 ? (active / base) * 100 : 0
    };
  });

  createChart('chart-posgraduacao-status', 'doughnut', {
    labels: statusLabels.map(label => truncateText(label, 35)),
    datasets: [{
      data: statusLabels.map(label => statusCounts[label]),
      backgroundColor: statusLabels.map(label => ({
        'Concluinte': '#4D90FE',
        'Em curso': '#4CAF50',
        'Retido': '#FF9800',
        'Evadido': '#F44336',
        'Outros': '#607D8B'
      }[label] || '#607D8B'))
    }]
  });

  createChart('chart-posgraduacao-categoria', 'bar', {
    labels: ['Conclusão Ciclo', 'Evasão Ciclo', 'Retenção Ciclo'],
    datasets: categoryRows.map(row => ({
      label: row.category,
      data: [row.completionRate, row.attritionRate, row.pendingActiveRate],
      backgroundColor: getPosGraduacaoCategoryColor(row.category)
    }))
  }, {
    scales: {
      x: { ticks: { color: '#555' } },
      y: { ticks: { color: '#555', callback: v => `${v}%` }, beginAtZero: true }
    }
  });
}

function renderPosGraduacaoTopCoursesAndMap(data) {
  const programRiskRows = Object.entries(countBy(data, r => (r.curso || '').trim() || 'Não informado'))
    .map(([course]) => {
      const rows = data.filter(r => ((r.curso || '').trim() || 'Não informado') === course);
      const maturedRows = rows.filter(isPosGraduacaoMature);
      const base = maturedRows.length;
      const pending = maturedRows.filter(r => normalizePosGraduacaoStatus(r.situacao) === 'Matriculado').length;
      const regular = rows.filter(r => normalizePosGraduacaoStatus(r.situacao) === 'Matriculado' && !isPosGraduacaoMature(r)).length;
      const lost = maturedRows.filter(r => isPosGraduacaoAttritionStatus(normalizePosGraduacaoStatus(r.situacao))).length;
      return { course, base, pending, regular, lost, risk: base > 0 ? ((pending + lost) / base) * 100 : 0 };
    })
    .sort((a, b) => (b.pending + b.regular) - (a.pending + a.regular) || b.risk - a.risk)
    .slice(0, 10);

  createChart('chart-posgraduacao-topcursos', 'bar', {
    labels: programRiskRows.map(row => truncateText(row.course, 40)),
    datasets: [{
      label: 'Em curso',
      data: programRiskRows.map(row => row.regular),
      backgroundColor: '#4CAF50'
    }, {
      label: 'Retido',
      data: programRiskRows.map(row => row.pending),
      backgroundColor: '#FF9800'
    }, {
      label: 'Evadido',
      data: programRiskRows.map(row => row.lost),
      backgroundColor: '#F44336'
    }]
  }, {
    indexAxis: 'y',
    scales: {
      x: { ticks: { color: '#555' }, beginAtZero: true },
      y: { ticks: { color: '#555' } }
    }
  });

  const campusRows = Object.entries(countBy(data, r => (r.campus || '').trim() || 'SEM'))
    .map(([campus]) => {
      const rows = data.filter(r => ((r.campus || '').trim() || 'SEM') === campus);
      const maturedRows = rows.filter(isPosGraduacaoMature);
      const base = maturedRows.length;
      const pending = maturedRows.filter(r => normalizePosGraduacaoStatus(r.situacao) === 'Matriculado').length;
      const regular = rows.filter(r => normalizePosGraduacaoStatus(r.situacao) === 'Matriculado' && !isPosGraduacaoMature(r)).length;
      const lost = maturedRows.filter(r => isPosGraduacaoAttritionStatus(normalizePosGraduacaoStatus(r.situacao))).length;
      return {
        campus,
        regularRate: rows.length > 0 ? (regular / rows.length) * 100 : 0,
        pendingRate: base > 0 ? (pending / base) * 100 : 0,
        attritionRate: base > 0 ? (lost / base) * 100 : 0
      };
    })
    .sort((a, b) => (b.pendingRate + b.attritionRate) - (a.pendingRate + a.attritionRate))
    .slice(0, 8);

  createChart('chart-posgraduacao-campusrisk', 'bar', {
    labels: campusRows.map(r => `${CAMPUS_TO_CITY[r.campus] || r.campus} (${r.campus})`),
    datasets: [{
      label: 'Em curso (%)',
      data: campusRows.map(r => r.regularRate),
      backgroundColor: '#4CAF50'
    }, {
      label: 'Retenção (%)',
      data: campusRows.map(r => r.pendingRate),
      backgroundColor: '#FF9800'
    }, {
      label: 'Evasão (%)',
      data: campusRows.map(r => r.attritionRate),
      backgroundColor: '#F44336'
    }]
  }, {
    scales: {
      x: { ticks: { color: '#555' } },
      y: { ticks: { color: '#555', callback: v => `${v}%` }, beginAtZero: true }
    }
  });
}

function renderPosGraduacaoCompletionRate(data) {
  const years = getSortedNumericYears(data);
  const rates = calculateCompletionRates(data);

  createChart('chart-posgraduacao-completion', 'line', {
    labels: years,
    datasets: [
      {
        label: 'Conclusão Ciclo (CCiclo)',
        data: years.map(year => rates.completion[year] || 0),
        borderColor: '#4D90FE',
        backgroundColor: 'rgba(77, 144, 254, 0.12)',
        tension: 0.25,
        fill: false
      },
      {
        label: 'Evasão Ciclo (EvCiclo)',
        data: years.map(year => rates.attrition[year] || 0),
        borderColor: '#F44336',
        backgroundColor: 'rgba(76, 175, 80, 0.12)',
        tension: 0.25,
        fill: false
      },
      {
        label: 'Retenção Ciclo (RCiclo)',
        data: years.map(year => rates.overdue[year] || 0),
        borderColor: '#FF9800',
        backgroundColor: 'rgba(244, 67, 54, 0.12)',
        tension: 0.25,
        fill: false
      }
    ]
  }, {
    scales: {
      x: { ticks: { color: '#555' } },
      y: {
        ticks: {
          color: '#555',
          callback: value => `${value}%`
        },
        beginAtZero: true
      }
    }
  });
}

function renderPosGraduacaoCourseCharts(data, selectedCourse) {
  const years = getSortedNumericYears(data);
  const statusCounts = countBy(data, getPosGraduacaoSituationBucket);
  const evolutionBuckets = {};
  data.forEach(record => {
    const year = parseInt(record.ano, 10);
    if (Number.isNaN(year)) return;
    const bucket = getPosGraduacaoSituationBucket(record);
    if (!evolutionBuckets[year]) evolutionBuckets[year] = {};
    evolutionBuckets[year][bucket] = (evolutionBuckets[year][bucket] || 0) + 1;
  });

  createChart('chart-posgraduacao-curso-evolucao', 'bar', {
    labels: years,
    datasets: ['Em curso', 'Retido', 'Concluinte', 'Evadido']
      .map(bucket => ({
        label: bucket,
        data: years.map(year => evolutionBuckets[year]?.[bucket] || 0),
        backgroundColor: ({
          'Em curso': '#4CAF50',
          'Retido': '#FF9800',
          'Concluinte': '#4D90FE',
          'Evadido': '#F44336'
        })[bucket]
      }))
  }, {
    scales: {
      x: { stacked: true, ticks: { color: '#555' } },
      y: { stacked: true, ticks: { color: '#555' }, beginAtZero: true }
    }
  });

  const statusLabels = Object.keys(statusCounts);
  createChart('chart-posgraduacao-curso-status', 'doughnut', {
    labels: statusLabels.map(label => truncateText(label, 35)),
    datasets: [{
      data: statusLabels.map(label => statusCounts[label]),
      backgroundColor: getChartColors(statusLabels.length)
    }]
  });

  const rates = calculateCompletionRates(data);
  createChart('chart-posgraduacao-curso-campus', 'line', {
    labels: years,
    datasets: [{
      label: 'Conclusão Ciclo (CCiclo)',
      data: years.map(y => rates.completion[y] || 0),
      borderColor: '#4D90FE',
      tension: 0.25
    }, {
      label: 'Evasão Ciclo (EvCiclo)',
      data: years.map(y => rates.attrition[y] || 0),
      borderColor: '#F44336',
      tension: 0.25
    }, {
      label: 'Retenção Ciclo (RCiclo)',
      data: years.map(y => rates.overdue[y] || 0),
      borderColor: '#FF9800',
      tension: 0.25
    }]
  }, {
    scales: {
      x: { ticks: { color: '#555' } },
      y: { ticks: { color: '#555', callback: v => `${v}%` }, beginAtZero: true }
    }
  });
}

function renderPosGraduacaoCampusCharts(data, selectedCampus) {
  const programRows = Object.entries(countBy(data, r => (r.curso || '').trim() || 'Não informado'))
    .map(([course]) => {
      const rows = data.filter(r => ((r.curso || '').trim() || 'Não informado') === course && isPosGraduacaoMature(r));
      const base = rows.length;
      const done = rows.filter(r => normalizePosGraduacaoStatus(r.situacao) === 'Concluído').length;
      const lost = rows.filter(r => isPosGraduacaoAttritionStatus(normalizePosGraduacaoStatus(r.situacao))).length;
      const backlog = rows.filter(r => normalizePosGraduacaoStatus(r.situacao) === 'Matriculado').length;
      return { course, base, doneRate: base > 0 ? (done / base) * 100 : 0, lostRate: base > 0 ? (lost / base) * 100 : 0, backlog };
    })
    .filter(r => r.base > 0)
    .sort((a, b) => b.backlog - a.backlog || b.lostRate - a.lostRate)
    .slice(0, 12);

  createChart('chart-posgraduacao-campus-evolucao', 'bar', {
    labels: programRows.map(r => truncateText(r.course, 35)),
    datasets: [{
      label: 'Retidos',
      data: programRows.map(r => r.backlog),
      backgroundColor: '#FF9800'
    }, {
      label: 'Evasão (%)',
      data: programRows.map(r => r.lostRate),
      backgroundColor: '#F44336'
    }]
  }, {
    indexAxis: 'y',
    scales: {
      x: { ticks: { color: '#555' }, beginAtZero: true },
      y: { ticks: { color: '#555' } }
    }
  });

  const campusRows = Object.entries(countBy(data, r => (r.campus || '').trim() || 'SEM'))
    .map(([campus]) => {
      const rows = data.filter(r => ((r.campus || '').trim() || 'SEM') === campus && isPosGraduacaoMature(r));
      const base = rows.length;
      const done = rows.filter(r => normalizePosGraduacaoStatus(r.situacao) === 'Concluído').length;
      const lost = rows.filter(r => isPosGraduacaoAttritionStatus(normalizePosGraduacaoStatus(r.situacao))).length;
      const backlog = rows.filter(r => normalizePosGraduacaoStatus(r.situacao) === 'Matriculado').length;
      return { campus, base, doneRate: base > 0 ? (done / base) * 100 : 0, lostRate: base > 0 ? (lost / base) * 100 : 0, backlogRate: base > 0 ? (backlog / base) * 100 : 0 };
    })
    .filter(r => r.base > 0)
    .sort((a, b) => b.base - a.base);

  createChart('chart-posgraduacao-campus-cursos', 'bar', {
    labels: campusRows.map(r => `${CAMPUS_TO_CITY[r.campus] || r.campus} (${r.campus})`),
    datasets: [{
      label: 'Conclusão Ciclo (%)',
      data: campusRows.map(r => r.doneRate),
      backgroundColor: '#4D90FE'
    }, {
      label: 'Evasão Ciclo (%)',
      data: campusRows.map(r => r.lostRate),
      backgroundColor: '#F44336'
    }, {
      label: 'Retenção Ciclo (%)',
      data: campusRows.map(r => r.backlogRate),
      backgroundColor: '#FF9800'
    }]
  }, {
    scales: {
      x: { ticks: { color: '#555' } },
      y: { ticks: { color: '#555', callback: v => `${v}%` }, beginAtZero: true }
    }
  });

  const categoryCounts = countBy(data, r => r.categoria || 'Outro');
  const categoryLabels = Object.keys(categoryCounts);
  createChart('chart-posgraduacao-campus-categorias', 'doughnut', {
    labels: categoryLabels,
    datasets: [{
      data: categoryLabels.map(label => categoryCounts[label]),
      backgroundColor: categoryLabels.map(getPosGraduacaoCategoryColor)
    }]
  });
}

// Post-graduation charts rendering
function renderChartsPosGraduacao() {
  const data = STATE.filtered.posgraduacao;
  renderPosGraduacaoTraceability(data);
  populateCampusSelector(STATE.raw.posgraduacao);
  populateCourseSelector(STATE.raw.posgraduacao);

  // Get active subtab
  const activeSubtab = document.querySelector('.sub-tab-btn.active');
  if (!activeSubtab) {
    // Default to overview if no subtab is active
    document.querySelector('.sub-tab-btn[data-subtarget="subtab-overview"]').classList.add('active');
    document.getElementById('subtab-overview').classList.add('active');
    renderPosGraduacaoOverview(data);
    return;
  }

  const subtab = activeSubtab.dataset.subtarget;

  switch(subtab) {
    case 'subtab-overview': {
      if (!ensureCanvasElements([
        'chart-posgraduacao-evolucao',
        'chart-posgraduacao-status',
        'chart-posgraduacao-categoria',
        'chart-posgraduacao-topcursos',
        'chart-posgraduacao-campusrisk',
        'chart-posgraduacao-completion'
      ])) return;
      renderPosGraduacaoOverview(data);
      break;
    }
    case 'subtab-cursos': {
      if (!ensureCanvasElements([
        'chart-posgraduacao-curso-evolucao',
        'chart-posgraduacao-curso-status',
        'chart-posgraduacao-curso-campus'
      ])) return;
      renderPosGraduacaoByCourse(data);
      break;
    }
    case 'subtab-campus': {
      if (!ensureCanvasElements([
        'chart-posgraduacao-campus-evolucao',
        'chart-posgraduacao-campus-cursos',
        'chart-posgraduacao-campus-categorias'
      ])) return;
      renderPosGraduacaoByCampus(data);
      break;
    }
  }
}

// Overview subtab rendering
function renderPosGraduacaoOverview(data) {
  // 1. Render KPIs
  renderKPIsPosGraduacaoOverview(data);

  // 2. Render evolution chart
  renderPosGraduacaoEvolution(data);

  // 3. Render status and category distribution
  renderPosGraduacaoDistributions(data);

  // 4. Render top courses and map
  renderPosGraduacaoTopCoursesAndMap(data);

  // 5. Render completion rate over time
  renderPosGraduacaoCompletionRate(data);
}

// Course subtab rendering
function renderPosGraduacaoByCourse(data) {
  const selectedCourse = $('posgrad-curso-filter') ? $('posgrad-curso-filter').value : 'all';

  // Filter data by selected course
  const filteredData = selectedCourse === 'all' ? data : data.filter(r => r.curso === selectedCourse);

  // Render KPIs for selected course
  renderKPIsPosGraduacaoByCourse(filteredData, selectedCourse);

  // Render course-specific charts
  renderPosGraduacaoCourseCharts(filteredData, selectedCourse);
}

// Campus subtab rendering
function renderPosGraduacaoByCampus(data) {
  const selectedCampus = $('posgrad-campus-filter') ? $('posgrad-campus-filter').value : 'all';

  // Filter data by selected campus
  const filteredData = selectedCampus === 'all' ? data : data.filter(r => r.campus === selectedCampus);

  // Render KPIs for selected campus
  renderKPIsPosGraduacaoByCampus(filteredData, selectedCampus);

  // Render campus-specific charts
  renderPosGraduacaoCampusCharts(filteredData, selectedCampus);
}
