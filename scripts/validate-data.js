#!/usr/bin/env node
// validate-data.js — Verifica a integridade do data.json versionado.
// Roda no CI (.github/workflows/ci.yml) e localmente: `npm run validate`.
// Sai com código 1 e um relatório legível se algo estiver errado.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { CAMPUS_TO_CITY } = require('../src/shared');

const RAIZ = path.join(__dirname, '..');
const DATA_PATH = path.join(RAIZ, 'data.json');

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

// ─── Guarda de PII nos arquivos versionados ──────────────────────────────────
// O data.json não é o único caminho para o GitHub Pages: a planilha da DINOV
// chegou a ser versionada em docs/validacao/ com inventores, e-mails e
// telefones. Esta varredura cobre qualquer texto versionado.

const EXT_TEXTO = /\.(md|csv|json|html|txt|js|yml|yaml)$/i;

// TLD alfabético: evita casar especificadores de CDN como `xlsx@0.18.5`.
const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)*\.[a-zA-Z]{2,}/g;

// Exige DDD entre parênteses ou celular com o 9 inicial. O caso solto
// NNNN-NNNN é ambíguo demais: colide com números de registro do INPI
// (`BR 102015033175-4`) e com intervalos de ano (`2000-2026`), que aparecem
// legitimamente na documentação. A guarda de e-mail é a rede principal.
const TELEFONE = /\(\d{2}\)\s?9?\d{4}-?\d{4}\b|\b9\d{4}-\d{4}\b/g;

// data.json é validado campo a campo acima; package-lock e afins têm "e-mails"
// de mantenedores de pacote, que não são dados pessoais sob nossa guarda.
const ISENTOS = new Set(['data.json', 'package-lock.json', 'package.json']);

function arquivosVersionados() {
  try {
    return execFileSync('git', ['ls-files', '-z'], { cwd: RAIZ, maxBuffer: 1e8 })
      .toString().split('\0').filter(Boolean);
  } catch {
    return null; // fora de um repositório git: guarda não se aplica
  }
}

function verificarPiiVersionada() {
  const erros = [];
  const arquivos = arquivosVersionados();
  if (!arquivos) return erros;

  for (const rel of arquivos) {
    if (ISENTOS.has(rel) || !EXT_TEXTO.test(rel)) continue;

    const abs = path.join(RAIZ, rel);
    if (!fs.existsSync(abs)) continue;

    const texto = fs.readFileSync(abs, 'utf-8');
    const emails = [...new Set(texto.match(EMAIL) || [])]
      // e-mails institucionais genéricos do projeto não são dado pessoal
      .filter(e => !/^(prpgi|dinov|contato|noreply)@/i.test(e));
    const telefones = [...new Set(texto.match(TELEFONE) || [])];

    if (emails.length) {
      erros.push(`${rel}: ${emails.length} e-mail(s) em arquivo versionado -> ${emails.slice(0, 3).join(', ')}${emails.length > 3 ? ' …' : ''} (LGPD)`);
    }
    if (telefones.length) {
      erros.push(`${rel}: ${telefones.length} telefone(s) em arquivo versionado -> ${telefones.slice(0, 3).join(', ')}${telefones.length > 3 ? ' …' : ''} (LGPD)`);
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
  erros.push(...verificarPiiVersionada());

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

module.exports = { validate, verificarPiiVersionada, ARRAYS, CODIGOS_VALIDOS, CAMPO_PII };
