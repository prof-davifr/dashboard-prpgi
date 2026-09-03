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
  const cursos = [...new Set(data.map(r => (r.curso || '').trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'pt-BR'));

  select.innerHTML = '<option value="all">Todos os Programas</option>' +
    cursos.map(c => `<option value="${c}">${truncateText(c, 60)}</option>`).join('');

  if (atual && cursos.includes(atual)) select.value = atual;
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
    scales: { x: { stacked: true, beginAtZero: true }, y: { stacked: true } }
  });
}

// Cursos distintos por campus.
function renderPosGraduacaoCursosPorCampus(data) {
  const contagem = cursosPorCampus(data);
  const campi = Object.keys(contagem).sort((a, b) => contagem[b] - contagem[a]);

  createChart('chart-posgraduacao-cursos-campus', 'bar', {
    labels: campi.map(c => `${CAMPUS_TO_CITY[c] || c} (${c})`),
    datasets: [{
      label: 'Cursos',
      data: campi.map(c => contagem[c]),
      backgroundColor: '#9C27B0'
    }]
  }, {
    indexAxis: 'y',
    scales: { x: { beginAtZero: true, ticks: { precision: 0 } } }
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

  createChart('chart-posgraduacao-topcursos', 'bar', {
    labels: top.map(([curso]) => truncateText(curso, 45)),
    datasets: [{
      label: 'Alunos',
      data: top.map(([, n]) => n),
      backgroundColor: '#4D90FE'
    }]
  }, {
    indexAxis: 'y',
    scales: { x: { beginAtZero: true } },
    plugins: { legend: { display: false } }
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
