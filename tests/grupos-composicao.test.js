// Gráfico "Docentes, TAE e Alunos nos Grupos" (aba Grupos de Pesquisa)
'use strict';

const path = require('path');
const { createBrowserContext, loadDashboard } = require('./helpers/browserEnv');

let ctx;

beforeAll(() => {
  ctx = createBrowserContext();
  loadDashboard(ctx);
});

// Os objetos vêm de outro contexto da VM; o JSON tira a diferença de protótipo.
const simples = v => JSON.parse(JSON.stringify(v));

describe('composicaoGrupos', () => {
  test('Docentes = Pesquisadores, TAE = Tecnicos, Alunos = Estudantes, nessa ordem', () => {
    const { itens, total } = simples(ctx.composicaoGrupos([
      { Situacao: 'Certificado', Pesquisadores: '6', Tecnicos: '1', Estudantes: '3' },
      { Situacao: 'Em preenchimento', Pesquisadores: '2', Tecnicos: '1', Estudantes: '7' }
    ]));
    expect(itens.map(i => [i.rotulo, i.total])).toEqual([['Docentes', 8], ['TAE', 2], ['Alunos', 10]]);
    expect(total).toBe(20);
    expect(itens.map(i => i.percentual)).toEqual([40, 10, 50]);
  });

  test('grupo excluído do DGP fica de fora', () => {
    const { itens, total } = simples(ctx.composicaoGrupos([
      { Situacao: 'Certificado', Pesquisadores: '1', Tecnicos: '0', Estudantes: '1' },
      { Situacao: 'Excluído', Pesquisadores: '50', Tecnicos: '50', Estudantes: '50' }
    ]));
    expect(total).toBe(2);
    expect(itens.find(i => i.rotulo === 'TAE').total).toBe(0);
  });

  test('recorte sem grupo dá zero, não NaN', () => {
    const { itens, total } = simples(ctx.composicaoGrupos([]));
    expect(total).toBe(0);
    expect(itens.every(i => i.percentual === 0)).toBe(true);
  });

  test('cores fixas e distintas por categoria', () => {
    const cores = simples(ctx.composicaoGrupos([])).itens.map(i => i.cor);
    expect(new Set(cores).size).toBe(3);
  });
});

// Sem o campo, a fatia de TAE sai zerada sem erro nenhum. `refresh-grupos.js`
// e `build.js` montam os grupos cada um por conta própria; se um deles perder o
// campo, este teste acusa.
describe('data.json publicado', () => {
  test('todo grupo traz a contagem de técnicos', () => {
    const data = require(path.join(__dirname, '..', 'data.json'));
    const sem = data.grupos.filter(g => g.Tecnicos === undefined);
    expect(sem).toHaveLength(0);
  });
});
