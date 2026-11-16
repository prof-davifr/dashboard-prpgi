// export.js — motor genérico de exportação para Excel.
//
// Separa duas coisas que antes viviam grudadas em exportTableToExcel: montar os
// dados e escrever o arquivo. Uma aba da pasta de trabalho é um objeto simples,
//
//     { nome: 'Resumo', aoa: [['Indicador', 'Valor'], ['Alunos', 4770]] }
//
// e quem monta o `aoa` é uma função pura, que o teste roda sem SheetJS e sem
// DOM. Só baixarPastaExcel toca no XLSX e no navegador.

// O Excel recusa nome de planilha com mais de 31 caracteres ou com : \ / ? * [ ].
// Nomes repetidos também quebram o arquivo, então o sufixo numérico entra aqui.
function sanearNomeDeAba(nome, usados) {
  let limpo = (nome || 'Planilha').replace(/[:\\/?*[\]]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!limpo) limpo = 'Planilha';
  limpo = limpo.slice(0, 31);

  if (!usados || !usados.has(limpo)) {
    if (usados) usados.add(limpo);
    return limpo;
  }

  let n = 2;
  let candidato;
  do {
    const sufixo = ` (${n})`;
    candidato = limpo.slice(0, 31 - sufixo.length) + sufixo;
    n += 1;
  } while (usados.has(candidato));

  usados.add(candidato);
  return candidato;
}

// Largura de cada coluna pelo conteúdo mais longo, entre 8 e 60 caracteres.
// Sem isto o Excel abre tudo com a largura padrão e os nomes de curso ficam
// cortados por "###".
function larguraDasColunas(aoa) {
  const larguras = [];
  aoa.forEach(linha => {
    linha.forEach((celula, i) => {
      const tamanho = String(celula === null || celula === undefined ? '' : celula).length;
      if (!larguras[i] || tamanho > larguras[i]) larguras[i] = tamanho;
    });
  });
  return larguras.map(w => ({ wch: Math.min(60, Math.max(8, (w || 8) + 2)) }));
}

// Base + carimbo de data e hora. Duas exportações com recortes diferentes
// geravam o mesmo nome, e a segunda sobrescrevia a primeira na pasta Downloads.
function nomeArquivoComCarimbo(base, agora = new Date()) {
  const p = n => String(n).padStart(2, '0');
  const carimbo = `${agora.getFullYear()}-${p(agora.getMonth() + 1)}-${p(agora.getDate())}` +
    `_${p(agora.getHours())}${p(agora.getMinutes())}`;
  return `${base}_${carimbo}`;
}

// Uma aba de pares rótulo/valor, para a capa do relatório.
function abaDeCapa(nome, titulo, linhas) {
  const aoa = [[titulo], []];
  linhas.forEach(([rotulo, valor]) => {
    if (rotulo === null) { aoa.push([]); return; }
    aoa.push([rotulo, valor === null || valor === undefined ? '' : valor]);
  });
  return { nome, aoa };
}

// Uma aba tabular a partir de uma lista de registros.
// colunas: [{ titulo, valor: registro => célula }]
function abaDeObjetos(nome, colunas, registros) {
  const aoa = [colunas.map(c => c.titulo)];
  registros.forEach(r => {
    aoa.push(colunas.map(c => {
      const v = c.valor(r);
      return v === null || v === undefined ? '' : v;
    }));
  });
  return { nome, aoa };
}

// Lê a barra de filtros do topo e devolve pares prontos para a capa. Vale para
// qualquer aba: o período e o campus são globais.
function resumoDosFiltrosGlobais() {
  const periodo = $('period-filter');
  const campus = $('campus-filter');

  const textoDaOpcao = select => {
    if (!select) return 'não disponível';
    const opcao = select.options && select.options[select.selectedIndex];
    return (opcao && opcao.textContent ? opcao.textContent : select.value || 'Todos').trim();
  };

  const codigoCampus = campus ? campus.value : 'all';
  const nomeCampus = (!codigoCampus || codigoCampus === 'all')
    ? 'Todos os campi'
    : `${CAMPUS_TO_CITY[codigoCampus] || codigoCampus} (${codigoCampus})`;

  return [
    ['Período', textoDaOpcao(periodo)],
    ['Campus', nomeCampus]
  ];
}

// Data de geração da base, para a capa. Fica fora de resumoDosFiltrosGlobais
// porque não é um filtro: sob o título "FILTROS APLICADOS" ela confundiria.
function dataDosDados() {
  const meta = typeof STATE !== 'undefined' ? STATE.meta : null;
  return meta && meta.generatedAt ? formatDateTimePtBr(meta.generatedAt) : 'não disponível';
}

// Converte uma <table> do DOM em matriz, para as abas que exportam o que já
// está na tela. Usa textContent, então o <strong> da coluna Total não vira lixo.
function matrizDeTabelaHtml(table) {
  return Array.from(table.rows).map(linha =>
    Array.from(linha.cells).map(celula => {
      const texto = (celula.textContent || '').trim();
      if (texto === '') return '';
      const numero = Number(texto.replace(/\./g, '').replace(',', '.'));
      return Number.isNaN(numero) ? texto : numero;
    })
  );
}

// Escreve a pasta de trabalho e dispara o download.
function baixarPastaExcel(nomeBase, abas) {
  const validas = (abas || []).filter(a => a && Array.isArray(a.aoa) && a.aoa.length > 0);
  if (validas.length === 0) {
    showToast('Não há dados para exportar no recorte atual.');
    return null;
  }

  const wb = XLSX.utils.book_new();
  const usados = new Set();
  validas.forEach(aba => {
    const ws = XLSX.utils.aoa_to_sheet(aba.aoa);
    ws['!cols'] = larguraDasColunas(aba.aoa);
    XLSX.utils.book_append_sheet(wb, ws, sanearNomeDeAba(aba.nome, usados));
  });

  const nomeArquivo = `${nomeArquivoComCarimbo(nomeBase)}.xlsx`;
  XLSX.writeFile(wb, nomeArquivo);
  showToast(`Arquivo ${nomeArquivo} exportado.`);
  return nomeArquivo;
}

// ─── Inovação: exportação para validação independente ────────────────────────
//
// A tabela campus × ano da tela não deixa ninguém conferir nada: não diz quais
// registros entraram na conta. Esta exportação dá uma linha por registro do
// INPI, com o número que qualquer pessoa pesquisa no pePI, e os poucos campos
// que decidem cada indicador da aba (tipo, ano, campus, ativo, nº de alunos).
// Nenhum nome, SIAPE ou pseudônimo sai daqui.

// Base do pePI em que cada tipo se pesquisa.
const BASE_PEPI_POR_TIPO = {
  'Patente': 'Patentes',
  'Software': 'Programas de Computador',
  'Desenho Industrial': 'Desenhos Industriais',
  'Marca': 'Marcas'
};

// Os registros chegam um por autor (fan-out de coautoria). Aqui voltam a ser um
// por número INPI, que é a unidade que o INPI conhece.
function registrosInovacaoPorNumero(registros) {
  const porNumero = new Map();
  (registros || []).forEach(r => {
    const numero = String(r.dedupKey || '');
    if (!numero) return;
    if (!porNumero.has(numero)) {
      porNumero.set(numero, {
        numero,
        tipo: r.Tipo || '',
        ano: r.Ano || '',
        campi: new Set(),
        inativo: false,
        alunos: new Set()
      });
    }
    const item = porNumero.get(numero);
    if (r.campus) item.campi.add(r.campus);
    if (r.Inativo) item.inativo = true;
    (r.Alunos || []).forEach(a => item.alunos.add(a));
  });
  return Array.from(porNumero.values()).sort((a, b) =>
    String(a.ano).localeCompare(String(b.ano)) || a.numero.localeCompare(b.numero));
}

function abasInovacao(registros, filtrosGlobais, dataDados, tabelaCampusAno) {
  const itens = registrosInovacaoPorNumero(registros);
  const ativos = itens.filter(i => !i.inativo).length;
  const alunos = new Set(itens.flatMap(i => Array.from(i.alunos))).size;

  const capa = abaDeCapa('Filtros', 'INOVAÇÃO — REGISTROS DO INPI (IFBA)', [
    ...filtrosGlobais,
    ['Dados gerados em', dataDados],
    [null],
    ['Registros no recorte', itens.length],
    ['Total de Registros Ativos (PI)', ativos],
    ['Alunos Inventores', alunos],
    [null],
    ['COMO VALIDAR', ''],
    ['Fonte', 'pePI — Busca de Propriedade Intelectual do INPI: https://busca.inpi.gov.br/pePI/'],
    ['Titular', 'CNPJ 10.764.307/0001-12 (IFBA) ou 13.941.232/0001-96 (CEFET-BA, nome anterior)'],
    ['Passo 1', 'Na aba "Registros", copie o "Número INPI".'],
    ['Passo 2', 'No pePI, abra a base da coluna "Base no pePI" e pesquise pelo número do pedido.'],
    ['Passo 3', 'Confira o titular, a data de depósito e os inventores na página de detalhe.'],
    [null],
    ['Observações', ''],
    ['Número INPI', 'Só os dígitos, sem o prefixo (BR, PI, MU) e sem pontuação.'],
    ['Campus', 'O INPI não informa campus. Ele vem do setor de propriedade intelectual da PRPGI e, na falta, do campus dos autores servidores.'],
    ['Ativo', '"Não" quando o setor de propriedade intelectual da PRPGI marcou o ativo como inativo (arquivado ou indeferido).'],
    ['Alunos inventores', 'Inventores do registro achados nas bases de alunos do SUAP, da pós-graduação, da IC e do DGP. O total da capa conta cada aluno uma vez, por isso é menor que a soma da coluna.']
  ]);

  const dados = abaDeObjetos('Registros', [
    { titulo: 'Número INPI', valor: i => i.numero },
    { titulo: 'Tipo', valor: i => i.tipo },
    { titulo: 'Base no pePI', valor: i => BASE_PEPI_POR_TIPO[i.tipo] || '' },
    { titulo: 'Ano de depósito', valor: i => (i.ano ? Number(i.ano) : '') },
    { titulo: 'Campus', valor: i => Array.from(i.campi).sort().join(', ') },
    { titulo: 'Ativo', valor: i => (i.inativo ? 'Não' : 'Sim') },
    { titulo: 'Alunos inventores', valor: i => i.alunos.size }
  ], itens);

  const abas = [capa, dados];
  if (tabelaCampusAno && tabelaCampusAno.length) abas.push({ nome: 'Campus x Ano', aoa: tabelaCampusAno });
  return abas;
}

function exportarInovacao() {
  const registros = (STATE.filtered && STATE.filtered.inovacao) || [];
  if (registros.length === 0) {
    showToast('Nenhum registro no recorte atual. Ajuste os filtros e exporte de novo.');
    return;
  }
  const tabela = document.querySelector('#table-inovacao-container table');
  baixarPastaExcel('Inovacao_IFBA', abasInovacao(
    registros,
    resumoDosFiltrosGlobais(),
    dataDosDados(),
    tabela ? matrizDeTabelaHtml(tabela) : null
  ));
}
