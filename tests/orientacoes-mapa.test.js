// Regressão: o mapa da aba Orientações recebia STATE.filtered.grupos, com o
// rótulo "Pesquisadores (aprox.)". Um campus sem grupo certificado no DGP,
// como Itabuna, deixava o mapa vazio numa aba que tem orientações.
//
// O teste não desenha nada: troca renderGenericMap por um espião e confere o
// que a aba manda para ele. Os dados vêm do data.json publicado, como em
// tests/campus-filter.test.js.
const vm = require('vm');
const path = require('path');
const { createBrowserContext, loadDashboard } = require('./helpers/browserEnv');

const dados = require(path.join(__dirname, '..', 'data.json'));

function chamadasDoMapa(filtro) {
  const ctx = createBrowserContext();
  loadDashboard(ctx);

  ctx.__concluidas = dados.concluidas.filter(filtro);
  ctx.__andamento = dados.andamento.filter(filtro);
  ctx.__grupos = [];
  ctx.__chamadas = [];

  vm.runInContext(`
    renderGenericMap = (data, id, cor, rotulo) => __chamadas.push({ n: data.length, id, rotulo });
    processEvolucao = () => {};
    processTipos = () => {};
    STATE.filtered.concluidas = __concluidas;
    STATE.filtered.andamento = __andamento;
    STATE.filtered.grupos = __grupos;
    renderChartsOrientacoes();
  `, ctx);

  return {
    mapa: ctx.__chamadas.find(c => c.id === 'map-orientacoes'),
    total: ctx.__concluidas.length + ctx.__andamento.length,
  };
}

describe('mapa da aba Orientações', () => {
  test('recebe as orientações do recorte, e não os grupos de pesquisa', () => {
    const { mapa, total } = chamadasDoMapa(() => true);
    expect(mapa).toBeDefined();
    expect(mapa.rotulo).toBe('Orientações');
    expect(mapa.n).toBe(total);
  });

  test('Itabuna aparece no mapa, mesmo sem grupo certificado no DGP', () => {
    const { mapa } = chamadasDoMapa(r => r.campus === 'ITA');
    expect(mapa.n).toBeGreaterThan(0);
  });

  test('todo registro de orientação tem campus, senão o mapa perde ponto', () => {
    const semCampus = [...dados.concluidas, ...dados.andamento].filter(r => !r.campus);
    expect(semCampus).toHaveLength(0);
  });
});
