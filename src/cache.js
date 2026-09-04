// cache.js — carga do data.json e inicialização do dashboard.
//
// Estratégia stale-while-revalidate sobre a Cache API: entrega o que está em
// cache e revalida em segundo plano, com fallback para fetch direto.
// Último script carregado — depende de todos os renderizadores.

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
      console.warn('Cache API indisponível, fallback para fetch tradicional', e);
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
    STATE.raw.ic = data.ic || [];

    // Set period labels from metadata
    if (data.meta) {
      // Guardado em STATE porque a capa do relatório exportado precisa dizer de
      // quando são os dados, e ela roda muito depois desta função.
      STATE.meta = data.meta;
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
        renderKPIsIC();
        renderTables();
      });
    }
    
    // Post-graduation filter event listeners
    ['posgrad-curso-filter', 'posgrad-categoria-filter', 'posgrad-situacao-filter']
      .forEach(id => {
        const elem = $(id);
        if (elem) elem.addEventListener('change', processData);
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

window.addEventListener("DOMContentLoaded", initDashboard);
