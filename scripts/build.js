#!/usr/bin/env node
// build.js  Pre-processes all XLSX + CSV data files into a single data.json
// Run: node build.js   (or: npm run build)

const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const { validate } = require('./validate-data');
const { canonizarCurso } = require('./programas-pos');

const DADOS_DIR = path.join(__dirname, '..', 'dados');
const OUTPUT_FILE = path.join(__dirname, '..', 'data.json');
const OUTPUT_GROUPS = path.join(__dirname, '..', 'data-groups.json');

// Normalize non-standard campus codes that appear in filenames or raw data
const CAMPUS_CODE_FIX = {
  'VDC': 'VC',   // Vitória da Conquista (common typo)
  'FSA': 'FS',   // Feira de Santana (typo)
  'PAF': 'PA',   // Paulo Afonso (typo)
  'PSG': 'PS',   // Porto Seguro — o SUAP trocou PS por PSG entre ago e set/2026
};

// Nomes de curso da pós que nenhuma entrada de PROGRAMAS_POS reconheceu. O
// build não para por causa disso — o aluno continua no painel —, mas avisa no
// fim, porque um nome fora do registro volta a duplicar o programa no gráfico.
const cursosPosSemRegistro = new Set();

function normalizeCampusCode(raw) {
  const upper = (raw || '').toString().trim().toUpperCase();
  return CAMPUS_CODE_FIX[upper] || upper;
}

// Palavras que ficam em minúscula dentro de um nome de cidade, exceto na
// primeira posição: "Mata de São João", "Bom Jesus da Lapa".
const CONECTIVOS_POLO = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);

// O campo `polo` chega do SUAP em 51 grafias para as mesmas cidades:
// `EspDoc_UAB_CAMAÇARI (UBA)`, `Pólo Eunápolis - UAB`, `Irecê  UAB`,
// `MATA DE SÃO JOÃO`. Todas viram o nome da cidade, do jeito que a tabela do
// painel mostra. O que sobra depois da limpeza é preservado: o sufixo de
// `SALVADOR: SUBÚRBIO` distingue dois polos da mesma cidade.
function normalizePolo(raw) {
  let s = (raw || '').toString().replace(/\s+/g, ' ').trim();
  if (!s) return '';

  s = s.replace(/^EspDoc[_\s]*UAB[_\s]*/i, '');
  s = s.replace(/\s*\((?:UAB|UBA)\)\s*$/i, '');
  s = s.replace(/^P[óo]lo\s+/i, '');
  s = s.replace(/\s*[-–]\s*UAB\s*$/i, '');
  s = s.replace(/\s+UAB\s*$/i, '');
  s = s.trim();
  if (!s) return '';

  // Só reescreve a caixa quando a fonte mandou tudo em maiúscula. Um nome que
  // já veio bem escrito passa intacto.
  if (s === s.toUpperCase()) {
    s = s.toLowerCase().split(' ').map((palavra, i) => {
      if (i > 0 && CONECTIVOS_POLO.has(palavra)) return palavra;
      return palavra.charAt(0).toUpperCase() + palavra.slice(1);
    }).join(' ');
  }
  return s;
}

// Erros de grafia que vêm da fonte (Lattes/SUAP) e chegam ao painel como rótulo
// de gráfico. Corrigidos aqui para que data.json já saia certo.
// `scripts/comparar_pi.js` continua aceitando a grafia antiga da planilha DINOV.
const TIPO_FIX = {
  'Desenho Insdustrial': 'Desenho Industrial',
};

function normalizeTipo(raw) {
  const t = (raw || '').toString().trim();
  return TIPO_FIX[t] || raw;
}

// ─── LGPD: pseudonimização de dados pessoais ─────────────────────────────────
// data.json é publicado no GitHub Pages. Nomes, matrículas e e-mails nunca
// entram no arquivo público; identidades viram um hash estável, que preserva as
// contagens de valores distintos (alunos, orientadores, bolsistas) sem expor
// o dado pessoal.
//
// O salt fica em `.build-salt` (gitignored) para que o hash seja estável entre
// builds — evitando diffs gigantes no data.json — sem ser reversível por força
// bruta a partir do repositório público (matrículas são enumeráveis).
//
// Uma cópia vive fora da árvore do projeto, em ~/.config/dashboard-prpgi/. Sem
// ela, apagar node_modules, reclonar o repositório ou trocar de máquina geraria
// um salt novo em silêncio, e o build seguinte reescreveria todos os
// pseudônimos — um diff de 21 MB sem nenhuma mudança real de dado.
const SALT_FILE = path.join(__dirname, '..', '.build-salt');
const SALT_BACKUP_DIR = path.join(
  process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'),
  'dashboard-prpgi'
);
const SALT_BACKUP_FILE = path.join(SALT_BACKUP_DIR, 'build-salt');

// 0600: só o dono lê. É segredo — quem o tiver consegue reverter os
// pseudônimos do data.json por força bruta.
function gravarSalt(destino, salt) {
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.writeFileSync(destino, salt + '\n', { mode: 0o600 });
  try {
    fs.chmodSync(destino, 0o600); // arquivo preexistente mantém o modo antigo
  } catch { /* sistemas de arquivos sem permissões POSIX */ }
}

// Os caminhos são parâmetros para que os testes possam exercitar os três
// caminhos em diretórios temporários, sem tocar no salt real da máquina.
function loadOrCreateSalt(local = SALT_FILE, backup = SALT_BACKUP_FILE, log = console.log) {
  // 1. Salt local: fonte normal.
  if (fs.existsSync(local)) {
    const salt = fs.readFileSync(local, 'utf-8').trim();
    if (!fs.existsSync(backup)) {
      gravarSalt(backup, salt);
      log(`  Salt copiado para ${backup}`);
    }
    return salt;
  }

  // 2. Sem salt local, mas com backup: restaura e mantém os pseudônimos.
  if (fs.existsSync(backup)) {
    const salt = fs.readFileSync(backup, 'utf-8').trim();
    gravarSalt(local, salt);
    log(`  Salt restaurado de ${backup} (pseudônimos preservados)`);
    return salt;
  }

  // 3. Primeira execução nesta máquina.
  const salt = crypto.randomBytes(32).toString('hex');
  gravarSalt(local, salt);
  gravarSalt(backup, salt);
  log(`  Salt de pseudonimização criado em ${local} (não versionar)`);
  log(`  Cópia de segurança em ${backup}`);
  log('  ATENÇÃO: se este for um projeto já existente, os pseudônimos do');
  log('  data.json vão mudar. Recupere o salt antigo antes de commitar.');
  return salt;
}

/**
 * Hash curto e determinístico para chaves de deduplicação.
 *
 * Diferente de `pseudonymize`, aqui NÃO há salt: o valor de entrada (um título
 * de publicação) é público, e a chave precisa ser reprodutível por qualquer
 * pessoa que rode o build. O objetivo é só encolher o payload.
 *
 * 16 hex = 64 bits. Para ~150 mil chaves distintas, a probabilidade de colisão
 * é da ordem de 1e-9 — irrelevante diante do ruído da própria normalização de
 * títulos.
 */
function shortHash(value) {
  const s = (value === null || value === undefined) ? '' : value.toString();
  if (!s) return '';
  return crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);
}

let SALT = null;

/**
 * Converte um identificador pessoal (nome, matrícula) num pseudônimo estável.
 * Valores vazios continuam vazios, para que `.filter(Boolean)` no frontend
 * siga funcionando.
 */
function pseudonymize(value, salt = SALT) {
  const s = (value === null || value === undefined) ? '' : value.toString().trim();
  if (!s) return '';
  return crypto.createHash('sha256')
    .update(salt + '\0' + s.toUpperCase())
    .digest('hex')
    .slice(0, 16);
}

const SOURCE_LABELS = {
  'scraper-SUAPCNPQ': 'SUAP CNPq (Lattes)',
  'scraper-DGP': 'DGP',
  'scraper-SUAPPos': 'SUAP Pós-Graduação',
  'ic': 'IC (Iniciação Científica)'
};

// A aba `inovacao` NÃO está aqui de propósito: a fonte dela é o INPI, não o
// Lattes. `scripts/refresh-inovacao.js` preenche o array a partir do CSV do
// repositório scraper-INPI, e o build deixa `result.inovacao` vazio.
//
// Os registros do Lattes contavam 988 contra os ~160 que o INPI conhece no CNPJ
// do IFBA: a maioria era propriedade intelectual de outra titularidade.
//
// Ordem obrigatória depois de qualquer `npm run build`:
//     npm run build && node scripts/refresh-inovacao.js <inpi.csv>
// Sem o segundo comando, o data.json sai com a aba Inovação vazia.
const SHEET_MAP = {
  'produções bibliográficas': 'bibliografica',
  'produções técnicas': 'tecnica',
  'orientações concluídas': 'concluidas',
  'orientações em andamento': 'andamento',
  // Title-case variants (new scraper format)
  'Produções Bibliográficas': 'bibliografica',
  'Produções Técnicas': 'tecnica',
  'Orientações Concluídas': 'concluidas',
  'Orientações em Andamento': 'andamento'
};

// O build precisa continuar lendo a aba de registros do XLSX para o
// data-groups.json (o relatorio-grupos-pesquisa usa), mas não para o data.json.
const SHEET_MAP_DETALHADO = { ...SHEET_MAP, 'registros e patentes': 'inovacao', 'Registros e Patentes': 'inovacao' };

// ─── autoria: uma linha do SUAP pode citar vários servidores ─────────────────
// A coluna `Servidor` do XLSX é a repr de um QuerySet do Django, e uma linha só
// chega a listar 20 vínculos. Quando o SUAP agrupa produções por título, os
// títulos genéricos ("Semana Nacional de Ciência e Tecnologia") juntam registros
// de pessoas diferentes, e o fan-out abaixo dá os pontos cheios a todas elas.
// Em Organização de Eventos, apenas 42% dos vínculos múltiplos trazem o
// sobrenome do servidor na citação; em artigos são 95%.
//
// A citação Lattes escreve o sobrenome por extenso ("FERNANDES, A. O."), então
// ela prova a autoria. Numa linha com dois ou mais vínculos, ficam só os
// servidores que a citação nomeia.
//
// A regra não vale para orientações: lá a citação nomeia o aluno, não o
// orientador ("Cecília Alves Guimarães. Águas que conectam... Início: 2026.").
const CHAVES_COM_AUTORIA = new Set(['bibliografica', 'tecnica', 'inovacao']);

// Partículas e sufixos não identificam ninguém, e "JUNIOR"/"NETO" aparecem em
// citações de terceiros com frequência alta demais para servir de prova.
const PARTICULAS_NOME = new Set(['DE', 'DA', 'DO', 'DOS', 'DAS', 'E', 'JUNIOR', 'NETO', 'FILHO', 'SOBRINHO']);

function normalizarParaBusca(s) {
  return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z]+/g, ' ');
}

function tokensDeNome(nome) {
  return normalizarParaBusca(nome).split(' ').filter((t) => t.length > 3 && !PARTICULAS_NOME.has(t));
}

// Uma entrada de autor Lattes é "SOBRENOME, Iniciais": "SANTOS, J. N. S. C.",
// "ISRAEL, Haniel", "OLIVEIRA FERNANDES, A.". O sobrenome aceita duas palavras
// porque sobrenomes compostos aparecem inteiros antes da vírgula.
const RE_AUTOR = /([A-Za-zÀ-ÿ'-]+(?:\s+[A-Za-zÀ-ÿ'-]+)?)\s*,\s*([A-Za-zÀ-ÿ])/g;

function autoresDaCitacao(citacao) {
  const autores = [];
  for (const m of (citacao || '').matchAll(RE_AUTOR)) {
    autores.push({
      sobrenomes: normalizarParaBusca(m[1]).trim().split(' '),
      inicial: normalizarParaBusca(m[2]).trim()
    });
  }
  if (autores.length) return autores;
  const unico = autorSemVirgula(citacao);
  return unico ? [unico] : [];
}

// Parte das citações de evento traz um organizador só, sem vírgula:
// "I.C.F.A. JORGE; Semana Nacional de Ciência e Tecnologia. 2015." Aqui não há
// inicial para conferir, e a comparação fica pelo sobrenome. O trecho só conta
// como nome se for curto e sem números — caso contrário é o próprio título.
function autorSemVirgula(citacao) {
  const texto = (citacao || '').trim();
  // Sem separador não há autor: a citação é só o nome do produto ("Sistema de
  // gestão XPTO"), e aí ninguém é descartado.
  const fim = texto.search(/;|\s\.\s/);
  if (fim < 1) return null;
  const trecho = texto.slice(0, fim).trim();
  if (!trecho || /\d/.test(trecho) || trecho.split(/\s+/).length > 6) return null;
  const sobrenomes = normalizarParaBusca(trecho).trim().split(' ').filter((t) => t.length > 3);
  return sobrenomes.length ? { sobrenomes, inicial: '' } : null;
}

/**
 * Diz se a citação nomeia esta pessoa.
 *
 * Só o sobrenome não basta: "Alexandre de Oliveira Fernandes" casaria com
 * "OLIVEIRA, J. R. S.", que é outra pessoa. A inicial do prenome entra junto.
 * Uma citação sem lista de autores (Software, Marca) não permite julgar, e aí
 * a resposta é sim — quem decide o descarte é `filtrarPorAutoria`.
 */
function nomeNaCitacao(nome, citacao) {
  const tokens = tokensDeNome(nome);
  if (!tokens.length) return true;
  const autores = autoresDaCitacao(citacao);
  if (!autores.length) return true;
  // A inicial tem de vir de um nome anterior ao sobrenome citado. Sem isso,
  // "Alexandre de Oliveira Fernandes" casaria com "OLIVEIRA, F. J. R." pelo F
  // de Fernandes, que na citação é o prenome de outra pessoa.
  const casa = (a) => {
    const pos = tokens.findIndex((t) => a.sobrenomes.includes(t));
    if (pos < 0) return false;
    if (!a.inicial) return true; // autor sem inicial: só o sobrenome responde
    const anteriores = pos > 0 ? tokens.slice(0, pos) : tokens.slice(1);
    return anteriores.some((t) => t[0] === a.inicial);
  };
  if (autores.some(casa)) return true;
  // Parte dos autores vem por extenso e sem vírgula ("Marcelo Nava ; LIMA, E.
  // P. R."), fora do formato acima. Aí exige-se o prenome e mais um sobrenome,
  // ambos como palavra inteira: só o sobrenome voltaria a casar com terceiros.
  const palavras = new Set(normalizarParaBusca(citacao).split(' '));
  const [prenome, ...sobrenomes] = tokens;
  return palavras.has(prenome) && sobrenomes.some((t) => palavras.has(t));
}

/**
 * Reduz os vínculos de uma linha aos servidores que a citação nomeia.
 *
 * @param {{id: string, nome: string}[]} vinculos servidores extraídos do QuerySet
 * @param {string} citacao coluna Publicação/Título da linha
 * @param {string} key chave do SHEET_MAP (bibliografica, tecnica, ...)
 */
function filtrarPorAutoria(vinculos, citacao, key) {
  if (vinculos.length < 2) return vinculos;
  if (!CHAVES_COM_AUTORIA.has(key)) return vinculos;
  if (!citacao) return vinculos;
  // Lista vazia é resultado válido: a citação traz autores e nenhum dos
  // servidores está entre eles. Acontece quando o QuerySet corta no 20º vínculo
  // e o autor real fica de fora. A linha sai toda, porque creditar 20 pessoas
  // erradas é pior do que perder uma produção.
  return vinculos.filter((v) => nomeNaCitacao(v.nome, citacao));
}

// O QuerySet vem como "<VinculoQueryset [<Vinculo: Nome Completo (123456) (Servidor)>, ...]>".
// O Django corta a repr no 20º item e escreve "...(remaining elements truncated)...",
// então listas longas chegam incompletas — nada que o build possa recuperar.
//
// A matrícula tem 5, 6 ou 7 dígitos: servidores antigos ficaram com SIAPE curto.
// A regex exigia 7, e as 4.287 linhas de SIAPE curto caíam no fallback da linha
// que copia o QuerySet cru para `Servidor` — nome completo dentro do data.json
// público, e coautoria sem fan-out. Não baixe de 5: com 4 dígitos a regex casaria
// com um ano entre parênteses.
function extrairVinculos(raw) {
  const texto = (raw === null || raw === undefined) ? '' : raw.toString();
  if (!texto) return [];
  const comNome = [...texto.matchAll(/Vinculo: (.+?) \((\d{5,})\)/g)];
  if (comNome.length) return comNome.map((m) => ({ id: m[2], nome: m[1].trim() }));
  return [...texto.matchAll(/\((\d{5,})\)/g)].map((m) => ({ id: m[1], nome: '' }));
}

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

// Divide o texto do CSV em registros e campos numa varredura s\u00f3, respeitando as
// aspas tamb\u00e9m na quebra de linha.
//
// A vers\u00e3o anterior fazia text.split('\n') antes de olhar as aspas. O SUAP
// exporta c\u00e9lulas com quebra de linha dentro \u2014 um aluno do mestrado tinha o
// e-mail acad\u00eamico partido em duas linhas \u2014 e o registro virava dois registros
// defeituosos, ambos descartados adiante por ficarem sem ano. O aluno sumia do
// painel sem aviso nenhum.
function splitCsvRecords(text) {
  const records = [];
  let fields = [];
  let field = '';
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (char === '"') {
      if (insideQuotes && text[i + 1] === '"') {
        field += '"'; // aspas escapadas dentro do campo
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }

    if (!insideQuotes && (char === '\n' || char === '\r')) {
      if (char === '\r' && text[i + 1] === '\n') i++;
      fields.push(field);
      records.push(fields);
      fields = [];
      field = '';
      continue;
    }

    if (char === ',' && !insideQuotes) {
      fields.push(field);
      field = '';
      continue;
    }

    field += char;
  }

  fields.push(field);
  records.push(fields);

  return records.filter(r => r.some(f => f.trim() !== ''));
}

function parseCSV(filePath) {
  const text = fs.readFileSync(filePath, 'utf-8');
  const records = splitCsvRecords(text);
  if (records.length === 0) return [];

  const headers = records[0].map(h => h.trim())
                       .map(h => h.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ''));

  return records.slice(1).map(fields => {
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = i < fields.length ? fields[i].trim() : '';
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

// Exportações de pós-graduação são snapshots cumulativos do SUAP: cada novo
// download contém TODOS os alunos (e os anteriores). Concatenar vários arquivos
// sem deduplicar por matrícula infla os totais (~3x). Por isso fica apenas o
// snapshot mais recente (timestamp embutido no nome: alunos_pos_YYYYMMDD_HHMMSS).
function selectPosGraduacaoCsvFiles(csvFiles) {
  const posGradFiles = csvFiles.filter(({ fileName }) => isPostGraduationCsv(fileName));
  if (posGradFiles.length === 0) {
    return { selected: null, ignored: [] };
  }

  const withTimestamp = posGradFiles.map(file => {
    const m = file.fileName.match(/alunos_pos_(\d{8})_(\d{6})\.csv$/i);
    let ts = 0;
    if (m) {
      const d = `${m[1].slice(0, 4)}-${m[1].slice(4, 6)}-${m[1].slice(6, 8)}T${m[2].slice(0, 2)}:${m[2].slice(2, 4)}:${m[2].slice(4, 6)}`;
      ts = new Date(d).getTime();
    }
    if (!ts || Number.isNaN(ts)) {
      try { ts = fs.statSync(file.filePath).mtimeMs || 0; } catch (e) { ts = 0; }
    }
    return { ...file, ts };
  });

  withTimestamp.sort((a, b) => b.ts - a.ts);
  const [selected, ...ignored] = withTimestamp;
  return { selected, ignored };
}

/**
 * Copia a aba Inovação do data.json anterior para o resultado do build, junto
 * com tudo o que ela implica.
 *
 * O build não enxerga o INPI: `SHEET_MAP` omite a aba de propósito, porque a
 * fonte é `scripts/refresh-inovacao.js`. Preservar só o array não basta. A
 * faixa de anos daqui vem dos dados do Lattes, que começam em 2000, e o INPI
 * alcança 1996 — sem alargar, o filtro de período em "Todos" descarta esses
 * registros em silêncio, e eles ficam no data.json sem aparecer na tela. A
 * data da fonte tem o mesmo problema: sem ela o painel lista a atualização de
 * quatro fontes e omite a quinta, sem o leitor ter como saber por quê.
 *
 * @returns {boolean} true quando havia o que preservar.
 */
function preservarInovacao(result, anterior) {
  if (!anterior || !Array.isArray(anterior.inovacao) || anterior.inovacao.length === 0) return false;

  result.inovacao = anterior.inovacao;

  const anos = anterior.inovacao.map(r => parseInt(r.Ano, 10)).filter(a => !Number.isNaN(a));
  if (anos.length) {
    result.meta.minYear = Math.min(result.meta.minYear, ...anos);
    result.meta.maxYear = Math.max(result.meta.maxYear, ...anos);
  }

  const metaAnterior = anterior.meta || {};
  for (const campo of ['sourceFiles', 'sourceDates']) {
    if (metaAnterior[campo] && metaAnterior[campo]['INPI']) {
      result.meta[campo]['INPI'] = metaAnterior[campo]['INPI'];
    }
  }

  return true;
}

function main() {
  console.log(' Scanning dados/ for .xlsx and .csv files recursively...');

  SALT = loadOrCreateSalt();

  const xlsFiles = [
    ...findFiles(DADOS_DIR, '.xlsx'),
    ...findFiles(DADOS_DIR, '.xls')
  ].filter(f => getSourceKey(f.filePath) !== 'ic');

  // ─── Dedup XLS files by campus: prefer scraper .xlsx with real data,
  //      fall back to .xls from old/ if scraper file is empty (just "vazio") ──
  const xlsByCampus = {};
  for (const f of xlsFiles) {
    const rawName = path.basename(f.fileName, path.extname(f.fileName));
    const code = normalizeCampusCode(rawName.split('-')[0]);
    if (!xlsByCampus[code]) xlsByCampus[code] = [];
    xlsByCampus[code].push(f);
  }

  function hasRealData(filePath) {
    try {
      const wb = XLSX.readFile(filePath);
      const sheets = wb.SheetNames.filter(s => s.toLowerCase() !== 'vazio');
      if (sheets.length === 0) return false;
      // Check at least one non-vazio sheet has more than 1 row
      for (const sn of sheets) {
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { raw: false, defval: null });
        if (rows.length > 0) return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  const dedupedXlsFiles = [];
  for (const [code, files] of Object.entries(xlsByCampus)) {
    // Sort: prefer scraper-SUAPCNPQ over old/, and newer format (.xlsx) over .xls
    const scraperFiles = files.filter(f => getSourceKey(f.filePath) === 'scraper-SUAPCNPQ');
    const otherFiles = files.filter(f => getSourceKey(f.filePath) !== 'scraper-SUAPCNPQ');

    // Try scraper files first (newest data)
    const bestScraper = scraperFiles.find(f => hasRealData(f.filePath));
    if (bestScraper) {
      dedupedXlsFiles.push(bestScraper);
      if (otherFiles.length > 0) {
        console.log(`   Campus ${code}: using scraper data, skipping ${otherFiles.length} older file(s)`);
      }
      continue;
    }

    // Fall back to any file with real data (old/ directory, etc.)
    const bestOther = otherFiles.find(f => hasRealData(f.filePath));
    if (bestOther) {
      dedupedXlsFiles.push(bestOther);
      if (scraperFiles.length > 0) {
        console.log(`   Campus ${code}: scraper file empty, falling back to ${bestOther.fileName}`);
      }
      continue;
    }

    // No file has data — keep one scraper file for consistency (will produce zero records)
    if (scraperFiles.length > 0) {
      dedupedXlsFiles.push(scraperFiles[0]);
    } else if (otherFiles.length > 0) {
      dedupedXlsFiles.push(otherFiles[0]);
    }
  }
  const csvFiles = findFiles(DADOS_DIR, '.csv');
  const dgpCsvSelection = selectDgpGroupsCsvFiles(csvFiles);
  const posGradCsvSelection = selectPosGraduacaoCsvFiles(csvFiles);

  // Só entram CSVs de fontes reconhecidas. Antes, qualquer .csv sob dados/ que
  // não fosse do DGP caía no processamento de grupos por eliminação — foi assim
  // que a planilha da DINOV, ao ser movida para dados/validacao/, inflou
  // `grupos` de 197 para 494.
  const csvReconhecido = file =>
    isPostGraduationCsv(file.fileName) || isDgpGroupsCsv(file.filePath, file.fileName);

  const csvFilesToProcess = csvFiles.filter(file => {
    if (!csvReconhecido(file)) return false;
    if (isPostGraduationCsv(file.fileName)) {
      return posGradCsvSelection.selected && file.filePath === posGradCsvSelection.selected.filePath;
    }
    return dgpCsvSelection.selected && file.filePath === dgpCsvSelection.selected.filePath;
  });

  const csvIgnorados = csvFiles.filter(f => !csvReconhecido(f));
  if (csvIgnorados.length > 0) {
    console.log(`   Ignorando ${csvIgnorados.length} CSV(s) fora das fontes conhecidas: ${csvIgnorados.map(f => f.fileName).join(', ')}`);
  }

  console.log(`   Found ${dedupedXlsFiles.length} campus files (after dedup) and ${csvFiles.length} CSV files.`);
  if (dgpCsvSelection.selected) {
    console.log(`   Using DGP groups source: ${dgpCsvSelection.selected.fileName}`);
  }
  if (dgpCsvSelection.ignored.length > 0) {
    console.log(`   Ignoring ${dgpCsvSelection.ignored.length} historical/extra DGP CSV file(s).`);
  }
  if (posGradCsvSelection.selected) {
    console.log(`   Using pós-graduação source: ${posGradCsvSelection.selected.fileName}`);
  }
  if (posGradCsvSelection.ignored.length > 0) {
    console.log(`   Ignoring ${posGradCsvSelection.ignored.length} snapshot(s) anteriores (cumulativos): ${posGradCsvSelection.ignored.map(f => f.fileName).join(', ')}`);
  }

  const result = {
    meta: {
      files: dedupedXlsFiles.map(f => f.fileName),
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
  for (const { fileName, filePath } of dedupedXlsFiles) {
    registerSourceFile(result.meta, filePath, fileName);
    // Campus code is the filename without extension, normalized (e.g. VDC.xlsx → VC)
    // For old format CAMPUS-YYYY-YYYY.xls, take only the code before first dash
    const rawName = path.basename(fileName, path.extname(fileName));
    const campusCode = normalizeCampusCode(rawName.split('-')[0]);

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

        // O frontend s\u00f3 compara dedupKeys por igualdade (`filterUnique` em
        // src/script.js), ent\u00e3o o t\u00edtulo normalizado inteiro n\u00e3o precisa
        // trafegar: eram 105 caracteres por registro em ~150 mil registros,
        // 15,8 MB dos 32 MB do data.json.
        //
        // `inovacao` \u00e9 a exce\u00e7\u00e3o: scripts/comparar_pi.js extrai o n\u00famero do
        // registro de dentro da chave (`numerodoregistro\u2026dataderegistro`), e
        // s\u00e3o apenas 935 registros \u2014 o ganho ali seria irrelevante.
        const shortKey = r => {
          const k = normalizeKey(r);
          if (!k) return "";
          return key === 'inovacao' ? k : shortHash(k);
        };

        const tagged = rows.flatMap(r => {
          // Extract all Servidor IDs from the VinculoQueryset string (multi-author support)
          const citacao = r["Publicação"] || r["Título"] || r["Nome"] || "";
          const todos = extrairVinculos(r["Servidor"]);
          // Sem nenhum vínculo legível, o valor cru segue adiante como antes.
          // Com vínculos, o filtro manda: lista vazia significa linha descartada.
          const srvIds = todos.length
            ? filtrarPorAutoria(todos, citacao, key).map(v => v.id)
            : [r["Servidor"] || null];
          const base = {
             Ano: r["Ano"],
             Tipo: normalizeTipo(r["Tipo"]),
             campus: campusCode,
             dedupKey: shortKey(r)
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

           // Normaliza "Especializao" (modalidade do SUAP vem como "Especialização")
           if (categoria === 'Especializao') categoria = 'Especialização';

           // If categoria is empty or invalid, infer from curso name
           // (normalizado NFD p/ ignorar acentos: ESPECIALIZAÇÃO → especializacao)
           if (!categoria || !['Mestrado', 'Doutorado', 'Especialização'].includes(categoria)) {
             const cursoLower = curso.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
             if (cursoLower.includes('doutorado')) categoria = 'Doutorado';
             else if (cursoLower.includes('mestrado')) categoria = 'Mestrado';
             else if (cursoLower.includes('especializacao') || cursoLower.includes('lato sensu') || cursoLower.includes('pos-graduacao')) categoria = 'Especialização';
             else categoria = 'Outro'; // Fallback
           }
           
           // Nome do programa.
           //
           // O SUAP não tem cadastro único de curso: em set/2026 eram 60 nomes
           // para 27 programas, porque cada campus digita o seu. O registro de
           // scripts/programas-pos.js resolve o nome canônico; a limpeza abaixo
           // (código de matrícula no começo, campus entre parênteses no fim) só
           // vale para o que o registro ainda não conhece.
           let curso_simplificado = curso;
           if (curso_simplificado) {
             const canonico = canonizarCurso(curso_simplificado);
             if (canonico.encontrado) {
               curso_simplificado = canonico.nome;
             } else {
               if (curso_simplificado.trim()) cursosPosSemRegistro.add(curso_simplificado.trim());
               curso_simplificado = curso_simplificado
                 .replace(/^\d+\s*-\s*/, '')
                 .replace(/\s*\([^)]*\)$/, '')
                 .trim();
             }
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

           // LGPD: nome, matrícula e e-mails não entram no data.json público.
           // A identidade do aluno sobrevive apenas como dedupKey pseudonimizado,
           // o que preserva a contagem de alunos únicos e a deduplicação.
           return {
             curso: curso_simplificado,
             curso_original: curso,
             campus: campus,
             polo: normalizePolo(r["polo"]),
             situacao: situacao,
             ano: ano,
             semestre: semestre,
             ano_periodo: anoPeriodo,
             modalidade: r["modalidade"],
             categoria: categoria,
             dedupKey: pseudonymize(r["matricula"])
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
              // LGPD: só as contagens de únicos são usadas pela aba IC
              // (renderKPIsIC), então os nomes viram pseudônimos estáveis.
              orientador: pseudonymize(row[1]),
              bolsista: pseudonymize(row[2]),
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

  // A aba Inovação não vem de dados/: ela vem do INPI, por
  // scripts/refresh-inovacao.js. O build deixa result.inovacao vazio de
  // propósito (ver SHEET_MAP), mas validate() recusa dataset vazio e aborta
  // antes de escrever. Sem isto as duas regras se anulam e `npm run build`
  // nunca conclui.
  //
  // A saída é preservar o que o data.json já publica. O refresh seguinte
  // sobrescreve com a coleta nova; se ele não rodar, a aba continua com o
  // último conteúdo bom em vez de esvaziar. Ver preservarInovacao().
  if (result.inovacao.length === 0 && fs.existsSync(OUTPUT_FILE)) {
    try {
      const anterior = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf-8'));
      if (preservarInovacao(result, anterior)) {
        console.log(`   Inovação preservada do data.json anterior (${anterior.inovacao.length} registros).`);
        console.log('   Rode `node scripts/refresh-inovacao.js <inpi.csv>` para atualizá-la.');
      }
    } catch (e) {
      console.warn(`   Não consegui ler a Inovação do data.json anterior: ${e.message}`);
    }
  }

  // Write data.json (lightweight — for dashboard)
  const jsonStr = JSON.stringify(result, (key, value) => value === null ? undefined : value);

  // Valida ANTES de escrever: um data.json quebrado (dataset vazio, código de
  // campus desconhecido, campo de dado pessoal) é pior que nenhum, porque vai
  // direto para o GitHub Pages no próximo push. Antes isso era só console.warn.
  // O parse/stringify normaliza o resultado para o mesmo formato que o
  // validador vê em disco (o replacer acima remove os nulls).
  const errosValidacao = validate(JSON.parse(jsonStr));
  if (errosValidacao.length > 0) {
    console.error('\n Build abortado — data.json inválido (nada foi escrito):');
    errosValidacao.forEach(e => console.error('   - ' + e));
    process.exit(1);
  }

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

  if (cursosPosSemRegistro.size > 0) {
    console.log(`\n   ATENÇÃO: ${cursosPosSemRegistro.size} nome(s) de curso da pós fora de PROGRAMAS_POS.`);
    console.log('   Enquanto não entrarem em scripts/programas-pos.js, o mesmo programa');
    console.log('   aparece duas vezes no filtro e no gráfico:');
    [...cursosPosSemRegistro].sort().forEach(c => console.log(`     - ${c}`));
  }

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

  for (const { fileName, filePath } of dedupedXlsFiles) {
    const rawName = path.basename(fileName, path.extname(fileName));
    const campusCode = normalizeCampusCode(rawName.split('-')[0]);
    try {
      const workbook = XLSX.readFile(filePath);
      for (const sheetName of workbook.SheetNames) {
        const key = SHEET_MAP_DETALHADO[sheetName.trim().toLowerCase()] || SHEET_MAP_DETALHADO[sheetName.trim()];
        if (!key) continue;

        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { raw: false, defval: null });
        const tagged = rows.flatMap(r => {
          // Extract all Servidor name+ID pairs from VinculoQueryset string
          // Format: <Vinculo: Nome Completo (ID) (Servidor)>
          const todos = extrairVinculos(r["Servidor"]);
          // O mapa de nomes registra todo mundo, inclusive quem o filtro de
          // autoria descarta: o vínculo com a produção cai, a identidade não.
          for (const v of todos) {
            if (v.nome && !servidorIdToName[v.id]) {
              servidorIdToName[v.id] = v.nome;
              servidorNameToId[normalizeName(v.nome)] = v.id;
            }
          }
          const rawTitle = r["Publicação"] || r["Título"] || r["Nome"] || "";
          // Sem nenhum vínculo legível, o valor cru segue adiante como antes.
          // Com vínculos, o filtro manda: lista vazia significa linha descartada.
          const srvIds = todos.length
            ? filtrarPorAutoria(todos, rawTitle, key).map(v => v.id)
            : [r["Servidor"] || null];
          const dedupKey = rawTitle
            ? rawTitle.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/gi, "").substring(0, 150)
            : "";
          const base = {
            Ano: r["Ano"],
            Tipo: normalizeTipo(r["Tipo"]),
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
  preservarInovacao,
  pseudonymize,
  shortHash,
  loadOrCreateSalt,
  SALT_FILE,
  SALT_BACKUP_FILE,
  getSourceKey,
  registerSourceFile,
  splitCsvRecords,
  normalizeCampusCode,
  normalizePolo,
  CAMPUS_CODE_FIX,
  isPostGraduationCsv,
  isDgpGroupsCsv,
  selectDgpGroupsCsvFiles,
  selectPosGraduacaoCsvFiles,
  SHEET_MAP,
  SHEET_MAP_DETALHADO,
  SOURCE_LABELS,
  extrairVinculos,
  nomeNaCitacao,
  filtrarPorAutoria,
  CHAVES_COM_AUTORIA
};
