// Tests for the pure utility functions defined in src/posgraduacao.js
'use strict';

const path = require('path');
const { createBrowserContext, loadScript } = require('./helpers/browserEnv');

const POSGRAD_PATH = path.join(__dirname, '..', 'src', 'posgraduacao.js');

let ctx;

beforeAll(() => {
  ctx = createBrowserContext({ STATE: { maxYear: 2024, filtered: {} } });
  loadScript(ctx, POSGRAD_PATH);
});

// ─── getPosGraduacaoCategoryColor ─────────────────────────────────────────────

describe('getPosGraduacaoCategoryColor', () => {
  test('returns blue (#4D90FE) for Mestrado', () => {
    expect(ctx.getPosGraduacaoCategoryColor('Mestrado')).toBe('#4D90FE');
  });

  test('returns red (#F44336) for Doutorado', () => {
    expect(ctx.getPosGraduacaoCategoryColor('Doutorado')).toBe('#F44336');
  });

  test('returns green (#4CAF50) for Especialização', () => {
    expect(ctx.getPosGraduacaoCategoryColor('Especialização')).toBe('#4CAF50');
  });

  test('returns yellow (#FFC107) for Outro', () => {
    expect(ctx.getPosGraduacaoCategoryColor('Outro')).toBe('#FFC107');
  });

  test('returns fallback grey (#607D8B) for unknown category', () => {
    expect(ctx.getPosGraduacaoCategoryColor('Unknown')).toBe('#607D8B');
    expect(ctx.getPosGraduacaoCategoryColor('')).toBe('#607D8B');
    expect(ctx.getPosGraduacaoCategoryColor(undefined)).toBe('#607D8B');
  });
});

// ─── truncateText ─────────────────────────────────────────────────────────────

describe('truncateText', () => {
  test('returns "Não informado" for null', () => {
    expect(ctx.truncateText(null)).toBe('Não informado');
  });

  test('returns "Não informado" for empty string', () => {
    expect(ctx.truncateText('')).toBe('Não informado');
  });

  test('returns text unchanged when shorter than maxLength', () => {
    expect(ctx.truncateText('Hello', 10)).toBe('Hello');
  });

  test('returns text unchanged when exactly at maxLength', () => {
    const text = 'A'.repeat(40);
    expect(ctx.truncateText(text, 40)).toBe(text);
  });

  test('truncates text longer than maxLength and appends ellipsis', () => {
    const text = 'A'.repeat(50);
    const result = ctx.truncateText(text, 40);
    expect(result).toBe('A'.repeat(40) + '...');
  });

  test('uses default maxLength of 40 when not specified', () => {
    const text = 'B'.repeat(50);
    const result = ctx.truncateText(text);
    expect(result).toBe('B'.repeat(40) + '...');
  });
});

// ─── normalizePosGraduacaoStatus ──────────────────────────────────────────────

describe('normalizePosGraduacaoStatus', () => {
  test('returns the trimmed status when non-empty', () => {
    expect(ctx.normalizePosGraduacaoStatus('Concluído')).toBe('Concluído');
    expect(ctx.normalizePosGraduacaoStatus('  Matriculado  ')).toBe('Matriculado');
  });

  test('returns "Não informado" for empty string', () => {
    expect(ctx.normalizePosGraduacaoStatus('')).toBe('Não informado');
  });

  test('returns "Não informado" for null', () => {
    expect(ctx.normalizePosGraduacaoStatus(null)).toBe('Não informado');
  });

  test('returns "Não informado" for undefined', () => {
    expect(ctx.normalizePosGraduacaoStatus(undefined)).toBe('Não informado');
  });

  test('returns "Não informado" for whitespace-only string', () => {
    expect(ctx.normalizePosGraduacaoStatus('   ')).toBe('Não informado');
  });
});

// ─── getPosGraduacaoDurationYears ─────────────────────────────────────────────

describe('getPosGraduacaoDurationYears', () => {
  test('returns 2 for Mestrado', () => {
    expect(ctx.getPosGraduacaoDurationYears('Mestrado')).toBe(2);
  });

  test('returns 4 for Doutorado', () => {
    expect(ctx.getPosGraduacaoDurationYears('Doutorado')).toBe(4);
  });

  test('returns 2 for Especialização', () => {
    expect(ctx.getPosGraduacaoDurationYears('Especialização')).toBe(2);
  });

  test('returns 2 as default for unknown category', () => {
    expect(ctx.getPosGraduacaoDurationYears('Outro')).toBe(2);
    expect(ctx.getPosGraduacaoDurationYears('')).toBe(2);
    expect(ctx.getPosGraduacaoDurationYears(undefined)).toBe(2);
  });
});

// ─── isPosGraduacaoMature ─────────────────────────────────────────────────────

describe('isPosGraduacaoMature', () => {
  // STATE.maxYear = 2024

  test('returns true for a Mestrado record entered 2 or more years ago', () => {
    // 2024 - 2022 = 2 >= 2 → mature
    expect(ctx.isPosGraduacaoMature({ ano: 2022, categoria: 'Mestrado' })).toBe(true);
    // 2024 - 2020 = 4 >= 2 → mature
    expect(ctx.isPosGraduacaoMature({ ano: 2020, categoria: 'Mestrado' })).toBe(true);
  });

  test('returns false for a Mestrado record entered less than 2 years ago', () => {
    // 2024 - 2023 = 1 < 2 → not mature
    expect(ctx.isPosGraduacaoMature({ ano: 2023, categoria: 'Mestrado' })).toBe(false);
    // 2024 - 2024 = 0 < 2 → not mature
    expect(ctx.isPosGraduacaoMature({ ano: 2024, categoria: 'Mestrado' })).toBe(false);
  });

  test('returns true for a Doutorado record entered 4 or more years ago', () => {
    expect(ctx.isPosGraduacaoMature({ ano: 2020, categoria: 'Doutorado' })).toBe(true);
    expect(ctx.isPosGraduacaoMature({ ano: 2018, categoria: 'Doutorado' })).toBe(true);
  });

  test('returns false for a Doutorado record entered fewer than 4 years ago', () => {
    // 2024 - 2021 = 3 < 4 → not mature
    expect(ctx.isPosGraduacaoMature({ ano: 2021, categoria: 'Doutorado' })).toBe(false);
  });

  test('returns true for Especialização entered 2 or more years ago', () => {
    expect(ctx.isPosGraduacaoMature({ ano: 2022, categoria: 'Especialização' })).toBe(true);
  });

  test('uses default duration of 2 for unknown category', () => {
    expect(ctx.isPosGraduacaoMature({ ano: 2022, categoria: 'Outro' })).toBe(true);
    expect(ctx.isPosGraduacaoMature({ ano: 2023, categoria: 'Outro' })).toBe(false);
  });

  test('returns false when ano is not a number', () => {
    expect(ctx.isPosGraduacaoMature({ ano: 'invalid', categoria: 'Mestrado' })).toBe(false);
    expect(ctx.isPosGraduacaoMature({ categoria: 'Mestrado' })).toBe(false);
  });
});

// ─── isPosGraduacaoAttritionStatus ────────────────────────────────────────────

describe('isPosGraduacaoAttritionStatus', () => {
  test.each(['Cancelado', 'Desligado', 'Evasão', 'Abandono', 'Falecido'])(
    'returns true for attrition status "%s"',
    (status) => {
      expect(ctx.isPosGraduacaoAttritionStatus(status)).toBe(true);
    }
  );

  test.each(['Concluído', 'Matriculado', 'Não informado', '', 'Outro'])(
    'returns false for non-attrition status "%s"',
    (status) => {
      expect(ctx.isPosGraduacaoAttritionStatus(status)).toBe(false);
    }
  );
});

// ─── normalizePosGraduacaoOutcome ─────────────────────────────────────────────

describe('normalizePosGraduacaoOutcome', () => {
  test('returns "Concluído" for "Concluído"', () => {
    expect(ctx.normalizePosGraduacaoOutcome('Concluído')).toBe('Concluído');
  });

  test('returns "Ativo" for "Matriculado"', () => {
    expect(ctx.normalizePosGraduacaoOutcome('Matriculado')).toBe('Ativo');
  });

  test.each(['Cancelado', 'Desligado', 'Evasão', 'Abandono', 'Falecido'])(
    'returns "Evasão/Desligamento" for attrition status "%s"',
    (status) => {
      expect(ctx.normalizePosGraduacaoOutcome(status)).toBe('Evasão/Desligamento');
    }
  );

  test('returns "Outros" for unrecognised statuses', () => {
    expect(ctx.normalizePosGraduacaoOutcome('Não informado')).toBe('Outros');
    expect(ctx.normalizePosGraduacaoOutcome('')).toBe('Outros');
    expect(ctx.normalizePosGraduacaoOutcome('SomeOtherStatus')).toBe('Outros');
  });
});

// ─── getPosGraduacaoSituationBucket ───────────────────────────────────────────

describe('getPosGraduacaoSituationBucket', () => {
  // STATE.maxYear = 2024, so 2022 is mature (2 yrs), 2023 is not (1 yr)

  test('returns "Concluído" for concluded record', () => {
    const record = { situacao: 'Concluído', ano: 2020, categoria: 'Mestrado' };
    expect(ctx.getPosGraduacaoSituationBucket(record)).toBe('Concluído');
  });

  test('returns "Evasão/Desligamento" for attrition record', () => {
    const record = { situacao: 'Cancelado', ano: 2020, categoria: 'Mestrado' };
    expect(ctx.getPosGraduacaoSituationBucket(record)).toBe('Evasão/Desligamento');
  });

  test('returns "Pendência Ativa" for Matriculado in a mature cohort', () => {
    // 2024 - 2022 = 2 >= 2 → mature
    const record = { situacao: 'Matriculado', ano: 2022, categoria: 'Mestrado' };
    expect(ctx.getPosGraduacaoSituationBucket(record)).toBe('Pendência Ativa');
  });

  test('returns "Em Fluxo Regular" for Matriculado in an immature cohort', () => {
    // 2024 - 2023 = 1 < 2 → not mature
    const record = { situacao: 'Matriculado', ano: 2023, categoria: 'Mestrado' };
    expect(ctx.getPosGraduacaoSituationBucket(record)).toBe('Em Fluxo Regular');
  });

  test('returns "Outros" for unrecognised status', () => {
    const record = { situacao: 'Transferido', ano: 2020, categoria: 'Mestrado' };
    expect(ctx.getPosGraduacaoSituationBucket(record)).toBe('Outros');
  });
});

// ─── formatPercent ────────────────────────────────────────────────────────────

describe('formatPercent', () => {
  test('formats a positive float with one decimal place', () => {
    expect(ctx.formatPercent(75.555)).toBe('75.6%');
  });

  test('formats 0 as "0.0%"', () => {
    expect(ctx.formatPercent(0)).toBe('0.0%');
  });

  test('formats 100 as "100.0%"', () => {
    expect(ctx.formatPercent(100)).toBe('100.0%');
  });

  test('returns "0%" for null', () => {
    expect(ctx.formatPercent(null)).toBe('0%');
  });

  test('returns "0%" for undefined', () => {
    expect(ctx.formatPercent(undefined)).toBe('0%');
  });

  test('returns "0%" for NaN', () => {
    expect(ctx.formatPercent(NaN)).toBe('0%');
  });
});

// ─── calculateCompletionRate ──────────────────────────────────────────────────

describe('calculateCompletionRate', () => {
  test('returns correct percentage', () => {
    // denominator = total - active = 10 - 2 = 8; rate = 5/8 * 100 = 62.5
    expect(ctx.calculateCompletionRate(10, 2, 5)).toBeCloseTo(62.5);
  });

  test('returns 100% when all non-active are completed', () => {
    expect(ctx.calculateCompletionRate(5, 0, 5)).toBe(100);
  });

  test('returns 0 when denominator is 0 (all active, none concluded)', () => {
    expect(ctx.calculateCompletionRate(5, 5, 0)).toBe(0);
  });

  test('returns 0 when denominator is negative', () => {
    // active > total → edge case
    expect(ctx.calculateCompletionRate(3, 5, 0)).toBe(0);
  });

  test('returns 0 when completed is 0', () => {
    expect(ctx.calculateCompletionRate(10, 2, 0)).toBe(0);
  });
});

// ─── getSortedNumericYears ────────────────────────────────────────────────────

describe('getSortedNumericYears', () => {
  test('returns sorted unique years', () => {
    const data = [
      { ano: 2021 }, { ano: 2020 }, { ano: 2022 }, { ano: 2021 },
    ];
    expect(ctx.getSortedNumericYears(data)).toEqual([2020, 2021, 2022]);
  });

  test('ignores non-numeric ano values', () => {
    const data = [{ ano: 2021 }, { ano: 'invalid' }, { ano: null }, { ano: NaN }];
    expect(ctx.getSortedNumericYears(data)).toEqual([2021]);
  });

  test('returns empty array for empty input', () => {
    expect(ctx.getSortedNumericYears([])).toEqual([]);
  });

  test('handles string year values that are numeric', () => {
    const data = [{ ano: '2022' }, { ano: '2021' }];
    expect(ctx.getSortedNumericYears(data)).toEqual([2021, 2022]);
  });
});

// ─── countBy ─────────────────────────────────────────────────────────────────

describe('countBy', () => {
  test('counts occurrences by a simple key getter', () => {
    const data = [
      { category: 'A' }, { category: 'B' }, { category: 'A' },
    ];
    const result = ctx.countBy(data, r => r.category);
    expect(result).toEqual({ A: 2, B: 1 });
  });

  test('returns empty object for empty input', () => {
    expect(ctx.countBy([], r => r.key)).toEqual({});
  });

  test('works with a getter that transforms values', () => {
    const data = [
      { situacao: 'Concluído' }, { situacao: 'Matriculado' }, { situacao: 'Concluído' },
    ];
    const result = ctx.countBy(data, r => r.situacao.toUpperCase());
    expect(result['CONCLUÍDO']).toBe(2);
    expect(result['MATRICULADO']).toBe(1);
  });
});

// ─── calculateCompletionRates ─────────────────────────────────────────────────

describe('calculateCompletionRates', () => {
  // STATE.maxYear = 2024.
  // Mature = year <= 2022 (Mestrado default 2 yr).
  // For Doutorado mature = year <= 2020.

  test('returns completion, attrition and overdue rates per cohort year', () => {
    const data = [
      // 2020 cohort (Mestrado) – 4 mature records
      { ano: 2020, categoria: 'Mestrado', situacao: 'Concluído' },
      { ano: 2020, categoria: 'Mestrado', situacao: 'Concluído' },
      { ano: 2020, categoria: 'Mestrado', situacao: 'Cancelado' },
      { ano: 2020, categoria: 'Mestrado', situacao: 'Matriculado' },
    ];
    const { completion, attrition, overdue } = ctx.calculateCompletionRates(data);

    expect(completion[2020]).toBeCloseTo(50); // 2/4 * 100
    expect(attrition[2020]).toBeCloseTo(25);  // 1/4 * 100
    expect(overdue[2020]).toBeCloseTo(25);    // 1/4 * 100
  });

  test('returns zero rates for cohorts with no mature records', () => {
    // 2023 Mestrado: 2024 - 2023 = 1 < 2 → not mature
    const data = [
      { ano: 2023, categoria: 'Mestrado', situacao: 'Matriculado' },
      { ano: 2023, categoria: 'Mestrado', situacao: 'Concluído' },
    ];
    const { completion, attrition, overdue } = ctx.calculateCompletionRates(data);
    expect(completion[2023]).toBe(0);
    expect(attrition[2023]).toBe(0);
    expect(overdue[2023]).toBe(0);
  });

  test('returns empty maps for empty data', () => {
    const { completion, attrition, overdue } = ctx.calculateCompletionRates([]);
    expect(Object.keys(completion)).toHaveLength(0);
    expect(Object.keys(attrition)).toHaveLength(0);
    expect(Object.keys(overdue)).toHaveLength(0);
  });

  test('handles multiple distinct cohort years independently', () => {
    const data = [
      // 2019 Mestrado (mature, 5 years ago): all concluded
      { ano: 2019, categoria: 'Mestrado', situacao: 'Concluído' },
      { ano: 2019, categoria: 'Mestrado', situacao: 'Concluído' },
      // 2021 Mestrado (mature, 3 years ago): 1 concluded, 1 attrition
      { ano: 2021, categoria: 'Mestrado', situacao: 'Concluído' },
      { ano: 2021, categoria: 'Mestrado', situacao: 'Evasão' },
    ];
    const { completion, attrition } = ctx.calculateCompletionRates(data);

    expect(completion[2019]).toBe(100);
    expect(attrition[2019]).toBe(0);

    expect(completion[2021]).toBeCloseTo(50);
    expect(attrition[2021]).toBeCloseTo(50);
  });
});
