#!/usr/bin/env node
// extrair-nit.js — guarda, da planilha do NIT, a estrutura (campus) de cada
// ativo de propriedade intelectual.
//
// A planilha `dados/nit/preenchimento_NIT.xlsx` foi preenchida pelo setor da
// PRPGI responsável pela propriedade intelectual. É a única fonte que diz a
// que campus pertence cada registro do INPI: o INPI nunca informa campus, e a
// cascata de `refresh-inovacao.js` só o deduz pelo Lattes ou pelo nome do
// autor.
//
// Só a aba `ativos_pesquisa` interessa ao painel, e só as colunas sem dado
// pessoal. As outras abas (produção, projetos, pessoas envolvidas) trazem CPF,
// nome e matrícula e ficam fora do repositório, em `dados/` (gitignored).
//
// Uso: node scripts/extrair-nit.js [planilha.xlsx]
//      (padrão: dados/nit/preenchimento_NIT.xlsx)
// Saída: nit-estrutura.json (versionado)

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { normalizeCampusCode } = require('./build');
const { CODIGOS_VALIDOS } = require('./validate-data');

const RAIZ = path.join(__dirname, '..');
const ENTRADA_PADRAO = path.join(RAIZ, 'dados', 'nit', 'preenchimento_NIT.xlsx');
const SAIDA = path.join(RAIZ, 'nit-estrutura.json');

// Estruturas que a planilha escreve fora do código de campus do painel. FSA e
// VDC já passam por `normalizeCampusCode`; REI (Reitoria) é código válido no
// painel e fica como está.
const ESTRUTURA_FIX = {
  'SEABRA': 'SEA'
};

// Mesma forma do `dedupKey` de `inovacao` no data.json: só os dígitos do
// número INPI. "BR 10 2024 010097 2" → "1020240100972"; "PI 1106612-1" → "11066121".
function numeroInpi(bruto) {
  return String(bruto || '').replace(/\D/g, '');
}

// Código de campus do painel, ou null quando a célula não traz campus (a
// planilha tem "INDEFERIDA" e "ARQUIVADO" nessa coluna em três marcas).
function campusDaEstrutura(estrutura) {
  const bruto = String(estrutura || '').trim().toUpperCase();
  if (!bruto) return null;
  const codigo = ESTRUTURA_FIX[bruto] || normalizeCampusCode(bruto);
  return CODIGOS_VALIDOS.has(codigo) ? codigo : null;
}

function extrairEstruturas(linhas) {
  const ativos = {};
  for (const linha of linhas) {
    const numero = numeroInpi(linha.num_inpi_ativo_pesq);
    if (!numero) continue;
    const ativo = {
      tipo: linha.tipo_ativo_pesq || null,
      situacao: linha.sit_registro_ativo_pesq || null,
      estrutura: linha.estrutura === null || linha.estrutura === undefined ? null : String(linha.estrutura).trim()
    };
    const campus = campusDaEstrutura(linha.estrutura);
    if (campus) ativo.campus = campus;
    ativos[numero] = ativo;
  }
  // Chaves em ordem para o diff do git mostrar só o que mudou.
  return Object.fromEntries(Object.keys(ativos).sort().map((k) => [k, ativos[k]]));
}

function main() {
  const entrada = process.argv[2] || ENTRADA_PADRAO;
  if (!fs.existsSync(entrada)) {
    console.error(`Planilha não encontrada: ${entrada}`);
    process.exit(1);
  }
  const wb = XLSX.readFile(entrada);
  const aba = wb.Sheets.ativos_pesquisa;
  if (!aba) {
    console.error('A planilha não tem a aba "ativos_pesquisa".');
    process.exit(1);
  }
  const ativos = extrairEstruturas(XLSX.utils.sheet_to_json(aba, { defval: null }));
  const semCampus = Object.entries(ativos).filter(([, a]) => !a.campus);

  const saida = {
    _leia_me: 'Gerado por scripts/extrair-nit.js a partir da planilha preenchida pelo setor de propriedade intelectual da PRPGI. Liga o número INPI à estrutura (campus) do IFBA. Sem dado pessoal.',
    planilha: path.basename(entrada),
    planilhaModificadaEm: fs.statSync(entrada).mtime.toISOString().slice(0, 10),
    ativos
  };
  const texto = JSON.stringify(saida, null, 1) + '\n';
  if (fs.existsSync(SAIDA) && fs.readFileSync(SAIDA, 'utf8') === texto) {
    console.log('nit-estrutura.json sem mudança.');
    return;
  }
  fs.writeFileSync(SAIDA, texto);
  console.log(`nit-estrutura.json: ${Object.keys(ativos).length} ativos, ${semCampus.length} sem campus` +
    (semCampus.length ? ` (${semCampus.map(([n, a]) => `${n}=${a.estrutura}`).join(', ')})` : ''));
}

if (require.main === module) {
  main();
}

module.exports = { numeroInpi, campusDaEstrutura, extrairEstruturas, ESTRUTURA_FIX };
