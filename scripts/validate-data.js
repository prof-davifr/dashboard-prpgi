#!/usr/bin/env node
// validate-data.js — Verifica a integridade do data.json versionado.
// Roda no CI (.github/workflows/ci.yml) e localmente: `npm run validate`.
// Sai com código 1 e um relatório legível se algo estiver errado.

const fs = require('fs');
const path = require('path');
const { CAMPUS_TO_CITY } = require('../src/shared');

const DATA_PATH = path.join(__dirname, '..', 'data.json');

const ARRAYS = [
  'bibliografica', 'tecnica', 'inovacao', 'concluidas',
  'andamento', 'grupos', 'posgraduacao', 'ic'
];

// IFBA (sede), REI (Reitoria) e PO são códigos legados vindos de XLSX vazios.
const CODIGOS_VALIDOS = new Set([...Object.keys(CAMPUS_TO_CITY), 'IFBA', 'REI', 'PO']);

// Campos que nunca podem voltar ao data.json público (ver scripts/build.js).
const CAMPO_PII = /nome|matricula|matrícula|e-?mail|cpf|telefone|contato/i;

const LIMITE_MB = 50;

function validate(data) {
  const erros = [];

  for (const k of ARRAYS) {
    if (!Array.isArray(data[k])) {
      erros.push(`dataset ausente ou não é array: ${k}`);
    } else if (data[k].length === 0) {
      erros.push(`dataset vazio: ${k}`);
    }
  }

  if (!data.meta) {
    erros.push('meta ausente');
  } else {
    const campi = data.meta.campuses;
    if (!Array.isArray(campi) || campi.length < 25) {
      erros.push(`meta.campuses deveria listar ao menos 25 campi, tem ${(campi || []).length}`);
    } else {
      const invalidos = campi.filter(c => !CODIGOS_VALIDOS.has(c));
      if (invalidos.length) erros.push(`meta.campuses com códigos desconhecidos: ${invalidos.join(', ')}`);
    }
    if (!(data.meta.minYear >= 1900 && data.meta.maxYear >= data.meta.minYear)) {
      erros.push(`faixa de anos inválida: ${data.meta.minYear}-${data.meta.maxYear}`);
    }
  }

  for (const k of ARRAYS) {
    if (!Array.isArray(data[k])) continue;

    const invalidos = [...new Set(data[k].map(r => r.campus).filter(Boolean))]
      .filter(c => !CODIGOS_VALIDOS.has(c));
    if (invalidos.length) erros.push(`${k}: códigos de campus inválidos -> ${invalidos.join(', ')}`);

    const campos = new Set();
    data[k].forEach(r => Object.keys(r).forEach(c => campos.add(c)));
    const vazando = [...campos].filter(c => CAMPO_PII.test(c));
    if (vazando.length) {
      erros.push(`${k}: campo de dado pessoal no arquivo público -> ${vazando.join(', ')} (LGPD)`);
    }
  }

  return erros;
}

function main() {
  const erros = [];

  const tamanhoMB = fs.statSync(DATA_PATH).size / 1024 / 1024;
  if (tamanhoMB > LIMITE_MB) {
    erros.push(`data.json tem ${tamanhoMB.toFixed(1)} MB, acima do limite de ${LIMITE_MB} MB`);
  }

  const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
  erros.push(...validate(data));

  if (erros.length) {
    console.error('data.json inválido:');
    erros.forEach(e => console.error('  - ' + e));
    process.exit(1);
  }

  console.log(`data.json OK (${tamanhoMB.toFixed(1)} MB)`);
  console.log('  ' + ARRAYS.map(k => `${k}=${data[k].length}`).join('  '));
  console.log(`  ${data.meta.campuses.length} campi, ${data.meta.minYear}-${data.meta.maxYear}`);
}

if (require.main === module) {
  main();
}

module.exports = { validate, ARRAYS, CODIGOS_VALIDOS, CAMPO_PII };
