#!/usr/bin/env node
// build.js – Pre-processes all XLS + CSV data files into a single data.json
// Run: node build.js   (or: npm run build)

const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const DADOS_DIR = path.join(__dirname, 'dados');
const OUTPUT_FILE = path.join(__dirname, 'data.json');

const SHEET_MAP = {
  'produções bibliográficas': 'bibliografica',
  'produções técnicas': 'tecnica',
  'registros e patentes': 'inovacao',
  'orientações concluídas': 'concluidas',
  'orientações em andamento': 'andamento'
};

function parseCSV(filePath) {
  const text = fs.readFileSync(filePath, 'utf-8');
  const rows = text.split('\n').map(r => r.trim()).filter(r => r);
  const headers = rows[0].split(',').map(h => h.replace(/^"|"$/g, '').trim());
  return rows.slice(1).map(line => {
    const cols = line.split('","').map(c => c.replace(/^"|"$/g, ''));
    if (cols.length === 1) {
      const fallback = line.split(',');
      const obj = {};
      headers.forEach((h, i) => obj[h] = fallback[i]);
      return obj;
    }
    const obj = {};
    headers.forEach((h, i) => obj[h] = cols[i]);
    return obj;
  });
}

function main() {
  console.log('🔍 Scanning dados/ for .xls files...');

  const files = fs.readdirSync(DADOS_DIR);
  const xlsFiles = files.filter(f => f.endsWith('.xls') && !f.startsWith('.~lock'));
  const csvFiles = files.filter(f => f.endsWith('.csv'));

  console.log(`   Found ${xlsFiles.length} XLS files and ${csvFiles.length} CSV files.`);

  const result = {
    meta: { files: xlsFiles, campuses: [], minYear: 9999, maxYear: 0 },
    bibliografica: [],
    tecnica: [],
    inovacao: [],
    concluidas: [],
    andamento: [],
    grupos: []
  };

  // Process XLS files
  for (const fileName of xlsFiles) {
    const filePath = path.join(DADOS_DIR, fileName);
    const campusCode = fileName.includes('-') ? fileName.split('-')[0] : fileName.split('_')[0];

    // Extract years from filename
    const dateMatch = fileName.match(/(\d{4})[_-](\d{4})/);
    if (dateMatch) {
      const y1 = parseInt(dateMatch[1]);
      const y2 = parseInt(dateMatch[2]);
      if (y1 < result.meta.minYear) result.meta.minYear = y1;
      if (y2 > result.meta.maxYear) result.meta.maxYear = y2;
    }

    if (!result.meta.campuses.includes(campusCode)) {
      result.meta.campuses.push(campusCode);
    }

    console.log(`   📄 Processing ${fileName} (campus: ${campusCode})...`);

    try {
      const workbook = XLSX.readFile(filePath);

      for (const sheetName of workbook.SheetNames) {
        const key = SHEET_MAP[sheetName.trim().toLowerCase()];
        if (!key) continue;

        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { raw: false, defval: null });
        
        const normalizeKey = r => {
          const raw = r["Título"] || r["Nome"] || (r["Publicação"] || "").substring(0, 150);
          if (!raw) return "";
          return raw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/gi, "").substring(0, 150);
        };

        const tagged = rows.map(r => {
          let srvId = null;
          if (r["Servidor"]) {
             const match = r["Servidor"].match(/(\d{7,})/);
             if (match) srvId = match[1];
             else srvId = r["Servidor"];
          }
          const obj = {
             Ano: r["Ano"],
             Tipo: r["Tipo"],
             Servidor: srvId,
             campus: campusCode,
             dedupKey: normalizeKey(r)
          };
          if (r["Estrato"]) obj.Estrato = r["Estrato"];
          return obj;
        });
        result[key].push(...tagged);
      }
    } catch (e) {
      console.warn(`   ⚠️  Failed to parse ${fileName}: ${e.message}`);
    }
  }

  // Process CSV files (grupos)
  for (const csvFile of csvFiles) {
    console.log(`   📄 Processing ${csvFile}...`);
    try {
      const rows = parseCSV(path.join(DADOS_DIR, csvFile));
      const mapped = rows.map(r => ({
         Situação: r["Situação"],
         "Ano Formação": r["Ano Formação"],
         Pesquisadores: r["Pesquisadores"],
         Estudantes: r["Estudantes"],
         Área: r["Área"],
         "Último Envio": r["Último Envio"],
         Unidade: r["Unidade"]
      }));
      result.grupos.push(...mapped);
    } catch (e) {
      console.warn(`   ⚠️  Failed to parse ${csvFile}: ${e.message}`);
    }
  }

  result.meta.campuses.sort();

  // Write output – strip null values to reduce size
  const jsonStr = JSON.stringify(result, (key, value) => value === null ? undefined : value);
  fs.writeFileSync(OUTPUT_FILE, jsonStr);

  const sizeMB = (Buffer.byteLength(jsonStr) / 1024 / 1024).toFixed(2);
  console.log(`\n✅ Built data.json (${sizeMB} MB)`);
  console.log(`   ${result.bibliografica.length} bibliográfica, ${result.tecnica.length} técnica, ${result.inovacao.length} inovação`);
  console.log(`   ${result.concluidas.length} concluídas, ${result.andamento.length} andamento, ${result.grupos.length} grupos`);
  console.log(`   Period: ${result.meta.minYear}-${result.meta.maxYear}`);
  console.log(`   Campuses: ${result.meta.campuses.join(', ')}`);
}

main();
