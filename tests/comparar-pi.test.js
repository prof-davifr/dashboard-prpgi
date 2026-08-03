// Testes da validação de Propriedade Intelectual (DINOV × Dashboard).
//
// Antes, `scripts/comparar_pi.js` era conferido a olho: rodava-se o script e
// lia-se o relatório. As funções de casamento (normalização de número INPI,
// extração do número a partir da chave do Dashboard, mapeamento de tipo e
// campus) são puras e valem um teste.
//
// A comparação de ponta a ponta depende da planilha da DINOV, que mora em
// dados/ (não versionada, por conter dados pessoais). Esses testes se
// autodesabilitam quando a planilha não está presente — é o caso do CI.

const fs = require('fs');
const path = require('path');

const {
  normalizeINPI,
  extractDashboardNumber,
  mapTipoDashboard,
  mapCampusCSV,
  CSV_PATH
} = require('../scripts/comparar_pi');

// ─── normalizeINPI ───────────────────────────────────────────────────────────

describe('normalizeINPI', () => {
  test('remove pontuação e o prefixo de tipo', () => {
    expect(normalizeINPI('PI0802052-3')).toEqual(['08020523']);
    expect(normalizeINPI('BR 102012007763-9')).toEqual(['1020120077639']);
  });

  test('separa múltiplos registros na mesma célula', () => {
    expect(normalizeINPI('MU8903003-6/ PI 0925423-4')).toEqual(['89030036', '09254234']);
  });

  test('normaliza formatos diferentes do mesmo número para a mesma chave', () => {
    const [a] = normalizeINPI('BR 512013001203-1');
    const [b] = normalizeINPI('br5120130012031');
    expect(a).toBe(b);
  });

  test('trata entradas vazias', () => {
    expect(normalizeINPI('')).toEqual([]);
    expect(normalizeINPI(null)).toEqual([]);
    expect(normalizeINPI(undefined)).toEqual([]);
    expect(normalizeINPI('   ')).toEqual([]);
  });

  test('descarta partes que só tinham prefixo', () => {
    expect(normalizeINPI('PI/')).toEqual([]);
  });
});

// ─── extractDashboardNumber ──────────────────────────────────────────────────

describe('extractDashboardNumber', () => {
  // A chave de `inovacao` é mantida longa justamente para isso — ver
  // scripts/build.js (shortKey).
  const chave = 'registrosoupatentesoftwarenumerodoregistrobr5120240039597dataderegistro2024';

  test('extrai o número entre os marcadores da chave', () => {
    expect(extractDashboardNumber(chave)).toEqual(['5120240039597']);
  });

  test('produz a mesma chave normalizada que o lado DINOV', () => {
    const [doDashboard] = extractDashboardNumber(chave);
    const [daDinov] = normalizeINPI('BR 512024003959-7');
    expect(doDashboard).toBe(daDinov);
  });

  test('retorna vazio quando a chave não tem número de registro', () => {
    expect(extractDashboardNumber('umtitulodepublicacaoqualquer')).toEqual([]);
    expect(extractDashboardNumber('')).toEqual([]);
    expect(extractDashboardNumber(null)).toEqual([]);
  });

  test('não casa com chaves curtas dos demais datasets', () => {
    expect(extractDashboardNumber('37c9a15262f008d1')).toEqual([]);
  });
});

// ─── mapTipoDashboard ────────────────────────────────────────────────────────

describe('mapTipoDashboard', () => {
  test('mapeia os tipos do Lattes para as siglas da DINOV', () => {
    expect(mapTipoDashboard('Patente')).toBe('PI');
    expect(mapTipoDashboard('Software')).toBe('SO');
    expect(mapTipoDashboard('Desenho Industrial')).toBe('DI');
    expect(mapTipoDashboard('Modelo de Utilidade')).toBe('MU');
  });

  test('absorve o typo "Desenho Insdustrial" presente na fonte', () => {
    expect(mapTipoDashboard('Desenho Insdustrial')).toBe('DI');
  });

  test('devolve o valor original quando não conhece o tipo', () => {
    expect(mapTipoDashboard('Cultivar')).toBe('Cultivar');
  });
});

// ─── mapCampusCSV ────────────────────────────────────────────────────────────

describe('mapCampusCSV', () => {
  test('resolve cidade → código, ignorando acento e caixa', () => {
    expect(mapCampusCSV('Salvador')).toBe('SSA');
    expect(mapCampusCSV('VITÓRIA DA CONQUISTA')).toBe('VC');
    expect(mapCampusCSV('vitoria da conquista')).toBe('VC');
    expect(mapCampusCSV('  Simões Filho  ')).toBe('SF');
  });

  test('reconhece as variantes vistas na planilha da DINOV', () => {
    expect(mapCampusCSV('Lauro')).toBe('LF');
    expect(mapCampusCSV('Polo Inovação')).toBe('PIS');
  });

  test('devolve null para valores não reconhecidos', () => {
    expect(mapCampusCSV('Cidade Inexistente')).toBeNull();
    expect(mapCampusCSV('')).toBeNull();
    expect(mapCampusCSV(null)).toBeNull();
  });
});

// ─── Integridade ponta a ponta (só com a planilha da DINOV disponível) ───────

// `describe.skip` não serve aqui: o Jest ainda executa o corpo do bloco para
// registrar os testes pulados, e a leitura da planilha estouraria. O `if`
// externo impede que o bloco chegue a ser definido.
const temCsvDinov = fs.existsSync(CSV_PATH);

if (!temCsvDinov) {
  describe('integridade DINOV × data.json', () => {
    test.skip('planilha da DINOV ausente (esperado no CI) — ver dados/validacao/', () => {});
  });
}

if (temCsvDinov) describe('integridade DINOV × data.json', () => {
  const XLSX = require('xlsx');
  const data = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'data.json'), 'utf-8')
  );

  const rows = (() => {
    const wb = XLSX.read(fs.readFileSync(CSV_PATH), { type: 'buffer', raw: false });
    return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
  })();

  test('a planilha da DINOV tem registros com número de INPI', () => {
    const comINPI = rows.filter(r => normalizeINPI(String(r['Nº INPI'] || '')).length > 0);
    expect(comINPI.length).toBeGreaterThan(100);
  });

  test('parte dos registros da DINOV é encontrada no dashboard', () => {
    const chavesDash = new Set(
      data.inovacao.flatMap(r => extractDashboardNumber(r.dedupKey))
    );
    const chavesDinov = new Set(
      rows.flatMap(r => normalizeINPI(String(r['Nº INPI'] || '')))
    );
    const casados = [...chavesDinov].filter(k => chavesDash.has(k));

    // 112 casamentos na base de ago/2026. O piso protege contra uma quebra
    // silenciosa da extração de chaves sem travar o número exato, que muda a
    // cada atualização das fontes.
    expect(casados.length).toBeGreaterThan(80);
  });

  test('os códigos de campus da DINOV que resolvem são válidos', () => {
    const { CAMPUS_TO_CITY } = require('../src/shared');
    const codigos = rows
      .map(r => mapCampusCSV(String(r['CAMPUS'] || '')))
      .filter(Boolean);
    expect(codigos.length).toBeGreaterThan(0);
    codigos.forEach(c => expect(Object.keys(CAMPUS_TO_CITY)).toContain(c));
  });
});
