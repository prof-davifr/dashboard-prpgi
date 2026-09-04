// Testes do motor de exportação (src/export.js) e das nove planilhas do
// relatório de Pós-Graduação (src/posgraduacao.js).
//
// Nenhum teste toca no SheetJS: as funções cobertas aqui são puras e devolvem
// { nome, aoa }. Só baixarPastaExcel usa XLSX, e ela é a parte fina.
'use strict';

const { createBrowserContext, loadDashboard } = require('./helpers/browserEnv');

// Um recorte pequeno e conhecido: 3 campi, 3 programas, 3 categorias,
// 4 situações do SUAP em 3 grupos diferentes, 3 anos de ingresso.
const ALUNOS = [
  { curso: 'MESTRADO PROFISSIONAL EM ENGENHARIA', curso_original: '64 - MESTRADO PROFISSIONAL EM ENGENHARIA (Salvador)', campus: 'SSA', polo: '', situacao: 'Concluído', ano: 2020, semestre: 1, ano_periodo: '2020.1', modalidade: 'Mestrado', categoria: 'Mestrado', dedupKey: 'aaa1' },
  { curso: 'MESTRADO PROFISSIONAL EM ENGENHARIA', curso_original: '64 - MESTRADO PROFISSIONAL EM ENGENHARIA (Salvador)', campus: 'SSA', polo: '', situacao: 'Matriculado', ano: 2021, semestre: 2, ano_periodo: '2021.2', modalidade: 'Mestrado', categoria: 'Mestrado', dedupKey: 'aaa2' },
  { curso: 'DOUTORADO EM CIENCIA DE MATERIAIS', curso_original: '70 - DOUTORADO EM CIENCIA DE MATERIAIS (Salvador)', campus: 'SSA', polo: '', situacao: 'Trancado', ano: 2021, semestre: 1, ano_periodo: '2021.1', modalidade: 'Doutorado', categoria: 'Doutorado', dedupKey: 'aaa3' },
  { curso: 'ESPECIALIZACAO EM DOCENCIA', curso_original: '12 - ESPECIALIZACAO EM DOCENCIA (Vitória da Conquista)', campus: 'VC', polo: 'Brumado', situacao: 'Cancelado', ano: 2022, semestre: 1, ano_periodo: '2022.1', modalidade: 'Especialização', categoria: 'Especialização', dedupKey: 'aaa4' },
  { curso: 'ESPECIALIZACAO EM DOCENCIA', curso_original: '12 - ESPECIALIZACAO EM DOCENCIA (Feira de Santana)', campus: 'FS', polo: '', situacao: 'Matriculado', ano: 2022, semestre: 2, ano_periodo: '2022.2', modalidade: 'Especialização', categoria: 'Especialização', dedupKey: 'aaa5' }
];

let ctx;
const aba = (abas, nome) => abas.find(a => a.nome === nome);

beforeAll(() => {
  ctx = createBrowserContext();
  loadDashboard(ctx);
});

// ─── Motor genérico ──────────────────────────────────────────────────────────

describe('abaDeObjetos', () => {
  test('respeita a ordem das colunas', () => {
    const { aoa } = ctx.abaDeObjetos('X', [
      { titulo: 'B', valor: r => r.b },
      { titulo: 'A', valor: r => r.a }
    ], [{ a: 1, b: 2 }]);

    expect(aoa[0]).toEqual(['B', 'A']);
    expect(aoa[1]).toEqual([2, 1]);
  });

  // Célula undefined vira '' e não `undefined`: o XLSX gravaria a string.
  test('campo ausente vira célula vazia', () => {
    const { aoa } = ctx.abaDeObjetos('X', [{ titulo: 'A', valor: r => r.naoExiste }], [{}]);
    expect(aoa[1]).toEqual(['']);
  });

  test('sem registros sobra só o cabeçalho', () => {
    const { aoa } = ctx.abaDeObjetos('X', [{ titulo: 'A', valor: r => r.a }], []);
    expect(aoa).toEqual([['A']]);
  });
});

describe('nomeArquivoComCarimbo', () => {
  test('acrescenta data e hora à base', () => {
    expect(ctx.nomeArquivoComCarimbo('Base', new Date(2026, 8, 4, 7, 5)))
      .toBe('Base_2026-09-04_0705');
  });

  test('o formato casa com o que o teste e2e espera', () => {
    expect(ctx.nomeArquivoComCarimbo('PosGraduacao_IFBA'))
      .toMatch(/^PosGraduacao_IFBA_\d{4}-\d{2}-\d{2}_\d{4}$/);
  });
});

// O Excel recusa nome de planilha com mais de 31 caracteres, com : \ / ? * [ ]
// ou repetido. Errar qualquer um dos três gera um arquivo que não abre.
describe('sanearNomeDeAba', () => {
  test('corta em 31 caracteres', () => {
    const nome = ctx.sanearNomeDeAba('A'.repeat(50), new Set());
    expect(nome).toHaveLength(31);
  });

  test('tira os caracteres proibidos', () => {
    expect(ctx.sanearNomeDeAba('Campus x Ano [2026]/2', new Set()))
      .toBe('Campus x Ano 2026 2');
  });

  test('desempata nome repetido', () => {
    const usados = new Set();
    expect(ctx.sanearNomeDeAba('Dados', usados)).toBe('Dados');
    expect(ctx.sanearNomeDeAba('Dados', usados)).toBe('Dados (2)');
    expect(ctx.sanearNomeDeAba('Dados', usados)).toBe('Dados (3)');
  });
});

// ─── Planilhas da Pós-Graduação ──────────────────────────────────────────────

describe('abasPosGraduacao', () => {
  let abas;

  beforeAll(() => {
    abas = ctx.abasPosGraduacao(ALUNOS, [['Período', 'Todo o Período']], [['Categoria', 'Todas as Categorias']]);
  });

  test('monta as nove planilhas, na ordem', () => {
    expect(abas.map(a => a.nome)).toEqual([
      'Filtros', 'Resumo', 'Alunos por Campus', 'Cursos por Campus',
      'Situacao', 'Programas', 'Ingressos por Ano', 'Campus x Ano', 'Dados'
    ]);
  });

  test('a capa registra os filtros recebidos e o tamanho do recorte', () => {
    const linhas = aba(abas, 'Filtros').aoa;
    expect(linhas).toContainEqual(['Período', 'Todo o Período']);
    expect(linhas).toContainEqual(['Categoria', 'Todas as Categorias']);
    expect(linhas).toContainEqual(['Alunos no recorte', 5]);
  });

  test('o Resumo traz os seis indicadores dos KPIs', () => {
    const aoa = aba(abas, 'Resumo').aoa;
    expect(aoa[0]).toEqual(['Indicador', 'Valor', 'Definição']);

    const valor = rotulo => aoa.slice(1).find(l => l[0] === rotulo)[1];
    expect(valor('Alunos')).toBe(5);
    expect(valor('Matriculados')).toBe(2);
    expect(valor('Concluintes')).toBe(1);
    expect(valor('Evadidos')).toBe(1); // Cancelado
    expect(valor('Cursos')).toBe(3);
    expect(valor('Campi')).toBe(3);
  });

  test('Alunos por Campus abre uma coluna por categoria e fecha o total', () => {
    const aoa = aba(abas, 'Alunos por Campus').aoa;
    expect(aoa[0].slice(0, 2)).toEqual(['Campus', 'Cidade']);
    expect(aoa[0][aoa[0].length - 1]).toBe('Total');
    expect(aoa).toHaveLength(4); // cabeçalho + FS, SSA, VC

    const ssa = aoa.find(l => l[0] === 'SSA');
    expect(ssa[1]).toBe(ctx.CAMPUS_TO_CITY.SSA);
    expect(ssa[ssa.length - 1]).toBe(3);
  });

  test('Cursos por Campus conta programas distintos, não alunos', () => {
    const aoa = aba(abas, 'Cursos por Campus').aoa;
    expect(aoa[0]).toEqual(['Campus', 'Cidade', 'Cursos distintos']);
    expect(aoa.find(l => l[0] === 'SSA')[2]).toBe(2); // 3 alunos, 2 programas
  });

  // A aba traz o grupo e a situação bruta do SUAP. É o que torna a regra de
  // agrupamento auditável — o ponto sensível desta aba do painel.
  test('Situação mostra os cinco grupos e as situações de origem', () => {
    const aoa = aba(abas, 'Situacao').aoa;

    const grupos = ctx.POSGRAD_BUCKETS || ['Matriculado', 'Concluinte', 'Aperfeiçoado', 'Evadido', 'Outros'];
    grupos.forEach(g => expect(aoa.some(l => l[0] === g)).toBe(true));
    expect(aoa.find(l => l[0] === 'Total')[1]).toBe(5);

    const bruta = aoa.slice(aoa.findIndex(l => l[0] === 'Situação no SUAP') + 1);
    expect(bruta.find(l => l[0] === 'Trancado')).toEqual(['Trancado', 'Outros', 1, 20]);
  });

  test('Programas lista todos os cursos, com o nome do SUAP e os campi', () => {
    const aoa = aba(abas, 'Programas').aoa;
    expect(aoa[0]).toEqual(['Programa', 'Nome no SUAP', 'Categoria', 'Campi', 'Alunos']);
    expect(aoa).toHaveLength(4); // cabeçalho + 3 programas

    const docencia = aoa.find(l => l[1] === 'ESPECIALIZACAO EM DOCENCIA');
    expect(docencia[3]).toBe('FS, VC');
    expect(docencia[4]).toBe(2);
  });

  test('Ingressos por Ano usa o ano de entrada como número', () => {
    const aoa = aba(abas, 'Ingressos por Ano').aoa;
    expect(aoa[0][0]).toBe('Ano de ingresso');
    expect(aoa.slice(1).map(l => l[0])).toEqual([2020, 2021, 2022]);
    expect(aoa.find(l => l[0] === 2021)[aoa[0].length - 1]).toBe(2);
  });

  test('Campus x Ano repete a tabela da tela', () => {
    const aoa = aba(abas, 'Campus x Ano').aoa;
    expect(aoa[0]).toEqual(['Campus', 'Cidade', 2020, 2021, 2022, 'Total']);
    expect(aoa.find(l => l[0] === 'SSA')).toEqual(['SSA', ctx.CAMPUS_TO_CITY.SSA, 1, 2, 0, 3]);
  });

  test('Dados traz uma linha por aluno e os campos que a tela não mostra', () => {
    const { aoa } = aba(abas, 'Dados');
    expect(aoa).toHaveLength(ALUNOS.length + 1);

    ['Nome completo na origem', 'Polo', 'Modalidade', 'Semestre', 'Ano/Período']
      .forEach(c => expect(aoa[0]).toContain(c));

    const vc = aoa.find(l => l[0] === 'VC');
    expect(vc[aoa[0].indexOf('Polo')]).toBe('Brumado');
    expect(vc[aoa[0].indexOf('Grupo de situação')]).toBe('Evadido');
  });

  // LGPD: data.json é público e não tem esses campos; a planilha também não
  // pode inventá-los. O dedupKey existe no registro, é um pseudônimo salgado, e
  // fica de fora de propósito.
  test('Dados não exporta nome, matrícula, e-mail nem dedupKey', () => {
    const cabecalho = aba(abas, 'Dados').aoa[0].join(' ').toLowerCase();
    ['nome do aluno', 'matr', 'e-mail', 'email', 'dedup'].forEach(proibido => {
      expect(cabecalho).not.toContain(proibido);
    });
  });

  // Se as três planilhas discordarem, o leitor não sabe em qual acreditar.
  test('os totais fecham entre Campus x Ano, Alunos por Campus e Dados', () => {
    const somaTotal = nome => {
      const aoa = aba(abas, nome).aoa;
      const iTotal = aoa[0].indexOf('Total');
      return aoa.slice(1).reduce((s, l) => s + l[iTotal], 0);
    };

    expect(somaTotal('Campus x Ano')).toBe(ALUNOS.length);
    expect(somaTotal('Alunos por Campus')).toBe(ALUNOS.length);
    expect(aba(abas, 'Dados').aoa).toHaveLength(ALUNOS.length + 1);
  });

  test('recorte vazio ainda produz as nove planilhas, só com cabeçalho', () => {
    const vazias = ctx.abasPosGraduacao([], [], []);
    expect(vazias).toHaveLength(9);
    expect(aba(vazias, 'Dados').aoa).toHaveLength(1);
    expect(aba(vazias, 'Filtros').aoa).toContainEqual(['Alunos no recorte', 0]);
  });
});

// ─── resumoPosGraduacao ──────────────────────────────────────────────────────

describe('resumoPosGraduacao', () => {
  test('o mesmo programa em dois campi conta um curso só', () => {
    expect(ctx.resumoPosGraduacao(ALUNOS).cursos).toBe(3);
  });

  test('aguenta lista vazia e ausente', () => {
    expect(ctx.resumoPosGraduacao([]).alunos).toBe(0);
    expect(ctx.resumoPosGraduacao(undefined).campi).toBe(0);
  });
});
