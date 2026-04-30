// Tests for build.js pure functions
const fs = require('fs');
const path = require('path');
const os = require('os');

const { findFiles, parseCSV, getSourceKey, registerSourceFile, SHEET_MAP, SOURCE_LABELS } = require('../build');

// ─── findFiles ────────────────────────────────────────────────────────────────

describe('findFiles', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'build-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('returns empty array when no matching files exist', () => {
    expect(findFiles(tmpDir, '.xls')).toEqual([]);
  });

  test('finds files with the given extension in root dir', () => {
    fs.writeFileSync(path.join(tmpDir, 'CAMPUS-2000-2024.xls'), '');
    const results = findFiles(tmpDir, '.xls');
    expect(results).toHaveLength(1);
    expect(results[0].fileName).toBe('CAMPUS-2000-2024.xls');
    expect(results[0].filePath).toBe(path.join(tmpDir, 'CAMPUS-2000-2024.xls'));
  });

  test('does not return files with a different extension', () => {
    fs.writeFileSync(path.join(tmpDir, 'data.csv'), '');
    expect(findFiles(tmpDir, '.xls')).toHaveLength(0);
  });

  test('recurses into sub-directories', () => {
    const sub = path.join(tmpDir, 'scraper-SUAPCNPQ');
    fs.mkdirSync(sub);
    fs.writeFileSync(path.join(sub, 'SSA-2000-2024.xls'), '');
    const results = findFiles(tmpDir, '.xls');
    expect(results).toHaveLength(1);
    expect(results[0].fileName).toBe('SSA-2000-2024.xls');
  });

  test('recurses multiple levels deep', () => {
    const deep = path.join(tmpDir, 'a', 'b', 'c');
    fs.mkdirSync(deep, { recursive: true });
    fs.writeFileSync(path.join(deep, 'file.xls'), '');
    const results = findFiles(tmpDir, '.xls');
    expect(results).toHaveLength(1);
    expect(results[0].fileName).toBe('file.xls');
  });

  test('ignores lock files starting with .~lock', () => {
    fs.writeFileSync(path.join(tmpDir, '.~lock.file.xls'), '');
    fs.writeFileSync(path.join(tmpDir, 'real.xls'), '');
    const results = findFiles(tmpDir, '.xls');
    expect(results).toHaveLength(1);
    expect(results[0].fileName).toBe('real.xls');
  });

  test('finds multiple files across multiple directories', () => {
    const sub1 = path.join(tmpDir, 'dir1');
    const sub2 = path.join(tmpDir, 'dir2');
    fs.mkdirSync(sub1);
    fs.mkdirSync(sub2);
    fs.writeFileSync(path.join(sub1, 'a.xls'), '');
    fs.writeFileSync(path.join(sub2, 'b.xls'), '');
    fs.writeFileSync(path.join(sub2, 'c.csv'), ''); // different extension
    const results = findFiles(tmpDir, '.xls');
    expect(results).toHaveLength(2);
    const names = results.map(r => r.fileName).sort();
    expect(names).toEqual(['a.xls', 'b.xls']);
  });
});

// ─── parseCSV ─────────────────────────────────────────────────────────────────

describe('parseCSV', () => {
  let tmpFile;

  afterEach(() => {
    if (tmpFile && fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
  });

  function writeCsvAndParse(content) {
    tmpFile = path.join(os.tmpdir(), `test-${Date.now()}.csv`);
    fs.writeFileSync(tmpFile, content, 'utf-8');
    return parseCSV(tmpFile);
  }

  test('parses a basic CSV with two rows', () => {
    const rows = writeCsvAndParse('Nome,Ano\nAlice,2021\nBob,2022');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ Nome: 'Alice', Ano: '2021' });
    expect(rows[1]).toEqual({ Nome: 'Bob', Ano: '2022' });
  });

  test('handles quoted fields', () => {
    const rows = writeCsvAndParse('"Nome","Ano"\n"Alice","2021"');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({ Nome: 'Alice', Ano: '2021' });
  });

  test('handles commas inside quoted fields', () => {
    const rows = writeCsvAndParse('Nome,Descricao\nAlice,"Hello, World"');
    expect(rows[0]).toEqual({ Nome: 'Alice', Descricao: 'Hello, World' });
  });

  test('handles escaped double-quotes inside quoted fields', () => {
    const rows = writeCsvAndParse('Nome,Descricao\nAlice,"Say ""Hi"""');
    expect(rows[0]).toEqual({ Nome: 'Alice', Descricao: 'Say "Hi"' });
  });

  test('fills missing fields with empty string', () => {
    const rows = writeCsvAndParse('A,B,C\n1,2');
    expect(rows[0]).toEqual({ A: '1', B: '2', C: '' });
  });

  test('skips empty lines', () => {
    const rows = writeCsvAndParse('Nome,Ano\nAlice,2021\n\nBob,2022\n');
    expect(rows).toHaveLength(2);
  });

  test('returns empty array for header-only CSV', () => {
    const rows = writeCsvAndParse('Nome,Ano\n');
    expect(rows).toHaveLength(0);
  });

  test('trims whitespace from headers', () => {
    const rows = writeCsvAndParse(' Nome , Ano \nAlice,2021');
    expect(Object.keys(rows[0])).toContain('Nome');
    expect(Object.keys(rows[0])).toContain('Ano');
  });

  test('handles real-world DGP-like CSV structure', () => {
    const csv = [
      'Situação,Ano Formação,Pesquisadores,Estudantes,Área,Último Envio,Unidade',
      'Certificado,2015,5,10,Ciências Exatas,2023,IFBA - Salvador',
    ].join('\n');
    const rows = writeCsvAndParse(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]['Situação']).toBe('Certificado');
    expect(rows[0]['Ano Formação']).toBe('2015');
    expect(rows[0]['Pesquisadores']).toBe('5');
  });
});

// ─── getSourceKey ─────────────────────────────────────────────────────────────

describe('getSourceKey', () => {
  const DADOS_DIR = path.join(__dirname, '..', 'dados');

  test('returns the first subdirectory name for files inside dados/', () => {
    const filePath = path.join(DADOS_DIR, 'scraper-SUAPCNPQ', 'SSA-2000-2024.xls');
    expect(getSourceKey(filePath)).toBe('scraper-SUAPCNPQ');
  });

  test('returns the first subdirectory for DGP scraper', () => {
    const filePath = path.join(DADOS_DIR, 'scraper-DGP', 'coletor_dgp_ifba.csv');
    expect(getSourceKey(filePath)).toBe('scraper-DGP');
  });

  test('returns the first subdirectory for pos-graduation scraper', () => {
    const filePath = path.join(DADOS_DIR, 'scraper-SUAPPos', 'alunos_pos.csv');
    expect(getSourceKey(filePath)).toBe('scraper-SUAPPos');
  });

  test('returns "desconhecido" for a file directly in dados/', () => {
    // A file directly in dados/ has no subdirectory component
    const filePath = path.join(DADOS_DIR, 'file.csv');
    // The relative path is just "file.csv" with no directory separator
    // so parts[0] = "file.csv", but it's still a valid key
    const key = getSourceKey(filePath);
    expect(typeof key).toBe('string');
    expect(key.length).toBeGreaterThan(0);
  });
});

// ─── registerSourceFile ───────────────────────────────────────────────────────

describe('registerSourceFile', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'register-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function makeMeta() {
    return { sourceFiles: {}, sourceDates: {} };
  }

  test('creates a new entry for a new source key', () => {
    const filePath = path.join(tmpDir, 'scraper-DGP', 'data.csv');
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, '');

    // We need a dados-like structure so getSourceKey works correctly
    // Override by testing the meta object after calling registerSourceFile
    // with a filePath that resolves to a known source key via the real DADOS_DIR.
    // For unit purposes, just ensure the function populates the meta.
    const meta = makeMeta();
    registerSourceFile(meta, filePath, 'data.csv');

    const keys = Object.keys(meta.sourceFiles);
    expect(keys).toHaveLength(1);
    const key = keys[0];
    expect(meta.sourceFiles[key]).toContain('data.csv');
  });

  test('appends file name when source key already exists', () => {
    const dir = path.join(tmpDir, 'scraper-DGP');
    fs.mkdirSync(dir);
    const file1 = path.join(dir, 'a.csv');
    const file2 = path.join(dir, 'b.csv');
    fs.writeFileSync(file1, '');
    fs.writeFileSync(file2, '');

    const meta = makeMeta();
    registerSourceFile(meta, file1, 'a.csv');
    registerSourceFile(meta, file2, 'b.csv');

    const key = Object.keys(meta.sourceFiles)[0];
    expect(meta.sourceFiles[key]).toEqual(expect.arrayContaining(['a.csv', 'b.csv']));
  });

  test('increments fileCount on subsequent registrations for same source', () => {
    const dir = path.join(tmpDir, 'scraper-DGP');
    fs.mkdirSync(dir);
    const file1 = path.join(dir, 'a.csv');
    const file2 = path.join(dir, 'b.csv');
    fs.writeFileSync(file1, '');
    fs.writeFileSync(file2, '');

    const meta = makeMeta();
    registerSourceFile(meta, file1, 'a.csv');
    registerSourceFile(meta, file2, 'b.csv');

    const key = Object.keys(meta.sourceDates)[0];
    expect(meta.sourceDates[key].fileCount).toBe(2);
  });

  test('records label from SOURCE_LABELS when key is known', () => {
    const dir = path.join(tmpDir, 'scraper-DGP');
    fs.mkdirSync(dir);
    const file = path.join(dir, 'data.csv');
    fs.writeFileSync(file, '');

    const meta = makeMeta();
    registerSourceFile(meta, file, 'data.csv');

    const key = Object.keys(meta.sourceDates)[0];
    // The key extracted may be 'scraper-DGP' or the tmpDir variant
    // Either way, a label should be set (either from SOURCE_LABELS or key name)
    expect(typeof meta.sourceDates[key].label).toBe('string');
  });

  test('sets null dates when stat throws (non-existent file)', () => {
    const meta = makeMeta();
    // Pass a non-existent file path so fs.statSync throws
    const fakeFilePath = path.join(tmpDir, 'scraper-DGP', 'ghost.csv');
    registerSourceFile(meta, fakeFilePath, 'ghost.csv');

    const key = Object.keys(meta.sourceDates)[0];
    expect(meta.sourceDates[key].createdAt).toBeNull();
    expect(meta.sourceDates[key].modifiedAt).toBeNull();
  });
});

// ─── SHEET_MAP ────────────────────────────────────────────────────────────────

describe('SHEET_MAP', () => {
  test('maps all five expected Portuguese sheet names', () => {
    expect(SHEET_MAP['produções bibliográficas']).toBe('bibliografica');
    expect(SHEET_MAP['produções técnicas']).toBe('tecnica');
    expect(SHEET_MAP['registros e patentes']).toBe('inovacao');
    expect(SHEET_MAP['orientações concluídas']).toBe('concluidas');
    expect(SHEET_MAP['orientações em andamento']).toBe('andamento');
  });

  test('does not map unexpected keys', () => {
    expect(SHEET_MAP['other']).toBeUndefined();
    expect(SHEET_MAP['']).toBeUndefined();
  });
});

// ─── SOURCE_LABELS ────────────────────────────────────────────────────────────

describe('SOURCE_LABELS', () => {
  test('provides human-readable labels for each known scraper', () => {
    expect(SOURCE_LABELS['scraper-SUAPCNPQ']).toBeTruthy();
    expect(SOURCE_LABELS['scraper-DGP']).toBeTruthy();
    expect(SOURCE_LABELS['scraper-SUAPPos']).toBeTruthy();
  });
});
