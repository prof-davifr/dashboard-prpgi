#!/usr/bin/env node
/**
 * Lista os inventores e autores de cada registro do INPI, com o campus de cada
 * pessoa.
 *
 * Uso:
 *   node scripts/inventores-inpi.js <inpi.csv> [saida.xlsx]
 *
 * O CSV vem do scraper-INPI (`node cli/coletar.js --out`). A saída padrão é
 * `dados/inpi/inventores-<data>.xlsx`.
 *
 * ─── LGPD ───────────────────────────────────────────────────────────────────
 *
 * A planilha traz nomes de pessoas. Ela fica em `dados/`, que é gitignored, e
 * nunca vai para o data.json. Este script não escreve em nenhum arquivo
 * versionado.
 *
 * ─── como o campus da pessoa é achado ───────────────────────────────────────
 *
 * O INPI dá só o nome. O nome é comparado com estas fontes locais:
 *
 *   - Lattes do SUAP (`dados/scraper-SUAPCNPQ/` e `dados/old/`): servidor, SIAPE e o campus
 *     da planilha em que ele aparece;
 *   - grupos do DGP (`data-groups.json`): pesquisadores, técnicos e estudantes,
 *     com o campus da unidade do grupo;
 *   - pós-graduação do SUAP (`dados/scraper-SUAPPos/`): aluno e campus;
 *   - iniciação científica (`dados/ic/`): orientador e bolsista, com o campus
 *     do projeto;
 *   - `inpi-campus.json`: SIAPE e campus que a cascata já resolveu;
 *   - busca no SUAP (`dados/inpi/suap-busca.json`, de
 *     `buscar-inventores-suap.js`): servidores pela lotação, alunos pelo campus
 *     do curso.
 *
 * A comparação é por nome inteiro (sem acento, caixa e partículas). Quando o
 * INPI abrevia ou omite um sobrenome, aceita-se a pessoa cujo prenome e último
 * sobrenome coincidem, desde que só uma pessoa da base case; a coluna `método`
 * marca esses casos como "aproximado". Uma pessoa em mais de um campus fica com
 * todos eles listados, o mais frequente primeiro.
 */

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const { parseCSV, extrairVinculos, SHEET_MAP_DETALHADO, normalizeCampusCode } = require('./build');
const { chaveINPI, TIPO_POR_BASE } = require('./refresh-inovacao');
const { mapUnidadeToCampus } = require('../src/shared');

const RAIZ = path.resolve(__dirname, '..');
// `old/` guarda exportações antigas do Lattes, com servidores que já saíram.
const DIRS_LATTES = ['scraper-SUAPCNPQ', 'old'].map((d) => path.join(RAIZ, 'dados', d));
const DIR_POS = path.join(RAIZ, 'dados', 'scraper-SUAPPos');
const GRUPOS_JSON = path.join(RAIZ, 'data-groups.json');
const DIR_IC = path.join(RAIZ, 'dados', 'ic');
const CACHE_SUAP = path.join(RAIZ, 'dados', 'inpi', 'suap-busca.json');

const PARTICULAS = new Set(['DE', 'DA', 'DO', 'DOS', 'DAS', 'E', 'D']);

/** "José da Silva Júnior" -> ["JOSE", "SILVA", "JUNIOR"]. */
function tokens(nome) {
  return (nome || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()
    .replace(/[^A-Z]+/g, ' ').trim().split(' ').filter((t) => t && !PARTICULAS.has(t));
}

const chaveNome = (nome) => tokens(nome).join(' ');

// ─── índice de pessoas ──────────────────────────────────────────────────────

/** `chaveNome -> { nome, siape, vinculo, campi: Map<campus, ocorrências>, fontes: Set }` */
function novoIndice() {
  const pessoas = new Map();
  const add = (nome, { siape = '', campus = '', vinculo, fonte }) => {
    const k = chaveNome(nome);
    if (!k || k.split(' ').length < 2) return;
    if (!pessoas.has(k)) pessoas.set(k, { nome: nome.trim(), siape: '', vinculos: new Set(), campi: new Map(), fontes: new Set() });
    const p = pessoas.get(k);
    if (siape && !p.siape) p.siape = siape;
    if (vinculo) p.vinculos.add(vinculo);
    if (campus) p.campi.set(campus, (p.campi.get(campus) || 0) + 1);
    p.fontes.add(fonte);
  };
  return { pessoas, add };
}

function carregarLattes(indice, campusPorSiape) {
  let n = 0;
  const arquivos = DIRS_LATTES.filter((d) => fs.existsSync(d)).flatMap((d) =>
    fs.readdirSync(d).filter((f) => /\.xlsx?$/.test(f)).map((f) => path.join(d, f)));
  for (const arquivo of arquivos) {
    const campus = normalizeCampusCode(path.basename(arquivo).replace(/\.xlsx?$/, '').split('-')[0]);
    const wb = XLSX.readFile(arquivo);
    for (const aba of wb.SheetNames) {
      if (!SHEET_MAP_DETALHADO[aba.trim().toLowerCase()] && !SHEET_MAP_DETALHADO[aba.trim()]) continue;
      for (const linha of XLSX.utils.sheet_to_json(wb.Sheets[aba], { raw: false, defval: null })) {
        for (const v of extrairVinculos(linha['Servidor'])) {
          indice.add(v.nome, { siape: v.id, campus, vinculo: 'Servidor', fonte: 'Lattes' });
          if (!campusPorSiape.has(v.id)) campusPorSiape.set(v.id, new Map());
          const m = campusPorSiape.get(v.id);
          m.set(campus, (m.get(campus) || 0) + 1);
          n++;
        }
      }
    }
  }
  return n;
}

function carregarDgp(indice) {
  if (!fs.existsSync(GRUPOS_JSON)) return 0;
  const { grupos = [] } = JSON.parse(fs.readFileSync(GRUPOS_JSON, 'utf-8'));
  let n = 0;
  for (const g of grupos) {
    if ((g.Situacao || '') === 'Excluído') continue;
    const campus = mapUnidadeToCampus(g.Unidade || '') || '';
    for (const m of g.membrosMap || []) {
      indice.add(m.nome, { siape: m.siape || '', campus, vinculo: 'Pesquisador (DGP)', fonte: 'DGP' });
      n++;
    }
    for (const [campo, vinculo] of [['TecnicosNomes', 'Técnico (DGP)'], ['EstudantesNomes', 'Estudante (DGP)']]) {
      for (const nome of String(g[campo] || '').split(';')) {
        if (nome.trim()) { indice.add(nome, { campus, vinculo, fonte: 'DGP' }); n++; }
      }
    }
  }
  return n;
}

function carregarPos(indice) {
  if (!fs.existsSync(DIR_POS)) return 0;
  const arquivos = fs.readdirSync(DIR_POS).filter((f) => f.endsWith('.csv')).sort();
  if (!arquivos.length) return 0;
  let n = 0;
  for (const r of parseCSV(path.join(DIR_POS, arquivos[arquivos.length - 1]))) {
    indice.add(r.nome || '', {
      campus: normalizeCampusCode(r.campus || ''),
      vinculo: 'Aluno de pós-graduação',
      fonte: 'SUAP Pós',
    });
    n++;
  }
  return n;
}

/** Campus de uma célula da planilha de IC: código ("SSA", "PAF") ou cidade. */
function campusDaIc(valor) {
  const bruto = (valor || '').toString().trim();
  if (/^[A-Za-z]{2,3}$/.test(bruto)) return normalizeCampusCode(bruto);
  return mapUnidadeToCampus(bruto) || '';
}

// Colunas fixas, as mesmas de build.js: 1=Orientador, 2=Bolsista, 4=Campus.
function carregarIc(indice) {
  if (!fs.existsSync(DIR_IC)) return 0;
  let n = 0;
  for (const arquivo of fs.readdirSync(DIR_IC).filter((f) => f.endsWith('.xlsx'))) {
    const wb = XLSX.readFile(path.join(DIR_IC, arquivo));
    for (const aba of wb.SheetNames.filter((a) => a.startsWith('Ciclo'))) {
      const linhas = XLSX.utils.sheet_to_json(wb.Sheets[aba], { raw: false, defval: null, header: 1 });
      for (const row of linhas.slice(3)) {
        if (!row || !row[1]) continue;
        const campus = campusDaIc(row[4]);
        indice.add(String(row[1]), { campus, vinculo: 'Orientador de IC', fonte: 'IC' });
        if (row[2]) indice.add(String(row[2]), { campus, vinculo: 'Bolsista de IC', fonte: 'IC' });
        n++;
      }
    }
  }
  return n;
}

/**
 * Resultado da busca por nome no SUAP. O servidor vale pela lotação; o aluno,
 * pelo campus do curso, e a matrícula mais recente entra primeiro, para ganhar
 * o empate quando o aluno tem cursos em campi diferentes.
 */
function carregarSuap(indice, campusPorSiape) {
  if (!fs.existsSync(CACHE_SUAP)) return 0;
  let n = 0;
  for (const r of Object.values(JSON.parse(fs.readFileSync(CACHE_SUAP, 'utf-8')))) {
    for (const s of r.servidores || []) {
      indice.add(r.nome, { siape: s.siape, campus: s.campus, vinculo: `Servidor (${s.situacao || 'SUAP'})`, fonte: 'SUAP' });
      if (s.siape && s.campus && !campusPorSiape.has(s.siape)) campusPorSiape.set(s.siape, new Map([[s.campus, 1]]));
      n++;
    }
    const alunos = [...(r.alunos || [])].sort((a, b) => String(b.matricula).localeCompare(String(a.matricula)));
    for (const a of alunos) {
      indice.add(r.nome, { campus: a.campus, vinculo: `Aluno (${a.situacao || 'SUAP'})`, fonte: 'SUAP' });
      n++;
    }
  }
  return n;
}

/** SIAPE -> campus que a cascata já gravou em inpi-campus.json. */
function carregarMapaInpi(campusPorSiape) {
  const arquivo = path.join(RAIZ, 'inpi-campus.json');
  if (!fs.existsSync(arquivo)) return;
  const { vinculos = {} } = JSON.parse(fs.readFileSync(arquivo, 'utf-8'));
  for (const lista of Object.values(vinculos)) {
    for (const v of lista) {
      if (!v.Servidor || !v.campus) continue;
      if (!campusPorSiape.has(v.Servidor)) campusPorSiape.set(v.Servidor, new Map());
      const m = campusPorSiape.get(v.Servidor);
      if (!m.has(v.campus)) m.set(v.campus, 1);
    }
  }
}

// ─── comparação de nomes ────────────────────────────────────────────────────

function porPrenomeUltimo(pessoas) {
  const idx = new Map();
  for (const [k, p] of pessoas) {
    const t = k.split(' ');
    const chave = `${t[0]} ${t[t.length - 1]}`;
    if (!idx.has(chave)) idx.set(chave, []);
    idx.get(chave).push({ k, p });
  }
  return idx;
}

/**
 * Acha a pessoa da base para um nome do INPI.
 * @returns {{ pessoa, metodo: 'exato'|'aproximado' } | null}
 */
function acharPessoa(nome, pessoas, idxPU) {
  const k = chaveNome(nome);
  if (!k) return null;
  if (pessoas.has(k)) return { pessoa: pessoas.get(k), metodo: 'exato' };
  const t = k.split(' ');
  if (t.length < 2) return null;
  const candidatos = (idxPU.get(`${t[0]} ${t[t.length - 1]}`) || []).filter(({ k: kb }) => {
    // Todo sobrenome do INPI tem de estar no nome da base, por extenso ou como
    // inicial. Sem isso, "Ana Souza" casaria com qualquer Ana ... Souza.
    const tb = kb.split(' ');
    return t.slice(1, -1).every((x) => tb.includes(x) || (x.length === 1 && tb.some((y) => y[0] === x)));
  });
  if (candidatos.length === 1) return { pessoa: candidatos[0].p, metodo: 'aproximado' };
  return null;
}

/**
 * Campi da pessoa, do mais citado ao menos, e a fatia do primeiro.
 *
 * A planilha Lattes de um campus lista também os coautores de outros campi,
 * então uma pessoa aparece em vários arquivos. O campus dela é o que mais
 * aparece; uma fatia baixa pede conferência.
 */
function ordenarCampi(mapa) {
  const lista = [...mapa.entries()].sort((a, b) => b[1] - a[1]);
  const total = lista.reduce((s, [, n]) => s + n, 0);
  return { campi: lista.map(([c]) => c), fatia: total ? lista[0][1] / total : 0 };
}

// Abaixo desta fatia o campus principal não domina, e a linha pede conferência.
const FATIA_MINIMA = 0.6;

// ─── main ───────────────────────────────────────────────────────────────────

function main() {
  const csv = process.argv[2];
  if (!csv) {
    console.error('Uso: node scripts/inventores-inpi.js <inpi.csv> [saida.xlsx]');
    process.exit(1);
  }
  const hoje = new Date().toISOString().slice(0, 10);
  const saida = process.argv[3] || path.join(RAIZ, 'dados', 'inpi', `inventores-${hoje}.xlsx`);

  const indice = novoIndice();
  const campusPorSiape = new Map();
  console.log(`Lattes: ${carregarLattes(indice, campusPorSiape)} vínculos`);
  console.log(`DGP: ${carregarDgp(indice)} membros`);
  console.log(`Pós-graduação: ${carregarPos(indice)} alunos`);
  console.log(`Iniciação científica: ${carregarIc(indice)} projetos`);
  console.log(`Busca no SUAP: ${carregarSuap(indice, campusPorSiape)} vínculos`);
  carregarMapaInpi(campusPorSiape);
  console.log(`${indice.pessoas.size} pessoas no índice`);
  const idxPU = porPrenomeUltimo(indice.pessoas);

  const nit = fs.existsSync(path.join(RAIZ, 'nit-estrutura.json'))
    ? JSON.parse(fs.readFileSync(path.join(RAIZ, 'nit-estrutura.json'), 'utf-8')).ativos || {}
    : {};
  const nitPorChave = {};
  for (const [numero, a] of Object.entries(nit)) nitPorChave[chaveINPI(numero)] = a;

  const linhas = parseCSV(csv);
  const pessoasUnicas = new Map(); // chaveNome -> linha do resumo por pessoa
  const detalhe = [];

  for (const r of linhas) {
    const chave = chaveINPI(r.numeroPedido);
    const ativoNit = nitPorChave[chave] || {};
    const base = {
      'Número INPI': r.numeroPedido,
      Tipo: TIPO_POR_BASE[r.base] || r.base,
      'Data de depósito': r.dataDeposito || '',
      Título: r.titulo || '',
      'Situação (NIT)': ativoNit.situacao || '',
      'Campus do ativo (NIT)': ativoNit.campus || ativoNit.estrutura || '',
    };
    const autores = String(r.autores || '').split(/\s*\/\s*/).map((s) => s.trim()).filter(Boolean);
    if (!autores.length) {
      detalhe.push({ ...base, Inventor: '', Vínculo: '', SIAPE: '', 'Campus do inventor': '',
        'Fatia do campus': '', 'Outros campi': '', Conferir: '',
        Método: r.base === 'marca' ? 'marca não tem inventor' : 'INPI sem autor', Fontes: '' });
      continue;
    }
    for (const autor of autores) {
      const achado = acharPessoa(autor, indice.pessoas, idxPU);
      let campi = [];
      let fatia = 0;
      let p = null;
      if (achado) {
        p = achado.pessoa;
        // Com SIAPE, vale a contagem do Lattes por SIAPE; sem ele, a do nome.
        const m = p.siape && campusPorSiape.has(p.siape) ? campusPorSiape.get(p.siape) : p.campi;
        ({ campi, fatia } = ordenarCampi(m));
      }
      const conferir = achado && (achado.metodo === 'aproximado' || fatia < FATIA_MINIMA) ? 'sim' : '';
      const linha = {
        ...base,
        Inventor: autor,
        Vínculo: p ? [...p.vinculos].join(', ') : '',
        SIAPE: p ? p.siape : '',
        'Campus do inventor': campi[0] || '',
        'Fatia do campus': campi.length ? Math.round(fatia * 100) / 100 : '',
        'Outros campi': campi.slice(1).join(', '),
        Conferir: conferir,
        Método: achado ? achado.metodo : 'não encontrado',
        Fontes: p ? [...p.fontes].join(', ') : '',
      };
      detalhe.push(linha);

      const kp = chaveNome(autor);
      if (!pessoasUnicas.has(kp)) {
        pessoasUnicas.set(kp, {
          Inventor: autor, Vínculo: linha.Vínculo, SIAPE: linha.SIAPE,
          'Campus do inventor': linha['Campus do inventor'], 'Fatia do campus': linha['Fatia do campus'],
          'Outros campi': linha['Outros campi'], Conferir: linha.Conferir,
          Método: linha.Método, Fontes: linha.Fontes, Registros: 0, Patentes: 0, Softwares: 0, Desenhos: 0,
        });
      }
      const u = pessoasUnicas.get(kp);
      u.Registros++;
      if (r.base === 'patente') u.Patentes++;
      if (r.base === 'programa') u.Softwares++;
      if (r.base === 'desenho') u.Desenhos++;
    }
  }

  const pessoas = [...pessoasUnicas.values()].sort((a, b) =>
    (a['Campus do inventor'] || 'ZZZ').localeCompare(b['Campus do inventor'] || 'ZZZ') || a.Inventor.localeCompare(b.Inventor, 'pt-BR'));

  // Resumo por campus: pessoas distintas e registros distintos.
  const porCampus = new Map();
  for (const l of detalhe) {
    if (!l.Inventor) continue;
    const c = l['Campus do inventor'] || '(sem campus)';
    if (!porCampus.has(c)) porCampus.set(c, { pessoas: new Set(), registros: new Set() });
    porCampus.get(c).pessoas.add(chaveNome(l.Inventor));
    porCampus.get(c).registros.add(l['Número INPI']);
  }
  const contar = (m) => pessoas.filter((p) => p.Método === m).length;
  const resumo = [
    ['Inventores e autores dos registros do INPI'],
    ['Gerado em', hoje],
    ['CSV do INPI', path.basename(csv)],
    [],
    ['Registros no CSV', linhas.length],
    ['Pessoas distintas', pessoas.length],
    ['  com campus (nome exato)', contar('exato')],
    ['  com campus (nome aproximado)', contar('aproximado')],
    ['  não encontradas nas bases', contar('não encontrado')],
    ['  a conferir', pessoas.filter((p) => p.Conferir).length],
    [],
    ['Campus', 'Pessoas', 'Registros'],
    ...[...porCampus.entries()].sort((a, b) => b[1].pessoas.size - a[1].pessoas.size)
      .map(([c, v]) => [c, v.pessoas.size, v.registros.size]),
    [],
    ['Leitura'],
    ['"Campus do inventor" é o campus da própria pessoa (Lattes, DGP, pós-graduação, IC ou busca no SUAP), não o do ativo.'],
    ['Aluno achado no SUAP: campus do curso; com cursos em campi diferentes, vale o da matrícula mais recente e "Conferir" fica "sim".'],
    ['"Campus do ativo (NIT)" é o campus que o setor de PI da PRPGI registrou para o ativo.'],
    ['"Fatia do campus": parte das ocorrências da pessoa nas bases que cai no campus principal. Abaixo de 0,6, "Conferir" fica "sim".'],
    ['"aproximado": o INPI abrevia ou omite um sobrenome; prenome e último sobrenome casam com uma só pessoa. Confira.'],
    ['"não encontrado": a pessoa não está nas bases locais nem na busca por nome no SUAP. Em geral, coautor de fora do IFBA ou nome escrito de outro jeito.'],
    ['Dado pessoal: não publique esta planilha nem a coloque no git.'],
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resumo), 'Resumo');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pessoas), 'Pessoas');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detalhe), 'Por registro');
  fs.mkdirSync(path.dirname(saida), { recursive: true });
  XLSX.writeFile(wb, saida);

  console.log(`\n${pessoas.length} pessoas distintas em ${linhas.length} registros`);
  console.log(`  exato: ${contar('exato')}  aproximado: ${contar('aproximado')}  não encontrado: ${contar('não encontrado')}`);
  console.log(`Planilha: ${path.relative(RAIZ, saida)}`);
}

if (require.main === module) main();

module.exports = { tokens, chaveNome, acharPessoa, porPrenomeUltimo };
