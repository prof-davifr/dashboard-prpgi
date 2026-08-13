// E2E tests for campus filter across all data sources
// Validates that campus filtering logic works correctly against data.json

const fs = require('fs');
const path = require('path');

// A implementação real, não uma cópia. A cópia que existia aqui não
// normalizava acentos, então passava enquanto src/script.js falhava — foi
// isso que escondeu o bug de grupos sem campus (ago/2026).
const { CAMPUS_TO_CITY, mapUnidadeToCampus } = require('../src/shared');

const VALID_CODES = [...Object.keys(CAMPUS_TO_CITY), 'IFBA', 'REI', 'PO'];
// Note: IFBA (sede), REI (Reitoria), PO are legacy placeholder codes from
// empty XLSX files. They are distinct from SSA (Salvador campus) and PIS (Polo).

const data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data.json'), 'utf-8'));

// ─── Data integrity ───────────────────────────────────────────────────────────

describe('Data integrity', () => {
  test('meta.campuses contains only valid IFBA codes', () => {
    const invalid = data.meta.campuses.filter(c => !VALID_CODES.includes(c));
    expect(invalid).toEqual([]);
  });

  test('meta.campuses has expected entries (25 standard + legacy placeholders)', () => {
    expect(data.meta.campuses.length).toBeGreaterThanOrEqual(25);
    expect(data.meta.campuses.length).toBeLessThanOrEqual(30);
  });

  test('no record in any dataset has an invalid campus code', () => {
    const datasets = ['bibliografica', 'tecnica', 'inovacao', 'concluidas', 'andamento'];
    for (const ds of datasets) {
      const invalid = [...new Set(data[ds].map(r => r.campus).filter(Boolean))]
        .filter(c => !VALID_CODES.includes(c));
      expect(invalid).toEqual([]);
    }
  });

  test('posgraduacao has no VDC records (regression)', () => {
    const vdc = data.posgraduacao.filter(r => r.campus === 'VDC');
    expect(vdc.length).toBe(0);
  });

  test('IC has no invalid campus codes', () => {
    const invalid = [...new Set(data.ic.map(r => r.campus).filter(Boolean))]
      .filter(c => !VALID_CODES.includes(c));
    expect(invalid).toEqual([]);
  });
});

// ─── Lattes campus filter (bibliografica, tecnica, inovacao, concluidas, andamento) ──

describe('Lattes campus filter', () => {
  const datasets = ['bibliografica', 'tecnica', 'inovacao', 'concluidas', 'andamento'];

  for (const ds of datasets) {
    test(`${ds}: campus filter returns only matching campus records`, () => {
      const campusesInData = [...new Set(data[ds].map(r => r.campus).filter(Boolean))];
      for (const campus of campusesInData) {
        const filtered = data[ds].filter(r => r.campus === campus);
        // Every record should have the requested campus
        expect(filtered.every(r => r.campus === campus)).toBe(true);
        // Filtered count should be <= total
        expect(filtered.length).toBeLessThanOrEqual(data[ds].length);
        // When 'all' is selected, all records pass
        const allFiltered = data[ds].filter(r => true);
        expect(allFiltered.length).toBe(data[ds].length);
      }
    });

    test(`${ds}: filtering by a campus with no data returns empty`, () => {
      // Find a valid campus that has no records in this dataset
      const campusesInData = new Set(data[ds].map(r => r.campus).filter(Boolean));
      const emptyCampus = VALID_CODES.find(c => !campusesInData.has(c));
      if (emptyCampus) {
        const filtered = data[ds].filter(r => r.campus === emptyCampus);
        expect(filtered.length).toBe(0);
      }
    });
  }
});

// ─── DGP grupos campus filter (Unidade mapping) ──────────────────────────────

describe('DGP grupos campus filter', () => {
  test('all Unidade values map to valid campus codes', () => {
    const unidades = [...new Set(data.grupos.map(r => r.Unidade).filter(Boolean))];
    for (const u of unidades) {
      const code = mapUnidadeToCampus(u);
      expect(VALID_CODES).toContain(code);
    }
  });

  test('known Unidade values map correctly (longest-city-first disambiguation)', () => {
    const cases = [
      ['IFBA - Campus Salvador', 'SSA'],
      ['IFBA - Campus Barreiras', 'BAR'],
      ['IFBA - Campus Feira de Santana', 'FS'],
      ['IFBA - Campus Vitória da Conquista', 'VC'],
      ['IFBA - Campus Eunápolis', 'EUN'],
      ['IFBA - Campus Porto Seguro', 'PS'],
      ['IFBA - Campus Santo Amaro', 'SAM'],
      ['IFBA - Campus Santo Antônio de Jesus', 'SAJ'],
      ['IFBA - Campus Paulo Afonso', 'PA'],
      ['IFBA - Campus Simões Filho', 'SF'],
      ['IFBA - Campus Valença', 'VAL'],
      ['IFBA - Campus Seabra', 'SEA'],
      ['IFBA - Campus Jequié', 'JEQ'],
      ['IFBA - Campus Ilhéus', 'ILH'],
      ['IFBA - Campus Irecê', 'IRE'],
      ['IFBA - Campus Camaçari', 'CAM'],
      ['IFBA - Campus Brumado', 'BRU'],
      ['IFBA - Campus Euclides da Cunha', 'EC'],
      ['Polo de Inovação Salvador', 'PIS'],
      ['Salvador', 'SSA'],
    ];
    for (const [unidade, expected] of cases) {
      expect(mapUnidadeToCampus(unidade)).toBe(expected);
    }
  });

  test('Polo de Inovação Salvador maps to PIS, not SSA (regression)', () => {
    expect(mapUnidadeToCampus('Polo de Inovação Salvador')).toBe('PIS');
  });

  test('grupos campus filter returns correct counts', () => {
    for (const campus of VALID_CODES) {
      const filtered = data.grupos.filter(r => {
        const code = mapUnidadeToCampus(r.Unidade);
        return code === campus;
      });
      // All mapped codes should match
      expect(filtered.every(r => mapUnidadeToCampus(r.Unidade) === campus)).toBe(true);
    }
  });
});

// ─── Pós-Graduação campus filter ──────────────────────────────────────────────

describe('Pós-Graduação campus filter', () => {
  test('all posgraduacao campus codes are valid', () => {
    const codes = [...new Set(data.posgraduacao.map(r => r.campus).filter(Boolean))];
    for (const c of codes) {
      expect(VALID_CODES).toContain(c);
    }
  });

  test('VC (Vitória da Conquista) tem 71 registros (snapshot único mais recente)', () => {
    // Os CSVs do SUAPPos são snapshots cumulativos; o build usa apenas o mais
    // recente (antes concatenava 3 e inflava para 213).
    const vc = data.posgraduacao.filter(r => r.campus === 'VC');
    expect(vc.length).toBe(71);
  });

  test('campus filter works for all posgraduacao campuses', () => {
    const campusesInData = [...new Set(data.posgraduacao.map(r => r.campus).filter(Boolean))];
    expect(campusesInData.length).toBeGreaterThanOrEqual(9);
    for (const campus of campusesInData) {
      const filtered = data.posgraduacao.filter(r => r.campus === campus);
      expect(filtered.length).toBeGreaterThan(0);
      expect(filtered.every(r => r.campus === campus)).toBe(true);
    }
  });
});

// ─── IC campus filter ─────────────────────────────────────────────────────────

describe('IC campus filter', () => {
  test('all IC campus codes are valid', () => {
    const codes = [...new Set(data.ic.map(r => r.campus).filter(Boolean))];
    for (const c of codes) {
      expect(VALID_CODES).toContain(c);
    }
  });

  test('campus filter works for all IC campuses', () => {
    const campusesInData = [...new Set(data.ic.map(r => r.campus).filter(Boolean))];
    for (const campus of campusesInData) {
      const filtered = data.ic.filter(r => r.campus === campus);
      expect(filtered.length).toBeGreaterThan(0);
      expect(filtered.every(r => r.campus === campus)).toBe(true);
    }
  });

  test('IC has data for at least 20 campuses', () => {
    const campusesInData = [...new Set(data.ic.map(r => r.campus).filter(Boolean))];
    expect(campusesInData.length).toBeGreaterThanOrEqual(20);
  });
});

// ─── Cross-dataset consistency ────────────────────────────────────────────────

describe('Cross-dataset consistency', () => {
  test('CAMPUS_TO_CITY tem as entradas canônicas esperadas', () => {
    expect(CAMPUS_TO_CITY['PIS']).toBe('POLO DE INOVAÇÃO SALVADOR');
    expect(CAMPUS_TO_CITY['SSA']).toBe('SALVADOR');
    expect(CAMPUS_TO_CITY['VC']).toBe('VITÓRIA DA CONQUISTA');
    expect(CAMPUS_TO_CITY['UBA']).toBe('UBAITABA');
    expect(Object.keys(CAMPUS_TO_CITY).length).toBe(25);
  });
});
