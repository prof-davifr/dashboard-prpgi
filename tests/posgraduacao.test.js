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

// ─── Nomes de curso ──────────────────────────────────────────────────────────

describe('nomeCursoCurto', () => {
  test('tira o nível do curso, que a coluna categoria já informa', () => {
    expect(ctx.nomeCursoCurto('MESTRADO PROFISSIONAL EM ENGENHARIA DE MATERIAIS'))
      .toBe('Engenharia de Materiais');
    expect(ctx.nomeCursoCurto('Doutorado em Difusão do Conhecimento'))
      .toBe('Difusão do Conhecimento');
    expect(ctx.nomeCursoCurto('Curso de Pós-graduação Lato Sensu em Ensino de Ciências: Ciência é 10'))
      .toBe('Ensino de Ciências: Ciência é 10');
  });

  test('tira o código de matrícula do começo', () => {
    expect(ctx.nomeCursoCurto('PGMP - Especialização em Ensino de Matemática'))
      .toBe('Ensino de Matemática');
    expect(ctx.nomeCursoCurto('EDEPTILH - Especialização em Educação a Distância - ILH'))
      .toBe('Educação a Distância - ILH');
  });

  // Casos reais da base que a primeira versão da regra deixou passar.
  test('aceita a vírgula e o hífen com espaços que a base traz', () => {
    expect(ctx.nomeCursoCurto('CELER - Curso de Especialização, Lato Sensu, em Linguagem, Ensino e Representação'))
      .toBe('Linguagem, Ensino e Representação');
    expect(ctx.nomeCursoCurto('PGGEA - CURSO DE PÓS - GRADUAÇÃO LATO SENSU EM GESTÃO E EDUCAÇÃO AMBIENTAL- JQ'))
      .toBe('Gestão e Educação Ambiental- JQ');
  });

  test('normaliza o CAIXA ALTA mas preserva as siglas', () => {
    expect(ctx.nomeCursoCurto('PÓS-GRADUAÇÃO LATO SENSU EM EDUCAÇÃO E SUAS TECNOLOGIAS - VAL'))
      .toBe('Educação e suas Tecnologias - VAL');
  });

  test('não mexe em nome que já está em caixa mista', () => {
    expect(ctx.nomeCursoCurto('DWEB - Pós-Graduação Lato Sensu em Desenvolvimento WEB'))
      .toBe('Desenvolvimento WEB');
  });

  // Sem esta guarda, "Doutorado" sozinho viraria string vazia, e um nome de
  // uma palavra ficaria irreconhecível.
  test('mantém o nome quando tirar o nível deixaria menos de oito letras', () => {
    expect(ctx.nomeCursoCurto('Doutorado')).toBe('Doutorado');
    expect(ctx.nomeCursoCurto('Mestrado')).toBe('Mestrado');
    expect(ctx.nomeCursoCurto('PGMP - Especialização em Ensino')).toBe('Especialização em Ensino');
  });

  test('valor vazio devolve string vazia', () => {
    expect(ctx.nomeCursoCurto('')).toBe('');
    expect(ctx.nomeCursoCurto(null)).toBe('');
  });
});

describe('construirRotulosCurso', () => {
  // Oito programas de "Docência para a Educação Profissional e Tecnológica"
  // encurtavam para o mesmo texto, um por campus. Sem o campus no rótulo, o
  // filtro mostraria oito opções iguais.
  test('acrescenta o campus quando dois cursos encurtam para o mesmo nome', () => {
    const dados = [
      { curso: 'DEPTSSA - Especialização em Docência', campus: 'SSA' },
      { curso: 'DEPTVC - Especialização em Docência', campus: 'VC' },
    ];
    const rotulos = ctx.construirRotulosCurso(dados);
    expect(rotulos['DEPTSSA - Especialização em Docência']).toBe('Docência · SSA');
    expect(rotulos['DEPTVC - Especialização em Docência']).toBe('Docência · VC');
  });

  test('não acrescenta campus quando o nome curto já é único', () => {
    const dados = [
      { curso: 'Doutorado em Difusão do Conhecimento', campus: 'SSA' },
      { curso: 'MESTRADO PROFISSIONAL EM ENGENHARIA DE MATERIAIS', campus: 'SSA' },
    ];
    const rotulos = ctx.construirRotulosCurso(dados);
    expect(rotulos['Doutorado em Difusão do Conhecimento']).toBe('Difusão do Conhecimento');
  });

  test('resume a lista quando o curso passa de três campi', () => {
    const nomeA = 'PGMP - Especialização em Ensino de Matemática';
    const nomeB = 'ESMP - Especialização em Ensino de Matemática';
    const dados = ['BAR', 'CAM', 'EUN', 'SSA', 'VAL'].map(c => ({ curso: nomeA, campus: c }));
    dados.push({ curso: nomeB, campus: 'SF' });
    const rotulos = ctx.construirRotulosCurso(dados);
    expect(rotulos[nomeA]).toBe('Ensino de Matemática · BAR, CAM, EUN…');
    expect(rotulos[nomeB]).toBe('Ensino de Matemática · SF');
  });

  // O código de uma letra só não é código: "A - Ensino" começa por uma palavra.
  test('não confunde uma letra solta com código de matrícula', () => {
    const rotulos = ctx.construirRotulosCurso([{ curso: 'A - Especialização em Ensino', campus: 'SSA' }]);
    expect(rotulos['A - Especialização em Ensino']).toBe('A - Especialização em Ensino');
  });

  test('todo curso do data.json ganha rótulo distinto', () => {
    const dados = require('../data.json').posgraduacao;
    const rotulos = ctx.construirRotulosCurso(dados);
    const valores = Object.values(rotulos);
    expect(valores.length).toBeGreaterThan(0);
    expect(new Set(valores).size).toBe(valores.length);
  });
});

describe('quebrarRotulo', () => {
  test('quebra por palavra, sem cortar no meio', () => {
    expect(ctx.quebrarRotulo('Ensino de Ciências Naturais', 20, 2))
      .toEqual(['Ensino de Ciências', 'Naturais']);
  });

  test('texto curto cabe em uma linha só', () => {
    expect(ctx.quebrarRotulo('Engenharia', 38, 2)).toEqual(['Engenharia']);
  });

  // Sem a marca, "…Transferencia de Tecnologia para" parecia o nome inteiro e
  // a palavra "Inovação" sumia sem deixar rastro.
  test('marca a última linha sempre que sobra texto', () => {
    const linhas = ctx.quebrarRotulo('Propriedade Intelectual e Transferencia de Tecnologia para Inovação', 38, 2);
    expect(linhas).toHaveLength(2);
    expect(linhas[1]).toMatch(/…$/);
  });

  test('não marca quando o texto coube inteiro', () => {
    expect(ctx.quebrarRotulo('Engenharia de Materiais', 38, 2)).toEqual(['Engenharia de Materiais']);
  });
});

describe('escaparHtml', () => {
  // Um nome com aspas quebraria o atributo value da <option>, e o filtro
  // pararia de casar com r.curso.
  test('escapa aspas e sinais de marcação', () => {
    expect(ctx.escaparHtml('Ciência é "Dez!" & Cia <b>'))
      .toBe('Ciência é &quot;Dez!&quot; &amp; Cia &lt;b&gt;');
  });
});

// ─── Rótulos do gráfico "Alunos por Programa" ────────────────────────────────

describe('categoriasPorCurso', () => {
  test('junta as modalidades de cada programa', () => {
    const mapa = ctx.categoriasPorCurso([
      { curso: 'A', categoria: 'Mestrado' },
      { curso: 'A', categoria: 'Mestrado' },
      { curso: 'B', categoria: 'Especialização' }
    ]);
    expect([...mapa['A']]).toEqual(['Mestrado']);
    expect([...mapa['B']]).toEqual(['Especialização']);
  });

  // O mesmo nome de curso pode aparecer com modalidades diferentes entre campi.
  // Escolher uma delas esconderia a outra do rótulo.
  test('guarda as duas quando o mesmo nome tem modalidades diferentes', () => {
    const mapa = ctx.categoriasPorCurso([
      { curso: 'A', categoria: 'Mestrado' },
      { curso: 'A', categoria: 'Doutorado' }
    ]);
    expect([...mapa['A']].sort()).toEqual(['Doutorado', 'Mestrado']);
  });

  test('ignora registro sem curso', () => {
    expect(ctx.categoriasPorCurso([{ curso: '  ', categoria: 'Mestrado' }])).toEqual({});
  });
});

describe('rotuloDePrograma', () => {
  // A cor da barra sozinha não basta: impressa em preto e branco, ou para quem
  // não distingue as cores, o gráfico deixaria de dizer qual é a modalidade.
  test('a modalidade fica numa linha própria, depois do nome', () => {
    const linhas = ctx.rotuloDePrograma(
      'MESTRADO EM ENGENHARIA DE MATERIAIS',
      { 'MESTRADO EM ENGENHARIA DE MATERIAIS': 'Engenharia de Materiais' },
      { 'MESTRADO EM ENGENHARIA DE MATERIAIS': new Set(['Mestrado']) },
      52
    );
    expect(linhas[linhas.length - 1]).toBe('(Mestrado)');
    expect(linhas.slice(0, -1).join(' ')).toBe('Engenharia de Materiais');
  });

  test('o nome longo quebra em duas linhas antes da modalidade', () => {
    const nome = 'Propriedade Intelectual e Transferencia de Tecnologia para Inovação';
    const linhas = ctx.rotuloDePrograma('X', { X: nome }, { X: new Set(['Mestrado']) }, 38);
    expect(linhas).toHaveLength(3);
    expect(linhas[1]).toMatch(/…$/);
    expect(linhas[2]).toBe('(Mestrado)');
  });

  test('sem categoria conhecida sobra só o nome', () => {
    expect(ctx.rotuloDePrograma('X', { X: 'Curso X' }, {}, 52)).toEqual(['Curso X']);
  });
});

// A largura do rótulo e a do eixo andam juntas. Quando não andavam, o rótulo
// quebrado em 52 caracteres transbordava o eixo de 150 px do celular e saía
// cortado pela borda esquerda do cartão.
describe('largura do eixo e do rótulo', () => {
  test('o eixo fica em torno de 45% da largura, com piso e teto', () => {
    expect(ctx.larguraDoEixoPrograma(800)).toBe(360);
    expect(ctx.larguraDoEixoPrograma(300)).toBe(150);   // piso
    expect(ctx.larguraDoEixoPrograma(2000)).toBe(440);  // teto
  });

  test('sem largura conhecida usa a de uma tela comum', () => {
    expect(ctx.larguraDoEixoPrograma(0)).toBe(360);
    expect(ctx.larguraDoEixoPrograma(undefined)).toBe(360);
  });

  test('o rótulo nunca pede mais caracteres do que o eixo comporta', () => {
    [300, 420, 800, 1440, 2000].forEach(tela => {
      const eixo = ctx.larguraDoEixoPrograma(tela);
      expect(ctx.caracteresDoRotuloPrograma(eixo) * 6.2).toBeLessThanOrEqual(eixo);
    });
  });
});
