// pos-validacao-init.js — CONGELADO em 02/09/2026.
//
// Partida da página "Pós-Graduação Validação". Substitui src/cache.js e
// src/filters.js, que servem o painel principal e carregam as outras sete abas.
//
// Só roda depois que a porta de senha abre (src/pos-validacao-porta.js).

const POS_VALIDACAO_CACHE = 'dashboard-prpgi-v1';
const POS_VALIDACAO_JSON = 'data.json';

// Mesmo padrão stale-while-revalidate de src/cache.js: entrega o que está em
// cache e revalida em segundo plano, com fallback para fetch direto.
async function carregarDadosPosValidacao() {
  try {
    const cache = await caches.open(POS_VALIDACAO_CACHE);
    const emCache = await cache.match(POS_VALIDACAO_JSON);

    if (emCache) {
      const dados = await emCache.json();
      fetch(POS_VALIDACAO_JSON).then(async resp => {
        if (!resp.ok) return;
        const daRede = await resp.clone().json();
        if (daRede.meta && dados.meta && daRede.meta.generatedAt !== dados.meta.generatedAt) {
          await cache.put(POS_VALIDACAO_JSON, resp);
        }
      }).catch(err => console.log('Revalidação em segundo plano falhou', err));
      return dados;
    }

    const resp = await fetch(POS_VALIDACAO_JSON);
    if (!resp.ok) return null;
    await cache.put(POS_VALIDACAO_JSON, resp.clone());
    return resp.json();
  } catch (e) {
    console.warn('Cache API indisponível, fallback para fetch tradicional', e);
    const resp = await fetch(POS_VALIDACAO_JSON);
    return resp.ok ? resp.json() : null;
  }
}

// Cópia de filterPosGraduacao (src/filters.js), sem o filtro global de período
// e sem o de campus do painel principal, que não existem nesta página.
function filtrarPosValidacao(arr, aplicarCicloEncerrado = true) {
  const categoriaVal = $('posgrad-categoria-filter').value;
  const statusVal = $('posgrad-status-filter').value;
  const campusVal = $('posgrad-campus-filter').value;
  const cursoVal = $('posgrad-curso-filter').value;
  const soCiclosEncerrados = $('posgrad-matured-only-toggle').checked;

  return arr.filter(r => {
    const status = normalizePosGraduacaoStatus(r.situacao);

    if (campusVal !== 'all' && r.campus !== campusVal) return false;
    if (cursoVal !== 'all' && (r.curso || '').trim() !== cursoVal) return false;
    if (categoriaVal !== 'all' && r.categoria !== categoriaVal) return false;
    if (statusVal !== 'all' && status !== statusVal) return false;

    if (aplicarCicloEncerrado && soCiclosEncerrados && !isPosGraduacaoMature(r)) return false;

    // Guarda contra ano de coorte inválido
    if (Number.isNaN(parseInt(r.ano, 10))) return false;

    return true;
  });
}

function processarPosValidacao() {
  STATE.filtered.posgraduacao = filtrarPosValidacao(STATE.raw.posgraduacao);
  STATE.filtered.posgraduacaoTodosCiclos = filtrarPosValidacao(STATE.raw.posgraduacao, false);
  renderChartsPosGraduacao();
}

async function iniciarPosValidacao() {
  try {
    $('loading-text').innerText = 'Carregando dados...';
    const dados = await carregarDadosPosValidacao();

    if (!dados) {
      $('loading-text').innerText = "Erro: data.json não encontrado. Execute 'npm run build' primeiro.";
      return;
    }

    STATE.raw.posgraduacao = dados.posgraduacao || [];

    if (dados.meta) {
      STATE.minYear = dados.meta.minYear;
      STATE.maxYear = dados.meta.maxYear;
      if ($('last-update-display')) {
        $('last-update-display').textContent = formatDateTimePtBr(dados.meta.generatedAt);
      }
    }

    populateCourseSelector();
    populateCampusSelector();

    ['posgrad-categoria-filter', 'posgrad-status-filter', 'posgrad-campus-filter',
     'posgrad-curso-filter', 'posgrad-matured-only-toggle']
      .forEach(id => $(id).addEventListener('change', processarPosValidacao));

    // Sub-abas: mesma lógica de src/cache.js, sem a guarda de aba ativa.
    document.querySelectorAll('.sub-tab-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        document.querySelectorAll('.sub-tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.subtab-content').forEach(c => c.classList.remove('active'));
        e.target.classList.add('active');
        $(e.target.dataset.subtarget).classList.add('active');
        renderChartsPosGraduacao();
      });
    });

    $('loading').style.display = 'none';
    processarPosValidacao();
  } catch (e) {
    $('loading-text').innerText = 'Erro ao carregar os arquivos.';
    console.error(e);
  }
}
