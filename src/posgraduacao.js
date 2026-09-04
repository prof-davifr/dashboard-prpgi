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

function renderKPIsPosGraduacao() {
  const data = STATE.filtered.posgraduacao;
  const baldes = contarPor(data, r => getPosGraduacaoBucket(r.situacao));
  const cursos = new Set(data.map(r => (r.curso || '').trim()).filter(Boolean)).size;
  const campi = new Set(data.map(r => r.campus).filter(Boolean)).size;

  $('kpi-posgraduacao').innerHTML = `
    ${buildPosGraduacaoKpi('Alunos', data.length, 'Alunos de pós-graduação no recorte atual. Um registro por aluno.')}
    ${buildPosGraduacaoKpi('Matriculados', baldes['Matriculado'] || 0, 'Alunos com vínculo ativo no SUAP.')}
    ${buildPosGraduacaoKpi('Concluintes', baldes['Concluinte'] || 0, 'Situação Concluído ou Formado no SUAP.')}
    ${buildPosGraduacaoKpi('Evadidos', baldes['Evadido'] || 0, 'Cancelado, Evasão, Desligado, Abandono, Falecido ou Cancelamento Compulsório.')}
    ${buildPosGraduacaoKpi('Cursos', cursos, 'Programas distintos com aluno no recorte. O mesmo programa em dois campi conta uma vez.')}
    ${buildPosGraduacaoKpi('Campi', campi, 'Campi com pelo menos um aluno de pós-graduação no recorte.')}
  `;
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

// Os 15 cursos com mais alunos.
function renderPosGraduacaoTopCursos(data) {
  const totais = contarPor(data, r => (r.curso || '').trim());
  const top = Object.entries(totais).sort((a, b) => b[1] - a[1]).slice(0, 15);
  const rotulos = construirRotulosCurso(data);

  createChart('chart-posgraduacao-topcursos', 'bar', {
    labels: top.map(([curso]) => quebrarRotulo(rotulos[curso] || curso)),
    datasets: [{
      label: 'Alunos',
      data: top.map(([, n]) => n),
      backgroundColor: '#4D90FE'
    }]
  }, {
    indexAxis: 'y',
    scales: {
      x: { beginAtZero: true },
      y: { ticks: { autoSkip: false } }
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          // O eixo mostra o nome curto, em duas linhas; o tooltip mostra o nome
          // do SUAP por extenso, que é o que o usuário reconhece.
          title: itens => top[itens[0].dataIndex][0]
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
function renderTablePosGraduacao() {
  const container = $('table-posgraduacao-content');
  if (!container) return;

  const data = STATE.filtered.posgraduacao;
  const porCampusAno = {};
  const anos = new Set();
  const campi = new Set();

  data.forEach(r => {
    const ano = r.ano;
    const campus = r.campus;
    if (!ano || !campus) return;
    anos.add(ano);
    campi.add(campus);
    if (!porCampusAno[campus]) porCampusAno[campus] = {};
    porCampusAno[campus][ano] = (porCampusAno[campus][ano] || 0) + 1;
  });

  const anosOrdenados = Array.from(anos).sort();
  const campiOrdenados = Array.from(campi).sort();

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
  renderPosGraduacaoTopCursos(data);
  renderPosGraduacaoEvolucao(data);
  renderGenericMap(data, 'map-posgraduacao', '#4D90FE', 'alunos');
  renderTablePosGraduacao();
}
