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
// Os nomes canônicos seguem a grafia das páginas de cursos da PRPGI
// (consultadas em 14/09/2026):
//
//   https://portal.ifba.edu.br/prpgi/cursos/mestrados/
//   https://portal.ifba.edu.br/prpgi/cursos/doutorados/
//   https://portal.ifba.edu.br/prpgi/cursos/especializacoes/
//
// A PRPGI lista 5 mestrados, 1 doutorado e 31 especializações. Uma única
// grafia do portal não foi seguida: "Educação à Distância" fica sem crase,
// como pede a norma. Vários cursos da página ainda não têm aluno na base, e a
// Pró-Reitoria informou quatro especializações já encerradas, fora da página.
// Todos entram aqui assim mesmo, para casarem na primeira coleta que os trouxer.
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
    // A página da PRPGI lista este curso presencial à parte da Docência na
    // EPT, que é a distância. Até 14/09/2026 os alunos de Eunápolis somavam na
    // Docência; o SUAP os traz como "Formação de Professor da EPT".
    nome: 'Especialização em Formação de Professores da Educação Profissional e Tecnológica',
    termos: [['formacao de professor'], ['educacao profissional']]
  },
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
    nome: 'Especialização em Ensino de Ciências - Ciências é 10!',
    termos: [['ensino de ciencias', 'ensino em ciencias']],
    exceto: ['naturais e matematica']
  },
  {
    // Dezessete grafias. "na" e "para a" convivem, e Ubaitaba põe o polo no
    // nome ("_Polo Camaçari"). O polo já vem no campo `polo`, então sai do nome.
    nome: 'Especialização em Docência na Educação Profissional e Tecnológica',
    termos: [['docencia'], ['educacao profissional']]
  },
  {
    // A página da PRPGI escreve "à Distância"; aqui fica sem crase.
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
  {
    // O presencial. O `exceto` o separa do Matem@tica na Pr@tica, que também
    // chega como "Ensino de Matemática".
    nome: 'Especialização em Ensino da Matemática',
    termos: [['ensino da matematica', 'ensino de matematica']],
    exceto: ['matem tica na pr tica', 'matematica na pratica']
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
    nome: 'Especialização em Leitura e Produção Textual aplicadas à Educação de Jovens e Adultos',
    termos: [['leitura e producao textual']]
  },
  {
    nome: 'Especialização em Linguagem, Ensino e Representação',
    termos: [['linguagem ensino e representacao']]
  },
  {
    nome: 'Especialização em Tecnologias Digitais para Educação',
    termos: [['tecnologias digitais']]
  },

  // ── Na página da PRPGI, ainda sem aluno na base do SUAP ────────────────────
  {
    nome: 'Especialização em Computação Distribuída e Ubíqua',
    termos: [['computacao distribuida']]
  },
  {
    nome: 'Especialização em Energias Renováveis e Mobilidade Elétrica',
    termos: [['energias renovaveis']]
  },
  {
    nome: 'Especialização em Ensino de Língua Estrangeira na Educação Profissional e Tecnológica',
    termos: [['lingua estrangeira']]
  },
  {
    nome: 'Especialização em Gestão Pública, Segurança contra Incêndio e Pânico e Defesa Civil',
    termos: [['seguranca contra incendio']]
  },
  {
    nome: 'Especialização em História e Cultura Afro-Brasileira e Indígena',
    termos: [['historia e cultura afro']]
  },
  {
    nome: 'Especialização em Línguas Indígenas de Sinais',
    termos: [['linguas indigenas de sinais']]
  },
  {
    nome: 'Especialização em Literatura, Ensino e Diversidade',
    termos: [['literatura ensino e diversidade']]
  },
  {
    nome: 'Especialização em Práticas Educacionais e Juventudes na Contemporaneidade',
    termos: [['praticas educacionais e juventudes']]
  },

  // ── Encerradas, fora da página da PRPGI ────────────────────────────────────
  // Lista da Pró-Reitoria (14/09/2026). Nenhuma tem aluno na base do SUAP.
  {
    nome: 'Especialização em Educação Profissional Integrada à Educação Básica na Modalidade EJA',
    termos: [['integrada a educacao basica', 'proeja']]
  },
  {
    nome: 'Especialização em Gestão de Instituições Públicas de Ensino',
    termos: [['instituicoes publicas de ensino']]
  },
  {
    nome: 'Especialização em Gestão de Tecnologias em Saúde com ênfases em: Engenharia Clínica e em Gestão de Equipamentos Médico-Hospitalares',
    termos: [['tecnologias em saude']]
  },
  {
    nome: 'Especialização em Técnica em Segurança, Meio Ambiente e Saúde',
    termos: [['seguranca meio ambiente e saude']]
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
