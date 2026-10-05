// Tests for scripts/extrair-nit.js and the committed nit-estrutura.json
const fs = require('fs');
const path = require('path');

const { numeroInpi, campusDaEstrutura, extrairEstruturas } = require('../scripts/extrair-nit');
const { CODIGOS_VALIDOS } = require('../scripts/validate-data');

describe('numeroInpi', () => {
  test('deixa só os dígitos, como o dedupKey de inovacao', () => {
    expect(numeroInpi('BR 10 2024 010097 2')).toBe('1020240100972');
    expect(numeroInpi('PI 1106612-1')).toBe('11066121');
    expect(numeroInpi(819210110)).toBe('819210110');
    expect(numeroInpi(null)).toBe('');
  });
});

describe('campusDaEstrutura', () => {
  test('converte as grafias da planilha para o código do painel', () => {
    expect(campusDaEstrutura('SSA')).toBe('SSA');
    expect(campusDaEstrutura('FSA')).toBe('FS');
    expect(campusDaEstrutura('VDC')).toBe('VC');
    expect(campusDaEstrutura('Seabra')).toBe('SEA');
    expect(campusDaEstrutura('REI')).toBe('REI');
  });

  test('situação escrita na coluna de estrutura não vira campus', () => {
    expect(campusDaEstrutura('INDEFERIDA')).toBeNull();
    expect(campusDaEstrutura('ARQUIVADO')).toBeNull();
    expect(campusDaEstrutura(null)).toBeNull();
  });
});

describe('extrairEstruturas', () => {
  test('guarda só tipo, situação e estrutura — nenhuma outra coluna passa', () => {
    const out = extrairEstruturas([
      { num_inpi_ativo_pesq: 'BR 10 2024 010097 2', tipo_ativo_pesq: 'Patente de Invenção',
        sit_registro_ativo_pesq: 'Ativo', estrutura: 'SSA', id_ativo_pesq: 6022, titular_inpi_ativo_pesq: true },
      { num_inpi_ativo_pesq: null, estrutura: 'SSA' }
    ]);
    expect(out).toEqual({
      '1020240100972': { tipo: 'Patente de Invenção', situacao: 'Ativo', estrutura: 'SSA', campus: 'SSA' }
    });
  });
});

describe('nit-estrutura.json versionado', () => {
  const arquivo = path.join(__dirname, '..', 'nit-estrutura.json');
  const { ativos } = JSON.parse(fs.readFileSync(arquivo, 'utf8'));

  test('cada ativo tem só os campos esperados e campus válido', () => {
    const permitidos = new Set(['tipo', 'situacao', 'estrutura', 'campus']);
    for (const [numero, ativo] of Object.entries(ativos)) {
      expect(numero).toMatch(/^\d+$/);
      for (const campo of Object.keys(ativo)) expect(permitidos.has(campo)).toBe(true);
      if (ativo.campus) expect(CODIGOS_VALIDOS.has(ativo.campus)).toBe(true);
    }
  });
});
