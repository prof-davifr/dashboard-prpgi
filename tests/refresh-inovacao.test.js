// scripts/refresh-inovacao.js — troca da fonte da aba Inovação, do Lattes para o INPI.
//
// O que estes testes protegem:
//   - a cascata de campus, porque o INPI não informa campus em lugar nenhum;
//   - o fan-out por autor, que mantém o KPI "p/ Servidor" correto;
//   - a guarda de LGPD, porque o CSV do INPI traz nomes por extenso e o
//     data.json é servido publicamente pelo GitHub Pages.

const {
  TIPO_POR_BASE, anoDe, chaveINPI, normalizeName,
  indexarLattes, resolverVinculos, converter, conferirLGPD,
} = require('../scripts/refresh-inovacao');

// ─── utilidades ──────────────────────────────────────────────────────────────

describe('anoDe', () => {
  test('tira o ano de uma data dd/mm/aaaa do INPI', () => {
    expect(anoDe('21/05/2024')).toBe('2024');
    expect(anoDe('04/01/2019')).toBe('2019');
  });

  test('valor ausente ou ilegível vira string vazia', () => {
    expect(anoDe('')).toBe('');
    expect(anoDe(null)).toBe('');
    expect(anoDe('sem data')).toBe('');
  });
});

describe('chaveINPI', () => {
  test('o espaçamento do INPI não muda a chave', () => {
    // O mesmo pedido aparece com espaçamentos diferentes entre as telas do
    // pePI, e o Lattes o registra em terceiro formato.
    expect(chaveINPI('BR 10 2024 010097 2')).toBe('1020240100972');
    expect(chaveINPI('BR1020240100972')).toBe('1020240100972');
    expect(chaveINPI('br 10 2024 010097-2')).toBe('1020240100972');
  });

  test('o prefixo do tipo sai da chave', () => {
    expect(chaveINPI('PI0802052-3')).toBe('08020523');
    expect(chaveINPI('MU8903003-6')).toBe('89030036');
  });
});

describe('normalizeName', () => {
  test('acento e caixa não impedem o casamento com a base do SUAP', () => {
    expect(normalizeName('VINÍCIUS SOUZA COSTA')).toBe('vinicius souza costa');
    expect(normalizeName('  Ana   Carolina  ')).toBe('ana carolina');
  });
});

// ─── cascata de campus ───────────────────────────────────────────────────────

const LATTES = [
  { Ano: '2024', Tipo: 'Software', campus: 'BAR', Servidor: '3074425',
    dedupKey: 'registrosoupatentesoftwarenumerodoregistrobr5120240039597dataderegistro22102024titulox' },
  { Ano: '2022', Tipo: 'Patente', campus: 'SSA', Servidor: '1111111',
    dedupKey: 'registrosoupatentepatentenumerodoregistrobr102022024466dataderegistro30112022titulos' },
];

describe('indexarLattes', () => {
  test('indexa pelo número INPI que está dentro do dedupKey', () => {
    const idx = indexarLattes(LATTES);
    expect(idx.get('5120240039597')).toEqual([{ Servidor: '3074425', campus: 'BAR' }]);
  });

  test('o mesmo número com dois servidores vira uma lista de dois', () => {
    const idx = indexarLattes([...LATTES, { ...LATTES[0], Servidor: '2222222', campus: 'VC' }]);
    expect(idx.get('5120240039597')).toHaveLength(2);
  });

  test('o mesmo servidor repetido não duplica', () => {
    const idx = indexarLattes([...LATTES, { ...LATTES[0] }]);
    expect(idx.get('5120240039597')).toHaveLength(1);
  });
});

describe('resolverVinculos', () => {
  const idxLattes = indexarLattes(LATTES);
  const mapaNomes = new Map([['vinicius souza costa', { Servidor: '9999999', campus: 'FS' }]]);
  const contexto = { idxLattes, mapaNomes, mapaSalvo: {} };

  test('nível 1: o número INPI casa com o Lattes e herda campus e servidor', () => {
    const r = resolverVinculos({ numeroPedido: 'BR 51 2024 003959 7' }, contexto);
    expect(r.nivel).toBe(1);
    expect(r.vinculos).toEqual([{ Servidor: '3074425', campus: 'BAR' }]);
  });

  test('nível 1: o mapa versionado responde quando o Lattes já não está lá', () => {
    // Depois da primeira troca de fonte, os registros do Lattes somem do
    // data.json. Sem o inpi-campus.json, o campus se perderia na execução
    // seguinte — e é essa a execução que roda no GitHub Actions.
    const r = resolverVinculos({ numeroPedido: 'BR 10 2019 000139 9' }, {
      idxLattes: new Map(), mapaNomes: null,
      mapaSalvo: { 1020190001399: [{ Servidor: '5555555', campus: 'JEQ' }] },
    });
    expect(r.nivel).toBe(1);
    expect(r.vinculos).toEqual([{ Servidor: '5555555', campus: 'JEQ' }]);
  });

  test('nível 2: sem número casado, o nome do autor resolve o SIAPE', () => {
    const r = resolverVinculos(
      { numeroPedido: 'BR 51 2026 006597 6', autores: 'VINÍCIUS SOUZA COSTA' }, contexto);
    expect(r.nivel).toBe(2);
    expect(r.vinculos).toEqual([{ Servidor: '9999999', campus: 'FS' }]);
  });

  test('nível 2: autor que não é do IFBA é ignorado, não inventa vínculo', () => {
    const r = resolverVinculos(
      { numeroPedido: 'BR 51 2026 000000 0', autores: 'PESSOA DE FORA' }, contexto);
    expect(r.nivel).toBe(3);
    expect(r.vinculos).toEqual([]);
  });

  test('nível 3: sem dados/, o nível 2 fica desligado e o registro fica sem campus', () => {
    const r = resolverVinculos(
      { numeroPedido: 'BR 51 2026 006597 6', autores: 'VINÍCIUS SOUZA COSTA' },
      { idxLattes: new Map(), mapaNomes: null, mapaSalvo: {} });
    expect(r.nivel).toBe(3);
    expect(r.vinculos).toEqual([]);
  });
});

// ─── conversão ───────────────────────────────────────────────────────────────

describe('converter', () => {
  const contexto = { idxLattes: indexarLattes(LATTES), mapaNomes: null, mapaSalvo: {} };

  test('cada rótulo do CSV vira o Tipo que a aba exibe', () => {
    const linhas = Object.keys(TIPO_POR_BASE).map((base, i) => ({
      base, numeroPedido: `BR 10 2020 00000${i} 0`, dataDeposito: '01/01/2020',
    }));
    const { inovacao } = converter(linhas, contexto);
    expect(inovacao.map((r) => r.Tipo).sort())
      .toEqual(['Desenho Industrial', 'Marca', 'Patente', 'Software']);
  });

  test('um registro com dois autores vira dois registros', () => {
    // É o mesmo fan-out de coautoria de build.js. Sem ele, o KPI "p/ Servidor"
    // contaria uma pessoa onde há duas.
    const mapaNomes = new Map([
      ['ana carolina', { Servidor: '111', campus: 'SSA' }],
      ['joao silva', { Servidor: '222', campus: 'VC' }],
    ]);
    const { inovacao } = converter(
      [{ base: 'programa', numeroPedido: 'BR 51 2026 000001 0', dataDeposito: '13/08/2026',
         autores: 'ANA CAROLINA / JOÃO SILVA' }],
      { idxLattes: new Map(), mapaNomes, mapaSalvo: {} });
    expect(inovacao).toHaveLength(2);
    expect(inovacao.map((r) => r.campus).sort()).toEqual(['SSA', 'VC']);
    expect(new Set(inovacao.map((r) => r.dedupKey)).size).toBe(1);
  });

  test('sem vínculo, o campo campus não é emitido', () => {
    // `validate-data.js` filtra com `.filter(Boolean)`, então a ausência passa.
    // Um código inventado como "NA" quebraria CODIGOS_VALIDOS.
    const { inovacao } = converter(
      [{ base: 'marca', numeroPedido: '942841395', dataDeposito: '25/02/2026' }],
      { idxLattes: new Map(), mapaNomes: null, mapaSalvo: {} });
    expect(inovacao[0]).not.toHaveProperty('campus');
    expect(inovacao[0]).not.toHaveProperty('Servidor');
    expect(inovacao[0].Ano).toBe('2026');
  });

  test('a contagem por nível fecha com o total de linhas', () => {
    const linhas = [
      { base: 'patente', numeroPedido: 'BR 10 2022 024466 0', dataDeposito: '30/11/2022' },
      { base: 'marca', numeroPedido: '942841395', dataDeposito: '25/02/2026' },
    ];
    const { porNivel } = converter(linhas, contexto);
    expect(porNivel[1] + porNivel[2] + porNivel[3]).toBe(linhas.length);
  });

  test('base desconhecida no CSV aborta em vez de sumir com a linha', () => {
    expect(() => converter([{ base: 'cultivar', numeroPedido: 'X1' }], contexto))
      .toThrow(/base desconhecida/);
  });

  test('número de pedido ilegível aborta', () => {
    expect(() => converter([{ base: 'marca', numeroPedido: '' }], contexto))
      .toThrow(/ilegível/);
  });
});

// ─── LGPD ────────────────────────────────────────────────────────────────────

describe('conferirLGPD', () => {
  test('aceita o registro que só tem código, ano e rótulo', () => {
    expect(() => conferirLGPD([
      { Ano: '2024', Tipo: 'Software', campus: 'BAR', Servidor: '3074425', dedupKey: '5120240039597' },
      { Ano: '2026', Tipo: 'Marca', dedupKey: '942841395', Situacao: 'Aguardando exame de mérito' },
    ])).not.toThrow();
  });

  test('recusa o nome do autor que escapou para um campo', () => {
    expect(() => conferirLGPD([
      { Ano: '2024', Tipo: 'Software', dedupKey: '512', Servidor: 'VINÍCIUS SOUZA COSTA' },
    ])).toThrow(/dado pessoal/);
  });

  test('recusa o titular por extenso', () => {
    expect(() => conferirLGPD([
      { Ano: '2024', Tipo: 'Patente', dedupKey: '102', titular: 'INSTITUTO FEDERAL DA BAHIA' },
    ])).toThrow(/dado pessoal/);
  });
});
