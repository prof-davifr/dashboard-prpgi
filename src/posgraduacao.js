// posgraduacao.js — aba Pós-Graduação do painel principal.
//
// Indicadores gerais: alunos e cursos por campus, por curso e por situação.
// Um registro do array `posgraduacao` é um aluno; não há repetição de matrícula,
// então contar linhas é contar alunos.
//
// A metodologia de ciclos da Plataforma Nilo Peçanha (ciclo encerrado, CCiclo,
// EvCiclo, RCiclo, IEA) viveu aqui até 02/09/2026. Ela não foi descartada: está
// congelada em src/pos-validacao.js e serve a página Pós-Graduação Validação.
// Ver CLAUDE.md, seção "Second page: Pós-Graduação Validação".

function getPosGraduacaoCategoryColor(category) {
  const colors = {
    "Mestrado": "#4D90FE",
    "Doutorado": "#F44336",
    "Especialização": "#4CAF50",
    "Especializao": "#4CAF50", // alias p/ dados antigos (pré-normalização)
    "Outro": "#FFC107"
  };
  return colors[category] || "#607D8B";
}

const POSGRAD_CATEGORIAS = ["Mestrado", "Doutorado", "Especialização"];

// O SUAP registra 16 situações distintas. Elas viram cinco baldes.
//
// "Aperfeiçoado" fica sozinho de propósito: o aluno cumpriu os créditos mas não
// obteve o título de especialista. Somá-lo a Concluinte inflaria a conclusão;
// somá-lo a Evadido misturaria quem terminou o curso com quem abandonou.
const POSGRAD_SITUACAO_BUCKET = {
  'Matriculado': 'Matriculado',
  'Concluído': 'Concluinte',
  'Formado': 'Concluinte',
  'Aperfeiçoado': 'Aperfeiçoado',
  'Cancelado': 'Evadido',
  'Evasão': 'Evadido',
  'Desligado': 'Evadido',
  'Abandono': 'Evadido',
  'Falecido': 'Evadido',
  'Cancelamento Compulsório': 'Evadido'
};

// O resto cai em "Outros": Em Migração, Não concluído, Transferido Interno,
// Trancado, Trancado Voluntariamente, Matrícula Vínculo Institucional,
// Aguardando Colação de Grau.
const POSGRAD_BUCKETS = ['Matriculado', 'Concluinte', 'Aperfeiçoado', 'Evadido', 'Outros'];

const POSGRAD_BUCKET_COLOR = {
  'Matriculado': '#4D90FE',
  'Concluinte': '#4CAF50',
  'Aperfeiçoado': '#00BCD4',
  'Evadido': '#F44336',
  'Outros': '#9E9E9E'
};

function normalizePosGraduacaoStatus(status) {
  return (status || "").trim() || "Não informado";
}

function getPosGraduacaoBucket(situacao) {
  return POSGRAD_SITUACAO_BUCKET[normalizePosGraduacaoStatus(situacao)] || 'Outros';
}

function truncateText(text, maxLength = 40) {
  if (!text) return "Não informado";
  return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
}

// ─── Nomes de curso ──────────────────────────────────────────────────────────
//
// Os nomes do SUAP têm 79 caracteres na mediana e chegam a 121. Cortá-los no
// meio não resolve: oito programas de "Docência para a Educação Profissional e
// Tecnológica" ficavam idênticos depois do corte, um por campus.
//
// A saída é tirar o que se repete em todos e não informa nada:
//   - o código de matrícula no começo ("EDEPTILH - ", "PGMP - ");
//   - o nível do curso ("MESTRADO PROFISSIONAL EM", "Curso de Pós-Graduação
//     Lato Sensu em"), que a coluna `categoria` já diz;
//   - o CAIXA ALTA, que muitos trazem da exportação.
// Isso leva a mediana a 51 caracteres. O nome original continua no `title` e no
// tooltip do gráfico.

const CURSO_PREFIXO_CODIGO = /^[A-Z0-9]{2,12}\s*[-–]\s*/;

// A vírgula e o hífen com espaços aparecem de verdade na base:
// "Curso de Especialização, Lato Sensu, em Linguagem…" e
// "Curso de PÓS - Graduação LATO Sensu em Gestão…".
const CURSO_PREFIXO_NIVEL = new RegExp(
  '^(curso\\s+de\\s+)?' +
  '(p[óo]s\\s*[-–]?\\s*gradua[çc][ãa]o\\s*,?\\s*)?' +
  '(lato\\s+sensu\\s*,?\\s*)?' +
  '(em\\s+)?' +
  '(mestrado\\s+(profissional|acad[êe]mico)?|doutorado|especializa[çc][ãa]o|aperfei[çc]oamento)?\\s*,?\\s*' +
  '(lato\\s+sensu\\s*,?\\s*)?' +
  '(em|na|no|de)?\\s+',
  'i'
);

// Preposições e artigos ficam em minúscula no meio do título.
const CURSO_PALAVRAS_PEQUENAS = new Set([
  'e', 'em', 'na', 'no', 'de', 'da', 'do', 'das', 'dos', 'a', 'o', 'as', 'os',
  'para', 'com', 'à', 'às', 'ao', 'aos', 'sua', 'suas', 'seu', 'seus'
]);

// Título com sigla preservada: EAD, WEB e os códigos de campus continuam em
// caixa alta, porque ali a caixa é o nome.
function tituloSuave(texto) {
  return texto.split(/(\s+)/).map(t => {
    if (!t.trim()) return t;
    const minuscula = t.toLowerCase();
    if (CURSO_PALAVRAS_PEQUENAS.has(minuscula)) return minuscula;
    if (t.length <= 4 && t === t.toUpperCase() && /[A-ZÀ-Ú]/.test(t)) return t;
    return minuscula.charAt(0).toUpperCase() + minuscula.slice(1);
  }).join('');
}

function nomeCursoCurto(curso) {
  let s = (curso || '').replace(/\s+/g, ' ').trim();
  if (!s) return '';

  s = s.replace(CURSO_PREFIXO_CODIGO, '');

  // Só tira o nível se sobrar nome de verdade — "Doutorado" sozinho vira nada.
  const semNivel = s.replace(CURSO_PREFIXO_NIVEL, '');
  if (semNivel.length >= 8) s = semNivel;

  const letras = s.replace(/[^A-Za-zÀ-ú]/g, '');
  const maiusculas = (letras.match(/[A-ZÀ-Ú]/g) || []).length;
  if (letras.length > 0 && maiusculas / letras.length > 0.7) s = tituloSuave(s);

  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Quando dois programas encurtam para o mesmo nome, o campus os separa. Sem
// isto o filtro mostraria oito opções iguais, e escolher qualquer uma pareceria
// erro do painel.
function construirRotulosCurso(data) {
  const campiPorCurso = {};
  data.forEach(r => {
    const curso = (r.curso || '').trim();
    if (!curso) return;
    if (!campiPorCurso[curso]) campiPorCurso[curso] = new Set();
    if (r.campus) campiPorCurso[curso].add(r.campus);
  });

  const quantosUsam = {};
  Object.keys(campiPorCurso).forEach(curso => {
    const curto = nomeCursoCurto(curso);
    quantosUsam[curto] = (quantosUsam[curto] || 0) + 1;
  });

  const rotulos = {};
  Object.keys(campiPorCurso).forEach(curso => {
    const curto = nomeCursoCurto(curso);
    if (quantosUsam[curto] === 1) {
      rotulos[curso] = curto;
      return;
    }
    const campi = [...campiPorCurso[curso]].sort();
    const lista = campi.length > 3 ? `${campi.slice(0, 3).join(', ')}…` : campi.join(', ');
    rotulos[curso] = lista ? `${curto} · ${lista}` : curto;
  });

  return rotulos;
}

// Chart.js aceita um array de strings por rótulo e desenha uma linha por item.
// Quebrar por palavra mantém o nome legível onde truncar o apagava.
function quebrarRotulo(texto, largura = 38, maxLinhas = 2) {
  const palavras = (texto || '').split(' ');
  const linhas = [];
  let atual = '';

  palavras.forEach(p => {
    if (!atual) { atual = p; return; }
    if ((atual + ' ' + p).length <= largura) { atual += ' ' + p; return; }
    linhas.push(atual);
    atual = p;
  });
  if (atual) linhas.push(atual);

  if (linhas.length <= maxLinhas) return linhas;

  // Sobrou texto: a última linha mantida precisa dizer isso. Sem a marca,
  // "…Transferencia de Tecnologia para" parecia o nome inteiro, e a palavra
  // "Inovação" sumia sem deixar rastro.
  const cortadas = linhas.slice(0, maxLinhas);
  const ultima = cortadas[maxLinhas - 1];
  cortadas[maxLinhas - 1] = (ultima.length > largura - 1 ? ultima.slice(0, largura - 1) : ultima) + '…';
  return cortadas;
}

function contarPor(data, chave) {
  const mapa = {};
  data.forEach(r => {
    const k = chave(r);
    if (!k) return;
    mapa[k] = (mapa[k] || 0) + 1;
  });
  return mapa;
}

// Cursos distintos por campus. O mesmo programa em dois campi conta uma vez em
// cada, porque cada campus tem a própria oferta.
function cursosPorCampus(data) {
  const mapa = {};
  data.forEach(r => {
    if (!r.campus) return;
    const curso = (r.curso || '').trim();
    if (!curso) return;
    if (!mapa[r.campus]) mapa[r.campus] = new Set();
    mapa[r.campus].add(curso);
  });
  const saida = {};
  Object.entries(mapa).forEach(([campus, cursos]) => { saida[campus] = cursos.size; });
  return saida;
}

function populateCourseSelector(data = STATE.raw.posgraduacao) {
  const select = $('posgrad-curso-filter');
  if (!select) return;

  const atual = select.value;
  const rotulos = construirRotulosCurso(data);
  const cursos = Object.keys(rotulos)
    .sort((a, b) => rotulos[a].localeCompare(rotulos[b], 'pt-BR'));

  // O `value` é o nome original, que é o que o filtro compara com r.curso; o
  // texto é o nome curto, e o `title` traz o original por extenso.
  select.innerHTML = '<option value="all">Todos os Programas</option>' +
    cursos.map(c => `<option value="${escaparHtml(c)}" title="${escaparHtml(c)}">${escaparHtml(rotulos[c])}</option>`).join('');

  if (atual && cursos.includes(atual)) select.value = atual;
  select.title = select.value === 'all' ? 'Filtra por programa específico.' : select.value;
}

// Os nomes vêm do SUAP e chegam com aspas e “&”. Sem escapar, um nome quebraria
// o atributo value e o filtro pararia de casar com r.curso.
function escaparHtml(texto) {
  return (texto || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── KPIs ────────────────────────────────────────────────────────────────────

function buildPosGraduacaoKpi(label, value, tooltip) {
  return `<div class="kpi-card" title="${tooltip}">
    <div class="kpi-label">${label}</div>
    <div class="kpi-value">${value.toLocaleString('pt-BR')}</div>
  </div>`;
}

// Os seis indicadores da faixa de KPIs, numa função pura. A aba "Resumo" do
// Excel lê daqui também: se cada um contasse por conta própria, a planilha e a
// tela poderiam divergir sem ninguém perceber.
const POSGRAD_KPIS = [
  { chave: 'alunos', rotulo: 'Alunos', ajuda: 'Alunos de pós-graduação no recorte atual. Um registro por aluno.' },
  { chave: 'matriculados', rotulo: 'Matriculados', ajuda: 'Alunos com vínculo ativo no SUAP.' },
  { chave: 'concluintes', rotulo: 'Concluintes', ajuda: 'Situação Concluído ou Formado no SUAP.' },
  { chave: 'evadidos', rotulo: 'Evadidos', ajuda: 'Cancelado, Evasão, Desligado, Abandono, Falecido ou Cancelamento Compulsório.' },
  { chave: 'cursos', rotulo: 'Cursos', ajuda: 'Programas distintos com aluno no recorte. O mesmo programa em dois campi conta uma vez.' },
  { chave: 'campi', rotulo: 'Campi', ajuda: 'Campi com pelo menos um aluno de pós-graduação no recorte.' }
];

function resumoPosGraduacao(data) {
  const registros = data || [];
  const baldes = contarPor(registros, r => getPosGraduacaoBucket(r.situacao));
  return {
    alunos: registros.length,
    matriculados: baldes['Matriculado'] || 0,
    concluintes: baldes['Concluinte'] || 0,
    evadidos: baldes['Evadido'] || 0,
    cursos: new Set(registros.map(r => (r.curso || '').trim()).filter(Boolean)).size,
    campi: new Set(registros.map(r => r.campus).filter(Boolean)).size
  };
}

function renderKPIsPosGraduacao() {
  const resumo = resumoPosGraduacao(STATE.filtered.posgraduacao);

  $('kpi-posgraduacao').innerHTML = POSGRAD_KPIS
    .map(k => buildPosGraduacaoKpi(k.rotulo, resumo[k.chave], k.ajuda))
    .join('\n    ');
}

// ─── Gráficos ────────────────────────────────────────────────────────────────

// Conta por chave e por categoria numa varredura só, e devolve as séries
// empilhadas que o Chart.js espera. Serve ao gráfico por campus e ao de
// ingressos por ano.
function seriesPorCategoria(data, chave, ordem) {
  const porChave = {};
  data.forEach(r => {
    const k = chave(r);
    if (k === null || k === undefined || k === '') return;
    if (!porChave[k]) porChave[k] = {};
    const cat = r.categoria || 'Outro';
    porChave[k][cat] = (porChave[k][cat] || 0) + 1;
  });

  const chaves = ordem(porChave);

  // As três categorias conhecidas vêm primeiro, na ordem declarada. Qualquer
  // outra que apareça nos dados entra depois, em vez de sumir da barra: o build
  // tem 'Outro' como reserva quando não reconhece a modalidade, e uma barra
  // curta sem aviso não bate com o KPI "Alunos".
  const presentes = new Set();
  Object.values(porChave).forEach(porCat => Object.keys(porCat).forEach(c => presentes.add(c)));
  const extras = [...presentes].filter(c => !POSGRAD_CATEGORIAS.includes(c)).sort();
  const categorias = [...POSGRAD_CATEGORIAS, ...extras];

  const datasets = categorias.map(cat => ({
    label: cat,
    data: chaves.map(k => porChave[k][cat] || 0),
    backgroundColor: getPosGraduacaoCategoryColor(cat)
  }));

  return { chaves, datasets };
}

function totalDaChave(porChave, k) {
  return Object.values(porChave[k]).reduce((s, n) => s + n, 0);
}

// Alunos por campus, barras horizontais empilhadas por categoria.
function renderPosGraduacaoPorCampus(data) {
  const { chaves: campi, datasets } = seriesPorCategoria(
    data,
    r => r.campus,
    porChave => Object.keys(porChave).sort((a, b) => totalDaChave(porChave, b) - totalDaChave(porChave, a))
  );

  createChart('chart-posgraduacao-campus', 'bar', {
    labels: campi.map(c => `${CAMPUS_TO_CITY[c] || c} (${c})`),
    datasets
  }, {
    indexAxis: 'y',
    // autoSkip desligado: com 20 campi e a altura padrão, o Chart.js escondia
    // um rótulo sim, outro não, e metade das barras ficava sem nome.
    scales: {
      x: { stacked: true, beginAtZero: true },
      y: { stacked: true, ticks: { autoSkip: false } }
    }
  });
}

// Cursos distintos por campus.
//
// Barras verticais, rotuladas só com a sigla: são 20 campi num cartão de meia
// largura, e o nome da cidade na horizontal não caberia. A cidade aparece no
// tooltip.
function renderPosGraduacaoCursosPorCampus(data) {
  const contagem = cursosPorCampus(data);
  const campi = Object.keys(contagem).sort((a, b) => contagem[b] - contagem[a]);

  createChart('chart-posgraduacao-cursos-campus', 'bar', {
    labels: campi,
    datasets: [{
      label: 'Cursos',
      data: campi.map(c => contagem[c]),
      backgroundColor: '#9C27B0'
    }]
  }, {
    scales: {
      x: { ticks: { autoSkip: false } },
      y: { beginAtZero: true, ticks: { precision: 0 } }
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          title: itens => `${CAMPUS_TO_CITY[campi[itens[0].dataIndex]] || ''} (${campi[itens[0].dataIndex]})`
        }
      }
    }
  });
}

// Situação, nos cinco baldes. A ordem é fixa para que a cor não dance entre
// recortes; baldes vazios saem da pizza.
function renderPosGraduacaoSituacao(data) {
  const baldes = contarPor(data, r => getPosGraduacaoBucket(r.situacao));
  const presentes = POSGRAD_BUCKETS.filter(b => baldes[b]);

  createChart('chart-posgraduacao-situacao', 'pie', {
    labels: presentes,
    datasets: [{
      data: presentes.map(b => baldes[b]),
      backgroundColor: presentes.map(b => POSGRAD_BUCKET_COLOR[b])
    }]
  });
}

// ─── Alunos por programa ─────────────────────────────────────────────────────
//
// Neste gráfico o nome do programa é a informação; a barra é só a escala. Por
// isso o eixo fica com quase metade da largura, e o rótulo tem mais espaço que
// nos outros gráficos da aba.
const PROGRAMA_TOP_N = 15;
const PROGRAMA_MAX_LINHAS = 2;

// Quase metade da largura vai para o eixo, com um piso para o celular e um teto
// para a tela grande — passando disso a barra some e o gráfico deixa de comparar.
function larguraDoEixoPrograma(larguraGrafico) {
  return Math.min(440, Math.max(150, Math.round((larguraGrafico || 800) * 0.45)));
}

// Quantos caracteres cabem na largura reservada. Sem amarrar os dois, o rótulo
// quebrado em 52 caracteres transbordava o eixo de 150 px do celular e saía
// cortado pela borda esquerda do cartão.
function caracteresDoRotuloPrograma(larguraEixo) {
  return Math.max(20, Math.floor(larguraEixo / 6.2));
}

// Modalidades de cada programa. Quase sempre é uma só; o Set cobre o caso de um
// mesmo nome de curso aparecer com modalidades diferentes entre campi.
function categoriasPorCurso(data) {
  const mapa = {};
  (data || []).forEach(r => {
    const curso = (r.curso || '').trim();
    if (!curso) return;
    if (!mapa[curso]) mapa[curso] = new Set();
    if (r.categoria) mapa[curso].add(r.categoria);
  });
  return mapa;
}

// A modalidade entra numa linha própria do rótulo, além da cor da barra. A cor
// sozinha não basta: impressa em preto e branco, ou para quem não distingue as
// cores, o gráfico deixaria de dizer se o programa é mestrado ou especialização.
function rotuloDePrograma(curso, rotulos, categorias, largura) {
  const linhas = quebrarRotulo(rotulos[curso] || curso, largura, PROGRAMA_MAX_LINHAS);
  const cats = [...(categorias[curso] || [])].sort();
  return cats.length > 0 ? [...linhas, `(${cats.join(' / ')})`] : linhas;
}

// Os 15 programas com mais alunos, empilhados por modalidade.
function renderPosGraduacaoAlunosPorPrograma(data) {
  const { chaves: cursos, datasets } = seriesPorCategoria(
    data,
    r => (r.curso || '').trim(),
    porChave => Object.keys(porChave)
      .sort((a, b) => totalDaChave(porChave, b) - totalDaChave(porChave, a))
      .slice(0, PROGRAMA_TOP_N)
  );

  const rotulos = construirRotulosCurso(data);
  const categorias = categoriasPorCurso(data);

  const canvas = $('chart-posgraduacao-programas');
  const larguraCartao = (canvas && canvas.parentElement && canvas.parentElement.clientWidth) || 800;
  const larguraEixo = larguraDoEixoPrograma(larguraCartao);
  const caracteres = caracteresDoRotuloPrograma(larguraEixo);

  createChart('chart-posgraduacao-programas', 'bar', {
    labels: cursos.map(c => rotuloDePrograma(c, rotulos, categorias, caracteres)),
    datasets
  }, {
    indexAxis: 'y',
    scales: {
      x: { stacked: true, beginAtZero: true },
      y: {
        stacked: true,
        ticks: { autoSkip: false },
        // Sem reservar a largura, o Chart.js dá ao eixo o mínimo e sobra pouco
        // para o nome. Aqui é o contrário: o eixo primeiro, a barra no resto.
        afterFit: escala => { escala.width = larguraEixo; }
      }
    },
    plugins: {
      tooltip: {
        callbacks: {
          // O eixo mostra o nome curto; o tooltip mostra o nome do SUAP por
          // extenso, que é o que o usuário reconhece.
          title: itens => cursos[itens[0].dataIndex]
        }
      }
    }
  });
}

// Ingressos por ano de entrada, empilhados por categoria.
function renderPosGraduacaoEvolucao(data) {
  const { chaves: anos, datasets } = seriesPorCategoria(
    data,
    r => { const a = parseInt(r.ano, 10); return Number.isNaN(a) ? '' : a; },
    porChave => Object.keys(porChave).sort((a, b) => Number(a) - Number(b))
  );

  createChart('chart-posgraduacao-evolucao', 'bar', {
    labels: anos.map(String),
    datasets
  }, {
    scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } }
  });
}

// ─── Tabela ──────────────────────────────────────────────────────────────────

// Campus × ano de ingresso. Segue renderTableIC (src/tables.js), não
// generateCampusYearTable: aquela lê r["Ano"] com maiúscula, e a pós-graduação
// grava r.ano em minúscula.
// A agregação, sem HTML: a tabela da tela e a aba "Campus x Ano" do Excel saem
// das mesmas contagens.
function matrizCampusAno(data) {
  const porCampusAno = {};
  const anos = new Set();
  const campi = new Set();

  (data || []).forEach(r => {
    const ano = r.ano;
    const campus = r.campus;
    if (!ano || !campus) return;
    anos.add(ano);
    campi.add(campus);
    if (!porCampusAno[campus]) porCampusAno[campus] = {};
    porCampusAno[campus][ano] = (porCampusAno[campus][ano] || 0) + 1;
  });

  return {
    porCampusAno,
    anos: Array.from(anos).sort(),
    campi: Array.from(campi).sort()
  };
}

function renderTablePosGraduacao() {
  const container = $('table-posgraduacao-content');
  if (!container) return;

  const { porCampusAno, anos: anosOrdenados, campi: campiOrdenados } =
    matrizCampusAno(STATE.filtered.posgraduacao);

  let html = '<table class="data-table"><caption>Alunos de pós-graduação por campus e ano de ingresso</caption><thead><tr><th scope="col">Campus</th>';
  anosOrdenados.forEach(a => { html += `<th scope="col">${a}</th>`; });
  html += '<th scope="col">Total</th></tr></thead><tbody>';

  campiOrdenados.forEach(campus => {
    const nome = CAMPUS_TO_CITY[campus] || campus;
    html += `<tr><th scope="row">${nome} (${campus})</th>`;
    let total = 0;
    anosOrdenados.forEach(ano => {
      const n = porCampusAno[campus]?.[ano] || 0;
      total += n;
      html += `<td>${n}</td>`;
    });
    html += `<td><strong>${total}</strong></td></tr>`;
  });

  html += '</tbody></table>';
  container.innerHTML = html;
}

// ─── Entrada única ───────────────────────────────────────────────────────────

function renderChartsPosGraduacao() {
  const data = STATE.filtered.posgraduacao;

  populateCourseSelector();
  renderKPIsPosGraduacao();
  renderPosGraduacaoPorCampus(data);
  renderPosGraduacaoCursosPorCampus(data);
  renderPosGraduacaoSituacao(data);
  renderPosGraduacaoAlunosPorPrograma(data);
  renderPosGraduacaoEvolucao(data);
  renderGenericMap(data, 'map-posgraduacao', '#4D90FE', 'alunos');
  renderTablePosGraduacao();
}

// ─── Exportação ──────────────────────────────────────────────────────────────
//
// Nove abas: a capa com os filtros, sete tabelas de indicador — as mesmas
// contas dos KPIs, dos cinco gráficos e da tabela da tela — e os dados por
// aluno. Cada função é pura e devolve { nome, aoa }; quem escreve o arquivo é
// baixarPastaExcel, em src/export.js.
//
// LGPD: `dedupKey` fica de fora de propósito. É um pseudônimo salgado, não diz
// nada ao usuário, e um registro já é um aluno — não há o que desduplicar.

// Rótulos dos filtros locais da aba, para a capa.
function filtrosLocaisPosGraduacao() {
  const texto = (id, padrao) => {
    const select = $(id);
    if (!select) return padrao;
    const opcao = select.options && select.options[select.selectedIndex];
    return (opcao && opcao.textContent ? opcao.textContent : select.value || padrao).trim();
  };

  return [
    ['Programa', texto('posgrad-curso-filter', 'Todos os Programas')],
    ['Categoria', texto('posgrad-categoria-filter', 'Todas as Categorias')],
    ['Situação', texto('posgrad-situacao-filter', 'Todas as Situações')]
  ];
}

function abaFiltrosPosGraduacao(data, filtrosGlobais, filtrosLocais) {
  const linhas = [
    ['Exportado em', formatDateTimePtBr(new Date().toISOString())],
    ['Dados atualizados em', dataDosDados()],
    [null],
    ['FILTROS APLICADOS', ''],
    ...(filtrosGlobais || []),
    ...(filtrosLocais || []),
    [null],
    ['Alunos no recorte', (data || []).length],
    [null],
    ['Conteúdo do arquivo', 'Resumo, Alunos por Campus, Cursos por Campus, Situação, ' +
      'Programas, Ingressos por Ano, Campus x Ano e Dados (uma linha por aluno).'],
    ['Como ler', 'Um registro é um aluno e o ano é o de ingresso. ' +
      'As 16 situações do SUAP entram em cinco grupos; a aba Situação mostra as duas visões.'],
    ['Proteção de dados', 'O arquivo não traz nome, matrícula nem e-mail. ' +
      'A base pública data.json também não os contém.'],
    ['Fonte', 'SUAP — Pós-Graduação (IFBA). Painel PRPGI.']
  ];

  return abaDeCapa('Filtros', 'Pós-Graduação — Relatório do painel PRPGI', linhas);
}

function abaResumoPosGraduacao(data) {
  const resumo = resumoPosGraduacao(data);
  return abaDeObjetos(
    'Resumo',
    [
      { titulo: 'Indicador', valor: k => k.rotulo },
      { titulo: 'Valor', valor: k => resumo[k.chave] },
      { titulo: 'Definição', valor: k => k.ajuda }
    ],
    POSGRAD_KPIS
  );
}

// Alunos por campus × categoria, as mesmas séries do gráfico empilhado.
function abaAlunosPorCampus(data) {
  const { chaves: campi, datasets } = seriesPorCategoria(
    data || [],
    r => r.campus,
    porChave => Object.keys(porChave).sort()
  );

  const aoa = [['Campus', 'Cidade', ...datasets.map(d => d.label), 'Total']];
  campi.forEach((campus, i) => {
    const valores = datasets.map(d => d.data[i]);
    aoa.push([
      campus,
      CAMPUS_TO_CITY[campus] || campus,
      ...valores,
      valores.reduce((s, n) => s + n, 0)
    ]);
  });

  return { nome: 'Alunos por Campus', aoa };
}

function abaCursosPorCampus(data) {
  const contagem = cursosPorCampus(data || []);
  const campi = Object.keys(contagem).sort();

  return abaDeObjetos(
    'Cursos por Campus',
    [
      { titulo: 'Campus', valor: c => c },
      { titulo: 'Cidade', valor: c => CAMPUS_TO_CITY[c] || c },
      { titulo: 'Cursos distintos', valor: c => contagem[c] }
    ],
    campi
  );
}

// Duas visões numa aba só: o grupo, que é o que a tela mostra, e a situação
// bruta do SUAP que o alimenta. Assim a regra de agrupamento fica auditável —
// é o ponto sensível desta aba.
function abaSituacao(data) {
  const registros = data || [];
  const total = registros.length;
  const pct = n => (total > 0 ? Number(((n / total) * 100).toFixed(1)) : 0);

  const porBalde = contarPor(registros, r => getPosGraduacaoBucket(r.situacao));
  const porSituacao = contarPor(registros, r => normalizePosGraduacaoStatus(r.situacao));

  const aoa = [['Grupo', 'Alunos', '% do total']];
  POSGRAD_BUCKETS.forEach(b => aoa.push([b, porBalde[b] || 0, pct(porBalde[b] || 0)]));
  aoa.push(['Total', total, total > 0 ? 100 : 0]);

  aoa.push([]);
  aoa.push(['Situação no SUAP', 'Grupo', 'Alunos', '% do total']);
  Object.keys(porSituacao)
    .sort((a, b) => porSituacao[b] - porSituacao[a] || a.localeCompare(b, 'pt-BR'))
    .forEach(s => aoa.push([s, getPosGraduacaoBucket(s), porSituacao[s], pct(porSituacao[s])]));

  return { nome: 'Situacao', aoa };
}

// Todos os programas, não só os quinze do gráfico.
function abaProgramas(data) {
  const registros = data || [];
  const rotulos = construirRotulosCurso(registros);
  const totais = contarPor(registros, r => (r.curso || '').trim());

  const campiPorCurso = {};
  const categoriasPorCurso = {};
  registros.forEach(r => {
    const curso = (r.curso || '').trim();
    if (!curso) return;
    if (!campiPorCurso[curso]) campiPorCurso[curso] = new Set();
    if (r.campus) campiPorCurso[curso].add(r.campus);
    if (!categoriasPorCurso[curso]) categoriasPorCurso[curso] = new Set();
    if (r.categoria) categoriasPorCurso[curso].add(r.categoria);
  });

  const cursos = Object.keys(totais)
    .sort((a, b) => totais[b] - totais[a] || a.localeCompare(b, 'pt-BR'));

  return abaDeObjetos(
    'Programas',
    [
      { titulo: 'Programa', valor: c => rotulos[c] || nomeCursoCurto(c) },
      { titulo: 'Nome no SUAP', valor: c => c },
      { titulo: 'Categoria', valor: c => [...(categoriasPorCurso[c] || [])].sort().join(', ') },
      { titulo: 'Campi', valor: c => [...(campiPorCurso[c] || [])].sort().join(', ') },
      { titulo: 'Alunos', valor: c => totais[c] }
    ],
    cursos
  );
}

function abaIngressosPorAno(data) {
  const { chaves: anos, datasets } = seriesPorCategoria(
    data || [],
    r => { const a = parseInt(r.ano, 10); return Number.isNaN(a) ? '' : a; },
    porChave => Object.keys(porChave).sort((a, b) => Number(a) - Number(b))
  );

  const aoa = [['Ano de ingresso', ...datasets.map(d => d.label), 'Total']];
  anos.forEach((ano, i) => {
    const valores = datasets.map(d => d.data[i]);
    aoa.push([Number(ano), ...valores, valores.reduce((s, n) => s + n, 0)]);
  });

  return { nome: 'Ingressos por Ano', aoa };
}

function abaCampusAno(data) {
  const { porCampusAno, anos, campi } = matrizCampusAno(data || []);

  const aoa = [['Campus', 'Cidade', ...anos.map(Number), 'Total']];
  campi.forEach(campus => {
    const valores = anos.map(ano => porCampusAno[campus][ano] || 0);
    aoa.push([
      campus,
      CAMPUS_TO_CITY[campus] || campus,
      ...valores,
      valores.reduce((s, n) => s + n, 0)
    ]);
  });

  return { nome: 'Campus x Ano', aoa };
}

// Uma linha por aluno, com os cinco campos que a tela nunca mostra:
// curso_original, polo, semestre, ano_periodo e modalidade.
function abaDadosPosGraduacao(data) {
  return abaDeObjetos(
    'Dados',
    [
      { titulo: 'Campus', valor: r => r.campus || '' },
      { titulo: 'Cidade', valor: r => CAMPUS_TO_CITY[r.campus] || '' },
      { titulo: 'Programa', valor: r => nomeCursoCurto(r.curso) },
      { titulo: 'Nome no SUAP', valor: r => r.curso || '' },
      { titulo: 'Nome completo na origem', valor: r => r.curso_original || '' },
      { titulo: 'Polo', valor: r => r.polo || '' },
      { titulo: 'Categoria', valor: r => r.categoria || '' },
      { titulo: 'Modalidade', valor: r => r.modalidade || '' },
      { titulo: 'Situação no SUAP', valor: r => normalizePosGraduacaoStatus(r.situacao) },
      { titulo: 'Grupo de situação', valor: r => getPosGraduacaoBucket(r.situacao) },
      { titulo: 'Ano de ingresso', valor: r => r.ano },
      { titulo: 'Semestre', valor: r => r.semestre },
      { titulo: 'Ano/Período', valor: r => r.ano_periodo || '' }
    ],
    data || []
  );
}

// Monta a pasta de trabalho inteira. Separada de exportarPosGraduacao para o
// teste conferir as nove abas sem tocar no XLSX.
function abasPosGraduacao(data, filtrosGlobais, filtrosLocais) {
  return [
    abaFiltrosPosGraduacao(data, filtrosGlobais, filtrosLocais),
    abaResumoPosGraduacao(data),
    abaAlunosPorCampus(data),
    abaCursosPorCampus(data),
    abaSituacao(data),
    abaProgramas(data),
    abaIngressosPorAno(data),
    abaCampusAno(data),
    abaDadosPosGraduacao(data)
  ];
}

function exportarPosGraduacao() {
  const data = (STATE.filtered && STATE.filtered.posgraduacao) || [];
  if (data.length === 0) {
    showToast('Nenhum aluno no recorte atual. Ajuste os filtros e exporte de novo.');
    return;
  }
  baixarPastaExcel('PosGraduacao_IFBA', abasPosGraduacao(
    data,
    resumoDosFiltrosGlobais(),
    filtrosLocaisPosGraduacao()
  ));
}
