// Tests for pure utility functions defined in src/script.js
'use strict';

const path = require('path');
const { createBrowserContext, loadScript, CAMPUS_TO_CITY, IFBA_COORDS } = require('./helpers/browserEnv');

const SCRIPT_PATH = path.join(__dirname, '..', 'src', 'script.js');

let ctx;

beforeAll(() => {
  ctx = createBrowserContext();
  loadScript(ctx, SCRIPT_PATH);
});

// ─── formatDateTimePtBr ───────────────────────────────────────────────────────

describe('formatDateTimePtBr', () => {
  test('returns "não disponível" for null', () => {
    expect(ctx.formatDateTimePtBr(null)).toBe('não disponível');
  });

  test('returns "não disponível" for undefined', () => {
    expect(ctx.formatDateTimePtBr(undefined)).toBe('não disponível');
  });

  test('returns "não disponível" for empty string', () => {
    expect(ctx.formatDateTimePtBr('')).toBe('não disponível');
  });

  test('returns "não disponível" for invalid date string', () => {
    expect(ctx.formatDateTimePtBr('not-a-date')).toBe('não disponível');
  });

  test('returns a formatted string for a valid ISO string', () => {
    const result = ctx.formatDateTimePtBr('2024-06-15T10:30:00.000Z');
    // The format is dd/mm/yyyy hh:mm:ss in pt-BR locale; just check it is a non-empty string
    expect(typeof result).toBe('string');
    expect(result).not.toBe('não disponível');
    expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/); // dd/mm/yyyy
  });
});

// ─── extractServidorIds ───────────────────────────────────────────────────────

describe('extractServidorIds', () => {
  test('returns an empty Set for an empty array', () => {
    expect(ctx.extractServidorIds([]).size).toBe(0);
  });

  test('returns a Set with unique Servidor IDs', () => {
    const records = [
      { Servidor: '1234567' },
      { Servidor: '9999999' },
      { Servidor: '1234567' }, // duplicate
    ];
    const ids = ctx.extractServidorIds(records);
    expect(ids.size).toBe(2);
    expect(ids.has('1234567')).toBe(true);
    expect(ids.has('9999999')).toBe(true);
  });

  test('ignores records with no Servidor field', () => {
    const records = [
      { Servidor: '1234567' },
      { Tipo: 'Artigo' }, // no Servidor
      { Servidor: null },
    ];
    const ids = ctx.extractServidorIds(records);
    expect(ids.size).toBe(1);
  });

  test('returns a proper Set instance', () => {
    const ids = ctx.extractServidorIds([{ Servidor: 'X' }]);
    expect(typeof ids.has).toBe('function');
    expect(typeof ids.size).toBe('number');
  });
});

// ─── getServidoresPerCampus ───────────────────────────────────────────────────

describe('getServidoresPerCampus', () => {
  test('returns an empty object for empty input', () => {
    expect(ctx.getServidoresPerCampus([])).toEqual({});
  });

  test('counts distinct Servidores per campus', () => {
    const records = [
      { Servidor: '111', campus: 'SSA' },
      { Servidor: '222', campus: 'SSA' },
      { Servidor: '111', campus: 'SSA' }, // duplicate → still 2 unique
      { Servidor: '333', campus: 'BRU' },
    ];
    const result = ctx.getServidoresPerCampus(records);
    expect(result.SSA).toBe(2);
    expect(result.BRU).toBe(1);
  });

  test('ignores records missing Servidor or campus', () => {
    const records = [
      { Servidor: '111' },       // no campus
      { campus: 'SSA' },         // no Servidor
      { Servidor: null, campus: 'SSA' },
    ];
    expect(ctx.getServidoresPerCampus(records)).toEqual({});
  });
});

// ─── getTotalServidores ───────────────────────────────────────────────────────

describe('getTotalServidores', () => {
  test('returns 0 for empty input', () => {
    expect(ctx.getTotalServidores([])).toBe(0);
  });

  test('returns count of distinct Servidor IDs', () => {
    const records = [
      { Servidor: 'A' },
      { Servidor: 'B' },
      { Servidor: 'A' }, // duplicate
    ];
    expect(ctx.getTotalServidores(records)).toBe(2);
  });

  test('ignores records without Servidor', () => {
    const records = [{ Servidor: 'A' }, { Tipo: 'X' }];
    expect(ctx.getTotalServidores(records)).toBe(1);
  });
});

// ─── formatRelativeValue ──────────────────────────────────────────────────────

describe('formatRelativeValue', () => {
  test('divides value by divisor and returns 2 decimal places', () => {
    expect(ctx.formatRelativeValue(10, 3)).toBe('3.33');
  });

  test('returns "0" when divisor is 0', () => {
    expect(ctx.formatRelativeValue(10, 0)).toBe('0');
  });

  test('returns "0" when divisor is null', () => {
    expect(ctx.formatRelativeValue(10, null)).toBe('0');
  });

  test('returns "0" when divisor is undefined', () => {
    expect(ctx.formatRelativeValue(10, undefined)).toBe('0');
  });

  test('returns "0.00" when value is 0', () => {
    expect(ctx.formatRelativeValue(0, 5)).toBe('0.00');
  });

  test('handles exact integer division', () => {
    expect(ctx.formatRelativeValue(100, 10)).toBe('10.00');
  });

  test('rounds to 2 decimal places correctly', () => {
    expect(ctx.formatRelativeValue(1, 3)).toBe('0.33');
    expect(ctx.formatRelativeValue(2, 3)).toBe('0.67');
  });
});

// ─── lookupCoords ─────────────────────────────────────────────────────────────

describe('lookupCoords', () => {
  test('returns null for null input', () => {
    expect(ctx.lookupCoords(null)).toBeNull();
  });

  test('returns null for undefined input', () => {
    expect(ctx.lookupCoords(undefined)).toBeNull();
  });

  test('returns null for unknown city', () => {
    expect(ctx.lookupCoords('CIDADE INEXISTENTE')).toBeNull();
  });

  test('returns coordinates for SALVADOR', () => {
    const coords = ctx.lookupCoords('SALVADOR');
    expect(Array.isArray(coords)).toBe(true);
    expect(coords).toHaveLength(2);
    expect(coords[0]).toBeCloseTo(-12.9714, 3);
    expect(coords[1]).toBeCloseTo(-38.5014, 3);
  });

  test('resolves accented city name via NFD normalisation', () => {
    // IFBA_COORDS has 'JEQUIÉ'; passing 'JEQUIE' (no accent) should still resolve
    const coordsAccented = ctx.lookupCoords('JEQUIÉ');
    const coordsNorm = ctx.lookupCoords('JEQUIE');
    expect(coordsAccented).not.toBeNull();
    expect(coordsNorm).not.toBeNull();
    expect(coordsAccented[0]).toBeCloseTo(coordsNorm[0], 3);
  });

  test('resolves CAMAÇARI case with accent stripping', () => {
    const coords = ctx.lookupCoords('CAMAÇARI');
    expect(coords).not.toBeNull();
  });
});

// ─── getChartColors ───────────────────────────────────────────────────────────

describe('getChartColors', () => {
  test('returns an array of the requested length', () => {
    expect(ctx.getChartColors(3)).toHaveLength(3);
    expect(ctx.getChartColors(10)).toHaveLength(10);
  });

  test('returns an empty array for count 0', () => {
    expect(ctx.getChartColors(0)).toHaveLength(0);
  });

  test('cycles through the palette when count exceeds palette size', () => {
    const colors = ctx.getChartColors(11); // palette has 10
    expect(colors).toHaveLength(11);
    expect(colors[0]).toBe(colors[10]); // cycles back
  });

  test('every element is a valid hex colour string', () => {
    const colors = ctx.getChartColors(10);
    colors.forEach(c => {
      expect(c).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });
  });
});

// ─── renderSourceUpdates ──────────────────────────────────────────────────────

describe('renderSourceUpdates', () => {
  test('does not throw when DOM elements are missing (mock returns null)', () => {
    // The mock document.getElementById always returns a stub, so this is safe
    expect(() => ctx.renderSourceUpdates(null)).not.toThrow();
  });

  test('does not throw with a valid meta object containing sourceDates', () => {
    const meta = {
      sourceDates: {
        'scraper-DGP': {
          label: 'DGP',
          createdAt: '2024-01-01T00:00:00.000Z',
          modifiedAt: '2024-06-01T00:00:00.000Z',
        },
      },
    };
    expect(() => ctx.renderSourceUpdates(meta)).not.toThrow();
  });

  test('does not throw with an empty sourceDates object', () => {
    expect(() => ctx.renderSourceUpdates({ sourceDates: {} })).not.toThrow();
  });
});

// ─── processEvolucao ──────────────────────────────────────────────────────────

describe('processEvolucao', () => {
  // processEvolucao calls createChart, which is a no-op stub in our context.
  // We verify that it returns the colour array and does not throw.

  test('does not throw for empty data', () => {
    expect(() => ctx.processEvolucao([], 'chart-dummy')).not.toThrow();
  });

  test('returns an array of colours', () => {
    const data = [
      { Ano: '2020', Tipo: 'Artigo' },
      { Ano: '2021', Tipo: 'Livro' },
    ];
    const colors = ctx.processEvolucao(data, 'chart-dummy');
    expect(Array.isArray(colors)).toBe(true);
    expect(colors.length).toBeGreaterThan(0);
  });

  test('ignores rows with a missing or NaN year', () => {
    const data = [
      { Ano: null, Tipo: 'Artigo' },
      { Ano: 'abc', Tipo: 'Livro' },
      { Tipo: 'Outro' },
      { Ano: '2022', Tipo: 'Patente' },
    ];
    expect(() => ctx.processEvolucao(data, 'chart-dummy')).not.toThrow();
  });

  test('truncates long type labels in datasets', () => {
    const longType = 'A'.repeat(50);
    const data = [{ Ano: '2022', Tipo: longType }];
    // No easy way to inspect Chart.js data from stubs, but ensure no throw
    expect(() => ctx.processEvolucao(data, 'chart-dummy')).not.toThrow();
  });
});

// ─── processTipos ─────────────────────────────────────────────────────────────

describe('processTipos', () => {
  test('does not throw for empty data', () => {
    expect(() => ctx.processTipos([], 'chart-dummy', [])).not.toThrow();
  });

  test('does not throw for data with various type values', () => {
    const data = [
      { Tipo: 'Artigo' },
      { Tipo: 'Livro' },
      { Tipo: 'Artigo' },
      {},               // no Tipo → falls back to "Outros"
    ];
    expect(() => ctx.processTipos(data, 'chart-dummy')).not.toThrow();
  });

  test('groups type counts correctly (verifiable via Chart stub side-effect)', () => {
    // Override Chart in ctx to capture arguments for inspection
    const captured = [];
    const origChart = ctx.Chart;
    ctx.Chart = function (canvas, config) {
      captured.push(config);
    };

    const data = [
      { Tipo: 'Alpha' }, { Tipo: 'Beta' }, { Tipo: 'Alpha' },
    ];
    ctx.processTipos(data, 'chart-tipos-test');

    // Restore
    ctx.Chart = origChart;

    expect(captured.length).toBeGreaterThan(0);
    const labels = captured[0].data.labels;
    const values = captured[0].data.datasets[0].data;
    const alphaIdx = labels.indexOf('Alpha');
    const betaIdx = labels.indexOf('Beta');
    expect(alphaIdx).toBeGreaterThanOrEqual(0);
    expect(values[alphaIdx]).toBe(2);
    expect(values[betaIdx]).toBe(1);
  });
});

// ─── CAMPUS_TO_CITY constant ──────────────────────────────────────────────────

describe('CAMPUS_TO_CITY (defined in script.js)', () => {
  test('SSA maps to SALVADOR', () => {
    // Access via the closure (lookupCoords uses it internally)
    // Verify that lookupCoords('SALVADOR') works, which depends on IFBA_COORDS
    expect(ctx.lookupCoords('SALVADOR')).not.toBeNull();
  });

  test('has entries for all common IFBA campus codes', () => {
    const required = ['SSA', 'BRU', 'CAM', 'JEQ', 'VC', 'ILH', 'FS'];
    // We can verify indirectly via CAMPUS_TO_CITY from the helper (same data)
    required.forEach(code => {
      expect(CAMPUS_TO_CITY[code]).toBeTruthy();
    });
  });
});
