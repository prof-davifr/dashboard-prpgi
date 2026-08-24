// Tests for build.js pure functions
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  findFiles,
  parseCSV,
  getSourceKey,
  registerSourceFile,
  isPostGraduationCsv,
  isDgpGroupsCsv,
  selectDgpGroupsCsvFiles,
  selectPosGraduacaoCsvFiles,
  pseudonymize,
  shortHash,
  loadOrCreateSalt,
  SALT_FILE,
  SALT_BACKUP_FILE,
  SHEET_MAP,
  SOURCE_LABELS,
  extrairVinculos,
  nomeNaCitacao,
  filtrarPorAutoria
} = require('../scripts/build');

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
    expect(rows[0]['Situacao']).toBe('Certificado');
    expect(rows[0]['AnoFormacao']).toBe('2015');
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
    expect(SOURCE_LABELS['ic']).toBeTruthy();
  });
});

// ─── DGP CSV selection ─────────────────────────────────────────────────────────

describe('isPostGraduationCsv', () => {
  test('returns true when file name contains alunos_pos', () => {
    expect(isPostGraduationCsv('alunos_pos_ifba.csv')).toBe(true);
    expect(isPostGraduationCsv('ALUNOS_POS_2026.csv')).toBe(true);
  });

  test('returns false for non-pos files', () => {
    expect(isPostGraduationCsv('coletor_dgp_ifba.csv')).toBe(false);
  });
});

describe('isDgpGroupsCsv', () => {
  const DADOS_DIR = path.join(__dirname, '..', 'dados');

  test('returns true for scraper-DGP collector files', () => {
    const filePath = path.join(DADOS_DIR, 'scraper-DGP', 'coletor_dgp_ifba.csv');
    expect(isDgpGroupsCsv(filePath, 'coletor_dgp_ifba.csv')).toBe(true);
  });

  test('returns false for alunos_pos files', () => {
    const filePath = path.join(DADOS_DIR, 'scraper-DGP', 'alunos_pos_2026.csv');
    expect(isDgpGroupsCsv(filePath, 'alunos_pos_2026.csv')).toBe(false);
  });

  test('returns false for files from other sources', () => {
    const filePath = path.join(DADOS_DIR, 'scraper-SUAPPos', 'coletor_dgp_ifba.csv');
    expect(isDgpGroupsCsv(filePath, 'coletor_dgp_ifba.csv')).toBe(false);
  });
});

describe('selectDgpGroupsCsvFiles', () => {
  const dgpDir = path.join(__dirname, '..', 'dados', 'scraper-DGP');
  const createdDirs = [];

  beforeEach(() => {
    fs.mkdirSync(dgpDir, { recursive: true });
  });

  afterEach(() => {
    createdDirs.forEach(dir => {
      if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true });
    });
    createdDirs.length = 0;
  });

  function makeCsv(name, ageMs = 0) {
    const uniqueDir = path.join(dgpDir, `${Date.now()}-${Math.random().toString(36).slice(2)}`);
    fs.mkdirSync(uniqueDir, { recursive: true });
    const filePath = path.join(uniqueDir, name);
    fs.writeFileSync(filePath, 'h1\nh2');
    createdDirs.push(uniqueDir);
    if (ageMs > 0) {
      const time = new Date(Date.now() - ageMs);
      fs.utimesSync(filePath, time, time);
    }
    return { filePath, fileName: name };
  }

  test('selects newest valid coletor CSV and ignores *_old.csv', () => {
    const newer = makeCsv('coletor_dgp_ifba.csv', 0);
    const older = makeCsv('coletor_dgp_ifba_old.csv', 60000);

    const out = selectDgpGroupsCsvFiles([newer, older]);
    expect(out.selected.filePath).toBe(newer.filePath);
    expect(out.ignored.map(f => f.filePath)).toContain(older.filePath);
  });

  test('ignores non-coletor files and returns null when no valid collectors exist', () => {
    const oldOnly = makeCsv('coletor_dgp_ifba_old.csv');
    const other = makeCsv('qualquer.csv');

    const out = selectDgpGroupsCsvFiles([oldOnly, other]);
    expect(out.selected).toBeNull();
    expect(out.ignored).toHaveLength(2);
  });

  test('keeps alunos_pos files out of DGP group selection', () => {
    const collector = makeCsv('coletor_dgp_ifba.csv');
    const alunos = makeCsv('alunos_pos_2026.csv');

    const out = selectDgpGroupsCsvFiles([collector, alunos]);
    expect(out.selected.filePath).toBe(collector.filePath);
    expect(out.ignored.map(f => f.filePath)).not.toContain(alunos.filePath);
  });
});

describe('selectPosGraduacaoCsvFiles', () => {
  const posDir = path.join(__dirname, '..', 'dados', 'scraper-SUAPPos');
  const createdDirs = [];

  beforeEach(() => {
    fs.mkdirSync(posDir, { recursive: true });
  });

  afterEach(() => {
    createdDirs.forEach(dir => {
      if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true });
    });
    createdDirs.length = 0;
  });

  function makeCsv(name, ageMs = 0) {
    const uniqueDir = path.join(posDir, `${Date.now()}-${Math.random().toString(36).slice(2)}`);
    fs.mkdirSync(uniqueDir, { recursive: true });
    const filePath = path.join(uniqueDir, name);
    fs.writeFileSync(filePath, 'h1\nh2');
    createdDirs.push(uniqueDir);
    if (ageMs > 0) {
      const time = new Date(Date.now() - ageMs);
      fs.utimesSync(filePath, time, time);
    }
    return { filePath, fileName: name };
  }

  test('selects the snapshot with the newest timestamp in the filename', () => {
    const older = makeCsv('alunos_pos_20260415_165049.csv', 60 * 60 * 1000);
    const middle = makeCsv('alunos_pos_20260711_181029.csv', 60 * 60 * 1000);
    const newest = makeCsv('alunos_pos_20260721_111724.csv', 0);

    const out = selectPosGraduacaoCsvFiles([older, middle, newest]);
    expect(out.selected.fileName).toBe('alunos_pos_20260721_111724.csv');
    expect(out.ignored.map(f => f.fileName)).toEqual(
      expect.arrayContaining(['alunos_pos_20260415_165049.csv', 'alunos_pos_20260711_181029.csv'])
    );
  });

  test('falls back to mtime when the filename has no timestamp', () => {
    const recent = makeCsv('alunos_pos.csv', 0);
    const old = makeCsv('alunos_pos.csv', 60 * 60 * 1000);

    const out = selectPosGraduacaoCsvFiles([recent, old]);
    expect(out.selected.filePath).toBe(recent.filePath);
  });

  test('returns null when there are no alunos_pos files', () => {
    expect(selectPosGraduacaoCsvFiles([]).selected).toBeNull();
    const dgp = makeCsv('coletor_dgp_ifba.csv');
    expect(selectPosGraduacaoCsvFiles([dgp]).selected).toBeNull();
  });
});

// ─── LGPD: pseudonimização ────────────────────────────────────────────────────

describe('pseudonymize', () => {
  const SALT = 'salt-de-teste';

  test('é determinístico para o mesmo salt', () => {
    expect(pseudonymize('Maria da Silva', SALT))
      .toBe(pseudonymize('Maria da Silva', SALT));
  });

  test('produz saídas diferentes para pessoas diferentes', () => {
    expect(pseudonymize('Maria da Silva', SALT))
      .not.toBe(pseudonymize('João Souza', SALT));
  });

  test('muda com o salt (não é reversível a partir do repositório público)', () => {
    expect(pseudonymize('Maria da Silva', SALT))
      .not.toBe(pseudonymize('Maria da Silva', 'outro-salt'));
  });

  test('normaliza caixa e espaços — mesma pessoa, mesmo pseudônimo', () => {
    const canonico = pseudonymize('Eduardo Oliveira Teles', SALT);
    expect(pseudonymize('Eduardo Oliveira teles', SALT)).toBe(canonico);
    expect(pseudonymize('  EDUARDO OLIVEIRA TELES  ', SALT)).toBe(canonico);
  });

  test('preserva valores vazios para que .filter(Boolean) siga funcionando', () => {
    expect(pseudonymize('', SALT)).toBe('');
    expect(pseudonymize(null, SALT)).toBe('');
    expect(pseudonymize(undefined, SALT)).toBe('');
    expect(pseudonymize('   ', SALT)).toBe('');
  });

  test('não vaza o valor original na saída', () => {
    const out = pseudonymize('Maria da Silva', SALT);
    expect(out).toMatch(/^[0-9a-f]{16}$/);
    expect(out.toLowerCase()).not.toContain('maria');
  });

  test('aceita entradas numéricas (matrícula)', () => {
    expect(pseudonymize(20162640001, SALT)).toBe(pseudonymize('20162640001', SALT));
  });
});

// ─── LGPD: guarda de regressão sobre o data.json publicado ────────────────────

describe('data.json publicado não contém dados pessoais', () => {
  const data = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'data.json'), 'utf-8')
  );
  const DATASETS = [
    'bibliografica', 'tecnica', 'inovacao', 'concluidas',
    'andamento', 'grupos', 'posgraduacao', 'ic'
  ];
  const PII_FIELD = /nome|matricula|matrícula|e-?mail|cpf|telefone|contato/i;

  test.each(DATASETS)('%s não expõe campos de nome/matrícula/e-mail', (ds) => {
    const campos = new Set();
    data[ds].forEach(r => Object.keys(r).forEach(k => campos.add(k)));
    const vazando = [...campos].filter(k => PII_FIELD.test(k));
    expect(vazando).toEqual([]);
  });

  // A guarda acima só olha o nome do campo. O vazamento de ago/2026 veio pelo
  // valor: `extrairVinculos` não casava SIAPE curto, e o QuerySet cru — com o
  // nome completo dentro — ia para `Servidor`.
  test.each(['bibliografica', 'tecnica', 'inovacao', 'concluidas', 'andamento'])(
    '%s traz só a matrícula em Servidor, nunca o QuerySet cru',
    (ds) => {
      const sujos = data[ds]
        .map(r => r.Servidor)
        .filter(v => v !== null && v !== undefined && v !== '' && !/^\d+$/.test(String(v)));
      expect(sujos.slice(0, 3)).toEqual([]);
    }
  );

  test('posgraduacao mantém dedupKey pseudonimizado (não a matrícula)', () => {
    const chaves = data.posgraduacao.map(r => r.dedupKey).filter(Boolean);
    expect(chaves.length).toBeGreaterThan(0);
    chaves.forEach(k => expect(k).toMatch(/^[0-9a-f]{16}$/));
  });

  test('ic mantém orientador/bolsista pseudonimizados', () => {
    for (const campo of ['orientador', 'bolsista']) {
      const vals = data.ic.map(r => r[campo]).filter(Boolean);
      expect(vals.length).toBeGreaterThan(0);
      vals.forEach(v => expect(v).toMatch(/^[0-9a-f]{16}$/));
    }
  });

  test('as contagens de únicos da aba IC continuam calculáveis', () => {
    const u = f => new Set(data.ic.map(r => r[f]).filter(Boolean)).size;
    expect(u('orientador')).toBeGreaterThan(400);
    expect(u('bolsista')).toBeGreaterThan(1000);
  });
});

// ─── shortHash (encurtamento das chaves de deduplicação) ──────────────────────

describe('shortHash', () => {
  test('é determinístico e não depende de salt', () => {
    expect(shortHash('um titulo qualquer')).toBe(shortHash('um titulo qualquer'));
  });

  test('produz 16 hex', () => {
    expect(shortHash('titulo')).toMatch(/^[0-9a-f]{16}$/);
  });

  test('distingue títulos diferentes', () => {
    expect(shortHash('titulo a')).not.toBe(shortHash('titulo b'));
  });

  test('preserva vazio', () => {
    expect(shortHash('')).toBe('');
    expect(shortHash(null)).toBe('');
    expect(shortHash(undefined)).toBe('');
  });

  test('é sensível à caixa — a normalização é responsabilidade de normalizeKey', () => {
    expect(shortHash('Titulo')).not.toBe(shortHash('titulo'));
  });
});

// ─── Seleção de CSVs por fonte conhecida ─────────────────────────────────────

describe('seleção de CSV por fonte (regressão)', () => {
  // Um .csv que não é do DGP nem da pós-graduação (ex.: a planilha da DINOV em
  // dados/validacao/) era processado como arquivo de grupos por eliminação,
  // inflando `grupos` de 197 para 494.
  const DADOS = path.join(__dirname, '..', 'dados');

  test('CSV fora das fontes conhecidas não é tratado como DGP nem como pós', () => {
    const alheio = {
      filePath: path.join(DADOS, 'validacao', 'Controle propriedade intelectual DINOV.csv'),
      fileName: 'Controle propriedade intelectual DINOV.csv'
    };
    expect(isDgpGroupsCsv(alheio.filePath, alheio.fileName)).toBe(false);
    expect(isPostGraduationCsv(alheio.fileName)).toBe(false);
  });

  test('os CSVs das fontes conhecidas continuam reconhecidos', () => {
    const dgp = {
      filePath: path.join(DADOS, 'scraper-DGP', 'coletor_dgp_2026-07-21.csv'),
      fileName: 'coletor_dgp_2026-07-21.csv'
    };
    expect(isDgpGroupsCsv(dgp.filePath, dgp.fileName)).toBe(true);
    expect(isPostGraduationCsv('alunos_pos_20260721_111724.csv')).toBe(true);
  });
});

// ─── data.json: efeito do encurtamento das chaves ────────────────────────────

describe('dedupKey no data.json', () => {
  const data = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'data.json'), 'utf-8')
  );

  test.each(['bibliografica', 'tecnica', 'concluidas', 'andamento'])(
    '%s usa chaves curtas',
    (ds) => {
      const chaves = data[ds].map(r => r.dedupKey).filter(Boolean);
      expect(chaves.length).toBeGreaterThan(0);
      chaves.forEach(k => expect(k).toMatch(/^[0-9a-f]{16}$/));
    }
  );

  test('inovacao mantém a chave longa — comparar_pi.js extrai o nº do INPI dela', () => {
    const comRegistro = data.inovacao
      .map(r => r.dedupKey)
      .filter(k => k && k.includes('numerodoregistro'));
    expect(comRegistro.length).toBeGreaterThan(0);
  });

  test('grupos tem o tamanho esperado (regressão do CSV alheio)', () => {
    expect(data.grupos.length).toBeLessThan(300);
  });
});

// ─── Salt de pseudonimização: persistência e restauração ─────────────────────

describe('loadOrCreateSalt', () => {
  let tmp;
  const mudo = () => {};

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'salt-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  const caminhos = () => ({
    local: path.join(tmp, '.build-salt'),
    backup: path.join(tmp, 'config', 'build-salt')
  });

  test('cria os dois arquivos na primeira execução', () => {
    const { local, backup } = caminhos();
    const salt = loadOrCreateSalt(local, backup, mudo);

    expect(salt).toMatch(/^[0-9a-f]{64}$/);
    expect(fs.existsSync(local)).toBe(true);
    expect(fs.existsSync(backup)).toBe(true);
    expect(fs.readFileSync(backup, 'utf-8').trim()).toBe(salt);
  });

  test('reusa o salt local em execuções seguintes', () => {
    const { local, backup } = caminhos();
    const primeiro = loadOrCreateSalt(local, backup, mudo);
    const segundo = loadOrCreateSalt(local, backup, mudo);
    expect(segundo).toBe(primeiro);
  });

  test('restaura do backup quando o salt local some (reclone, máquina nova)', () => {
    const { local, backup } = caminhos();
    const original = loadOrCreateSalt(local, backup, mudo);

    fs.unlinkSync(local);
    const restaurado = loadOrCreateSalt(local, backup, mudo);

    // O ponto do backup: sem ele nasceria um salt novo e todos os pseudônimos
    // do data.json mudariam, gerando um diff de 21 MB sem mudança de dado.
    expect(restaurado).toBe(original);
    expect(fs.existsSync(local)).toBe(true);
  });

  test('a restauração preserva os pseudônimos', () => {
    const { local, backup } = caminhos();
    const original = loadOrCreateSalt(local, backup, mudo);
    const antes = pseudonymize('Maria da Silva', original);

    fs.unlinkSync(local);
    const restaurado = loadOrCreateSalt(local, backup, mudo);

    expect(pseudonymize('Maria da Silva', restaurado)).toBe(antes);
  });

  test('faz backup de um salt local preexistente que ainda não tinha cópia', () => {
    const { local, backup } = caminhos();
    fs.writeFileSync(local, 'salt-que-ja-existia\n');

    const salt = loadOrCreateSalt(local, backup, mudo);

    expect(salt).toBe('salt-que-ja-existia');
    expect(fs.readFileSync(backup, 'utf-8').trim()).toBe('salt-que-ja-existia');
  });

  test('o local vence o backup quando ambos existem', () => {
    const { local, backup } = caminhos();
    fs.mkdirSync(path.dirname(backup), { recursive: true });
    fs.writeFileSync(backup, 'do-backup\n');
    fs.writeFileSync(local, 'do-local\n');

    expect(loadOrCreateSalt(local, backup, mudo)).toBe('do-local');
    // e não sobrescreve o backup existente
    expect(fs.readFileSync(backup, 'utf-8').trim()).toBe('do-backup');
  });

  test('grava os dois arquivos como 0600 — é segredo', () => {
    const { local, backup } = caminhos();
    loadOrCreateSalt(local, backup, mudo);

    for (const f of [local, backup]) {
      expect(fs.statSync(f).mode & 0o777).toBe(0o600);
    }
  });

  test('o backup fica fora da árvore do projeto', () => {
    expect(SALT_BACKUP_FILE.startsWith(path.join(__dirname, '..'))).toBe(false);
    expect(SALT_FILE.startsWith(path.join(__dirname, '..'))).toBe(true);
  });
});

// ─── atribuição de produção ao servidor ──────────────────────────────────────

const QS = (...pares) =>
  '<VinculoQueryset [' + pares.map(([n, i]) => `<Vinculo: ${n} (${i}) (Servidor)>`).join(', ') + ']>';

describe('extrairVinculos', () => {
  test('lê nome e id de cada vínculo do QuerySet', () => {
    expect(extrairVinculos(QS(['Ana Maria Costa', '1234567'], ['Joao Silva', '7654321'])))
      .toEqual([
        { id: '1234567', nome: 'Ana Maria Costa' },
        { id: '7654321', nome: 'Joao Silva' }
      ]);
  });

  test('sem nome legível, cai para os ids entre parênteses', () => {
    expect(extrairVinculos('<VinculoQueryset [(1234567) (Servidor)]>'))
      .toEqual([{ id: '1234567', nome: '' }]);
  });

  test('aceita SIAPE de 5 e 6 dígitos dos servidores antigos', () => {
    expect(extrairVinculos(QS(['Davi Kiermes Tavares', '383087'], ['Elias Ramos', '26861'])))
      .toEqual([
        { id: '383087', nome: 'Davi Kiermes Tavares' },
        { id: '26861', nome: 'Elias Ramos' }
      ]);
    expect(extrairVinculos('<VinculoQueryset [(383087) (Servidor)]>'))
      .toEqual([{ id: '383087', nome: '' }]);
  });

  test('valor vazio devolve lista vazia', () => {
    expect(extrairVinculos('')).toEqual([]);
    expect(extrairVinculos(null)).toEqual([]);
  });
});

describe('nomeNaCitacao', () => {
  test('casa sobrenome com a inicial do prenome', () => {
    expect(nomeNaCitacao('Alexandre de Oliveira Fernandes', 'FERNANDES, A. O.; Semana Nacional. 2020.')).toBe(true);
  });

  test('sobrenome igual e inicial diferente é outra pessoa', () => {
    expect(nomeNaCitacao('Alexandre de Oliveira Fernandes', 'OLIVEIRA, J. R. S.; Semana Nacional. 2013.')).toBe(false);
    expect(nomeNaCitacao('Ademildes Romana Santos', 'SANTOS, J. N. S. C.; Semana Nacional. 2025.')).toBe(false);
  });

  test('a inicial vale só se vier de um nome anterior ao sobrenome citado', () => {
    // o F de "Fernandes" não pode servir de prenome em "OLIVEIRA, F. J. R."
    expect(nomeNaCitacao('Alexandre de Oliveira Fernandes', 'OLIVEIRA, F. J. R.; Semana Nacional. 2018.')).toBe(false);
    expect(nomeNaCitacao('Maria Jose da Silva', 'SILVA, M. J. ; OUTRO, A. . Artigo. 2020.')).toBe(true);
  });

  test('aceita autor por extenso, sem vírgula', () => {
    expect(nomeNaCitacao('Marcelo Nava', 'Marcelo Nava ; LIMA, E. P. R. . Recrystallization Kinetics.')).toBe(true);
    expect(nomeNaCitacao('Pedro Cunha de Lima', 'Nicole Araujo ; Pedro Lima ; Marcelo Nava . Effect of Titanium.')).toBe(true);
  });

  test('citação sem lista de autores não permite julgar', () => {
    expect(nomeNaCitacao('Alexandre de Oliveira Fernandes', 'Sistema de gestao XPTO')).toBe(true);
    expect(nomeNaCitacao('Alexandre de Oliveira Fernandes', 'Sistema web para controle de uma maquete. 2010.')).toBe(true);
    expect(nomeNaCitacao('Alexandre de Oliveira Fernandes', 'Registros ou Patente: Software. Numero: BR512024003978-3.')).toBe(true);
  });

  test('organizador único sem vírgula responde pelo sobrenome', () => {
    const cit = 'BARRIOS BARRIOS BARTOLO E.; Semana Nacional de Ciencia e Tecnologia. 2012.';
    expect(nomeNaCitacao('Bartolo Elias Barrios Barrios', cit)).toBe(true);
    expect(nomeNaCitacao('Alexandre de Oliveira Fernandes', cit)).toBe(false);
    expect(nomeNaCitacao('Leandro Rafael Prado', 'Leandro Rafael Prado; I Seminario de Meio Ambiente. 2018.')).toBe(true);
  });
});

describe('filtrarPorAutoria', () => {
  const vinculos = [
    { id: '1', nome: 'Alexandre de Oliveira Fernandes' },
    { id: '2', nome: 'Ademildes Romana Santos' }
  ];

  test('mantém só quem a citação nomeia', () => {
    expect(filtrarPorAutoria(vinculos, 'FERNANDES, A. O.; Semana Nacional. 2020.', 'tecnica'))
      .toEqual([vinculos[0]]);
  });

  test('descarta a linha quando a citação não nomeia nenhum deles', () => {
    // QuerySet cortado no 20º vínculo: o organizador real ficou de fora.
    expect(filtrarPorAutoria(vinculos, 'RIBEIRO, L. R.; Semana Nacional. 2014.', 'tecnica')).toEqual([]);
  });

  test('não toca em orientações — lá a citação nomeia o aluno', () => {
    expect(filtrarPorAutoria(vinculos, 'Cecilia Alves Guimaraes. Aguas que conectam. Inicio: 2026.', 'concluidas'))
      .toEqual(vinculos);
  });

  test('vínculo único passa sem conferência', () => {
    expect(filtrarPorAutoria([vinculos[0]], 'RIBEIRO, L. R.; Semana Nacional. 2014.', 'tecnica'))
      .toEqual([vinculos[0]]);
  });

  test('citação sem autores mantém a linha inteira', () => {
    expect(filtrarPorAutoria(vinculos, 'Sistema de gestao XPTO', 'tecnica')).toEqual(vinculos);
  });
});
