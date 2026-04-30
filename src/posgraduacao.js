function getPosGraduacaoCategoryColor(category) {
  const colors = {
    "Mestrado": "#4D90FE",
    "Doutorado": "#F44336",
    "Especialização": "#4CAF50",
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

function getPosGraduacaoDurationYears(category) {
  const durations = {
    "Mestrado": 2,
    "Doutorado": 4,
    "Especialização": 2
  };
  return durations[category] || 2;
}

function isPosGraduacaoMature(record) {
  const year = parseInt(record.ano, 10);
  if (Number.isNaN(year)) return false;
  const category = record.categoria || "Outro";
  return (STATE.maxYear - year) >= getPosGraduacaoDurationYears(category);
}

function isPosGraduacaoAttritionStatus(status) {
  return ['Cancelado', 'Desligado', 'Evasão', 'Abandono', 'Falecido'].includes(status);
}

function normalizePosGraduacaoOutcome(status) {
  if (status === 'Concluído') return 'Concluído';
  if (status === 'Matriculado') return 'Ativo';
  if (isPosGraduacaoAttritionStatus(status)) return 'Evasão/Desligamento';
  return 'Outros';
}

function getPosGraduacaoSituationBucket(record) {
  const status = normalizePosGraduacaoStatus(record.situacao);
  if (status === 'Concluído') return 'Concluído';
  if (isPosGraduacaoAttritionStatus(status)) return 'Evasão/Desligamento';
  if (status === 'Matriculado') {
    return isPosGraduacaoMature(record) ? 'Pendência Ativa' : 'Em Fluxo Regular';
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
      <p><strong>Base atual:</strong> ${data.length} registros no recorte; ${matured} em coortes maduras.</p>
      <p><strong>Filtros ativos:</strong> Categoria=${selectedCategoria}; Status=${selectedStatus}; Campus=${selectedCampus}; Programa=${selectedCurso}; Somente coortes maduras=${maturedOnly ? 'sim' : 'não'}.</p>
      <ul>
        <li><strong>Taxa de Conclusão:</strong> Concluídos (coortes maduras) / Total de coortes maduras.</li>
        <li><strong>Taxa de Evasão/Desligamento:</strong> Evasão/Desligamento (coortes maduras) / Total de coortes maduras.</li>
        <li><strong>Pendência Ativa:</strong> Matriculados além do prazo esperado da coorte.</li>
        <li><strong>Em Fluxo Regular:</strong> Matriculados dentro do prazo esperado da coorte.</li>
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
  if (!selector) return;

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
  if (!selector) return;

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

  $('kpi-posgraduacao-overview').innerHTML = `
    ${buildPosGraduacaoKpi('Alunos Ativos Hoje', active, '', 'Alunos com status Matriculado no recorte atual.')}
    ${buildPosGraduacaoKpi('Em Fluxo Regular', regularFlow, '', 'Alunos Matriculados ainda dentro do prazo esperado de conclusão.')}
    ${buildPosGraduacaoKpi('Pendência Ativa', pendingActive, '', 'Alunos Matriculados além do prazo esperado de conclusão.')}
    ${buildPosGraduacaoKpi('Coortes Maduras', matured.length, 'Base apta para avaliar desfecho', 'Turmas cujo prazo esperado já foi atingido: Mestrado>=2 anos, Doutorado>=4 anos, Especialização>=2 anos.')}
    ${buildPosGraduacaoKpi('Conclusão (Maduras)', formatPercent(completionRate), '', 'Concluídos dividido pelo total de coortes maduras.')}
    ${buildPosGraduacaoKpi('Evasão/Desligamento (Maduras)', formatPercent(attritionRate), '', 'Cancelado/Desligado/Evasão/Abandono/Falecido dividido pelo total de coortes maduras.')}
    ${buildPosGraduacaoKpi('Pendência Ativa (Maduras)', formatPercent(pendingActiveRate), '', 'Alunos ainda Matriculados mesmo após o prazo esperado, dividido pelas coortes maduras.')}
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
    ${buildPosGraduacaoKpi(`Coortes Maduras`, matured.length, '', 'Turmas do programa com prazo esperado já atingido.')}
    ${buildPosGraduacaoKpi(`Conclusão`, formatPercent(completionRate), '', 'Concluídos em coortes maduras / total de coortes maduras.')}
    ${buildPosGraduacaoKpi(`Evasão/Desligamento`, formatPercent(attritionRate), '', 'Evasão e desligamentos em coortes maduras / total de coortes maduras.')}
    ${buildPosGraduacaoKpi(`Pendência Ativa`, active, '', 'Alunos ainda Matriculados em coortes maduras do programa.')}
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
    ${buildPosGraduacaoKpi(`Conclusão (Maduras)`, formatPercent(completionRate), '', 'Concluídos em coortes maduras do campus / total de coortes maduras do campus.')}
    ${buildPosGraduacaoKpi(`Evasão (Maduras)`, formatPercent(attritionRate), '', 'Evasão/desligamento em coortes maduras do campus / total de coortes maduras do campus.')}
    ${buildPosGraduacaoKpi(`Pendência Ativa (Maduras)`, backlog, '', 'Alunos Matriculados em coortes maduras no campus.')}
    ${buildPosGraduacaoKpi(`Ativos Hoje`, active, '', 'Alunos Matriculados no campus no recorte atual.')}
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
  const statusLabels = ['Concluído', 'Em Fluxo Regular', 'Pendência Ativa', 'Evasão/Desligamento', 'Outros']
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
        'Concluído': '#4D90FE',
        'Em Fluxo Regular': '#4CAF50',
        'Pendência Ativa': '#FF9800',
        'Evasão/Desligamento': '#F44336',
        'Outros': '#607D8B'
      }[label] || '#607D8B'))
    }]
  });

  createChart('chart-posgraduacao-categoria', 'bar', {
    labels: ['Conclusão', 'Evasão', 'Pendência Ativa'],
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
      label: 'Em Fluxo Regular',
      data: programRiskRows.map(row => row.regular),
      backgroundColor: '#4CAF50'
    }, {
      label: 'Pendência Ativa',
      data: programRiskRows.map(row => row.pending),
      backgroundColor: '#FF9800'
    }, {
      label: 'Evasão/Desligamento',
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
      label: 'Fluxo Regular (%)',
      data: campusRows.map(r => r.regularRate),
      backgroundColor: '#4CAF50'
    }, {
      label: 'Pendência Ativa (%)',
      data: campusRows.map(r => r.pendingRate),
      backgroundColor: '#FF9800'
    }, {
      label: 'Evasão/Desligamento (%)',
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
        label: 'Taxa de Conclusão',
        data: years.map(year => rates.completion[year] || 0),
        borderColor: '#4D90FE',
        backgroundColor: 'rgba(77, 144, 254, 0.12)',
        tension: 0.25,
        fill: false
      },
      {
        label: 'Taxa de Evasão/Desligamento',
        data: years.map(year => rates.attrition[year] || 0),
        borderColor: '#F44336',
        backgroundColor: 'rgba(76, 175, 80, 0.12)',
        tension: 0.25,
        fill: false
      },
      {
        label: 'Taxa de Pendência Ativa',
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
    datasets: ['Em Fluxo Regular', 'Pendência Ativa', 'Concluído', 'Evasão/Desligamento']
      .map(bucket => ({
        label: bucket,
        data: years.map(year => evolutionBuckets[year]?.[bucket] || 0),
        backgroundColor: ({
          'Em Fluxo Regular': '#4CAF50',
          'Pendência Ativa': '#FF9800',
          'Concluído': '#4D90FE',
          'Evasão/Desligamento': '#F44336'
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
      label: 'Conclusão (%)',
      data: years.map(y => rates.completion[y] || 0),
      borderColor: '#4D90FE',
      tension: 0.25
    }, {
      label: 'Evasão (%)',
      data: years.map(y => rates.attrition[y] || 0),
      borderColor: '#F44336',
      tension: 0.25
    }, {
      label: 'Pendência Ativa (%)',
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
      label: 'Pendência Ativa',
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
      label: 'Conclusão (%)',
      data: campusRows.map(r => r.doneRate),
      backgroundColor: '#4D90FE'
    }, {
      label: 'Evasão (%)',
      data: campusRows.map(r => r.lostRate),
      backgroundColor: '#F44336'
    }, {
      label: 'Pendência (%)',
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
