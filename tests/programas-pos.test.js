// Testes do registro de programas de pós-graduação (scripts/programas-pos.js).
//
// O SUAP não tem cadastro único de curso: cada campus digita o nome do seu
// jeito, e em set/2026 eram 60 nomes para 27 programas. O registro resolve o
// nome canônico. Estes testes existem para que o problema não volte em
// silêncio: a coleta seguinte pode trazer uma grafia nova, e sem o guarda o
// mesmo programa reaparece duas vezes no filtro e no gráfico.
'use strict';

const fs = require('fs');
const path = require('path');
const {
  PROGRAMAS_POS, NOMES_CANONICOS, normalizarNomeCurso, canonizarCurso
} = require('../scripts/programas-pos');

const DATA_PATH = path.join(__dirname, '..', 'data.json');

// ─── normalizarNomeCurso ─────────────────────────────────────────────────────

describe('normalizarNomeCurso', () => {
  test('tira acento, caixa e pontuação', () => {
    expect(normalizarNomeCurso('TRANSFERÊNCIA de Tecnologia — para Inovação!'))
      .toBe('transferencia de tecnologia para inovacao');
  });

  test('aspas curvas e retas dão a mesma chave', () => {
    expect(normalizarNomeCurso('“Ciência é Dez!”')).toBe(normalizarNomeCurso('"Ciencia e Dez!"'));
  });

  test('nome vazio ou ausente vira string vazia', () => {
    expect(normalizarNomeCurso('')).toBe('');
    expect(normalizarNomeCurso(undefined)).toBe('');
  });
});

// ─── O registro ──────────────────────────────────────────────────────────────

describe('PROGRAMAS_POS', () => {
  test('todo nome canônico é único', () => {
    expect(new Set(NOMES_CANONICOS).size).toBe(NOMES_CANONICOS.length);
  });

  // Os termos são comparados contra a chave normalizada. Um termo com acento ou
  // maiúscula nunca casaria, e a entrada ficaria morta sem ninguém notar.
  test('todo termo já está na forma normalizada', () => {
    PROGRAMAS_POS.forEach(p => {
      [...p.termos.flat(), ...(p.exceto || [])].forEach(termo => {
        expect(normalizarNomeCurso(termo)).toBe(termo);
      });
    });
  });

  test('o próprio nome canônico casa com a entrada dele', () => {
    PROGRAMAS_POS.forEach(p => {
      expect(canonizarCurso(p.nome)).toEqual({ nome: p.nome, encontrado: true });
    });
  });
});

// ─── canonizarCurso ──────────────────────────────────────────────────────────

// As grafias abaixo são as que o SUAP entregou de verdade em set/2026. Servem
// de retrato: se uma entrada do registro mudar e passar a capturar o programa
// errado, é aqui que se vê.
const GRAFIAS_REAIS = [
  // A família do "Ciência é Dez!": onze redações do mesmo programa nacional.
  ['C10 - Especialização em Ensino de Ciências - Anos Finais do Ensino Fundamental - "Ciência e Dez!"', 'ciencias'],
  ['C10ESP - Especialização em Ensino de Ciências – Anos finais do Ensino Fundamental “Ciência é Dez!” - Ilhéus', 'ciencias'],
  ['Curso de Especialização em Ensino de Ciências: Séries Finais do Ensino Fundamental', 'ciencias'],
  ['Curso de Pós-graduação lato sensu em Ensino de Ciências Anos Finais do Ensino Fundamental', 'ciencias'],
  ['Curso de Pós-Graduação Lato Sensu em Ensino de Ciências: Ciência é 10', 'ciencias'],
  ['EEC - Especialização em Ensino de Ciências – Anos finais do Ensino Fundamental “Ciência é Dez!” - Jacobina', 'ciencias'],
  ['EEC10 - CURSO DE ESPECIALIZAÇÃO EM ENSINO DE CIÊNCIAS – ANOS FINAIS DO ENSINO FUNDAMENTAL: "CIÊNCIA É DEZ!" - JQ', 'ciencias'],
  ['ESEC - Especialização em Ensino de Ciências – Anos finais do Ensino Fundamental “Ciência é Dez!” Euclides da Cunha', 'ciencias'],
  ['ESPC10 - Curso de Especialização em Ensino de Ciências: Anos Finais do Ensino Fundamental - "Ciência é Dez"', 'ciencias'],
  ['Especialização em Ensino de Ciências – Anos finais do Ensino Fundamental “Ciência é Dez!” - Campus Eunápolis', 'ciencias'],
  ['Especialização em Ensino em Ciências: Ciências é Dez', 'ciencias'],

  // Docência na EPT: "na" e "para a", prefixo de código, polo no nome.
  ['DEPTBAR - Especialização em Docência para a Educação Profissional e Tecnológica', 'docencia'],
  ['DEPTCAM - Especialização em Docência na Educação Profissional e Tecnológica', 'docencia'],
  ['ESDOSALV - Especialização em Docência na Educação Profissional e Tecnológica_Polo SALVADOR: SUBÚRBIO', 'docencia'],

  // Formação de Professores da EPT: a página da PRPGI a separa da Docência.
  ['1004 - ESPECIALIZAÇÃO EM FORMAÇÃO DE PROFESSOR DA EDUCAÇÃO PROFISSIONAL E TECNOLÓGICA - Campus Eunápolis (Eunápolis)', 'formacao'],

  // Matem@tica na Pr@tica: prefixos diferentes, "-" e ":".
  ['20202MP - Especialização em Ensino de Matemática: Matem@tica na Pr@tica', 'matematica'],
  ['Especialização em Ensino de Matemática - Matem@tica na Pr@tica', 'matematica'],
  ['PGMP - Especialização em Ensino de Matemática: Matem@tica na Pr@tica', 'matematica'],

  // Educação a Distância na EPT.
  ['Curso de Pós-Graduação Lato Sensu em Educação a Distância na Educação Profissional e Tecnológica (EAD) - Campus Eunápolis', 'ead'],
  ['EDEPTILH - Especialização em Educação a Distância na Educação Profissional e Tecnológica - ILH', 'ead'],

  // A página da PRPGI não usa a sigla CELER e escreve "aplicadas" minúsculo.
  ['CELER - Curso de Especialização, Lato Sensu, em Linguagem, Ensino e Representação – CELER (Salvador)', 'celer'],
  ['0006 - Curso de Pós-Graduação Lato Sensu em Leitura e Produção Textual aplicadas à Educação de Jovens e Adultos (Brumado)', 'leitura'],

  // Stricto sensu: o mestrado de Propriedade Intelectual chega com e sem acento.
  ['MESTRADO PROFISSIONAL EM PROPRIEDADE INTELECTUAL E TRANSFERENCIA DE TECNOLOGIA PARA INOVAÇÃO', 'pi'],
  ['MESTRADO PROFISSIONAL EM PROPRIEDADE INTELECTUAL E TRANSFERÊNCIA DE TECNOLOGIA PARA INOVAÇÃO', 'pi']
];

const CANONICO = {
  ciencias: 'Especialização em Ensino de Ciências - Ciências é 10!',
  docencia: 'Especialização em Docência na Educação Profissional e Tecnológica',
  formacao: 'Especialização em Formação de Professores da Educação Profissional e Tecnológica',
  celer: 'Especialização em Linguagem, Ensino e Representação',
  leitura: 'Especialização em Leitura e Produção Textual aplicadas à Educação de Jovens e Adultos',
  matematica: 'Especialização em Ensino da Matemática - Matem@tica na Pr@tica',
  ead: 'Especialização em Educação a Distância na Educação Profissional e Tecnológica',
  pi: 'Mestrado Profissional em Propriedade Intelectual e Transferência de Tecnologia para a Inovação'
};

describe('canonizarCurso', () => {
  test.each(GRAFIAS_REAIS)('%s', (grafia, familia) => {
    expect(canonizarCurso(grafia)).toEqual({ nome: CANONICO[familia], encontrado: true });
  });

  // "Ensino de Ciências Naturais e Matemática" (Lauro de Freitas) contém
  // "ensino de ciencias", mas é outro programa. A entrada dele vem antes no
  // registro, e a do Ciência é Dez o exclui por `exceto`.
  test('Ciências Naturais e Matemática não cai no Ciência é Dez', () => {
    expect(canonizarCurso('ESPECNM - Curso de Especialização em Ensino de Ciências Naturais e Matemática - LAF').nome)
      .toBe('Especialização em Ensino de Ciências Naturais e Matemática');
  });

  // "Formação Docente e Práticas Pedagógicas" (Jequié) tem "docente", não
  // "docência", e não fala em educação profissional. É outro curso.
  test('Formação Docente e Práticas Pedagógicas não cai na Docência na EPT', () => {
    expect(canonizarCurso('PGFDPP - CURSO DE PÓS - GRADUAÇÃO LATO SENSU EM FORMAÇÃO DOCENTE E PRÁTICAS PEDAGÓGICAS - JQ').nome)
      .toBe('Especialização em Formação Docente e Práticas Pedagógicas');
  });

  // A especialização de Porto Seguro e o mestrado acadêmico têm nomes vizinhos:
  // "Ciência e Tecnologia Ambiental" e "Ciências e Tecnologias Ambientais".
  test('a especialização ambiental não vira o mestrado acadêmico', () => {
    expect(canonizarCurso('ESPECIALIZAÇÃO EM CIÊNCIA E TECNOLOGIA AMBIENTAL').nome)
      .toBe('Especialização em Ciência e Tecnologia Ambiental');
    expect(canonizarCurso('MESTRADO ACADÊMICO EM CIÊNCIAS E TECNOLOGIAS AMBIENTAIS').nome)
      .toBe('Mestrado Acadêmico em Ciências e Tecnologias Ambientais');
  });

  // O portal lista dois cursos de matemática: "Ensino da Matemática" presencial
  // e "Ensino da Matemática - Matem@tica na Pr@tica" a distância. Um termo
  // largo como "ensino de matematica" juntaria os dois.
  test('o Ensino da Matemática presencial não cai no Matem@tica na Pr@tica', () => {
    expect(canonizarCurso('Especialização em Ensino de Matemática').nome)
      .toBe('Especialização em Ensino da Matemática');
    expect(canonizarCurso('PGMP - Especialização em Ensino de Matemática: Matem@tica na Pr@tica').nome)
      .toBe('Especialização em Ensino da Matemática - Matem@tica na Pr@tica');
  });

  // Até 14/09/2026 a Formação de Professor de Eunápolis somava na Docência na
  // EPT. A página da PRPGI lista os dois cursos; nenhum captura o outro.
  test('Docência na EPT e Formação de Professores da EPT ficam separadas', () => {
    expect(canonizarCurso('Especialização em Formação de Professores da Educação Profissional e Tecnológica').nome)
      .toBe(CANONICO.formacao);
    expect(canonizarCurso('Especialização em Docência na Educação Profissional e Tecnológica').nome)
      .toBe(CANONICO.docencia);
  });

  test('nome desconhecido volta como veio, marcado como não encontrado', () => {
    expect(canonizarCurso('Especialização em Algo Que Não Existe'))
      .toEqual({ nome: 'Especialização em Algo Que Não Existe', encontrado: false });
  });

  test('nome vazio não quebra', () => {
    expect(canonizarCurso('')).toEqual({ nome: '', encontrado: false });
    expect(canonizarCurso(undefined)).toEqual({ nome: '', encontrado: false });
  });
});

// ─── A grafia oficial do portal ──────────────────────────────────────────────

// Consultado em 14/09/2026 em portal.ifba.edu.br/prpgi/cursos/
// {mestrados,doutorados,especializacoes}/. A página omite o nível; o registro
// guarda o nível no nome. Estes casos existem para que uma edição futura não
// afaste o painel da grafia oficial.
//
// Uma grafia da página fica de fora de propósito: "Educação à Distância na
// Educação Profissional e Tecnológica". O registro escreve "a Distância", sem
// crase, como pede a norma.
const GRAFIA_DO_PORTAL = [
  // Mestrados e doutorado
  ['Ciências e Tecnologias Ambientais', 'Mestrado Acadêmico em Ciências e Tecnologias Ambientais'],
  ['Educação Profissional e Tecnológica', 'Mestrado Profissional em Educação Profissional e Tecnológica'],
  ['Engenharia de Materiais', 'Mestrado Profissional em Engenharia de Materiais'],
  ['Engenharia de Sistemas e Produtos', 'Mestrado Profissional em Engenharia de Sistemas e Produtos'],
  ['Propriedade Intelectual e Transferência de Tecnologia para a Inovação', 'Mestrado Profissional em Propriedade Intelectual e Transferência de Tecnologia para a Inovação'],
  ['Difusão do Conhecimento', 'Doutorado em Difusão do Conhecimento'],

  // Especializações presenciais
  ['Ciência e Tecnologia Ambiental', 'Especialização em Ciência e Tecnologia Ambiental'],
  ['Computação Distribuída e Ubíqua', 'Especialização em Computação Distribuída e Ubíqua'],
  ['Desenvolvimento de Aplicações e Games para Dispositivos Móveis', 'Especialização em Desenvolvimento de Aplicações e Games para Dispositivos Móveis'],
  ['Desenvolvimento Web', 'Especialização em Desenvolvimento Web'],
  ['Didática da Língua Portuguesa', 'Especialização em Didática da Língua Portuguesa'],
  ['Educação e Interculturalidade', 'Especialização em Educação e Interculturalidade'],
  ['Educação e suas Tecnologias', 'Especialização em Educação e suas Tecnologias'],
  ['Educação Profissional, Científica e Tecnológica', 'Especialização em Educação Profissional, Científica e Tecnológica'],
  ['Educação, Cultura e Linguagens', 'Especialização em Educação, Cultura e Linguagens'],
  ['Formação Docente e Práticas Pedagógicas', 'Especialização em Formação Docente e Práticas Pedagógicas'],
  ['Estudos Étnicos e Raciais: Identidades e Representação', 'Especialização em Estudos Étnicos e Raciais: Identidades e Representação'],
  ['Ensino da Matemática', 'Especialização em Ensino da Matemática'],
  ['Gestão e Educação Ambiental', 'Especialização em Gestão e Educação Ambiental'],
  ['Gestão Pública, Segurança contra Incêndio e Pânico e Defesa Civil', 'Especialização em Gestão Pública, Segurança contra Incêndio e Pânico e Defesa Civil'],
  ['Ensino de Ciências Naturais e Matemática', 'Especialização em Ensino de Ciências Naturais e Matemática'],
  ['Formação de Professores da Educação Profissional e Tecnológica', 'Especialização em Formação de Professores da Educação Profissional e Tecnológica'],
  ['Linguagem, Ensino e Representação', 'Especialização em Linguagem, Ensino e Representação'],
  ['Leitura e Produção Textual aplicadas à Educação de Jovens e Adultos', 'Especialização em Leitura e Produção Textual aplicadas à Educação de Jovens e Adultos'],
  ['Educação, Cultura e Relações Étnico-Raciais', 'Especialização em Educação, Cultura e Relações Étnico-Raciais'],
  ['Tecnologias Digitais para Educação', 'Especialização em Tecnologias Digitais para Educação'],
  ['Literatura, Ensino e Diversidade', 'Especialização em Literatura, Ensino e Diversidade'],
  ['História e Cultura Afro-Brasileira e Indígena', 'Especialização em História e Cultura Afro-Brasileira e Indígena'],
  ['Práticas Educacionais e Juventudes na Contemporaneidade', 'Especialização em Práticas Educacionais e Juventudes na Contemporaneidade'],

  // Especializações a distância
  ['Ensino de Ciências - Ciências é 10!', 'Especialização em Ensino de Ciências - Ciências é 10!'],
  ['Ensino da Matemática - Matem@tica na Pr@tica', 'Especialização em Ensino da Matemática - Matem@tica na Pr@tica'],
  ['Docência na Educação Profissional e Tecnológica', 'Especialização em Docência na Educação Profissional e Tecnológica'],
  ['Gestão na Educação Profissional e Tecnológica', 'Especialização em Gestão na Educação Profissional e Tecnológica'],
  ['Energias Renováveis e Mobilidade Elétrica', 'Especialização em Energias Renováveis e Mobilidade Elétrica'],
  ['Línguas Indígenas de Sinais', 'Especialização em Línguas Indígenas de Sinais'],
  ['Ensino de Língua Estrangeira na Educação Profissional e Tecnológica', 'Especialização em Ensino de Língua Estrangeira na Educação Profissional e Tecnológica']
];

// Especializações encerradas, informadas pela Pró-Reitoria em 14/09/2026. Não
// estão na página e não têm aluno na base do SUAP; a grafia é a da lista.
const ENCERRADAS = [
  'Especialização em Educação Profissional Integrada à Educação Básica na Modalidade EJA',
  'Especialização em Gestão de Instituições Públicas de Ensino',
  'Especialização em Gestão de Tecnologias em Saúde com ênfases em: Engenharia Clínica e em Gestão de Equipamentos Médico-Hospitalares',
  'Especialização em Técnica em Segurança, Meio Ambiente e Saúde'
];

// O teste é sobre a GRAFIA, não sobre a resolução. Vários nomes do portal são
// ambíguos sozinhos: "Educação Profissional e Tecnológica" cabe no mestrado
// ProfEPT, na Docência na EPT, na Gestão na EPT e na EaD na EPT. O que se
// garante aqui é que o nome canônico termina exatamente com a grafia oficial,
// precedido só do nível.
describe('grafia oficial do portal do IFBA', () => {
  test.each(GRAFIA_DO_PORTAL)('%s', (doPortal, canonico) => {
    expect(NOMES_CANONICOS).toContain(canonico);
    expect(canonico.endsWith(doPortal)).toBe(true);
    expect(canonico.slice(0, canonico.length - doPortal.length))
      .toMatch(/^(Mestrado (Acadêmico|Profissional)|Doutorado|Especialização) em $/);
  });

  test.each(ENCERRADAS)('encerrada: %s', nome => {
    expect(NOMES_CANONICOS).toContain(nome);
  });

  // Toda entrada do registro vem da página da PRPGI ou da lista de encerradas.
  // Um nome que não esteja em nenhuma das duas se afastou da grafia oficial.
  test('o registro não tem nome fora da página nem da lista de encerradas', () => {
    const conhecidos = new Set([
      ...GRAFIA_DO_PORTAL.map(([, canonico]) => canonico),
      'Especialização em Educação a Distância na Educação Profissional e Tecnológica',
      ...ENCERRADAS
    ]);
    expect(NOMES_CANONICOS.filter(n => !conhecidos.has(n))).toEqual([]);
  });
});

// ─── Guarda sobre o data.json publicado ──────────────────────────────────────

describe('data.json', () => {
  const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
  const cursos = [...new Set(data.posgraduacao.map(r => (r.curso || '').trim()).filter(Boolean))];

  // Se este teste falhar, a coleta trouxe uma grafia nova. Acrescente a entrada
  // em scripts/programas-pos.js e rode `npm run build` de novo — o build também
  // lista os nomes fora do registro no fim da saída.
  test('todo curso publicado é um nome canônico do registro', () => {
    const fora = cursos.filter(c => !NOMES_CANONICOS.includes(c));
    expect(fora).toEqual([]);
  });

  test('não há dois nomes de curso que só diferem por acento ou pontuação', () => {
    const porChave = {};
    cursos.forEach(c => {
      const k = normalizarNomeCurso(c);
      (porChave[k] = porChave[k] || []).push(c);
    });
    const colisoes = Object.values(porChave).filter(v => v.length > 1);
    expect(colisoes).toEqual([]);
  });
});
