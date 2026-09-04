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
