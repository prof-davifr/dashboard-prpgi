// Carga do data.json (src/cache.js): a revalidação em segundo plano aplica a
// versão nova na hora. Antes só pedia para recarregar, e a tela ficava com a
// versão do cache — um campo novo aparecia zerado (TAE 0,0% nos grupos).
'use strict';

const vm = require('vm');
const { createBrowserContext, loadDashboard } = require('./helpers/browserEnv');

// Documento em que o mesmo id devolve sempre o mesmo elemento, para ver o valor
// do seletor de período depois de reescrito.
function documentoComEstado() {
  const elementos = {};
  const elem = () => ({
    textContent: '', innerHTML: '', innerText: '', style: {}, value: 'all', checked: false,
    dataset: {}, title: '',
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    addEventListener() {}, appendChild() {}, parentElement: { style: {} }
  });
  return {
    getElementById: id => (elementos[id] = elementos[id] || elem()),
    querySelectorAll: () => ({ forEach() {} }),
    querySelector: () => null,
    addEventListener() {},
    body: { style: {} }
  };
}

const meta = generatedAt => ({ generatedAt, minYear: 2000, maxYear: 2026, sourceDates: {} });
const resposta = corpo => ({ ok: true, json: async () => corpo, clone() { return resposta(corpo); } });

function contexto(cacheado, rede) {
  const guardados = [];
  const ctx = createBrowserContext({
    document: documentoComEstado(),
    caches: {
      open: async () => ({
        match: async () => (cacheado ? resposta(cacheado) : undefined),
        put: async (url, resp) => { guardados.push(resp); }
      })
    },
    fetch: async () => resposta(rede),
    requestAnimationFrame: () => {},
    setTimeout
  });
  loadDashboard(ctx);
  ctx.processData = jest.fn();
  ctx.showToast = jest.fn();
  ctx.updateFilterVisibility = () => {};
  ctx.renderSourceUpdates = () => {};
  return { ctx, guardados };
}

// core.js declara `const STATE`, que não vira propriedade do contexto.
const estado = ctx => vm.runInContext('STATE', ctx);
const esperarRevalidacao = () => new Promise(r => setImmediate(r));

describe('initDashboard', () => {
  test('versão nova na rede substitui a do cache sem recarregar a página', async () => {
    const velho = { meta: meta('2026-10-26T12:00:00Z'), grupos: [{ Pesquisadores: '1' }] };
    const novo = { meta: meta('2026-10-28T18:00:00Z'), grupos: [{ Pesquisadores: '1', Tecnicos: '1' }] };
    const { ctx, guardados } = contexto(velho, novo);

    await ctx.initDashboard();
    expect(estado(ctx).raw.grupos[0].Tecnicos).toBeUndefined();

    await esperarRevalidacao();
    expect(estado(ctx).raw.grupos[0].Tecnicos).toBe('1');
    expect(estado(ctx).meta.generatedAt).toBe('2026-10-28T18:00:00Z');
    expect(ctx.processData).toHaveBeenCalledTimes(2);
    expect(guardados).toHaveLength(1);
    expect(ctx.showToast).toHaveBeenCalledWith('Dados atualizados.');
  });

  test('mesma versão na rede não desenha a tela de novo', async () => {
    const igual = { meta: meta('2026-10-28T18:00:00Z'), grupos: [] };
    const { ctx, guardados } = contexto(igual, igual);

    await ctx.initDashboard();
    await esperarRevalidacao();
    expect(ctx.processData).toHaveBeenCalledTimes(1);
    expect(guardados).toHaveLength(0);
    expect(ctx.showToast).not.toHaveBeenCalled();
  });
});

describe('aplicarDados', () => {
  test('mantém o período escolhido ao reescrever o seletor', () => {
    const { ctx } = contexto(null, null);
    ctx.document.getElementById('period-filter').value = '5';
    ctx.aplicarDados({ meta: meta('2026-10-28T18:00:00Z') });
    const seletor = ctx.document.getElementById('period-filter');
    expect(seletor.innerHTML).toContain('Últimos 5 Anos (2022-2026)');
    expect(seletor.value).toBe('5');
  });
});
