#!/usr/bin/env node
/**
 * Busca no SUAP, pelo nome completo, os inventores que `inventores-inpi.js` não
 * achou nas bases locais, e grava o resultado num cache local.
 *
 * Uso:
 *   node scripts/buscar-inventores-suap.js <inventores.xlsx> [cache.json]
 *
 * O cache padrão é `dados/inpi/suap-busca.json`. Um nome que já está no cache
 * não é buscado de novo. Depois, rode `inventores-inpi.js` outra vez: ele lê o
 * cache como mais uma fonte.
 *
 * A busca usa o comando `suap` (repositório suap-acesso), só de leitura, com a
 * conta do usuário. Cada nome custa uma requisição na lista de servidores e,
 * se nada casar, uma na de alunos; o comando espera 1 s entre requisições e
 * para em 1000 por dia.
 *
 * O cache tem nomes, SIAPE e matrículas. Ele fica em `dados/`, fora do git.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const XLSX = require('xlsx');

const { normalizeCampusCode } = require('./build');
const { mapUnidadeToCampus } = require('../src/shared');
const { chaveNome } = require('./inventores-inpi');

const RAIZ = path.resolve(__dirname, '..');
const CACHE_PADRAO = path.join(RAIZ, 'dados', 'inpi', 'suap-busca.json');

// ─── leitura das listas do SUAP ─────────────────────────────────────────────

const desescapar = (s) => s.replace(/\\([_*\[\]()])/g, '$1').trim();

/** Linhas de resultado de uma lista do admin do SUAP, em markdown. */
function linhasDaLista(md) {
  return md.split('\n').filter((l) => l.startsWith('| [Visualizar]'));
}

/**
 * Lista de servidores: "Ver Nome (SIAPE)", "Situação: X", "SIAPE Lotação: SETOR/CAMPUS".
 * O campus é o sufixo do setor de lotação; sem ele, o do exercício.
 */
function lerServidores(md) {
  return linhasDaLista(md).map((l) => {
    const [, nome, siape] = l.match(/"Ver (.+?) \((\d+)\)"/) || [];
    const situacao = (l.match(/Situação:\s+(.+?)\s*\|/) || [])[1] || '';
    const setor = (l.match(/SIAPE Lotação:\s+(\S+)/) || l.match(/SIAPE Exercício:\s+(\S+)/) || [])[1] || '';
    const sufixo = setor.includes('/') ? setor.split('/').pop() : '';
    return {
      nome: desescapar(nome || ''), siape: siape || '', situacao: situacao.trim(),
      setor, campus: sufixo ? normalizeCampusCode(sufixo) : '',
    };
  }).filter((s) => s.nome);
}

/** Lista de alunos: "Ver Nome (matrícula)", "Curso: 374 - Nome (Cidade)", "Situação: X". */
function lerAlunos(md) {
  return linhasDaLista(md).map((l) => {
    const [, nome, matricula] = l.match(/"Ver (.+?) \((\d+)\)"/) || [];
    const curso = desescapar((l.match(/Curso:\s+(.+?)\s+Situação:/) || [])[1] || '');
    const cidade = (curso.match(/\(([^()]+)\)\s*$/) || [])[1] || '';
    const situacao = (l.match(/Situação:\s+(.+?)\s*\|/) || [])[1] || '';
    return {
      nome: desescapar(nome || ''), matricula: matricula || '', curso,
      situacao: situacao.trim(), campus: mapUnidadeToCampus(cidade) || '',
    };
  }).filter((a) => a.nome);
}

function suapLer(caminho) {
  return execFileSync('suap', ['ler', caminho], { encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024 });
}

/**
 * Busca um nome. Só aceita resultados cujo nome normalizado é igual ao do INPI:
 * a busca do SUAP é por trecho, e "Ana Souza" traria toda Ana ... Souza.
 */
function buscar(nome, ler = suapLer) {
  const q = encodeURIComponent(nome);
  const alvo = chaveNome(nome);
  const servidores = lerServidores(ler(`admin/rh/servidor/?q=${q}`)).filter((s) => chaveNome(s.nome) === alvo);
  if (servidores.length) return { tipo: 'servidor', servidores };
  const alunos = lerAlunos(ler(`admin/edu/aluno/?q=${q}`)).filter((a) => chaveNome(a.nome) === alvo);
  if (alunos.length) return { tipo: 'aluno', alunos };
  return { tipo: 'nenhum' };
}

// ─── main ───────────────────────────────────────────────────────────────────

function main() {
  const planilha = process.argv[2];
  if (!planilha) {
    console.error('Uso: node scripts/buscar-inventores-suap.js <inventores.xlsx> [cache.json]');
    process.exit(1);
  }
  const arquivoCache = process.argv[3] || CACHE_PADRAO;
  const cache = fs.existsSync(arquivoCache) ? JSON.parse(fs.readFileSync(arquivoCache, 'utf-8')) : {};

  const wb = XLSX.readFile(planilha);
  const nomes = XLSX.utils.sheet_to_json(wb.Sheets['Pessoas'])
    .filter((p) => p['Método'] === 'não encontrado')
    .map((p) => p.Inventor)
    .filter((n) => !cache[chaveNome(n)]);
  console.log(`${nomes.length} nomes para buscar no SUAP`);

  const contagem = { servidor: 0, aluno: 0, nenhum: 0 };
  nomes.forEach((nome, i) => {
    const r = buscar(nome);
    cache[chaveNome(nome)] = { nome, ...r, buscadoEm: new Date().toISOString() };
    contagem[r.tipo]++;
    // Grava a cada nome: se o limite diário cortar a busca, o que veio fica.
    fs.mkdirSync(path.dirname(arquivoCache), { recursive: true });
    fs.writeFileSync(arquivoCache, JSON.stringify(cache, null, 1));
    if ((i + 1) % 20 === 0) console.log(`  ${i + 1}/${nomes.length}`);
  });
  console.log(`servidor: ${contagem.servidor}  aluno: ${contagem.aluno}  nenhum: ${contagem.nenhum}`);
  console.log(`Cache: ${path.relative(RAIZ, arquivoCache)}`);
}

if (require.main === module) main();

module.exports = { lerServidores, lerAlunos, buscar };
