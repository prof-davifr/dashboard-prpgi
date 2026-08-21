// filters.js — processData().
//
// Ponto único de filtragem: roda a cada mudança de período, campus, "Desduplicar"
// ou métricas relativas, e reescreve STATE.filtered a partir de STATE.raw.
// Depois chama os renderizadores de cada aba.

// CAMPUS_TO_CITY, IFBA_COORDS, normalizeText, mapUnidadeToCampus e lookupCoords
// vivem em src/shared.js (carregado antes deste arquivo em index.html).

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
    // Year filter — supports both "Ano" (Lattes) and "ano" (IC)
    const yearField = r["Ano"] || r.ano;
    if (yearField) {
        const y = parseInt(yearField, 10);
        const inPeriod = !isNaN(y) && y >= startYear && y <= endYear;
        if (!inPeriod) return false;
    }

    // Campus filter
    if (campusVal === 'all') return true;
    
    // For Lattes data (Excel) tagged with campus
    if (r.campus) return r.campus === campusVal;

    // For DGP data (CSV) - map Unidade to campus code (longest-city-first)
    let rCampus = mapUnidadeToCampus(r["Unidade"]);
    return rCampus === campusVal;
  });

  const filterGroupsCampus = arr => arr.filter(r => {
    if (campusVal === 'all') return true;
    let rCampus = mapUnidadeToCampus(r["Unidade"]);
    return rCampus === campusVal;
  });

  // Post-graduation filter function.
  // `applyMaturedOnly = false` devolve o mesmo recorte sem o filtro de ciclo
  // encerrado. Os KPIs de gestão (Matriculados, Em curso, Retidos) contam sobre
  // toda a população do recorte: "Em curso" é, por definição, quem ainda não
  // está em ciclo encerrado, então sobre o recorte filtrado daria sempre zero.
  const filterPosGraduacao = (arr, applyMaturedOnly = true) => arr.filter(r => {
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
    if (applyMaturedOnly && maturedOnly && !isMature) return false;

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
    posgraduacao: filterPosGraduacao(STATE.raw.posgraduacao),
    posgraduacaoTodosCiclos: filterPosGraduacao(STATE.raw.posgraduacao, false),
    ic: filterPeriodAndCampus(STATE.raw.ic)
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
  renderKPIsIC();
  renderChartsIC();
  
  // Render tables
  renderTables();

  // Render post-graduation if tab is active
  if ($('tab-posgraduacao') && $('tab-posgraduacao').classList.contains('active')) {
    renderChartsPosGraduacao();
  }
}
