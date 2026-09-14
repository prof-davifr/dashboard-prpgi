// programas-pos.js — registro dos programas de pós-graduação do IFBA.
//
// O SUAP não tem um cadastro único de curso: cada campus digita o nome do
// programa do seu jeito, e o mesmo curso chega em muitas grafias. Em set/2026
// eram 60 nomes distintos para 27 programas com aluno. Alguns exemplos reais do
// mesmo curso de Ensino de Ciências:
//
//   C10 - Especialização em Ensino de Ciências - Anos Finais ... - "Ciência e Dez!"
//   Curso de Pós-graduação Lato Sensu em Ensino de Ciências: Ciência é 10
//   Especialização em Ensino em Ciências: Ciências é Dez
//   Curso de Especialização em Ensino de Ciências: Séries Finais do Ensino Fundamental
//
// Tirar acento e pontuação não resolve: o que muda é a redação inteira. Por
// isso aqui não há normalização de texto, e sim um registro: cada programa
// declara os termos que o identificam, e o nome canônico sai do registro.
//
// Os nomes canônicos seguem a grafia do portal do IFBA (consultado em
// 04/09/2026):
//
//   https://portal.ifba.edu.br/ensino/nossos-cursos/pos-graduacao/mestrados
//   https://portal.ifba.edu.br/ensino/nossos-cursos/pos-graduacao/doutorados
//   https://portal.ifba.edu.br/ensino/nossos-cursos/pos-graduacao/especializacoes
//
// O portal lista a oferta de hoje, e o SUAP entrega 2000–2026. Oito programas
// do registro não estão no portal porque já encerraram; a grafia deles vem dos
// próprios dados. O portal também traz dois cursos sem nenhum aluno na base —
// entram aqui assim mesmo, para casarem na primeira coleta que os trouxer.
//
// O nível ("Especialização em", "Mestrado Profissional em") fica no nome
// canônico, embora o portal o omita: `nomeCursoCurto()` o remove do rótulo do
// gráfico, e a coluna `categoria` continua dizendo a modalidade.
//
// Para acrescentar um programa novo, ponha uma entrada em PROGRAMAS_POS. O
// build avisa em voz alta quando encontra um nome que nenhuma entrada casa, e
// tests/programas-pos.test.js falha enquanto o nome não estiver registrado —
// senão o problema volta em silêncio a cada coleta.

'use strict';

// Reduz o nome a letras, números e espaços, sem acento e em minúsculas, só
// para a comparação. O nome que vai para o data.json é o `nome` do registro.
function normalizarNomeCurso(nome) {
  return (nome || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Cada entrada tem:
//   nome    — a forma canônica, que vai para o data.json
//   termos  — grupos de termos. Todos os grupos precisam casar; dentro de um
//             grupo basta um dos termos casar (é um "ou").
//   exceto  — se qualquer um destes aparecer, a entrada não serve.
//
// A ORDEM IMPORTA: vale a primeira entrada que casa. Programas específicos
// vêm antes dos que têm termos mais largos.
const PROGRAMAS_POS = [
  // ── Stricto sensu ──────────────────────────────────────────────────────────
  {
    nome: 'Doutorado em Difusão do Conhecimento',
    termos: [['difusao do conhecimento']]
  },
  {
    nome: 'Mestrado Acadêmico em Ciências e Tecnologias Ambientais',
    termos: [['ciencias e tecnologias ambientais']]
  },
  {
    nome: 'Mestrado Profissional em Educação Profissional e Tecnológica',
    termos: [['mestrado profissional em educacao profissional']]
  },
  {
    nome: 'Mestrado Profissional em Engenharia de Materiais',
    termos: [['engenharia de materiais']]
  },
  {
    nome: 'Mestrado Profissional em Engenharia de Sistemas e Produtos',
    termos: [['engenharia de sistemas e produtos']]
  },
  {
    // Chega com e sem o acento de "Transferência". O portal escreve
    // "para a Inovação"; o SUAP, "para Inovação".
    nome: 'Mestrado Profissional em Propriedade Intelectual e Transferência de Tecnologia para a Inovação',
    termos: [['propriedade intelectual']]
  },

  // ── Lato sensu: entradas específicas, antes das famílias ───────────────────
  {
    // Precisa vir antes do Ciência é Dez: o nome contém "ensino de ciencias",
    // mas é outro programa, de Lauro de Freitas.
    nome: 'Especialização em Ensino de Ciências Naturais e Matemática',
    termos: [['ciencias naturais e matematica']]
  },
  {
    nome: 'Especialização em Educação Profissional, Científica e Tecnológica',
    termos: [['educacao profissional cientifica e tecnologica']]
  },

  // ── Lato sensu: famílias ───────────────────────────────────────────────────
  {
    // Onze grafias, dez campi. "Séries Finais" (SEA), "Ciência é 10" (BRU) e
    // "Ensino em Ciências: Ciências é Dez" (SSA) são o mesmo programa nacional.
    // Os dois nomes de Brumado são duas turmas: 2020 e 2025.
    nome: 'Especialização em Ensino de Ciências Anos Finais do Ensino Fundamental - Ciências é 10!',
    termos: [['ensino de ciencias', 'ensino em ciencias']],
    exceto: ['naturais e matematica']
  },
  {
    // Dezoito grafias. "na" e "para a" convivem, e Ubaitaba põe o polo no nome
    // ("_Polo Camaçari"). O polo já vem no campo `polo`, então sai do nome.
    // "Formação de Professor da EPT" (Eunápolis) é o mesmo curso.
    nome: 'Especialização em Docência na Educação Profissional e Tecnológica',
    termos: [['docencia', 'formacao de professor'], ['educacao profissional']]
  },
  {
    nome: 'Especialização em Educação a Distância na Educação Profissional e Tecnológica',
    termos: [['educacao a distancia'], ['educacao profissional']]
  },
  {
    // O portal separa este da "Especialização em Ensino da Matemática"
    // presencial, então o termo é a marca do curso, não "ensino de matematica".
    // O @ vira espaço na chave normalizada.
    nome: 'Especialização em Ensino da Matemática - Matem@tica na Pr@tica',
    termos: [['matem tica na pr tica', 'matematica na pratica']]
  },

  // ── Lato sensu: um campus cada ─────────────────────────────────────────────
  {
    nome: 'Especialização em Ciência e Tecnologia Ambiental',
    termos: [['ciencia e tecnologia ambiental']]
  },
  {
    nome: 'Especialização em Desenvolvimento de Aplicações e Games para Dispositivos Móveis',
    termos: [['aplicacoes e games']]
  },
  {
    nome: 'Especialização em Desenvolvimento Web',
    termos: [['desenvolvimento web']]
  },
  {
    nome: 'Especialização em Didática da Língua Portuguesa',
    termos: [['didatica da lingua portuguesa']]
  },
  {
    nome: 'Especialização em Educação, Cultura e Linguagens',
    termos: [['educacao cultura e linguagens']]
  },
  {
    nome: 'Especialização em Educação, Cultura e Relações Étnico-Raciais',
    termos: [['relacoes etnico raciais']]
  },
  {
    nome: 'Especialização em Educação e Interculturalidade',
    termos: [['interculturalidade']]
  },
  {
    nome: 'Especialização em Educação e suas Tecnologias',
    termos: [['educacao e suas tecnologias']]
  },
  {
    nome: 'Especialização em Estudos Étnicos e Raciais: Identidades e Representação',
    termos: [['estudos etnicos e raciais']]
  },
  {
    nome: 'Especialização em Formação Docente e Práticas Pedagógicas',
    termos: [['formacao docente e praticas pedagogicas']]
  },
  {
    nome: 'Especialização em Gestão e Educação Ambiental',
    termos: [['gestao e educacao ambiental']]
  },
  {
    nome: 'Especialização em Gestão na Educação Profissional e Tecnológica',
    termos: [['gestao na educacao profissional']]
  },
  {
    nome: 'Especialização em Leitura e Produção Textual Aplicadas à Educação de Jovens e Adultos',
    termos: [['leitura e producao textual']]
  },
  {
    nome: 'Especialização em Linguagem, Ensino e Representação (CELER)',
    termos: [['linguagem ensino e representacao']]
  },
  {
    nome: 'Especialização em Tecnologias Digitais para Educação',
    termos: [['tecnologias digitais']]
  },

  // ── No portal, ainda sem aluno na base do SUAP ─────────────────────────────
  {
    nome: 'Especialização em Computação Distribuída e Ubíqua',
    termos: [['computacao distribuida']]
  },
  {
    nome: 'Especialização em Gestão Pública, Segurança contra Incêndio e Pânico e Defesa Civil',
    termos: [['seguranca contra incendio']]
  }
];

function entradaCasa(entrada, chave) {
  if ((entrada.exceto || []).some(t => chave.includes(t))) return false;
  return entrada.termos.every(grupo => grupo.some(t => chave.includes(t)));
}

// Devolve { nome, encontrado }. Quando nenhuma entrada casa, `encontrado` é
// false e `nome` é o que veio, para o dado não sumir do painel enquanto o
// programa não entra no registro.
function canonizarCurso(nome) {
  const chave = normalizarNomeCurso(nome);
  if (!chave) return { nome: nome || '', encontrado: false };

  const entrada = PROGRAMAS_POS.find(p => entradaCasa(p, chave));
  return entrada
    ? { nome: entrada.nome, encontrado: true }
    : { nome: nome, encontrado: false };
}

const NOMES_CANONICOS = PROGRAMAS_POS.map(p => p.nome);

module.exports = {
  PROGRAMAS_POS,
  NOMES_CANONICOS,
  normalizarNomeCurso,
  canonizarCurso
};
