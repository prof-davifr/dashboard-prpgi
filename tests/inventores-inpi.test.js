/**
 * Comparação de nomes de inventores do INPI com as bases locais
 * (scripts/inventores-inpi.js). Os nomes abaixo são inventados.
 */

const { tokens, chaveNome, acharPessoa, porPrenomeUltimo, ehAluno, mapaDeAlunos } = require('../scripts/inventores-inpi');

function base(...nomes) {
  const pessoas = new Map(nomes.map((n) => [chaveNome(n), { nome: n }]));
  return { pessoas, idx: porPrenomeUltimo(pessoas) };
}

describe('chaveNome', () => {
  test('ignora acento, caixa, pontuação e partículas', () => {
    expect(chaveNome('José da Conceição  dos Santos')).toBe('JOSE CONCEICAO SANTOS');
    expect(chaveNome('JOSE DA CONCEICAO DOS SANTOS')).toBe('JOSE CONCEICAO SANTOS');
    expect(tokens("Maria D'Ávila")).toEqual(['MARIA', 'AVILA']);
  });
});

describe('acharPessoa', () => {
  test('nome igual depois da normalização é exato', () => {
    const { pessoas, idx } = base('Tereza Quirino de Albuquerque');
    expect(acharPessoa('TEREZA QUIRINO DE ALBUQUERQUE', pessoas, idx).metodo).toBe('exato');
  });

  test('sobrenome omitido ou abreviado casa como aproximado', () => {
    const { pessoas, idx } = base('Tereza Quirino Lemos Albuquerque');
    expect(acharPessoa('Tereza Albuquerque', pessoas, idx).metodo).toBe('aproximado');
    expect(acharPessoa('Tereza Q. Albuquerque', pessoas, idx).metodo).toBe('aproximado');
  });

  test('sobrenome do INPI que falta na base impede o casamento', () => {
    const { pessoas, idx } = base('Tereza Quirino Albuquerque');
    expect(acharPessoa('Tereza Moura Albuquerque', pessoas, idx)).toBeNull();
  });

  test('duas pessoas possíveis: nenhuma é escolhida', () => {
    const { pessoas, idx } = base('Tereza Quirino Albuquerque', 'Tereza Lemos Albuquerque');
    expect(acharPessoa('Tereza Albuquerque', pessoas, idx)).toBeNull();
  });

  test('prenome sozinho não casa', () => {
    const { pessoas, idx } = base('Tereza Quirino Albuquerque');
    expect(acharPessoa('Tereza', pessoas, idx)).toBeNull();
  });
});

describe('leitura das listas do SUAP', () => {
  const { lerServidores, lerAlunos, buscar } = require('../scripts/buscar-inventores-suap');

  const servidor = '| [Visualizar](/rh/servidor/1234567/ "Ver Tereza Quirino Albuquerque (1234567)") |  | ' +
    'Tereza Quirino Albuquerque (1234567)  [t@x](mailto:t@x) | Cargo:  PROFESSOR  Situação:  ATIVO PERMANENTE - 01 | ' +
    'SIAPE Lotação:  DEPEN/VDC  SIAPE Exercício:  DEPEN/VDC  SUAP:  DEPEN/VDC |';
  const aluno = '| [Visualizar](/edu/aluno/202312340001/ "Ver Caio Teixeira Lemos (202312340001)") |  | ' +
    'CAIO TEIXEIRA LEMOS  Matrícula:  202312340001  Curso:  374 - Eletromecânica (Simões Filho)  Situação:  Matriculado | 2 | 2023 | - |';

  test('servidor: SIAPE, situação e campus da lotação', () => {
    expect(lerServidores(`## Servidores\n${servidor}\n`)).toEqual([{
      nome: 'Tereza Quirino Albuquerque', siape: '1234567', situacao: 'ATIVO PERMANENTE - 01',
      setor: 'DEPEN/VDC', campus: 'VC',
    }]);
  });

  test('aluno: matrícula, curso e campus pela cidade do curso', () => {
    const [a] = lerAlunos(aluno);
    expect(a).toMatchObject({ matricula: '202312340001', campus: 'SF', situacao: 'Matriculado' });
  });

  test('a busca só aceita nome igual: trecho parecido não conta', () => {
    const ler = (caminho) => (caminho.includes('servidor') ? servidor : '');
    expect(buscar('Tereza Quirino Albuquerque', ler).tipo).toBe('servidor');
    expect(buscar('Tereza Albuquerque', ler).tipo).toBe('nenhum');
  });
});

describe('mapaDeAlunos', () => {
  const linha = (numero, inventor, vinculo, siape = '') =>
    ({ 'Número INPI': numero, Inventor: inventor, 'Vínculo': vinculo, SIAPE: siape, 'Método': 'exato' });

  test('aluno é quem tem vínculo de aluno e não tem SIAPE', () => {
    expect(ehAluno(linha('1', 'X', 'Aluno (Formado)'))).toBe(true);
    expect(ehAluno(linha('1', 'X', 'Bolsista de IC'))).toBe(true);
    expect(ehAluno(linha('1', 'X', 'Aluno de pós-graduação', '1234567'))).toBe(false);
    expect(ehAluno(linha('1', 'X', 'Servidor'))).toBe(false);
  });

  test('um aluno em dois registros dá o mesmo pseudônimo, e nenhum nome sai', () => {
    const mapa = mapaDeAlunos([
      linha('BR 51 2026 000001 0', 'Caio Teixeira Lemos', 'Aluno (Formado)'),
      linha('BR 51 2026 000002 0', 'CAIO TEIXEIRA LEMOS', 'Estudante (DGP)'),
      linha('BR 51 2026 000002 0', 'Tereza Quirino Albuquerque', 'Servidor', '1234567'),
    ]);
    expect(Object.keys(mapa)).toEqual(['5120260000010', '5120260000020']);
    expect(mapa['5120260000010']).toEqual(mapa['5120260000020']);
    expect(JSON.stringify(mapa)).not.toMatch(/caio|tereza/i);
  });
});
