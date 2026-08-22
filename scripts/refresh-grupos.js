#!/usr/bin/env node
/**
 * Atualiza SOMENTE o array `grupos` (e o meta do DGP) do data.json a partir de
 * um CSV novo do Coletor-DGP — sem rebuild total e sem depender dos arquivos
 * brutos de `dados/` (que são gitignored e não existem no checkout do CI).
 *
 * É o mesmo mapeamento do `build.js` (linha ~815): o CSV do DGP vira objetos
 * { Situacao, AnoFormacao, Pesquisadores, Estudantes, Area, UltimoEnvio, Unidade }.
 *
 * Uso:
 *   node scripts/refresh-grupos.js <coletor_dgp_*.csv>
 *
 * Valida antes de escrever (mesma função do build) e mantém o formato minificado
 * (sem nulls) usado pelo `build.js`.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const { parseCSV } = require('./build');
const { validate } = require('./validate-data');

const DATA_JSON = path.resolve(__dirname, '..', 'data.json');

function normalizarUnidade(valor) {
  let unidade = (valor || '').trim();
  const norm = unidade.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (
    !unidade ||
    norm.startsWith('instituto federal da bahia') ||
    norm.startsWith('instituto federal de educacao')
  ) {
    unidade = 'Salvador';
  }
  return unidade;
}

function main() {
  const csvPath = process.argv[2];
  if (!csvPath || !fs.existsSync(csvPath)) {
    console.error('Uso: node scripts/refresh-grupos.js <coletor_dgp_*.csv>');
    process.exit(1);
  }

  const rows = parseCSV(csvPath);
  const grupos = rows.map((r) => ({
    Situacao: r['Situacao'],
    AnoFormacao: r['AnoFormacao'],
    Pesquisadores: r['Pesquisadores'],
    Estudantes: r['Estudantes'],
    Area: r['Area'],
    UltimoEnvio: r['UltimoEnvio'],
    Unidade: normalizarUnidade(r['Unidade']),
  }));

  if (grupos.length === 0) {
    console.error('Abortando: CSV não produziu nenhum grupo (parse falhou?).');
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(DATA_JSON, 'utf-8'));
  const antes = data.grupos.length;

  // Detecta mudança real (sem contar timestamps): se o array de grupos for
  // idêntico, não reescreve o arquivo — evita diff espúrio no git/CI.
  const novoGruposJson = JSON.stringify(grupos);
  const velhoGruposJson = JSON.stringify(data.grupos);
  if (novoGruposJson === velhoGruposJson) {
    console.log(`grupos inalterados (${grupos.length}) — data.json não foi tocado.`);
    return;
  }

  data.grupos = grupos;

  const now = new Date().toISOString();
  const csvName = path.basename(csvPath);
  data.meta.sourceFiles['scraper-DGP'] = [csvName];
  data.meta.sourceDates['scraper-DGP'] = {
    label: 'DGP',
    createdAt: now,
    modifiedAt: now,
    fileCount: 1,
  };
  data.meta.generatedAt = now;

  // Valida ANTES de escrever (mesma regra do build: data.json quebrado é pior
  // que nenhum, porque vai direto para o GitHub Pages no próximo push).
  const jsonStr = JSON.stringify(data, (key, value) => (value === null ? undefined : value));
  const erros = validate(JSON.parse(jsonStr));
  if (erros.length > 0) {
    console.error('\n Abortado — data.json ficaria inválido:');
    erros.forEach((e) => console.error('   - ' + e));
    process.exit(1);
  }

  fs.writeFileSync(DATA_JSON, jsonStr);
  console.log(`grupos: ${antes} → ${grupos.length} (fonte: ${csvName})`);
  console.log(`data.json atualizado (${(Buffer.byteLength(jsonStr) / 1024 / 1024).toFixed(2)} MB).`);
}

main();
