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

  // Post-graduation specific filters - only get values if on post-graduation tab.
  // Período e campus vêm da barra global, como nas outras abas.
  let categoriaVal = 'all';
  let situacaoVal = 'all';
  let posgradCursoVal = 'all';

  if (isPosGraduacaoTab) {
    categoriaVal = $('posgrad-categoria-filter') ? $('posgrad-categoria-filter').value : 'all';
    situacaoVal = $('posgrad-situacao-filter') ? $('posgrad-situacao-filter').value : 'all';
    posgradCursoVal = $('posgrad-curso-filter') ? $('posgrad-curso-filter').value : 'all';
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
  //
  // Período e campus já vieram de filterPeriodAndCampus, que trata `r.ano` em
  // minúscula e `r.campus` — os mesmos campos que a pós-graduação usa. Aqui
  // ficam só os três seletores da aba.
  const filterPosGraduacao = arr => filterPeriodAndCampus(arr).filter(r => {
    if (posgradCursoVal !== 'all' && (r.curso || '').trim() !== posgradCursoVal) return false;
    if (categoriaVal !== 'all' && r.categoria !== categoriaVal) return false;
    if (situacaoVal !== 'all' && getPosGraduacaoBucket(r.situacao) !== situacaoVal) return false;

    // Guarda contra ano de coorte inválido
    if (Number.isNaN(parseInt(r.ano, 10))) return false;

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
  // Desenha junto com as outras abas, mesmo escondida. A aba antiga só desenhava
  // ao ser aberta, porque a metodologia de ciclos era pesada; a aba nova não é,
  // e o mapa Leaflet precisa existir antes do primeiro clique. core.js chama
  // invalidateSize() na troca de aba, como faz para os outros mapas.
  renderChartsPosGraduacao();

  // Render tables
  renderTables();
}
