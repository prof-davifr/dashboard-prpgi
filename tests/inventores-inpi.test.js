/**
 * Comparação de nomes de inventores do INPI com as bases locais
 * (scripts/inventores-inpi.js). Os nomes abaixo são inventados.
 */

const { tokens, chaveNome, acharPessoa, porPrenomeUltimo } = require('../scripts/inventores-inpi');

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
