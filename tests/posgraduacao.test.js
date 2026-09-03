// Testes das funções puras de src/posgraduacao.js — a aba Pós-Graduação do
// painel principal, com indicadores gerais.
//
// A metodologia de ciclos da PNP que vivia aqui está congelada em
// src/pos-validacao.js e tem suíte própria em tests/pos-validacao.test.js.
'use strict';

const path = require('path');
const vm = require('vm');
const { createBrowserContext, loadScript } = require('./helpers/browserEnv');

const POSGRAD_PATH = path.join(__dirname, '..', 'src', 'posgraduacao.js');

let ctx;

// `const` no topo de um script vai para o escopo léxico global, não para o
// objeto do contexto. É o mesmo no navegador; para lê-lo aqui, avalia-se o nome
// dentro do contexto.
const constante = nome => vm.runInContext(nome, ctx);

beforeAll(() => {
  ctx = createBrowserContext({ STATE: { maxYear: 2026, filtered: {}, raw: { posgraduacao: [] } } });
  loadScript(ctx, POSGRAD_PATH);
});

// ─── getPosGraduacaoBucket ───────────────────────────────────────────────────

describe('getPosGraduacaoBucket', () => {
  test('Matriculado fica sozinho', () => {
    expect(ctx.getPosGraduacaoBucket('Matriculado')).toBe('Matriculado');
  });

  test('Concluído e Formado viram Concluinte', () => {
    expect(ctx.getPosGraduacaoBucket('Concluído')).toBe('Concluinte');
    expect(ctx.getPosGraduacaoBucket('Formado')).toBe('Concluinte');
  });

  // Aperfeiçoado tem balde próprio de propósito: o aluno cumpriu os créditos
  // mas não obteve o título de especialista. Somá-lo a Concluinte inflaria a
  // conclusão; somá-lo a Evadido misturaria quem terminou com quem abandonou.
  test('Aperfeiçoado não é Concluinte nem Evadido', () => {
    expect(ctx.getPosGraduacaoBucket('Aperfeiçoado')).toBe('Aperfeiçoado');
  });

  test('as seis situações de perda de vínculo viram Evadido', () => {
    ['Cancelado', 'Evasão', 'Desligado', 'Abandono', 'Falecido', 'Cancelamento Compulsório']
      .forEach(s => expect(ctx.getPosGraduacaoBucket(s)).toBe('Evadido'));
  });

  test('o que não está no mapa cai em Outros', () => {
    ['Em Migração', 'Não concluído', 'Transferido Interno', 'Trancado',
     'Trancado Voluntariamente', 'Matrícula Vínculo Institucional',
     'Aguardando Colação de Grau', 'Situação Inventada']
      .forEach(s => expect(ctx.getPosGraduacaoBucket(s)).toBe('Outros'));
  });

  test('valor vazio, nulo ou indefinido cai em Outros', () => {
    expect(ctx.getPosGraduacaoBucket('')).toBe('Outros');
    expect(ctx.getPosGraduacaoBucket(null)).toBe('Outros');
    expect(ctx.getPosGraduacaoBucket(undefined)).toBe('Outros');
  });

  test('espaço em volta não muda o balde', () => {
    expect(ctx.getPosGraduacaoBucket('  Matriculado  ')).toBe('Matriculado');
  });

  test('todo balde declarado tem cor', () => {
    constante('POSGRAD_BUCKETS').forEach(b => {
      expect(constante('POSGRAD_BUCKET_COLOR')[b]).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });
  });

  test('todo destino do mapa está na lista de baldes', () => {
    Object.values(constante('POSGRAD_SITUACAO_BUCKET')).forEach(destino => {
      expect(constante('POSGRAD_BUCKETS')).toContain(destino);
    });
  });
});

// ─── contarPor ───────────────────────────────────────────────────────────────

describe('contarPor', () => {
  const dados = [
    { campus: 'SSA', categoria: 'Mestrado' },
    { campus: 'SSA', categoria: 'Doutorado' },
    { campus: 'VC', categoria: 'Mestrado' },
    { campus: '', categoria: 'Mestrado' },
  ];

  test('conta por campus e ignora valor vazio', () => {
    expect(ctx.contarPor(dados, r => r.campus)).toEqual({ SSA: 2, VC: 1 });
  });

  test('conta por categoria', () => {
    expect(ctx.contarPor(dados, r => r.categoria)).toEqual({ Mestrado: 3, Doutorado: 1 });
  });

  test('lista vazia devolve objeto vazio', () => {
    expect(ctx.contarPor([], r => r.campus)).toEqual({});
  });
});

// ─── cursosPorCampus ─────────────────────────────────────────────────────────

describe('cursosPorCampus', () => {
  test('conta programas distintos, não alunos', () => {
    const dados = [
      { campus: 'SSA', curso: 'Mestrado em A' },
      { campus: 'SSA', curso: 'Mestrado em A' },
      { campus: 'SSA', curso: 'Mestrado em B' },
      { campus: 'VC', curso: 'Especialização em C' },
    ];
    expect(ctx.cursosPorCampus(dados)).toEqual({ SSA: 2, VC: 1 });
  });

  // O mesmo programa ofertado em dois campi conta uma vez em cada, porque cada
  // campus tem a própria oferta. Vale para "Matem@tica na Pr@tica", que roda em
  // cinco campi.
  test('o mesmo programa em dois campi conta em cada um', () => {
    const dados = [
      { campus: 'BAR', curso: 'Especialização em Ensino de Matemática' },
      { campus: 'CAM', curso: 'Especialização em Ensino de Matemática' },
    ];
    expect(ctx.cursosPorCampus(dados)).toEqual({ BAR: 1, CAM: 1 });
  });

  test('ignora registro sem campus ou sem curso', () => {
    const dados = [
      { campus: '', curso: 'Mestrado em A' },
      { campus: 'SSA', curso: '' },
      { campus: 'SSA', curso: '   ' },
      { campus: 'SSA', curso: 'Mestrado em A' },
    ];
    expect(ctx.cursosPorCampus(dados)).toEqual({ SSA: 1 });
  });

  test('espaço em volta do nome não cria curso novo', () => {
    const dados = [
      { campus: 'SSA', curso: 'Mestrado em A' },
      { campus: 'SSA', curso: '  Mestrado em A  ' },
    ];
    expect(ctx.cursosPorCampus(dados)).toEqual({ SSA: 1 });
  });
});

// ─── truncateText ────────────────────────────────────────────────────────────

describe('truncateText', () => {
  test('devolve o texto curto intacto', () => {
    expect(ctx.truncateText('Mestrado', 40)).toBe('Mestrado');
  });

  test('corta o texto longo e marca com reticências', () => {
    expect(ctx.truncateText('a'.repeat(50), 10)).toBe('a'.repeat(10) + '...');
  });

  test('texto vazio vira "Não informado"', () => {
    expect(ctx.truncateText('')).toBe('Não informado');
    expect(ctx.truncateText(null)).toBe('Não informado');
  });
});

// ─── getPosGraduacaoCategoryColor ────────────────────────────────────────────

describe('getPosGraduacaoCategoryColor', () => {
  test('as três categorias têm cor própria', () => {
    expect(ctx.getPosGraduacaoCategoryColor('Mestrado')).toBe('#4D90FE');
    expect(ctx.getPosGraduacaoCategoryColor('Doutorado')).toBe('#F44336');
    expect(ctx.getPosGraduacaoCategoryColor('Especialização')).toBe('#4CAF50');
  });

  test('categoria desconhecida cai na cor neutra', () => {
    expect(ctx.getPosGraduacaoCategoryColor('Pós-Doutorado')).toBe('#607D8B');
    expect(ctx.getPosGraduacaoCategoryColor(undefined)).toBe('#607D8B');
  });

  test('toda categoria empilhada nos gráficos tem cor declarada', () => {
    constante('POSGRAD_CATEGORIAS').forEach(c => {
      expect(ctx.getPosGraduacaoCategoryColor(c)).not.toBe('#607D8B');
    });
  });
});

// ─── seriesPorCategoria ──────────────────────────────────────────────────────

describe('seriesPorCategoria', () => {
  const dados = [
    { campus: 'SSA', categoria: 'Mestrado' },
    { campus: 'SSA', categoria: 'Mestrado' },
    { campus: 'SSA', categoria: 'Doutorado' },
    { campus: 'VC', categoria: 'Especialização' },
    { campus: '', categoria: 'Mestrado' },
  ];
  const porTotal = porChave => Object.keys(porChave)
    .sort((a, b) => ctx.totalDaChave(porChave, b) - ctx.totalDaChave(porChave, a));

  test('devolve uma série por categoria, na ordem declarada', () => {
    const { chaves, datasets } = ctx.seriesPorCategoria(dados, r => r.campus, porTotal);
    expect(chaves).toEqual(['SSA', 'VC']);
    expect(datasets.map(d => d.label)).toEqual(['Mestrado', 'Doutorado', 'Especialização']);
  });

  test('a categoria ausente numa chave vale zero, não buraco', () => {
    const { datasets } = ctx.seriesPorCategoria(dados, r => r.campus, porTotal);
    const mestrado = datasets.find(d => d.label === 'Mestrado');
    expect(mestrado.data).toEqual([2, 0]);
  });

  test('ignora chave vazia', () => {
    const { chaves } = ctx.seriesPorCategoria(dados, r => r.campus, porTotal);
    expect(chaves).not.toContain('');
  });

  // O build usa 'Outro' quando não reconhece a modalidade. Se a série não
  // existisse, a barra ficaria menor que o KPI "Alunos", sem aviso nenhum.
  test('categoria fora das três conhecidas ganha série própria, no fim', () => {
    const comOutro = [
      { campus: 'SSA', categoria: 'Mestrado' },
      { campus: 'SSA', categoria: 'Outro' },
    ];
    const { chaves, datasets } = ctx.seriesPorCategoria(comOutro, r => r.campus, porTotal);
    expect(datasets.map(d => d.label)).toEqual(['Mestrado', 'Doutorado', 'Especialização', 'Outro']);
    const soma = datasets.reduce((s, d) => s + d.data[chaves.indexOf('SSA')], 0);
    expect(soma).toBe(comOutro.length);
  });

  test('registro sem categoria entra como Outro, e não some', () => {
    const semCategoria = [{ campus: 'SSA' }, { campus: 'SSA', categoria: 'Mestrado' }];
    const { chaves, datasets } = ctx.seriesPorCategoria(semCategoria, r => r.campus, porTotal);
    const soma = datasets.reduce((s, d) => s + d.data[chaves.indexOf('SSA')], 0);
    expect(soma).toBe(2);
  });

  test('a soma das séries devolve o total de cada chave', () => {
    const { chaves, datasets } = ctx.seriesPorCategoria(dados, r => r.campus, porTotal);
    const somaSSA = datasets.reduce((s, d) => s + d.data[chaves.indexOf('SSA')], 0);
    expect(somaSSA).toBe(3);
  });

  test('ordena por ano quando a chave é numérica', () => {
    const anos = [
      { ano: 2024, categoria: 'Mestrado' },
      { ano: 2019, categoria: 'Mestrado' },
      { ano: 2026, categoria: 'Doutorado' },
    ];
    const { chaves } = ctx.seriesPorCategoria(
      anos,
      r => r.ano,
      porChave => Object.keys(porChave).sort((a, b) => Number(a) - Number(b))
    );
    expect(chaves).toEqual(['2019', '2024', '2026']);
  });
});
