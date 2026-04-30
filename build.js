#!/usr/bin/env node
// build.js  Pre-processes all XLSX + CSV data files into a single data.json
// Run: node build.js   (or: npm run build)

const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const DADOS_DIR = path.join(__dirname, 'dados');
const OUTPUT_FILE = path.join(__dirname, 'data.json');
const SOURCE_LABELS = {
  'scraper-SUAPCNPQ': 'SUAP CNPq (Lattes)',
  'scraper-DGP': 'DGP',
  'scraper-SUAPPos': 'SUAP Ps-Graduao'
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

function main() {
  console.log(' Scanning dados/ for .xlsx and .csv files recursively...');

  const xlsFiles = findFiles(DADOS_DIR, '.xlsx');
  const csvFiles = findFiles(DADOS_DIR, '.csv');

  console.log(`   Found ${xlsFiles.length} XLSX files and ${csvFiles.length} CSV files.`);

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
    posgraduacao: []
  };

  // Process XLS files
  for (const { fileName, filePath } of xlsFiles) {
    registerSourceFile(result.meta, filePath, fileName);
    // Campus code is the filename without extension (e.g. SSA.xlsx → SSA)
    const campusCode = path.basename(fileName, path.extname(fileName));

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
          const raw = r["Ttulo"] || r["Nome"] || (r["Publicao"] || "").substring(0, 150);
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
              // Fallback: store the raw value if no numeric ID found
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
          // One result row per unique Servidor ID so all co-authors are counted
          return srvIds.map(srvId => ({ ...base, Servidor: srvId }));
        });
        result[key].push(...tagged);
      }
    } catch (e) {
      console.warn(`     Failed to parse ${fileName}: ${e.message}`);
    }
  }

  // Process CSV files
  for (const { fileName, filePath } of csvFiles) {
    registerSourceFile(result.meta, filePath, fileName);
    console.log(`    Processing ${fileName}...`);
    try {
      const rows = parseCSV(filePath);
      
      // Check if this is the post-graduation CSV
      if (fileName.includes('alunos_pos')) {
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
        // Process research groups data
        const mapped = rows.map(r => {
          // Normalize Unidade: map generic institution strings and empty values to "Salvador"
          // so map pins are placed correctly at IFBA headquarters.
          let unidade = (r["Unidade"] || "").trim();
          if (!unidade ||
              unidade.toLowerCase().startsWith("instituto federal da bahia") ||
              unidade.toLowerCase().startsWith("instituto federal de educao")) {
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

  result.meta.campuses.sort();

  // Write output  strip null values to reduce size
  const jsonStr = JSON.stringify(result, (key, value) => value === null ? undefined : value);
  fs.writeFileSync(OUTPUT_FILE, jsonStr);

  const sizeMB = (Buffer.byteLength(jsonStr) / 1024 / 1024).toFixed(2);
  console.log(`\n Built data.json (${sizeMB} MB)`);
  console.log(`   ${result.bibliografica.length} bibliogrfica, ${result.tecnica.length} tcnica, ${result.inovacao.length} inovao`);
  console.log(`   ${result.concluidas.length} concludas, ${result.andamento.length} andamento, ${result.grupos.length} grupos`);
  console.log(`   ${result.posgraduacao.length} ps-graduao`);
  console.log(`   Period: ${result.meta.minYear}-${result.meta.maxYear}`);
  console.log(`   Updated at (UTC): ${result.meta.generatedAt}`);
  console.log(`   Campuses: ${result.meta.campuses.join(', ')}`);
}

if (require.main === module) {
  main();
}

module.exports = { findFiles, parseCSV, getSourceKey, registerSourceFile, SHEET_MAP, SOURCE_LABELS };
