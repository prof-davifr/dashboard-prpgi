#!/usr/bin/env node
// build.js  Pre-processes all XLSX + CSV data files into a single data.json
// Run: node build.js   (or: npm run build)

const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const DADOS_DIR = path.join(__dirname, 'dados');
const OUTPUT_FILE = path.join(__dirname, 'data.json');
const OUTPUT_GROUPS = path.join(__dirname, 'data-groups.json');

// Normalize non-standard campus codes that appear in filenames or raw data
const CAMPUS_CODE_FIX = {
  'VDC': 'VC',   // Vitória da Conquista (common typo)
  'FSA': 'FS',   // Feira de Santana (typo)
  'PAF': 'PA',   // Paulo Afonso (typo)
};

function normalizeCampusCode(raw) {
  const upper = (raw || '').toString().trim().toUpperCase();
  return CAMPUS_CODE_FIX[upper] || upper;
}

const SOURCE_LABELS = {
  'scraper-SUAPCNPQ': 'SUAP CNPq (Lattes)',
  'scraper-DGP': 'DGP',
  'scraper-SUAPPos': 'SUAP Pós-Graduação',
  'ic': 'IC (Iniciação Científica)'
};

const SHEET_MAP = {
  'produções bibliográficas': 'bibliografica',
  'produções técnicas': 'tecnica',
  'registros e patentes': 'inovacao',
  'orientações concluídas': 'concluidas',
  'orientações em andamento': 'andamento',
  // Title-case variants (new scraper format)
  'Produções Bibliográficas': 'bibliografica',
  'Produções Técnicas': 'tecnica',
  'Registros e Patentes': 'inovacao',
  'Orientações Concluídas': 'concluidas',
  'Orientações em Andamento': 'andamento'
};

function findFiles(dir, extension) {
    const results = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            results.push(...findFiles(fullPath, extension));
        } else if (entry.name.endsWith(extension) && !entry.name.startsWith('.~lock')) {
            results.push({
                filePath: fullPath,
                fileName: entry.name
            });
        }
    }
    return results;
}

function parseCSV(filePath) {
  const text = fs.readFileSync(filePath, 'utf-8');
  const rows = text.split('\n').map(r => r.trim()).filter(r => r);
  const headers = rows[0].split(',').map(h => h.replace(/^"|"$/g, '').trim())
                       .map(h => h.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ''));
  
  return rows.slice(1).map(line => {
    // Parse CSV line handling quoted fields with commas
    const obj = {};
    let currentIndex = 0;
    let insideQuotes = false;
    let currentField = '';
    const fields = [];
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = i < line.length - 1 ? line[i + 1] : '';
      
      if (char === '"') {
        if (insideQuotes && nextChar === '"') {
          // Escaped quote inside quotes
          currentField += '"';
          i++; // Skip next char
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (char === ',' && !insideQuotes) {
        // End of field
        fields.push(currentField);
        currentField = '';
      } else {
        currentField += char;
      }
    }
    // Add last field
    fields.push(currentField);
    
    // Map to headers
    headers.forEach((h, i) => {
      if (i < fields.length) {
        obj[h] = fields[i].trim();
      } else {
        obj[h] = '';
      }
    });
    
    return obj;
  });
}

function getSourceKey(filePath) {
  const relPath = path.relative(DADOS_DIR, filePath);
  const parts = relPath.split(path.sep);
  return parts[0] || 'desconhecido';
}

function registerSourceFile(meta, filePath, fileName) {
  const sourceKey = getSourceKey(filePath);
  if (!meta.sourceFiles[sourceKey]) {
    meta.sourceFiles[sourceKey] = [];
  }
  meta.sourceFiles[sourceKey].push(fileName);

  try {
    const stat = fs.statSync(filePath);
    const createdAt = stat.birthtime instanceof Date && !Number.isNaN(stat.birthtime.getTime())
      ? stat.birthtime.toISOString()
      : null;
    const modifiedAt = stat.mtime instanceof Date && !Number.isNaN(stat.mtime.getTime())
      ? stat.mtime.toISOString()
      : null;

    if (!meta.sourceDates[sourceKey]) {
      meta.sourceDates[sourceKey] = {
        label: SOURCE_LABELS[sourceKey] || sourceKey,
        createdAt,
        modifiedAt,
        fileCount: 1
      };
      return;
    }

    meta.sourceDates[sourceKey].fileCount += 1;
    if (createdAt && (!meta.sourceDates[sourceKey].createdAt || createdAt > meta.sourceDates[sourceKey].createdAt)) {
      meta.sourceDates[sourceKey].createdAt = createdAt;
    }
    if (modifiedAt && (!meta.sourceDates[sourceKey].modifiedAt || modifiedAt > meta.sourceDates[sourceKey].modifiedAt)) {
      meta.sourceDates[sourceKey].modifiedAt = modifiedAt;
    }
  } catch (e) {
    if (!meta.sourceDates[sourceKey]) {
      meta.sourceDates[sourceKey] = {
        label: SOURCE_LABELS[sourceKey] || sourceKey,
        createdAt: null,
        modifiedAt: null,
        fileCount: 1
      };
      return;
    }
    meta.sourceDates[sourceKey].fileCount += 1;
  }
}

function isPostGraduationCsv(fileName) {
  return fileName.toLowerCase().includes('alunos_pos');
}

function isDgpGroupsCsv(filePath, fileName) {
  return getSourceKey(filePath) === 'scraper-DGP' && !isPostGraduationCsv(fileName);
}

function selectDgpGroupsCsvFiles(csvFiles) {
  const dgpGroupFiles = csvFiles.filter(({ filePath, fileName }) => isDgpGroupsCsv(filePath, fileName));
  if (dgpGroupFiles.length === 0) {
    return {
      selected: null,
      ignored: []
    };
  }

  const validCollectors = dgpGroupFiles.filter(({ fileName }) => {
    const lowerName = fileName.toLowerCase();
    if (!lowerName.startsWith('coletor')) return false;
    if (/_old\.csv$/i.test(fileName)) return false;
    return true;
  });

  if (validCollectors.length === 0) {
    return {
      selected: null,
      ignored: dgpGroupFiles
    };
  }

  const withMtime = validCollectors.map(file => {
    try {
      const stat = fs.statSync(file.filePath);
      return { ...file, mtimeMs: stat.mtimeMs || 0 };
    } catch (e) {
      return { ...file, mtimeMs: 0 };
    }
  });

  withMtime.sort((a, b) => b.mtimeMs - a.mtimeMs);
  const selected = withMtime[0];

  const ignored = dgpGroupFiles.filter(file => file.filePath !== selected.filePath);
  return { selected, ignored };
}

function main() {
  console.log(' Scanning dados/ for .xlsx and .csv files recursively...');

  const xlsFiles = findFiles(DADOS_DIR, '.xlsx').filter(f => getSourceKey(f.filePath) !== 'ic');
  const csvFiles = findFiles(DADOS_DIR, '.csv');
  const dgpCsvSelection = selectDgpGroupsCsvFiles(csvFiles);

  const csvFilesToProcess = csvFiles.filter(file => {
    if (!isDgpGroupsCsv(file.filePath, file.fileName)) return true;
    return dgpCsvSelection.selected && file.filePath === dgpCsvSelection.selected.filePath;
  });

  console.log(`   Found ${xlsFiles.length} XLSX files and ${csvFiles.length} CSV files.`);
  if (dgpCsvSelection.selected) {
    console.log(`   Using DGP groups source: ${dgpCsvSelection.selected.fileName}`);
  }
  if (dgpCsvSelection.ignored.length > 0) {
    console.log(`   Ignoring ${dgpCsvSelection.ignored.length} historical/extra DGP CSV file(s).`);
  }

  const result = {
    meta: {
      files: xlsFiles.map(f => f.fileName),
      sourceFiles: {},
      sourceDates: {},
      campuses: [],
      minYear: 9999,
      maxYear: 0,
      generatedAt: new Date().toISOString()
    },
    bibliografica: [],
    tecnica: [],
    inovacao: [],
    concluidas: [],
    andamento: [],
    grupos: [],
    posgraduacao: [],
    ic: []
  };

  // Process XLS files
  for (const { fileName, filePath } of xlsFiles) {
    registerSourceFile(result.meta, filePath, fileName);
    // Campus code is the filename without extension, normalized (e.g. VDC.xlsx → VC)
    const campusCode = normalizeCampusCode(path.basename(fileName, path.extname(fileName)));

    if (!result.meta.campuses.includes(campusCode)) {
      result.meta.campuses.push(campusCode);
    }

    console.log(`    Processing ${fileName} (campus: ${campusCode})...`);

    try {
      const workbook = XLSX.readFile(filePath);

      for (const sheetName of workbook.SheetNames) {
        const key = SHEET_MAP[sheetName.trim().toLowerCase()] || SHEET_MAP[sheetName.trim()];
        if (!key) continue;

        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { raw: false, defval: null });

        // Track year range from row data
        for (const r of rows) {
          const y = parseInt(r["Ano"]);
          if (!isNaN(y)) {
            if (y < result.meta.minYear) result.meta.minYear = y;
            if (y > result.meta.maxYear) result.meta.maxYear = y;
          }
        }
        
        const normalizeKey = r => {
          const raw = r["Título"] || r["Nome"] || (r["Publicação"] || "").substring(0, 150);
          if (!raw) return "";
          return raw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/gi, "").substring(0, 150);
        };

        const tagged = rows.flatMap(r => {
          // Extract all Servidor IDs from the VinculoQueryset string (multi-author support)
          const srvIds = [];
          if (r["Servidor"]) {
            const allMatches = [...r["Servidor"].matchAll(/\((\d{7,})\)/g)];
            if (allMatches.length > 0) {
              allMatches.forEach(m => srvIds.push(m[1]));
            } else {
              srvIds.push(r["Servidor"]);
            }
          } else {
            srvIds.push(null);
          }
          const base = {
             Ano: r["Ano"],
             Tipo: r["Tipo"],
             campus: campusCode,
             dedupKey: normalizeKey(r)
          };
          if (r["Estrato"]) base.Estrato = r["Estrato"];
          return srvIds.map(srvId => ({ ...base, Servidor: srvId }));
        });
        result[key].push(...tagged);
      }
    } catch (e) {
      console.warn(`     Failed to parse ${fileName}: ${e.message}`);
    }
  }

  // Process CSV files
  for (const { fileName, filePath } of csvFilesToProcess) {
    registerSourceFile(result.meta, filePath, fileName);
    console.log(`    Processing ${fileName}...`);
    try {
      const rows = parseCSV(filePath);
      
      // Check if this is the post-graduation CSV
      if (isPostGraduationCsv(fileName)) {
        // Process post-graduation data
         const mapped = rows.map(r => {
           // Extract year and semester from ano/periodo_letivo
           let ano = null;
           let semestre = null;
           const anoPeriodo = r["ano/periodo_letivo"];
           if (anoPeriodo && anoPeriodo.match(/^\d{4}\.\d$/)) {
             const parts = anoPeriodo.split('.');
             ano = parseInt(parts[0]);
             semestre = parseInt(parts[1]);
             
             // Update meta year range
             if (ano < result.meta.minYear) result.meta.minYear = ano;
             if (ano > result.meta.maxYear) result.meta.maxYear = ano;
           }
           
           // Determine categoria from modalidade and curso
           let categoria = r["modalidade"] || "";
           const curso = r["curso"] || "";
           
           // Clean up categoria - remove year/period if present
           if (categoria && categoria.match(/^\d{4}\.\d$/)) {
             categoria = ''; // This is actually a year/period, not a category
           }
           
           // If categoria is empty or invalid, infer from curso name
           if (!categoria || !['Mestrado', 'Doutorado', 'Especializao'].includes(categoria)) {
             const cursoLower = curso.toLowerCase();
             if (cursoLower.includes('doutorado')) categoria = 'Doutorado';
             else if (cursoLower.includes('mestrado')) categoria = 'Mestrado';
             else if (cursoLower.includes('especializao') || cursoLower.includes('lato sensu') || cursoLower.includes('ps-graduao')) categoria = 'Especializao';
             else categoria = 'Outro'; // Fallback
           }
           
           // Simplify curso name
           let curso_simplificado = curso;
           if (curso_simplificado) {
             // Remove leading numbers and dash
             curso_simplificado = curso_simplificado.replace(/^\d+\s*-\s*/, '');
             // Remove campus in parentheses at the end
             curso_simplificado = curso_simplificado.replace(/\s*\([^)]*\)$/, '');
             // Trim extra spaces
             curso_simplificado = curso_simplificado.trim();
           }
           
           // Normalize campus code
           let campus = r["campus"] || "";
           // Clean up campus field - remove quotes and trim
           campus = campus.replace(/^"|"$/g, '').trim();
           
           // Handle special cases
           if (campus === ' Lato Sensu') {
             // This appears to be Ubaitaba based on the original data
             campus = 'UBA';
           } else if (campus.includes('(')) {
             // Extract campus code from parentheses
             const match = campus.match(/\(([^)]+)\)/);
             if (match) {
               campus = match[1].trim();
             }
           }
           
           // Map common campus names to codes
           const campusMap = {
             'Salvador': 'SSA',
             'Brumado': 'BRU',
             'Camaari': 'CAM', 
             'Jequi': 'JEQ',
             'Porto Seguro': 'PS',
             'Ubaitaba': 'UBA',
             'Valena': 'VAL',
             'Vitria da Conquista': 'VC',
             'Bom Jesus da Lapa': 'BJL',
             'Itabuna': 'ITB',
             'Juazeiro': 'JUA',
             'Lauro de Freitas': 'LF',
             'Macaubas': 'MCB',
             'Paulo Afonso': 'PA'
           };
           
           if (campusMap[campus]) {
             campus = campusMap[campus];
           }
           
           // Normalize non-standard codes (VDC→VC, etc.)
           campus = normalizeCampusCode(campus);
           
           // Only add standard campus codes (2-3 letters)
           if (campus && /^[A-Z]{2,3}$/.test(campus) && !result.meta.campuses.includes(campus)) {
             result.meta.campuses.push(campus);
           }
           
           // Clean up status field
           let situacao = r["situacao"] || "";
           situacao = situacao.replace(/^"|"$/g, '').trim();
           // Remove malformed suffixes
           if (situacao.includes('(')) {
             situacao = situacao.split('(')[0].trim();
           }
           
           // Skip records with no matricula or invalid ano
           if (!r["matricula"] || !ano) return null;

           return {
             nome: r["nome"],
             matricula: r["matricula"],
             curso: curso_simplificado,
             curso_original: curso,
             campus: campus,
             polo: r["polo"],
             situacao: situacao,
             email_academico: r["e-mail_academico"],
             email_pessoal: r["e-mail_pessoal"],
             ano: ano,
             semestre: semestre,
             ano_periodo: anoPeriodo,
             modalidade: r["modalidade"],
             categoria: categoria,
             dedupKey: r["matricula"] // Use matricula as dedup key
           };
         }).filter(r => r !== null);
         result.posgraduacao.push(...mapped);
       } else {
         // Process research groups data — data.json gets lightweight version
         const mapped = rows.map(r => {
           let unidade = (r["Unidade"] || "").trim();
           if (!unidade ||
               unidade.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').startsWith("instituto federal da bahia") ||
               unidade.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').startsWith("instituto federal de educacao")) {
             unidade = "Salvador";
           }

           return {
             Situacao: r["Situacao"],
             AnoFormacao: r["AnoFormacao"],
             Pesquisadores: r["Pesquisadores"],
             Estudantes: r["Estudantes"],
             Area: r["Area"],
             UltimoEnvio: r["UltimoEnvio"],
             Unidade: unidade
           };
         });
         result.grupos.push(...mapped);
       }
    } catch (e) {
      console.warn(`     Failed to parse ${fileName}: ${e.message}`);
    }
  }

  // ─── Process IC Excel file ──────────────────────────────────────────────────
  const icDir = path.join(DADOS_DIR, 'ic');
  if (fs.existsSync(icDir)) {
    const icFiles = findFiles(icDir, '.xlsx');
    const campusMap = {
      'salvador': 'SSA', 'brumado': 'BRU', 'camaçari': 'CAM', 'camacari': 'CAM',
      'campo formoso': 'CFO', 'euclides da cunha': 'EC', 'eunápolis': 'EUN', 'eunapolis': 'EUN',
      'feira de santana': 'FS', 'ilhéus': 'ILH', 'ilheus': 'ILH', 'irecê': 'IRE', 'irece': 'IRE',
      'jacobina': 'JAC', 'jaguaquara': 'JAG', 'jequié': 'JEQ', 'jequie': 'JEQ',
      'juazeiro': 'JUA', 'lauro de freitas': 'LF', 'paulo afonso': 'PA',
      'porto seguro': 'PS', 'santo antônio de jesus': 'SAJ', 'santo antonio de jesus': 'SAJ',
      'santo amaro': 'SAM', 'seabra': 'SEA', 'simões filho': 'SF', 'simoes filho': 'SF',
      'ubaitaba': 'UBA', 'valença': 'VAL', 'valenca': 'VAL',
      'vitória da conquista': 'VC', 'vitoria da conquista': 'VC',
      'barreiras': 'BAR', 'polo de inovação salvador': 'PIS', 'polo de inovacao salvador': 'PIS',
      'rei': 'SSA', 'paf': 'PA'
    };
    for (const { fileName, filePath } of icFiles) {
      registerSourceFile(result.meta, filePath, fileName);
      try {
        const workbook = XLSX.readFile(filePath);
        for (const sheetName of workbook.SheetNames) {
          if (!sheetName.startsWith('Ciclo')) continue;
          const yearMatch = sheetName.match(/(\d{4})/);
          const ano = yearMatch ? parseInt(yearMatch[1]) : null;
          if (!ano) continue;
          const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
            raw: false, defval: null, header: 1
          });
          // SheetJS header:1 → 0-indexed rows
          // Row 2: header ("Nº","Orientador","Bolsista","Curso do bolsista","Campus",...)
          // Row 3+: data
          // Columns: 0=Nº, 1=Orientador, 2=Bolsista, 3=Curso, 4=Campus,
          //          5=Título, 6=Área, 7=Modalidade, 8=Titulação, 9=Progresso, 10=Fomento
          for (let i = 3; i < rows.length; i++) {
            const row = rows[i];
            if (!row || !row[1]) continue; // Skip rows without orientador
            const campusRaw = (row[4] || '').toString().trim();
            if (!campusRaw) continue;
            // Normalize campus: check if it's already a code (2-3 letters) or a city name
            let campusCode = campusRaw.toUpperCase();
            // Override non-standard codes like REI (Reitoria) and PAF (Paulo Afonso typo)
            const codeOverride = { 'REI': 'SSA', 'PAF': 'PA' };
            if (codeOverride[campusCode]) campusCode = codeOverride[campusCode];
            if (!/^[A-Z]{2,3}$/.test(campusCode)) {
              const cityKey = campusRaw.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
              campusCode = campusMap[cityKey];
              if (!campusCode) continue;
            }
            if (!result.meta.campuses.includes(campusCode)) {
              result.meta.campuses.push(campusCode);
            }
            if (ano < result.meta.minYear) result.meta.minYear = ano;
            if (ano > result.meta.maxYear) result.meta.maxYear = ano;
            result.ic.push({
              ano,
              campus: campusCode,
              orientador: (row[1] || '').toString().trim(),
              bolsista: (row[2] || '').toString().trim(),
              curso_bolsista: (row[3] || '').toString().trim(),
              titulo: (row[5] || '').toString().trim(),
              area_conhecimento: (row[6] || '').toString().trim(),
              modalidade: (row[7] || '').toString().trim(),
              titulacao_orientador: (row[8] || '').toString().trim(),
              progresso: (row[9] || '').toString().trim(),
              fomento: (row[10] || '').toString().trim()
            });
          }
        }
      } catch (e) {
        console.warn(`     Failed to parse IC file ${fileName}: ${e.message}`);
      }
    }
  }

  result.meta.campuses.sort();

  // Write data.json (lightweight — for dashboard)
  const jsonStr = JSON.stringify(result, (key, value) => value === null ? undefined : value);
  fs.writeFileSync(OUTPUT_FILE, jsonStr);

  const sizeMB = (Buffer.byteLength(jsonStr) / 1024 / 1024).toFixed(2);
  console.log(`\n Built data.json (${sizeMB} MB)`);
  console.log(`   ${result.bibliografica.length} bibliogrfica, ${result.tecnica.length} tcnica, ${result.inovacao.length} inovao`);
  console.log(`   ${result.concluidas.length} concludas, ${result.andamento.length} andamento, ${result.grupos.length} grupos`);
  console.log(`   ${result.posgraduacao.length} ps-graduao`);
  console.log(`   ${result.ic.length} IC (Iniciao Cientfica)`);
  console.log(`   Period: ${result.meta.minYear}-${result.meta.maxYear}`);
  console.log(`   Updated at (UTC): ${result.meta.generatedAt}`);
  console.log(`   Campuses: ${result.meta.campuses.join(', ')}`);

  // ─── Build data-groups.json (detailed — for relatorio-gp) ──────────────────
  console.log('\n Building data-groups.json (detailed)...');

  // Helper: normalize a person's name for fuzzy matching
  const normalizeName = (s) =>
    (s || "").trim().toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ");

  // Maps built during xlsx pass: id→name and normalizedName→id
  const servidorIdToName = {}; // { "2419000": "Antonio Carlos dos Santos Souza" }
  const servidorNameToId = {}; // { "antonio carlos dos santos souza": "2419000" }

  // Re-process XLS files with full detail
  const detailedProductions = {
    bibliografica: [],
    tecnica: [],
    inovacao: [],
    concluidas: [],
    andamento: []
  };

  for (const { fileName, filePath } of xlsFiles) {
    const campusCode = path.basename(fileName, path.extname(fileName));
    try {
      const workbook = XLSX.readFile(filePath);
      for (const sheetName of workbook.SheetNames) {
        const key = SHEET_MAP[sheetName.trim().toLowerCase()] || SHEET_MAP[sheetName.trim()];
        if (!key) continue;

        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { raw: false, defval: null });
        const tagged = rows.flatMap(r => {
          // Extract all Servidor name+ID pairs from VinculoQueryset string
          // Format: <Vinculo: Nome Completo (ID) (Servidor)>
          const srvIds = [];
          if (r["Servidor"]) {
            const allMatches = [...r["Servidor"].matchAll(/Vinculo: (.+?) \((\d{7,})\)/g)];
            if (allMatches.length > 0) {
              allMatches.forEach(m => {
                const name = m[1].trim();
                const id = m[2];
                srvIds.push(id);
                if (!servidorIdToName[id]) {
                  servidorIdToName[id] = name;
                  servidorNameToId[normalizeName(name)] = id;
                }
              });
            } else {
              // Fallback: try numeric-only match
              const fallback = [...r["Servidor"].matchAll(/\((\d{7,})\)/g)];
              fallback.forEach(m => srvIds.push(m[1]));
              if (srvIds.length === 0) srvIds.push(r["Servidor"]);
            }
          } else {
            srvIds.push(null);
          }
          const rawTitle = r["Publicação"] || r["Título"] || r["Nome"] || "";
          const dedupKey = rawTitle
            ? rawTitle.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/gi, "").substring(0, 150)
            : "";
          const base = {
            Ano: r["Ano"],
            Tipo: r["Tipo"],
            campus: campusCode,
            dedupKey,
          };
          // Tag orientation records so the scoring engine knows which array they came from
          if (key === 'concluidas') base.concluida = true;
          if (key === 'andamento') base.concluida = false;
          if (r["Estrato"]) base.Estrato = r["Estrato"];
          if (r["Publicação"]) base.Publicacao = r["Publicação"];
          if (r["Periódico/Revista"]) base.Periodico = r["Periódico/Revista"];
          if (r["ISSN"]) base.ISSN = r["ISSN"];
          return srvIds.map(srvId => ({ ...base, Servidor: srvId }));
        });
        detailedProductions[key].push(...tagged);
      }
    } catch (e) {
      console.warn(`     Skipping ${fileName} for detailed: ${e.message}`);
    }
  }

  // Re-process DGP CSV with full detail
  const detailedGroups = [];
  for (const { fileName, filePath } of csvFilesToProcess) {
    if (isPostGraduationCsv(fileName)) continue;
    try {
      const rows = parseCSV(filePath);
      const mapped = rows.map(r => {
        let unidade = (r["Unidade"] || "").trim();
        if (!unidade ||
            unidade.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').startsWith("instituto federal da bahia") ||
            unidade.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').startsWith("instituto federal de educacao")) {
          unidade = "Salvador";
        }
        const pesquisadoresNomes = r["Pesquisadores(Nomes)"] || "";
        // Resolve DGP researcher names → Servidor IDs using the name map
        // built during XLSX pass. Normalizes accents and case for fuzzy match.
        // Deduplicate both names and resolved IDs to avoid inflating counts.
        const uniqueNomes = [...new Set(
          pesquisadoresNomes.split(";").map(n => n.trim()).filter(Boolean)
        )];
        const membrosMap = uniqueNomes.map(n => ({
          nome: n,
          siape: servidorNameToId[normalizeName(n)] || null
        }));
        const membroIds = [...new Set(membrosMap.map(m => m.siape).filter(Boolean))];
        const pesquisadoresNomesDedup = uniqueNomes.join("; ");
        return {
          Nome: r["NomeBase"] || "",
          Situacao: r["Situacao"],
          AnoFormacao: r["AnoFormacao"],
          LinhasPesquisa: r["LinhasdePesquisa"] || "",
          Pesquisadores: r["Pesquisadores"],
          PesquisadoresNomes: pesquisadoresNomesDedup,
          membrosMap,
          membroIds,
          Lider: r["Lder"] || r["Lider"] || "",
          LiderId: servidorNameToId[normalizeName(r["Lder"] || r["Lider"] || "")] || null,
          ViceLider: r["Vice-Lder"] || r["ViceLider"] || "",
          Contato: r["Contato"] || "",
          Tecnicos: r["Tcnicos"] || r["Tecnicos"] || "",
          Estudantes: r["Estudantes"],
          Area: r["Area"],
          UltimoEnvio: r["UltimoEnvio"],
          Unidade: unidade,
          InstituicoesParceiras: r["InstituiesParceiras"] || r["InstituicoesParceiras"] || ""
        };
      });
      detailedGroups.push(...mapped);
    } catch (e) {
      console.warn(`     Skipping ${fileName} for detailed groups: ${e.message}`);
    }
  }

  const groupsData = {
    grupos: detailedGroups,
    producoes: detailedProductions,
    meta: {
      generatedAt: result.meta.generatedAt,
      sourceDates: result.meta.sourceDates
    }
  };

  const groupsJsonStr = JSON.stringify(groupsData, (key, value) => value === null ? undefined : value);
  fs.writeFileSync(OUTPUT_GROUPS, groupsJsonStr);

  const groupsSizeMB = (Buffer.byteLength(groupsJsonStr) / 1024 / 1024).toFixed(2);
  console.log(` Built data-groups.json (${groupsSizeMB} MB)`);
  console.log(`   ${detailedGroups.length} grupos detalhados`);
  console.log(`   ${detailedProductions.bibliografica.length} bibliogrfica, ${detailedProductions.tecnica.length} tcnica, ${detailedProductions.inovacao.length} inovao`);
  console.log(`   ${detailedProductions.concluidas.length} concludas, ${detailedProductions.andamento.length} andamento`);
}

if (require.main === module) {
  main();
}

module.exports = {
  findFiles,
  parseCSV,
  getSourceKey,
  registerSourceFile,
  isPostGraduationCsv,
  isDgpGroupsCsv,
  selectDgpGroupsCsvFiles,
  SHEET_MAP,
  SOURCE_LABELS
};
