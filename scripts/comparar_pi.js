// comparar_pi.js — Validação: DINOV (CSV) vs Dashboard (data.json → inovacao[])
// Gera docs/validacao/relatorio-comparacao-PI.md

const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// ─── Config ───────────────────────────────────────────────────────────────
const CSV_PATH = path.join(__dirname, '..', 'docs', 'validacao', 'Controle propriedade intelectual DINOV 2026 - CONCEDIDOS.csv');
const DATA_PATH = path.join(__dirname, '..', 'data.json');
const REPORT_PATH = path.join(__dirname, '..', 'docs', 'validacao', 'relatorio-comparacao-PI.md');

// Fonte única (src/shared.js). As cidades vêm em maiúsculas, mas CITY_TO_CAMPUS
// abaixo normaliza para minúsculas sem acento — a caixa é indiferente aqui.
const { CAMPUS_TO_CITY } = require('../src/shared');

// ─── Servidor ID → Name mapping (from SUAPCNPQ XLSX files) ────────────
function buildServidorNameMap() {
  const map = {};
  const dir = path.join(__dirname, '..', 'dados', 'scraper-SUAPCNPQ');
  if (!fs.existsSync(dir)) {
    console.warn('  Aviso: pasta dados/scraper-SUAPCNPQ não encontrada. Nomes não serão resolvidos.');
    return map;
  }
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.xlsx'));
  for (const file of files) {
    try {
      const wb = XLSX.readFile(path.join(dir, file));
      for (const sheetName of wb.SheetNames) {
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { raw: false, defval: null });
        for (const row of rows) {
          if (row['Servidor']) {
            const matches = [...row['Servidor'].matchAll(/Vinculo: (.+?) \((\d{7,})\)/g)];
            for (const m of matches) {
              const name = m[1].trim();
              const id = m[2];
              if (!map[id]) map[id] = name;
            }
          }
        }
      }
    } catch (e) {
      // skip problematic files
    }
  }
  console.log(`  ${Object.keys(map).length} servidores mapeados (ID → nome)`);
  return map;
}

// City → campus code reverse map (case-insensitive)
const CITY_TO_CAMPUS = {};
for (const [code, city] of Object.entries(CAMPUS_TO_CITY)) {
  CITY_TO_CAMPUS[city.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()] = code;
}
// Additional abbreviations / variants seen in DINOV CSV
CITY_TO_CAMPUS['lauro'] = 'LF';
CITY_TO_CAMPUS['polo inovacao'] = 'PIS';
CITY_TO_CAMPUS['polo inovação'] = 'PIS';
CITY_TO_CAMPUS['polo inova'] = 'PIS';
CITY_TO_CAMPUS['salvador'] = 'SSA';

// ─── Normalization ────────────────────────────────────────────────────────

function normalizeINPI(raw) {
  if (!raw) return [];
  let s = raw.trim();
  // Split on '/' when it separates multiple registration numbers
  // e.g., "MU8903003-6/ PI 0925423-4" → ["MU8903003-6", "PI 0925423-4"]
  const parts = s.split(/\s*\/\s*/).filter(Boolean);
  if (parts.length === 0) return [];

  const results = [];
  for (let part of parts) {
    // Lowercase
    let n = part.toLowerCase();
    // Remove non-alphanumeric (keep digits and letters)
    n = n.replace(/[^a-z0-9]/g, '');
    // Remove leading type prefixes if present: pi, mu, br, di, so
    n = n.replace(/^(pi|mu|br|di|so)+/, '');
    if (n.length > 0) results.push(n);
  }
  return results;
}

function extractDashboardNumber(dedupKey) {
  if (!dedupKey) return [];
  const m = dedupKey.match(/numerodoregistro([a-z0-9]+)dataderegistro/);
  if (!m) return [];
  const raw = m[1];
  // Already lowercase + alphanumeric from the dedupKey, but apply same normalization
  let n = raw.replace(/^(pi|mu|br|di|so)+/, '');
  return n.length > 0 ? [n] : [];
}

function mapTipoDashboard(tipo) {
  const map = {
    'Patente': 'PI',
    'Software': 'SO',
    'Desenho Industrial': 'DI',
    'Desenho Insdustrial': 'DI', // typo in data
    'Modelo de Utilidade': 'MU'
  };
  return map[tipo] || tipo;
}

function mapCampusCSV(campusStr) {
  if (!campusStr) return null;
  const c = campusStr.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return CITY_TO_CAMPUS[c] || null;
}

// ─── Load DINOV CSV ──────────────────────────────────────────────────────

function loadDINOV() {
  const buf = fs.readFileSync(CSV_PATH);
  const wb = XLSX.read(buf, { type: 'buffer', raw: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

  const records = [];
  for (const row of rows) {
    const rawINPI = String(row['Nº INPI'] || '');
    const normalized = normalizeINPI(rawINPI);
    if (normalized.length === 0) continue;

    const campusName = String(row['CAMPUS'] || '').trim();
    const campusCode = mapCampusCSV(campusName);

    records.push({
      rawINPI,
      normalized,
      objeto: String(row['OBJETO'] || '').trim(),
      campus: campusName,
      campusCode,
      anoDeposito: String(row['ANO DEPÓSITO'] || '').trim(),
      anoConcessao: String(row['ANO CONCESSÃO'] || '').trim(),
      inventores: String(row['INVENTORES'] || '').trim(),
      contato: String(row['CONTATO'] || '').trim(),
      titulo: String(row['TÍTULO INPI'] || '').trim(),
      status1: String(row['STATUS 1'] || '').trim(),
      status2: String(row['STATUS 2'] || '').trim()
    });
  }
  return records;
}

// ─── Load Dashboard ──────────────────────────────────────────────────────

function loadDashboard() {
  const raw = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
  const inovacao = raw.inovacao || [];
  const records = [];
  for (const item of inovacao) {
    const normalized = extractDashboardNumber(item.dedupKey);
    if (normalized.length === 0) continue;
    records.push({
      tipo: item.Tipo,
      campus: item.campus,
      ano: item.Ano,
      dedupKey: item.dedupKey,
      servidor: item.Servidor,
      normalized
    });
  }
  return records;
}

// ─── Build lookup index (normalized → record) ──────────────────────────

function buildIndex(records, field) {
  const idx = new Map();
  for (const rec of records) {
    for (const key of rec.normalized) {
      if (!idx.has(key)) idx.set(key, []);
      idx.get(key).push(rec);
    }
  }
  return idx;
}

// ─── Main ─────────────────────────────────────────────────────────────────

function main() {
  console.log('Carregando dados DINOV...');
  const dinovRecords = loadDINOV();
  console.log(`  ${dinovRecords.length} registros no CSV DINOV`);

  console.log('Carregando dados do Dashboard...');
  const dashRecords = loadDashboard();
  console.log(`  ${dashRecords.length} registros no Dashboard (inovacao[])`);

  console.log('Carregando mapa de servidores (ID → nome)...');
  const servidorNome = buildServidorNameMap();

  // Index both sides by normalized key
  const dinovIdx = buildIndex(dinovRecords, 'normalized');
  const dashIdx = buildIndex(dashRecords, 'normalized');

  // Find matches
  const allNormalized = new Set([...dinovIdx.keys(), ...dashIdx.keys()]);

  const matchedKeys = [];    // keys found in both
  const onlyDinovKeys = [];  // keys only in DINOV
  const onlyDashKeys = [];   // keys only in Dashboard

  for (const key of allNormalized) {
    const inDinov = dinovIdx.has(key);
    const inDash = dashIdx.has(key);
    if (inDinov && inDash) matchedKeys.push(key);
    else if (inDinov) onlyDinovKeys.push(key);
    else onlyDashKeys.push(key);
  }

  // Resolve records for matched keys (deduplicate by record identity)
  const matchedDinovRecords = [];
  const matchedDashRecords = [];
  const seenDinov = new Set();
  const seenDash = new Set();

  for (const key of matchedKeys) {
    for (const rec of dinovIdx.get(key)) {
      const id = rec.rawINPI + rec.objeto + rec.campus;
      if (!seenDinov.has(id)) {
        seenDinov.add(id);
        matchedDinovRecords.push(rec);
      }
    }
    for (const rec of dashIdx.get(key)) {
      if (!seenDash.has(rec.dedupKey)) {
        seenDash.add(rec.dedupKey);
        matchedDashRecords.push(rec);
      }
    }
  }

  const onlyDinovRecords = [];
  const seenOnlyDinov = new Set();
  for (const key of onlyDinovKeys) {
    for (const rec of dinovIdx.get(key)) {
      const id = rec.rawINPI + rec.objeto + rec.campus;
      if (!seenOnlyDinov.has(id)) {
        seenOnlyDinov.add(id);
        onlyDinovRecords.push(rec);
      }
    }
  }

  const onlyDashRecords = [];
  const seenOnlyDash = new Set();
  for (const key of onlyDashKeys) {
    for (const rec of dashIdx.get(key)) {
      if (!seenOnlyDash.has(rec.dedupKey)) {
        seenOnlyDash.add(rec.dedupKey);
        onlyDashRecords.push(rec);
      }
    }
  }

  // --- Compare matched records ---
  const typeMatches = [];
  const typeMismatches = [];
  const yearMatches = [];
  const yearMismatches = [];
  const campusMatches = [];
  const campusMismatches = [];

  for (const key of matchedKeys) {
    const dinovRecs = dinovIdx.get(key) || [];
    const dashRecs = dashIdx.get(key) || [];

    for (const dr of dinovRecs) {
      for (const ddr of dashRecs) {
        // Compare type
        const dashTipo = mapTipoDashboard(ddr.tipo);
        if (dashTipo === dr.objeto) {
          typeMatches.push({ key, dinov: dr.objeto, dash: ddr.tipo });
        } else {
          typeMismatches.push({ key, dinov: dr.objeto, dash: ddr.tipo, rawDinov: dr.rawINPI });
        }

        // Compare year (use anoDeposito as primary)
        if (dr.anoDeposito && ddr.ano) {
          if (dr.anoDeposito === ddr.ano) {
            yearMatches.push({ key, dinov: dr.anoDeposito, dash: ddr.ano });
          } else {
            yearMismatches.push({ key, dinov: dr.anoDeposito, dash: ddr.ano, rawDinov: dr.rawINPI });
          }
        }

        // Compare campus
        if (dr.campusCode && ddr.campus) {
          if (dr.campusCode === ddr.campus) {
            campusMatches.push({ key, dinov: `${dr.campus} (${dr.campusCode})`, dash: `${ddr.campus}` });
          } else {
            campusMismatches.push({
              key, dinov: `${dr.campus} → code ${dr.campusCode}`,
              dash: `${ddr.campus}`, rawDinov: dr.rawINPI
            });
          }
        }
      }
    }
  }

  // --- Generate Report ---
  const report = [];
  const emit = (line = '') => report.push(line);

  emit('# Relatório de Comparação: DINOV vs Dashboard PRPGI');
  emit();
  emit(`> Gerado em: ${new Date().toISOString().split('T')[0]}`);
  emit('> **Assessoria de Ciência de Dados — PRPGI/IFBA**');
  emit('> Prof. Dr. Davi Franco Rêgo');
  emit();

  // ─── 1. Sumário Executivo ────────────────────────────────────────────
  emit('## Sumário Executivo');
  emit();
  emit('| Métrica | Valor |');
  emit('|---------|-------|');
  emit(`| Registros DINOV (CSV) | ${dinovRecords.length} |`);
  emit(`| Registros Dashboard (inovacao[]) | ${dashRecords.length} |`);
  emit(`| Chaves normalizadas (DINOV) | ${dinovIdx.size} |`);
  emit(`| Chaves normalizadas (Dashboard) | ${dashIdx.size} |`);
  emit(`| Casados (match por chave normalizada) | ${matchedKeys.length} |`);
  emit(`| Só DINOV | ${onlyDinovKeys.length} chaves / ${onlyDinovRecords.length} registros |`);
  emit(`| Só Dashboard | ${onlyDashKeys.length} chaves / ${onlyDashRecords.length} registros |`);
  emit();
  emit('**O que são "chaves normalizadas"?**');
  emit();
  emit('Para comparar os registros das duas fontes, extraímos o número de registro do INPI de cada lado e o normalizamos: removemos espaços, hífens, barras e prefixos como `PI`, `BR`, `MU`, ficando apenas com os dígitos e letras. Por exemplo, `PI0802052-3` e `BR 102012007763-9` tornam-se `08020523` e `1020120077639`. Essa chave comum permite identificar se um mesmo registro aparece nas duas bases, independentemente do formato em que foi digitado.');
  emit();
  emit('| Categoria | Significado |');
  emit('|-----------|-------------|');
  emit('| **Casados** | Registro encontrado tanto no CSV da DINOV quanto no Dashboard — o número do INPI coincide após a normalização |');
  emit('| **Só DINOV** | Registro que está no CSV da DINOV mas não foi encontrado no Dashboard (pode ser que o pesquisador não o tenha cadastrado no Lattes) |');
  emit('| **Só Dashboard** | Registro que está no Dashboard mas não consta no CSV da DINOV (pode ser um pedido ainda não concedido, ou um registro que a DINOV ainda não incorporou à sua planilha) |');
  emit();

  // ─── 2. Só DINOV ─────────────────────────────────────────────────────
  emit('## Registros Só DINOV');
  emit();
  emit(`Total: **${onlyDinovRecords.length}** registros presentes no CSV DINOV mas **não encontrados** no Dashboard.`);
  emit();
  emit('> 💡 **Por que isso importa?** São concessões já formalizadas no INPI que os inventores podem não ter cadastrado em seus Currículos Lattes. A coluna `CONTATO` traz os meios de contato informados pela própria DINOV.');
  emit();
  if (onlyDinovRecords.length > 0) {
    emit('| INPI | Obj | Conc. | Inventores | Contato |');
    emit('|------|-----|-------|------------|---------|');
    for (const r of onlyDinovRecords) {
      const inpi = r.rawINPI.length > 20 ? r.rawINPI.substring(0, 20) + '…' : r.rawINPI;
      const inventores = r.inventores.length > 45 ? r.inventores.substring(0, 45) + '…' : r.inventores;
      const contato = r.contato.replace(/\s*\n\s*/g, '; ').replace(/\s{2,}/g, ' ');
      const contatoShort = contato.length > 40 ? contato.substring(0, 40) + '…' : contato;
      emit(`| ${inpi} | ${r.objeto} | ${r.anoConcessao || '-'} | ${inventores} | ${contatoShort} |`);
    }
    emit();
  }

  // ─── 3. Só Dashboard ─────────────────────────────────────────────────
  emit('## Registros Só Dashboard');
  emit();
  emit(`Total: **${onlyDashRecords.length}** registros no Dashboard mas **não encontrados** no CSV DINOV.`);
  emit();
  emit('**Possíveis causas (sugestões para investigação):**');
  emit('1. **Registro em andamento ou não concedido** — pode ser um pedido de PI que o pesquisador registrou no Lattes mas que ainda não foi concedido, foi indeferido, ou não chegou a ser depositado formalmente junto ao INPI. Sugere-se verificar no Lattes do pesquisador o status informado.');
  emit('2. **Concedido mas ainda não inserido na planilha DINOV** — talvez o título tenha sido concedido recentemente e ainda não tenha sido incluído no controle da DINOV. Uma consulta na base do INPI pode confirmar.');
  emit('3. **Tipo não controlado pela DINOV** — marcas, cultivares, ou outros tipos de registro que fogem ao escopo da planilha atual.');
  emit('4. **Registro estrangeiro** — patentes depositadas no exterior (USPTO, EPO, WIPO) que podem não constar na base da DINOV.');
  emit();
  if (onlyDashRecords.length > 0) {
    emit('| Tipo | Campus | Ano | Pesquisador | Nº Registro |');
    emit('|------|--------|-----|-------------|-------------|');
    for (const r of onlyDashRecords) {
      const nome = servidorNome[r.servidor] || `ID ${r.servidor} (não mapeado)`;
      const registro = r.normalized.join(', ');
      emit(`| ${r.tipo} | ${r.campus} | ${r.ano} | ${nome} | ${registro} |`);
    }
    emit();
  }

  // ─── 4. Distribuição Temporal ────────────────────────────────────────
  emit('## Distribuição Temporal');
  emit();
  const dinovYears = {};
  for (const r of dinovRecords) {
    const y = r.anoDeposito || 'sem ano';
    dinovYears[y] = (dinovYears[y] || 0) + 1;
  }
  const dashYears = {};
  for (const r of dashRecords) {
    const y = r.ano || 'sem ano';
    dashYears[y] = (dashYears[y] || 0) + 1;
  }
  const allYears = new Set([...Object.keys(dinovYears), ...Object.keys(dashYears)]);
  const yearEntries = [...allYears].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  emit('| Ano | DINOV | Dashboard |');
  emit('|-----|------|-----------|');
  for (const y of yearEntries) {
    const dc = dinovYears[y] || 0;
    const dd = dashYears[y] || 0;
    emit(`| ${y} | ${dc} | ${dd} |`);
  }
  emit();

  // ─── 5. Distribuição por Campus ──────────────────────────────────────
  emit('## Distribuição por Campus');
  emit();
  const dinovCampus = {};
  for (const r of dinovRecords) {
    const c = r.campusCode || r.campus || 'desconhecido';
    dinovCampus[c] = (dinovCampus[c] || 0) + 1;
  }
  const dashCampus = {};
  for (const r of dashRecords) {
    const c = r.campus || 'desconhecido';
    dashCampus[c] = (dashCampus[c] || 0) + 1;
  }
  const allCampus = new Set([...Object.keys(dinovCampus), ...Object.keys(dashCampus)]);
  const campEntries = [...allCampus].sort((a, b) => {
    const totalB = (dinovCampus[b] || 0) + (dashCampus[b] || 0);
    const totalA = (dinovCampus[a] || 0) + (dashCampus[a] || 0);
    return totalB - totalA;
  });
  emit('| Campus | DINOV | Dashboard |');
  emit('|--------|-------|-----------|');
  for (const c of campEntries) {
    const dc = dinovCampus[c] || 0;
    const dd = dashCampus[c] || 0;
    emit(`| ${c} | ${dc} | ${dd} |`);
  }
  emit();

  // ─── 6. Casados — Consistência ───────────────────────────────────────
  emit('## Registros Casados — Consistência');
  emit();
  emit(`Total de chaves casadas: **${matchedKeys.length}**. Abaixo, comparamos tipo, ano e campus dos registros que aparecem em ambas as fontes.`);
  emit();

  // Type consistency
  emit('### Tipo (Dashboard vs OBJETO)');
  emit();
  const totalTypeChecks = typeMatches.length + typeMismatches.length;
  if (totalTypeChecks > 0) {
    emit(`| Resultado | Quantidade | % |`);
    emit(`|-----------|-----------|-----|`);
    emit(`| Consistente | ${typeMatches.length} | ${(typeMatches.length / totalTypeChecks * 100).toFixed(1)}% |`);
    emit(`| Divergente | ${typeMismatches.length} | ${(typeMismatches.length / totalTypeChecks * 100).toFixed(1)}% |`);
  }
  emit();

  if (typeMismatches.length > 0) {
    emit('**Divergências de Tipo:**');
    emit();
    emit('| Nº INPI (DINOV) | OBJETO (DINOV) | Tipo (Dashboard) |');
    emit('|-----------------|-----------------|------------------|');
    for (const t of typeMismatches.slice(0, 50)) {
      emit(`| ${t.rawDinov} | ${t.dinov} | ${t.dash} |`);
    }
    if (typeMismatches.length > 50) emit(`| ... e mais ${typeMismatches.length - 50} divergências |`);
    emit();
  }

  // Year consistency
  emit('### Ano (Dashboard vs ANO DEPÓSITO)');
  emit();
  const totalYearChecks = yearMatches.length + yearMismatches.length;
  if (totalYearChecks > 0) {
    emit(`| Resultado | Quantidade | % |`);
    emit(`|-----------|-----------|-----|`);
    emit(`| Consistente | ${yearMatches.length} | ${(yearMatches.length / totalYearChecks * 100).toFixed(1)}% |`);
    emit(`| Divergente | ${yearMismatches.length} | ${(yearMismatches.length / totalYearChecks * 100).toFixed(1)}% |`);
  }
  emit();

  if (yearMismatches.length > 0) {
    emit('**Divergências de Ano:**');
    emit();
    emit('| Nº INPI (DINOV) | ANO DEPÓSITO (DINOV) | Ano (Dashboard) |');
    emit('|-----------------|----------------------|-----------------|');
    for (const y of yearMismatches.slice(0, 50)) {
      emit(`| ${y.rawDinov} | ${y.dinov} | ${y.dash} |`);
    }
    if (yearMismatches.length > 50) emit(`| ... e mais ${yearMismatches.length - 50} divergências |`);
    emit();
  }

  // Campus consistency
  emit('### Campus (Dashboard vs CAMPUS)');
  emit();
  const totalCampusChecks = campusMatches.length + campusMismatches.length;
  if (totalCampusChecks > 0) {
    emit(`| Resultado | Quantidade | % |`);
    emit(`|-----------|-----------|-----|`);
    emit(`| Consistente | ${campusMatches.length} | ${(campusMatches.length / totalCampusChecks * 100).toFixed(1)}% |`);
    emit(`| Divergente | ${campusMismatches.length} | ${(campusMismatches.length / totalCampusChecks * 100).toFixed(1)}% |`);
  }
  emit();

  if (campusMismatches.length > 0) {
    emit('**Divergências de Campus:**');
    emit();
    emit('| Nº INPI (DINOV) | CAMPUS (DINOV) | Campus (Dashboard) |');
    emit('|-----------------|----------------|--------------------|');
    for (const c of campusMismatches.slice(0, 50)) {
      emit(`| ${c.rawDinov} | ${c.dinov} | ${c.dash} |`);
    }
    if (campusMismatches.length > 50) emit(`| ... e mais ${campusMismatches.length - 50} divergências |`);
    emit();
  }

  // ─── 7. Observações e Sugestões ──────────────────────────────────────
  emit('## Observações e Sugestões');
  emit();
  emit('- **Campo CAMPUS do CSV**: em algumas linhas, este campo contém nomes de inventores ou informações adicionais junto com o campus. A validação tenta mapear o nome da cidade para o código do campus, mas pode não reconhecer valores muito divergentes. Uma sugestão é uniformizar este campo na planilha DINOV para facilitar futuras análises.');
  const unmapped = dinovRecords.filter(r => !r.campusCode && r.campus);
  if (unmapped.length > 0) {
    emit(`- **${unmapped.length} registros** da DINOV com campus não identificado automaticamente (o campo \`CAMPUS\` não corresponde exatamente a nenhuma cidade IFBA conhecida). Revisão manual pode ser necessária.`);
  }
  emit();
  emit('### Registros apenas na DINOV — sugestões');
  emit();
  emit(`Os **${onlyDinovRecords.length} registros** que estão no CSV da DINOV mas não aparecem no Dashboard são concessões já formalizadas no INPI cujos inventores talvez ainda não tenham incluído o registro em seus Currículos Lattes.`);
  emit('A tabela da seção **Registros Só DINOV** inclui os contatos extraídos do próprio CSV da DINOV. Uma sugestão é que o setor responsável utilize esses contatos para dialogar com os inventores e, se for o caso, solicitar a atualização dos Lattes com o número do registro concedido.');
  emit();
  emit('### Registros apenas no Dashboard — sugestões');
  emit();
  emit(`Os **${onlyDashRecords.length} registros** que estão no Dashboard mas não constam no CSV da DINOV podem ter diferentes explicações. Seguem algumas possibilidades:`);
  emit('1. **Pedido ainda não concedido**: o pesquisador pode ter cadastrado no Lattes um pedido de PI que está em andamento, foi indeferido ou não chegou a ser depositado. Sugere-se verificar o status no Lattes ou na base do INPI.');
  emit('2. **Concedido mas ainda não registrado na planilha DINOV**: pode ser um título concedido recentemente ou que ainda não foi incorporado ao controle da DINOV. Uma consulta pontual na base do INPI ajudaria a confirmar.');
  emit('3. **Tipo fora do escopo da planilha**: marcas, cultivares e registros estrangeiros podem não ser cobertos pela planilha atual da DINOV.');
  emit('4. **Registro estrangeiro**: patentes depositadas em outros escritórios (USPTO, EPO, WIPO) podem não estar na base da DINOV.');
  emit();
  const semNome = onlyDashRecords.filter(r => !servidorNome[r.servidor]);
  if (semNome.length > 0) {
    emit(`> 💡 **Nota:** ${semNome.length} registros exibem apenas o ID numérico do servidor, pois o nome não foi encontrado no mapa de servidores. O ID pode ser cruzado com a base do SUAP/DP-PRPGI para obter nome completo e e-mail.`);
  }
  emit();
  emit('---');
  emit();
  emit('*Relatório gerado pela **Assessoria de Ciência de Dados — PRPGI/IFBA**.*');
  emit();
  emit('*Prof. Dr. Davi Franco Rêgo*');
  emit();

  // Write report
  fs.writeFileSync(REPORT_PATH, report.join('\n'), 'utf-8');
  console.log(`\nRelatório gerado: ${REPORT_PATH}`);
  console.log(`  Casados: ${matchedKeys.length}`);
  console.log(`  Só DINOV: ${onlyDinovRecords.length}`);
  console.log(`  Só Dashboard: ${onlyDashRecords.length}`);
}

main();
