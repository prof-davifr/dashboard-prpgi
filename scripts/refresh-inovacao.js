#!/usr/bin/env node
/**
 * Substitui o array `inovacao` do data.json pelos registros do INPI.
 *
 * A aba Inovação vinha do Lattes dos pesquisadores, via SUAP. Muito do que
 * estava lá não é propriedade intelectual do IFBA: eram 988 registros contra os
 * ~160 que o INPI conhece no CNPJ da instituição. Esta é a troca de fonte.
 *
 * Uso:
 *   node scripts/refresh-inovacao.js <inpi.csv>
 *
 * O CSV vem do repositório irmão scraper-INPI (`node cli/coletar.js --out`).
 *
 * ─── campus: o INPI não informa ─────────────────────────────────────────────
 *
 * O INPI dá o titular (a instituição) e os autores (pessoas), nunca o campus.
 * A cascata tem três níveis, do mais confiável ao menos:
 *
 *   1. número INPI  — casa com o registro que o pesquisador declarou no Lattes,
 *                     e herda dele o campus e o SIAPE;
 *   2. nome do autor — resolve o SIAPE pelo nome, contra a base do SUAP;
 *   3. nenhum        — o campo `campus` fica de fora. O registro conta nos KPIs
 *                     e some do mapa. Não invente um código: `CODIGOS_VALIDOS`
 *                     em validate-data.js recusaria.
 *
 * ─── por que existe o inpi-campus.json ──────────────────────────────────────
 *
 * Os níveis 1 e 2 dependem de `dados/scraper-SUAPCNPQ/`, que é gitignored e não
 * existe no runner do GitHub Actions. Pior: o nível 1 se apaga sozinho, porque
 * a primeira execução substitui os registros do Lattes que ele consultava.
 *
 * Por isso o resultado da cascata é gravado em `inpi-campus.json`, versionado.
 * Quando `dados/` está por perto, este script resolve a cascata e atualiza o
 * mapa; quando não está, ele lê o mapa. O CI cai sempre no segundo caso.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const { parseCSV, extrairVinculos, SHEET_MAP_DETALHADO } = require('./build');
const { validate } = require('./validate-data');
const { normalizeINPI, extractDashboardNumber } = require('./comparar_pi');

const RAIZ = path.resolve(__dirname, '..');
const DATA_JSON = path.join(RAIZ, 'data.json');
const MAPA_JSON = path.join(RAIZ, 'inpi-campus.json');
const DIR_LATTES = path.join(RAIZ, 'dados', 'scraper-SUAPCNPQ');

/** Rótulo do CSV do robô → `Tipo` que a aba Inovação exibe. */
const TIPO_POR_BASE = {
  patente: 'Patente',
  programa: 'Software',
  desenho: 'Desenho Industrial',
  marca: 'Marca',
};

// Mesma normalização de `build.js` (linha ~956). Nome de pessoa casa por aqui.
const normalizeName = (s) =>
  (s || '').trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ');

/** Ano a partir de uma data dd/mm/aaaa do INPI. */
function anoDe(data) {
  const m = String(data || '').match(/(\d{4})\s*$/);
  return m ? m[1] : '';
}

/** Chave de comparação de um número INPI, igual dos dois lados da cascata. */
function chaveINPI(numero) {
  const [chave] = normalizeINPI(numero);
  return chave || '';
}

// ─── nível 1: o que o Lattes já sabia ────────────────────────────────────────

/**
 * Índice `chaveINPI -> [{ Servidor, campus }]` a partir do `inovacao` atual.
 *
 * Só funciona enquanto o array ainda vier do Lattes. Depois da primeira troca
 * de fonte, o resultado já está no `inpi-campus.json`.
 */
function indexarLattes(inovacao) {
  const idx = new Map();
  for (const r of inovacao || []) {
    for (const chave of extractDashboardNumber(r.dedupKey)) {
      if (!chave) continue;
      if (!idx.has(chave)) idx.set(chave, []);
      const lista = idx.get(chave);
      if (!lista.some((v) => v.Servidor === r.Servidor)) {
        lista.push({ Servidor: r.Servidor, campus: r.campus || '' });
      }
    }
  }
  return idx;
}

// ─── nível 2: resolver o autor pelo nome ─────────────────────────────────────

/**
 * Percorre os XLSX do SUAP e devolve `nome normalizado -> { Servidor, campus }`.
 *
 * O mesmo servidor aparece em vários campi quando muda de lotação; fica o
 * primeiro, que é o critério que `build.js` já usa para o mapa de nomes.
 */
function mapearNomesDoSuap(log = () => {}) {
  if (!fs.existsSync(DIR_LATTES)) {
    log(`  ${path.relative(RAIZ, DIR_LATTES)} não existe — nível 2 da cascata desligado.`);
    return null;
  }
  const mapa = new Map();
  for (const arquivo of fs.readdirSync(DIR_LATTES).filter((f) => f.endsWith('.xlsx'))) {
    const campus = path.basename(arquivo, '.xlsx').split('-')[0].toUpperCase();
    const wb = XLSX.readFile(path.join(DIR_LATTES, arquivo));
    for (const aba of wb.SheetNames) {
      if (!SHEET_MAP_DETALHADO[aba.trim().toLowerCase()] && !SHEET_MAP_DETALHADO[aba.trim()]) continue;
      for (const linha of XLSX.utils.sheet_to_json(wb.Sheets[aba], { raw: false, defval: null })) {
        for (const v of extrairVinculos(linha['Servidor'])) {
          const chave = normalizeName(v.nome);
          if (chave && !mapa.has(chave)) mapa.set(chave, { Servidor: v.id, campus });
        }
      }
    }
  }
  log(`  ${mapa.size} servidores no mapa de nomes (fonte: XLSX do SUAP)`);
  return mapa;
}

// ─── o mapa versionado ───────────────────────────────────────────────────────

function lerMapa() {
  if (!fs.existsSync(MAPA_JSON)) return { vinculos: {} };
  return JSON.parse(fs.readFileSync(MAPA_JSON, 'utf-8'));
}

function gravarMapa(vinculos) {
  const conteudo = {
    _leia_me: 'Gerado por scripts/refresh-inovacao.js. Liga o número INPI ao servidor e ao campus, '
      + 'para que o GitHub Actions atribua campus sem os arquivos brutos de dados/, que são gitignored.',
    geradoEm: new Date().toISOString(),
    vinculos,
  };
  fs.writeFileSync(MAPA_JSON, JSON.stringify(conteudo, null, 1) + '\n');
}

// ─── a cascata ───────────────────────────────────────────────────────────────

/**
 * Descobre os vínculos (servidor + campus) de um registro do INPI.
 *
 * @returns {{vinculos: {Servidor: string, campus: string}[], nivel: 1|2|3}}
 */
function resolverVinculos(registro, { idxLattes, mapaNomes, mapaSalvo }) {
  const chave = chaveINPI(registro.numeroPedido);

  if (chave && idxLattes.has(chave)) {
    return { vinculos: idxLattes.get(chave), nivel: 1 };
  }
  if (chave && mapaSalvo[chave]) {
    return { vinculos: mapaSalvo[chave], nivel: 1 };
  }
  if (mapaNomes) {
    const achados = [];
    for (const autor of String(registro.autores || '').split(/\s*\/\s*/)) {
      const v = mapaNomes.get(normalizeName(autor));
      if (v && !achados.some((a) => a.Servidor === v.Servidor)) achados.push(v);
    }
    if (achados.length) return { vinculos: achados, nivel: 2 };
  }
  return { vinculos: [], nivel: 3 };
}

/**
 * Converte o CSV do INPI nos registros do array `inovacao`.
 *
 * Um registro com vários autores vira um registro por autor — é o mesmo fan-out
 * de coautoria de `build.js`, e é o que mantém o KPI "p/ Servidor" correto.
 */
function converter(linhas, contexto) {
  const inovacao = [];
  const vinculosNovos = {};
  const porNivel = { 1: 0, 2: 0, 3: 0 };

  for (const linha of linhas) {
    const tipo = TIPO_POR_BASE[linha.base];
    if (!tipo) throw new Error(`base desconhecida no CSV: "${linha.base}"`);

    const chave = chaveINPI(linha.numeroPedido);
    if (!chave) throw new Error(`número de pedido ilegível: "${linha.numeroPedido}"`);

    const { vinculos, nivel } = resolverVinculos(linha, contexto);
    porNivel[nivel]++;
    if (vinculos.length) vinculosNovos[chave] = vinculos;

    const base = { Ano: anoDe(linha.dataDeposito), Tipo: tipo, dedupKey: chave };
    if (linha.situacao) base.Situacao = linha.situacao;

    if (!vinculos.length) {
      inovacao.push(base); // sem campus e sem servidor — conta no total, sai do mapa
      continue;
    }
    for (const v of vinculos) {
      const registro = { ...base, Servidor: v.Servidor };
      if (v.campus) registro.campus = v.campus;
      inovacao.push(registro);
    }
  }
  return { inovacao, vinculosNovos, porNivel };
}

// ─── LGPD ────────────────────────────────────────────────────────────────────

/**
 * Recusa qualquer nome de pessoa no array que vai para o data.json público.
 *
 * O CSV do INPI traz `titular` e `autores` por extenso. Eles servem só para
 * resolver o SIAPE aqui dentro. A assinatura de um nome que escapou é um valor
 * com espaço ou com letra acentuada — nenhum campo legítimo de `inovacao` tem
 * qualquer um dos dois.
 */
function conferirLGPD(inovacao) {
  const suspeitos = [];
  for (const r of inovacao) {
    for (const [campo, valor] of Object.entries(r)) {
      if (campo === 'Tipo' || campo === 'Situacao') continue; // rótulos fixos, não são pessoas
      if (typeof valor === 'string' && /\s|[À-ÿ]/.test(valor)) {
        suspeitos.push(`${campo}="${valor}"`);
      }
    }
  }
  if (suspeitos.length) {
    throw new Error(
      'dado pessoal chegaria ao data.json público:\n  ' + [...new Set(suspeitos)].slice(0, 10).join('\n  ')
    );
  }
}

// ─── main ────────────────────────────────────────────────────────────────────

function main() {
  const csv = process.argv[2];
  if (!csv || !fs.existsSync(csv)) {
    console.error('Uso: node scripts/refresh-inovacao.js <inpi.csv>');
    process.exit(1);
  }

  const linhas = parseCSV(csv);
  if (linhas.length === 0) {
    console.error('Abortado: o CSV não produziu nenhuma linha.');
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(DATA_JSON, 'utf-8'));
  const antes = data.inovacao.length;

  console.log('Montando a cascata de campus...');
  const idxLattes = indexarLattes(data.inovacao);
  console.log(`  ${idxLattes.size} números INPI no array atual (fonte Lattes)`);
  const mapaNomes = mapearNomesDoSuap(console.log);
  const mapaSalvo = lerMapa().vinculos || {};
  console.log(`  ${Object.keys(mapaSalvo).length} números no inpi-campus.json`);

  const { inovacao, vinculosNovos, porNivel } = converter(linhas, { idxLattes, mapaNomes, mapaSalvo });

  conferirLGPD(inovacao);

  if (JSON.stringify(inovacao) === JSON.stringify(data.inovacao)) {
    console.log(`inovacao inalterada (${inovacao.length}) — data.json não foi tocado.`);
    return;
  }

  data.inovacao = inovacao;

  // `meta.minYear`/`maxYear` vêm do build, que só enxerga os datasets do Lattes
  // (2000 em diante). O INPI alcança mais longe: as marcas do CEFET-BA são de
  // 1996 e 1999. Sem alargar a faixa, o filtro de período em "Todos" descarta
  // esses registros em silêncio — eles existem no data.json e não aparecem na
  // tela, que é a pior combinação possível.
  const anos = inovacao.map((r) => parseInt(r.Ano, 10)).filter((a) => !Number.isNaN(a));
  if (anos.length) {
    data.meta.minYear = Math.min(data.meta.minYear, ...anos);
    data.meta.maxYear = Math.max(data.meta.maxYear, ...anos);
  }

  const agora = new Date().toISOString();
  data.meta.sourceFiles['INPI'] = [path.basename(csv)];
  data.meta.sourceDates['INPI'] = { label: 'INPI', createdAt: agora, modifiedAt: agora, fileCount: 1 };
  data.meta.generatedAt = agora;

  // Valida ANTES de escrever: data.json quebrado é pior que nenhum, porque vai
  // direto para o GitHub Pages no próximo push.
  const texto = JSON.stringify(data, (chave, valor) => (valor === null ? undefined : valor));
  const erros = validate(JSON.parse(texto));
  if (erros.length > 0) {
    console.error('\nAbortado — data.json ficaria inválido:');
    erros.forEach((e) => console.error('   - ' + e));
    process.exit(1);
  }

  fs.writeFileSync(DATA_JSON, texto);
  // O mapa só melhora quando a cascata rodou completa (com `dados/` por perto).
  if (mapaNomes) gravarMapa({ ...mapaSalvo, ...vinculosNovos });

  const semCampus = inovacao.filter((r) => !r.campus).length;
  console.log(`  faixa de anos: ${data.meta.minYear}-${data.meta.maxYear}`);
  console.log(`\ninovacao: ${antes} → ${inovacao.length} (fonte: ${path.basename(csv)})`);
  console.log(`  campus por número INPI: ${porNivel[1]} | por nome do autor: ${porNivel[2]} | sem atribuição: ${porNivel[3]}`);
  console.log(`  ${semCampus} registros sem campus (${(semCampus / inovacao.length * 100).toFixed(1)}%)`);
  console.log(`  data.json: ${(Buffer.byteLength(texto) / 1024 / 1024).toFixed(2)} MB`);
}

if (require.main === module) main();

module.exports = {
  TIPO_POR_BASE, anoDe, chaveINPI, normalizeName,
  indexarLattes, resolverVinculos, converter, conferirLGPD,
  MAPA_JSON, DATA_JSON,
};
