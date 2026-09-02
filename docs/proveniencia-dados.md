# Documento de Proveniência de Dados — Dashboard PRPGI

| Versão | Data | Autor |
|--------|------|-------|
| 1.0 | 2026-07-06 | PRPGI/IFBA |

---

## 1. Visão Geral do Projeto

| Atributo | Valor |
|---|---|
| **Nome** | Dashboard PRPGI |
| **Instituição** | IFBA — Instituto Federal de Educação, Ciência e Tecnologia da Bahia |
| **Pró-Reitoria** | PRPGI — Pró-Reitoria de Pesquisa, Pós-Graduação e Inovação |
| **Repositório** | https://github.com/prof-davifr/dashboard-prpgi |
| **URL de produção** | https://prof-davifr.github.io/dashboard-prpgi/ |
| **Linguagem** | JavaScript (Node.js v18+ para build; frontend estático vanilla) |
| **Dependências de build** | `xlsx` (SheetJS) ^0.18.5 |
| **Dependências de frontend** | Chart.js 4.4.0, Leaflet 1.9.4, SheetJS (via CDN) |
| **Deploy** | GitHub Pages (push na branch `main`) |
| **Propósito** | Consolidar indicadores institucionais de pesquisa, inovação e pós-graduação do IFBA para apoio à gestão acadêmica |

### 1.1 Estrutura do Repositório

```
/
├── index.html           # Dashboard (única página)
├── scripts/
│   └── build.js         # Pipeline de ETL (Node.js)
├── data.json            # Saída do build (~31 MB, commitado)
├── data-groups.json     # Saída detalhada (~63 MB, commitado)
├── dados/               # Fontes brutas (gitignored)
│   ├── scraper-SUAPCNPQ/   # Lattes por campus (25 .xlsx)
│   ├── scraper-DGP/        # Grupos de pesquisa (.csv)
│   ├── scraper-SUAPPos/    # Pós-graduação (.csv)
│   └── ic/                 # Iniciação Científica (.xlsx)
├── src/
│   ├── script.js         # Lógica principal do dashboard
│   ├── style.css         # Estilos
│   ├── posgraduacao.js   # Lógica específica de pós-graduação
│   └── pesquisadores.js  # Lógica específica de pesquisadores
├── tests/                # Testes Jest
└── docs/                 # Documentação técnica
```

---

## 2. Fontes de Dados Primárias

O dashboard consolida quatro fontes de dados primárias, cada uma com origem, formato e pipeline de extração distintos.

---

### 2.1 SUAP CNPq (Lattes) — Produção Acadêmica dos Servidores

#### Identificador
`scraper-SUAPCNPQ`

#### Descrição
Produção acadêmica (bibliográfica, técnica, inovação e orientações) dos servidores ativos do IFBA, extraída da integração entre o SUAP (Sistema Unificado de Administração Pública) e a Plataforma Lattes CNPq.

#### Origem
- **Sistema de origem**: SUAP/IFBA, módulo de integração com CNPq
- **Forma de extração**: Exportação manual pelo setor de Gestão de Pesquisa, organizada por campus
- **Responsável**: PRPGI/IFBA

#### Formato e estrutura
- **Formato**: `.xlsx` (Excel), um arquivo por campus
- **Arquivos**: 25 arquivos nomeados como `{CÓDIGO_CAMPUS}.xlsx` (ex: `SSA.xlsx`, `BAR.xlsx`)
- **5 abas (sheets)** padronizadas em cada arquivo:

| Sheet | Chave interna | Conteúdo | Colunas principais |
|---|---|---|---|
| Produções Bibliográficas | `bibliografica` | Artigos, livros, capítulos, anais | `Ano`, `Tipo`, `Servidor`, `Estrato`, `Publicação`, `Periódico/Revista`, `ISSN` |
| Produções Técnicas | `tecnica` | Cursos, apresentações, produtos técnicos | `Ano`, `Tipo`, `Servidor`, `Publicação` |
| Registros e Patentes | `inovacao` | Patentes, softwares, marcas, desenhos industriais | `Ano`, `Tipo`, `Servidor`, `Publicação` |
| Orientações Concluídas | `concluidas` | Orientações finalizadas (IC, mestrado, doutorado) | `Ano`, `Tipo`, `Servidor`, `Publicação` |
| Orientações em Andamento | `andamento` | Orientações em curso | `Ano`, `Tipo`, `Servidor`, `Publicação` |

#### Campo Servidor
O campo `Servidor` contém uma string com dados dos vínculos:
```
<VinculoQueryset [<Vinculo: Nome do Servidor (ID) (Servidor)>]>
```
O pipeline extrai o **ID numérico** (mín. 7 dígitos) e o **nome completo** para:
- Contagem distinta de servidores
- Resolução de nomes entre fontes (Lattes ↔ DGP)
- Suporte a multiautoria (mesma produção com múltiplos servidores)

#### Período e volume
| Aba | Registros totais | Período |
|---|---|---|
| Bibliográfica | ~47.000 | 2000–2026 |
| Técnica | ~75.200 | 2000–2026 |
| Inovação | ~850 | 2000–2026 |
| Orientações Concluídas | ~24.900 | 2000–2026 |
| Orientações em Andamento | ~2.200 | 2000–2026 |

#### Frequência de atualização
Manual, conforme exportação do SUAP. Sem periodicidade fixa estabelecida.

---

### 2.2 DGP/CNPq — Grupos de Pesquisa

#### Identificador
`scraper-DGP`

#### Descrição
Grupos de pesquisa certificados do IFBA no Diretório de Grupos de Pesquisa do CNPq (DGP), com informações sobre líderes, área de atuação, número de pesquisadores e estudantes.

#### Origem
- **Sistema de origem**: Diretório de Grupos de Pesquisa — CNPq (https://dgp.cnpq.br)
- **Forma de extração**: Scraper automatizado (projeto `prof-davifr/scraper-DGP`)
- **Responsável**: PRPGI/IFBA

#### Formato e estrutura
- **Formato**: `.csv` (UTF-8)
- **Arquivo principal**: `coletor_dgp_ifba.csv`
- **Arquivo histórico**: `coletor_dgp_ifba_old.csv` (ignorado pelo build; mantido como backup)
- **Seleção**: O build seleciona o arquivo `coletor` mais recente (por data de modificação) entre os disponíveis

#### Colunas do CSV

| Coluna original | Chave normalizada | Tipo | Descrição |
|---|---|---|---|
| `Situação` | `Situacao` | string | Certificado, Excluído, Em preenchimento, Não-atualizado, Aguardando certificação |
| `Ano Formação` | `AnoFormacao` | string numérica | Ano de formação do grupo |
| `Pesquisadores` | `Pesquisadores` | string numérica | Nº de pesquisadores |
| `Estudantes` | `Estudantes` | string numérica | Nº de estudantes |
| `Área` | `Area` | string | Grande área do conhecimento |
| `Último Envio` | `UltimoEnvio` | string | Data do último envio ao CNPq |
| `Unidade` | `Unidade` | string | Campus/unidade IFBA (ex: "IFBA - Salvador") |
| `Nome Base` | `NomeBase` | string | Nome do grupo |
| `Líder` | `Lder` / `Lider` | string | Nome do líder |
| `Vice-Líder` | `Vice-Lder` / `ViceLider` | string | Nome do vice-líder |
| `Contato` | `Contato` | string | E-mail de contato |
| `Técnicos` | `Tcnicos` / `Tecnicos` | string numérica | Nº de técnicos |
| `Pesquisadores (Nomes)` | `PesquisadoresNomes` | string | Nomes separados por `;` |
| `Linhas de Pesquisa` | `LinhasdePesquisa` | string | Linhas de pesquisa |
| `Instituições Parceiras` | `InstituicoesParceiras` | string | Instituições parceiras |

#### Período e volume
- **Registros**: ~197 grupos (incluindo ativos, excluídos e em preenchimento)
- **Período**: Grupos formados desde a década de 1990 até o presente
- **Filtro IFBA**: O scraper externo coleta apenas grupos do IFBA. O build não re-filtra.

#### Frequência de atualização
Sob demanda, após execução do scraper DGP.

---

### 2.3 SUAP — Pós-Graduação

#### Identificador
`scraper-SUAPPos`

#### Descrição
Registros de alunos de pós-graduação (stricto e lato sensu) do IFBA, extraídos do SUAP, incluindo informações de matrícula, curso, campus, situação acadêmica e período letivo.

#### Origem
- **Sistema de origem**: SUAP/IFBA, módulo acadêmico
- **Forma de extração**: Exportação CSV pelo setor de Pós-Graduação
- **Responsável**: PRPGI/IFBA — Coordenação de Pós-Graduação

#### Formato e estrutura
- **Formato**: `.csv` (UTF-8 com BOM), nome com timestamp (`alunos_pos_YYYYMMDD_HHMMSS.csv`)
- **Linha de cabeçalho** normalizada pelo build (remoção de acentos, trim, lowercase)

#### Colunas do CSV

| Coluna | Tipo | Descrição | Tratamento |
|---|---|---|---|
| `nome` | string | Nome do aluno | Preservado |
| `matricula` | string | Matrícula | Chave de desduplicação (`dedupKey`) |
| `curso` | string | Nome do programa | Simplificado (remove prefixo numérico, campus entre parênteses) |
| `campus` | string | Nome ou código do campus | Normalizado via mapa `campusMap` com ~20 entradas |
| `polo` | string | Polo (se houver) | Preservado |
| `situacao` | string | Situação acadêmica | Normalizada (remove sufixos malformados) |
| `e-mail_academico` | string | E-mail institucional | Preservado |
| `e-mail_pessoal` | string | E-mail pessoal | Preservado |
| `ano/periodo_letivo` | string | Período no formato `YYYY.S` | Extraído `ano` e `semestre` |
| `modalidade` | string | Presencial, EaD, etc. | Usado para inferir `categoria` |

#### Categorias inferidas
A `categoria` (Mestrado/Doutorado/Especialização/Outro) é determinada por:
1. Campo `modalidade` (normalizado para UTF-8: `Especialização`)
2. Fallback: análise do nome do `curso` (normalizado NFD — ignora acentos)
3. Se indefinido: `Outro`

#### Seleção de snapshot (importante)
As exportações do SUAP são **snapshots cumulativos**: cada novo CSV contém TODOS os
alunos (o de jul/2026 contém os de abr/2026). O build usa **apenas o arquivo mais
recente** (`selectPosGraduacaoCsvFiles`, timestamp do nome `alunos_pos_YYYYMMDD_HHMMSS.csv`;
fallback para mtime). Concatenar vários snapshots sem deduplicar por matrícula
inflaria os totais em ~3x (bug corrigido em ago/2026: 7.477 → 2.521 registros).

#### Período e volume
- **Registros**: ~2.5 mil (snapshot mais recente)
- **Período**: Conforme `ano/periodo_letivo` (2016.1–2026.1 no snapshot atual)

#### Frequência de atualização
Manual, conforme exportação do SUAP.

---

### 2.4 Planilha Compartilhada PRPGI — Iniciação Científica e Tecnológica

#### Identificador
`ic`

#### Descrição
Projetos de Iniciação Científica e Tecnológica (ICT) do IFBA submetidos no âmbito do Programa de Monitoramento de Indicadores da PRPGI — Plataforma Nilo Peçanha (PNP/SETEC/MEC). Contém dados projeto-a-projeto por ciclo anual.

#### Origem
- **Sistema de origem**: Google Sheets (planilha compartilhada mantida pela Coordenação de IC)
- **Forma de extração**: Download manual no formato `.xlsx` pela Coordenação de IC/PRPGI
- **Responsável**: PRPGI/IFBA — Coordenação de Iniciação Científica

#### Formato e estrutura
- **Formato**: `.xlsx` (Excel)
- **Arquivo**: `Projetos de Iniciação Científica _ Tecnológica - PNP-SETEC_MEC.xlsx`
- **9 sheets** no total:

| Sheet | Conteúdo |
|---|---|
| `DadosGlerais-ICT-IFBA` | Sumário geral: total de projetos por ano e por modalidade |
| `Ciclo 2025-2026` | Projetos do ciclo 2025-2026 |
| `Ciclo 2024-2025` | Projetos do ciclo 2024-2025 |
| `Ciclo 2023-2024` | Projetos do ciclo 2023-2024 |
| `Ciclo 2022-2023` | Projetos do ciclo 2022-2023 |
| `Ciclo 2021-2022` | Projetos do ciclo 2021-2022 |
| `Ciclo 2020-2021` | Projetos do ciclo 2020-2021 |
| `Ciclo 2019-2020` | Projetos do ciclo 2019-2020 |

#### Estrutura das sheets `Ciclo`

| Índice | Coluna | Descrição | Exemplo |
|---|---|---|---|
| 0 | Nº | Número sequencial | `1` |
| 1 | Orientador | Nome do orientador | `Marcelo Santana Silva` |
| 2 | Bolsista | Nome do bolsista | `Amanda Maria de Souza` |
| 3 | Curso do bolsista | Curso do bolsista | `Engenharia de Alimentos` |
| 4 | Campus | Código ou nome do campus | `SSA`, `Salvador` |
| 5 | Título | Título do projeto | `Inovações Sociais...` |
| 6 | Área do conhecimento | Grande área CNPq | `Engenharias` |
| 7 | Modalidade | Programa de IC | `PIBIC`, `PIBITI`, `PIBIC-EM` |
| 8 | Titulação do orientador | Doutorado, Mestrado | `Doutorado` |
| 9 | Progresso | Status do projeto | `Em andamento`, `Concluído` |
| 10 | Fomento | Agência/Programa de fomento | `FAPESB`, `CNPq` |

#### Modalidades
- `PIBIC` — Programa Institucional de Bolsas de Iniciação Científica
- `PIBIC-Af` — PIBIC Ações Afirmativas
- `PIBIC-EM` — PIBIC Ensino Médio
- `PIBITI` — Programa Institucional de Bolsas de Iniciação em Desenvolvimento Tecnológico e Inovação
- `PIBITI-EM` — PIBITI Ensino Médio
- `PIBIC-EM-AF` — PIBIC Ensino Médio Ações Afirmativas

#### Período e volume
- **Registros**: ~1.333 projetos individuais
- **Período**: Ciclos 2019–2020 a 2025–2026
- **Distribuição**: ~200 a ~900 projetos por ciclo (crescente ao longo dos anos)

#### Frequência de atualização
Anual, conforme preenchimento dos ciclos na planilha compartilhada.

---

### 2.5 INPI (pePI) — Propriedade Intelectual

#### Origem

Robô `scraper-INPI` (repositório irmão), que consulta a Busca de Propriedade
Intelectual do INPI em `busca.inpi.gov.br/pePI`. A sessão é anônima: o pePI não
pede credencial para consultar.

**Esta fonte substituiu o Lattes na aba Inovação em agosto de 2026.** Antes, o
array `inovacao` vinha da planilha `Registros e Patentes` do SUAP, ou seja, do
que cada pesquisador declarava no próprio currículo. Eram 988 registros contra
os ~160 que o INPI conhece no CNPJ da instituição: a maioria era propriedade
intelectual de outra titularidade — do próprio pesquisador, de um vínculo
anterior, ou de depósito que não se formalizou.

A busca roda com dois CNPJs, porque as patentes antigas continuam registradas no
nome anterior da instituição:

| CNPJ | Instituição |
|---|---|
| 10.764.307/0001-12 | IFBA |
| 13.941.232/0001-96 | CEFET-BA (nome anterior) |

#### As quatro bases

| Base | Servlet e parâmetros | Volume (ago/2026) |
|---|---|---|
| Patentes | `PatenteServletController`, `Action=SearchAvancado`, `CpfCnpjDepositante` | 20 IFBA + 1 CEFET-BA |
| Programas de computador | `ProgramaServletController`, `Action=SearchBasico`, `Coluna=CpfCnpjTitularPrograma`, `FormaPesquisa=expExata` | 130 IFBA |
| Desenhos industriais | `DesenhoServletController`, `Action=SearchAvancado`, `CpfCnpjDepositante` **e** `Action=SearchBasico`, `Coluna=NomeDepositante` | 5 (união das duas buscas) |
| Marcas | `MarcasServletController`, fluxo de duas etapas (abaixo) | 1 IFBA + 3 CEFET-BA |

#### Particularidades do pePI

Cada uma custou uma sessão de depuração; todas estão tratadas em
`scraper-INPI/src/`.

- **Codificação ISO-8859-1.** Decodificar como UTF-8 quebra os acentos dos
  nomes, e é por nome que o campus do autor é resolvido.
- **Erro com HTTP 200.** O pePI devolve `Erro: java.lang.NullPointerException` e
  `Erro: java.sql.SQLException` no corpo, com status 200. `src/sessao.js` lê o
  corpo, não o status.
- **Formulário completo obrigatório.** As buscas avançadas de patente e de
  desenho lançam `NullPointerException` se qualquer campo faltar. Os 17 campos
  da patente e os 13 do desenho vão juntos, vazios inclusive.
- **Uma sessão por base.** O pePI guarda a busca corrente na sessão, e o estado
  vaza: a segunda etapa da busca de marcas devolve 403 numa sessão que já serviu
  outra base, e uma sequência longa de páginas de detalhe fez a busca seguinte
  devolver zero. Zero é indistinguível de "não há registro", então a coleta saía
  pela metade sem erro. Daí também os pisos de `MINIMO_ESPERADO`.
- **Marcas: busca por titular fora do menu.** `Pesquisa_titular.jsp` só aparece
  no menu de dentro da página de detalhe de uma marca. A etapa 1
  (`Action=searchNome`, `tipoPesquisa=BY_CNPJ_NOME`) devolve a lista de
  *titulares*; a etapa 2 (`Action=searchMarca&pos=N`) devolve as marcas daquele
  titular.
- **Desenhos: duas buscas.** O formulário avançado aceita CNPJ, mas o INPI
  deixou esse campo vazio nos registros antigos — por CNPJ vem 1, por nome vêm
  5. As duas buscas se unem pelo número do pedido, e a busca por nome exige a
  guarda IFBA ≠ IFBaiano sobre o titular da página de detalhe (§6.2).
- **Código INID nos rótulos.** A ficha de patente escreve `(73) Nome do
  Titular:` e a de programa escreve `Nome do Titular:`. `src/parse.js` remove o
  número, senão nenhum autor de patente é encontrado.
- **Página de detalhe é a única fonte dos autores.** A lista de resultados traz
  só número, data e título. São ~160 páginas de detalhe por coleta, uma a cada
  1,5 s.

#### Bases que o INPI não permite consultar

| Base | Motivo |
|---|---|
| Topografia de circuitos integrados | O próprio INPI responde: "no momento não há Consulta para a base de Topografia de Circuitos Integrados" |
| Contratos de transferência de tecnologia | `ContratoSearchBasico.jsp` exige login com usuário e senha; não tem acesso anônimo |

Nenhuma das duas tinha registro no dashboard, então nada se perdeu.

#### Atribuição de campus

O INPI dá o titular (a instituição) e os autores (pessoas), **nunca o campus**.
`scripts/refresh-inovacao.js` resolve numa cascata de três níveis:

| Nível | Como | Resultado |
|---|---|---|
| 1 | O número INPI casa com o registro declarado no Lattes | Herda `campus` e `Servidor` |
| 2 | O nome do autor casa com a base do SUAP | Resolve o SIAPE e o campus |
| 3 | Nenhum dos dois | O campo `campus` não é emitido |

No nível 3 o registro conta nos KPIs e some do mapa e da tabela por campus. Um
KPI próprio, "Sem Campus Atribuído", torna a diferença visível. **Não invente um
código como `NA`**: `CODIGOS_VALIDOS` em `scripts/validate-data.js` o recusaria.

Um registro com vários autores vira **um registro por autor**, o mesmo fan-out
de coautoria de `build.js`. É o que mantém o KPI "p/ Servidor" correto.

#### `inpi-campus.json` — por que existe

Os níveis 1 e 2 dependem de `dados/scraper-SUAPCNPQ/`, que é gitignored e não
existe no runner do GitHub Actions. Pior: **o nível 1 se apaga sozinho**, porque
a primeira execução substitui exatamente os registros do Lattes que ele
consultava.

Por isso o resultado da cascata é gravado em `inpi-campus.json`, versionado.
Quando `dados/` está por perto, `refresh-inovacao.js` resolve a cascata e
atualiza o mapa; quando não está, ele lê o mapa. O CI cai sempre no segundo
caso. O arquivo guarda apenas número INPI → SIAPE → campus, que o `data.json`
já publica.

#### LGPD

O CSV que o robô produz traz `titular` e `autores` por extenso. **Ele não é
versionado**, e os nomes servem só para resolver o SIAPE dentro do
`refresh-inovacao.js`. `conferirLGPD()` recusa qualquer valor com espaço ou
letra acentuada nos campos de `inovacao` — a assinatura de um nome próprio.

#### Frequência de atualização

Mensal, pelo workflow `.github/workflows/refresh-inovacao.yml` (dia 1, 07:00
UTC), ou à mão por `workflow_dispatch`. O robô roda igual na máquina local, e o
CSV vale o mesmo nos dois caminhos.

**O workflow depende do segredo `SCRAPER_INPI_TOKEN`.** O `scraper-INPI` é um
repositório privado e este é público, então o `GITHUB_TOKEN` padrão não alcança
o checkout. É preciso um Personal Access Token com leitura em
`prof-davifr/scraper-INPI`, guardado nos segredos deste repositório. Sem ele o
passo de checkout falha com "Repository not found" — e é só isso que quebra: a
coleta local continua valendo.

---

## 3. Pipeline de Build (`scripts/build.js`)

### 3.1 Fluxo Geral

```
                    ┌─────────────────────────┐
                    │     dados/              │
                    │  (arquivos brutos)       │
                    └──────┬──────────────────┘
                           │
               ┌───────────┼───────────┐
               v           v           v
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │ .xlsx    │ │ .csv     │ │ .xlsx IC │
        │(Lattes)  │ │(DGP+Pos)│ │ (ic/)    │
        └────┬─────┘ └────┬─────┘ └────┬─────┘
             │            │            │
             v            v            v
        ┌─────────────────────────────────────┐
        │       scripts/build.js              │
        │  parseCSV / XLSX.readFile           │
        │  SHEET_MAP / campusMap              │
        │  desduplicação / normalização       │
        └────────────────┬────────────────────┘
                         │
                         v
              ┌─────────────────────┐
              │     data.json       │
              │  (dashboard leve)   │
              │  ~31 MB             │
              └─────────────────────┘
                         │
                         v
              ┌─────────────────────┐
              │  data-groups.json   │
              │  (relatório DGP)    │
              │  ~63 MB             │
              └─────────────────────┘
```

### 3.2 Etapas Detalhadas

#### Etapa 1: Escaneamento de Arquivos
- Função `findFiles(dir, extension)` — recursão em subdiretórios
- Ignora arquivos de lock (prefixo `.~lock`)
- Separa XLSX (excluindo diretório `ic/`) e CSV

#### Etapa 2: Seleção do CSV DGP
- Função `selectDgpGroupsCsvFiles`
- Critérios: nome começa com `coletor`, não contém `_old`
- Entre múltiplos válidos: seleciona o mais recente (por `mtime`)
- Demais CSVs DGP são ignorados no processamento

#### Etapa 3: Processamento XLSX (Lattes)
- Leitura com `XLSX.readFile(filePath)`
- Mapeamento de sheets via `SHEET_MAP` (suporta lowercase e Title Case)
- Para cada linha:
  - Extração de `Ano` para determinar `minYear`/`maxYear`
  - Extração de ID(s) de servidor via regex `/\((\d{7,})\)/g` (multiautoria)
  - Geração de `dedupKey`: título normalizado (NFD + lowercase + sem não-alfanuméricos, 150 chars)
  - Expansão: um registro por servidor (multiautoria)
  - Campos preservados: `Ano`, `Tipo`, `campus`, `dedupKey`, `Servidor`, `Estrato`

#### Etapa 4: Processamento CSV (DGP + Pós)
- Parse com `parseCSV`: trata campos quoted, vírgulas internas, aspas escapadas
- Normalização de cabeçalhos: NFD + lowercase + sem acentos
- **Pós-graduação**: extração de ano/semestre, inferência de categoria, simplificação de curso, normalização de campus, filtro de registros inválidos
- **Grupos DGP**: mapeamento de 11 campos, normalização de `Unidade`

#### Etapa 5: Processamento XLSX (IC)
- Leitura separada do arquivo em `dados/ic/`
- Para cada sheet `Ciclo YYYY-YYYY`:
  - Extração do ano do nome da sheet
  - Leitura `header: 1` (array de arrays), dados da linha 3 em diante
  - Colunas: 0=Nº, 1=Orientador, 2=Bolsista, 3=Curso, 4=Campus, 5=Título, 6=Área, 7=Modalidade, 8=Titulação, 9=Progresso, 10=Fomento
  - Normalização de campus:
    1. Tenta código direto (2-3 letras, ex: `SSA`)
    2. Override de códigos não-padrão (`REI`→`SSA`, `PAF`→`PA`)
    3. Mapeia nome de cidade via `campusMap` (~40 entradas)

#### Etapa 6: Geração de data.json
- Estrutura final com metadados + 8 arrays de dados
- Nulos removidos via `JSON.stringify` com `replacer`

#### Etapa 7: Geração de data-groups.json (separado)
- Re-processamento dos XLSX com extração detalhada de nomes de servidores
- Construção de índices `servidorIdToName` / `servidorNameToId`
- Resolução de nomes de pesquisadores DGP via fuzzy match (NFD + lowercase)
- Vinculação membro do grupo → ID Lattes

### 3.3 Tratamento de Erros

| Situação | Comportamento |
|---|---|
| Arquivo XLSX corrompido | `console.warn` e continua com os demais |
| CSV sem cabeçalho esperado | Linhas mapeadas com campos vazios |
| Sheet sem mapeamento no SHEET_MAP | Ignorada silenciosamente |
| Registro sem `matricula` ou `Ano` | Filtrado (não entra no resultado) |
| Campus não reconhecido (IC) | Registro descartado |
| `fs.statSync` falha | `createdAt`/`modifiedAt` como `null` |

---

## 4. Fluxo de Dados: Fonte → Frontend

### 4.1 Arquitetura de Apresentação

```
data.json (estático, servido pelo GitHub Pages)
       │
       ▼
fetch('data.json') ← Cache API (stale-while-revalidate)
       │
       ▼
STATE.raw.* (8 arrays: bibliografica, tecnica, inovacao,
             concluidas, andamento, grupos, posgraduacao, ic)
       │
       ▼
processData()  ← acionado por mudanças nos filtros
       │
       ▼
STATE.filtered.*
       │
       ├── renderKPIs*()       → HTML em .kpi-grid
       ├── renderCharts*()     → Chart.js em <canvas>
       ├── renderGenericMap()  → Leaflet em .map-container
       └── generateTable*()    → HTML table em .table-container
```

### 4.2 Cache Stale-While-Revalidate
1. Abre Cache API (`caches.open('dashboard-prpgi-v1')`)
2. Se cache hit: exibe dados, dispara fetch assíncrono para validar
3. Se cache miss: fetch normal, armazena no cache
4. Se Cache API indisponível: fallback para fetch direto

### 4.3 Renderização por Aba

| Aba | Dados | KPIs | Gráficos | Mapa |
|---|---|---|---|---|
| Produção Científica | `bibliografica` | Total, artigos, livros | Evolução, Qualis | Geográfico |
| Produção Técnica | `tecnica` | Total, apresentações, cursos | Evolução, tipos | Geográfico |
| Inovação | `inovacao` | Total de registros | Evolução (2), tipos | Geográfico |
| Grupos de Pesquisa | `grupos` | Status, médias | Evolução combinada, áreas | Geográfico |
| Pesquisadores | `grupos` + `bibliografica` + `tecnica` + orientações | Totais, densidade | Evolução, campus, área | Geográfico |
| Orientações | `concluidas` + `andamento` | Total, concluídas, andamento | Evolução (2), nível | Geográfico |
| Pós-Graduação | `posgraduacao` | Por categoria/status | Coortes, risco, campus | — |
| Iniciação Científica | `ic` | Total, modalidades | Evolução, modalidade, área | Geográfico |

---

## 5. Mapeamento de Campus

### 5.1 Tabela de Correspondência

| Código | Cidade | Coordenadas (lat, lon) |
|---|---|---|
| BAR | Barreiras | -12.1528, -44.9900 |
| BRU | Brumado | -14.2045, -41.6663 |
| CAM | Camaçari | -12.6975, -38.3241 |
| CFO | Campo Formoso | -10.5100, -40.3200 |
| EC | Euclides da Cunha | -10.5085, -39.0150 |
| EUN | Eunápolis | -16.3720, -39.5815 |
| FS | Feira de Santana | -12.2666, -38.9666 |
| ILH | Ilhéus | -14.7889, -39.0494 |
| IRE | Irecê | -11.3040, -41.8557 |
| JAC | Jacobina | -11.1818, -40.5181 |
| JAG | Jaguaquara | -13.5283, -39.9713 |
| JEQ | Jequié | -13.8580, -40.0830 |
| JUA | Juazeiro | -9.4124, -40.5055 |
| LF | Lauro de Freitas | -12.8967, -38.3286 |
| PA | Paulo Afonso | -9.4005, -38.2163 |
| PIS | Polo de Inovação Salvador | -12.9714, -38.5014 |
| PS | Porto Seguro | -16.4442, -39.0644 |
| SAJ | Santo Antônio de Jesus | -12.9680, -39.2618 |
| SAM | Santo Amaro | -12.5445, -38.7135 |
| SEA | Seabra | -12.4187, -41.7702 |
| SF | Simões Filho | -12.7844, -38.4025 |
| SSA | Salvador | -12.9714, -38.5014 |
| UBA | Ubaitaba | -14.2255, -39.3245 |
| VAL | Valença | -13.3700, -39.0730 |
| VC | Vitória da Conquista | -14.8661, -40.8394 |

### 5.2 Mapas de Normalização por Fonte

#### Para IC (nomes de cidade → código)
Fonte `scripts/build.js` — usado nas sheets de ciclo do IC e na pós-graduação. Suporta variantes com e sem acentos, ortografia alternativa.

#### Para DGP (Unidade → código)
Fonte `script.js` — função `filterGroupsCampus`: a string `Unidade` (ex: `"IFBA - Salvador"`) é comparada via `includes()` com os nomes de cidade mapeados em `CAMPUS_TO_CITY`.

#### Overrides de Códigos IC
| Código bruto | Mapeado para | Motivo |
|---|---|---|
| `REI` | `SSA` | Reitoria (em Salvador) |
| `PAF` | `PA` | Variação de Paulo Afonso |

### 5.3 Discrepância Conhecida
O arquivo `tests/helpers/browserEnv.js` mapeia `UBA` para `"UBATÃ"` enquanto `src/script.js` usa `"UBAITABA"`. A divergência deve ser reconciliada.

---

## 6. Regras de Negócio

### 6.1 Desduplicação

| Fonte | Chave | Método |
|---|---|---|
| Lattes (todas as abas) | `dedupKey` | Título normalizado: NFD + lowercase + remove acentos + remove não-alfanuméricos + substring(0,150) |
| Pós-graduação | `matricula` | Matrícula do aluno |
| Grupos DGP | — | Sem desduplicação (cada grupo é único) |
| IC | — | Sem desduplicação (cada projeto é único) |

**Comportamento**: toggle "Desduplicar" (ativo por padrão) no frontend. Quando ativo, registros com mesma `dedupKey` são contados apenas uma vez.

**Impacto da multiautoria**: Uma produção com 3 autores gera 3 registros com o mesmo `dedupKey`. Com desduplicação ativa, conta como 1 produção.

### 6.2 Filtro IFBA vs IFBaiano

IMPORTANTE: IFBA e IFBaiano são instituições distintas. O dashboard cobre exclusivamente o **IFBA** (Instituto Federal da Bahia). Qualquer integração de nova fonte DEVE verificar se o campo `Instituição` contém `"IFBA"`.

### 6.3 Métricas Relativas (p/ Servidor)

Toggle "p/ Servidor" que divide as métricas pelo número de pesquisadores ativos únicos:
- **Divisor**: total de IDs distintos de `Servidor` (Lattes) no período/campus selecionado
- **Aplicado em**: KPIs, tabelas, valores dos mapas
- **Fórmula**: `valor / totalPesquisadoresAtivos`
- **No mapa**: divisão por campus (pesquisadores ativos *daquele campus*)

### 6.4 Coortes Maduras (Pós-Graduação)

> **Onde estas regras valem (set/2026).** As seções 6.4 e 6.5 descrevem a
> metodologia de ciclos da PNP, que saiu do painel principal em 02/09/2026 e
> passou a viver na página **Pós-Graduação Validação**
> (`pos-validacao-f85b5515.html`, não listada, com senha). O código congelado
> está em `src/pos-validacao.js`. A aba Pós-Graduação do painel principal está
> em remodelagem, com indicadores mais simples. Ver `CLAUDE.md`, seção "Second
> page: Pós-Graduação Validação".

Regra que define se uma coorte (período de ingresso) já atingiu maturidade para avaliação de desfecho.
A referência "hoje" é o **período (ano+semestre) mais recente presente nos dados** (ex.: 2026.1).
A comparação é feita em **meses**, com granularidade de semestre (`ano*12 + (semestre-1)*6`):

| Categoria | Prazo esperado | Coorte madura se |
|---|---|---|
| Mestrado | 24 meses | `referência − ingresso >= 24 meses` |
| Doutorado | 48 meses | `referência − ingresso >= 48 meses` |
| Especialização | **18 meses** (Resolução CNE/CES nº 1/2018 — prazo padrão lato sensu) | `referência − ingresso >= 18 meses` |
| Outros | 24 meses | `referência − ingresso >= 24 meses` |

Observações:
- Antes de ago/2026 a maturidade era calculada por ano inteiro (`ano_atual - ano`),
  o que não distinguia 18 meses de 24 meses.
- Registro sem `semestre` assume semestre 1.

Ativo por padrão. Quando desativado, todas as coortes são exibidas.

### 6.5 Classificação de Situação (Pós-Graduação)

| Situação original | Bucket normalizado |
|---|---|
| Matriculado (coorte madura) | Pendência Ativa |
| Matriculado (coorte não madura) | Em Fluxo Regular |
| Concluído | Concluído |
| Cancelado, Desligado, Evasão, Abandono, Falecido | Evasão/Desligamento |
| Demais | Outros |

### 6.6 Agregação de Categorias Pequenas

Nos gráficos de evolução e pizza, categorias com <2% do total são agregadas em "Outras" (ou fundidas com categoria "Outras" já existente). Aplicado a:
- Produção Científica (tipos bibliográficos)
- Produção Técnica (tipos)
- Inovação (tipos)
- IC (áreas do conhecimento)

### 6.7 Definição de Pesquisador Ativo

Servidor do IFBA com ao menos um registro em qualquer das bases Lattes (bibliográfica, técnica, orientações concluídas ou em andamento) dentro do período/campus selecionado. Identificado pelo código numérico de servidor (7+ dígitos).

---

## 7. Estrutura dos Arquivos de Saída

### 7.1 `data.json` (~31 MB)

```json
{
  "meta": {
    "files": ["BAR.xlsx", "BRU.xlsx", ...],
    "sourceFiles": {
      "scraper-SUAPCNPQ": ["BAR.xlsx", ...],
      "scraper-DGP": ["coletor_dgp_ifba.csv"],
      "scraper-SUAPPos": ["alunos_pos_20260415_165049.csv"],
      "ic": ["Projetos de Iniciação Científica _ Tecnológica - PNP-SETEC_MEC.xlsx"]
    },
    "sourceDates": {
      "scraper-SUAPCNPQ": { "label": "SUAP CNPq (Lattes)", "fileCount": 25, "createdAt": "...", "modifiedAt": "..." },
      ...
    },
    "campuses": ["BAR", "BRU", ..., "VC"],
    "minYear": 2000,
    "maxYear": 2026,
    "generatedAt": "2026-07-06T12:55:56.303Z"
  },
  "bibliografica": [{ "Ano": "...", "Tipo": "...", "campus": "...", "Servidor": "...", "dedupKey": "...", "Estrato": "..." }],
  "tecnica": [...],
  "inovacao": [...],
  "concluidas": [...],
  "andamento": [...],
  "grupos": [{ "Situacao": "...", "AnoFormacao": "...", "Pesquisadores": "...", "Estudantes": "...", "Area": "...", "Unidade": "..." }],
  "posgraduacao": [{ "nome": "...", "matricula": "...", "curso": "...", "campus": "...", "ano": N, "semestre": N, "situacao": "...", "categoria": "..." }],
  "ic": [{ "ano": N, "campus": "...", "orientador": "...", "bolsista": "...", "modalidade": "...", "area_conhecimento": "...", "progresso": "...", "fomento": "..." }]
}
```

### 7.2 `data-groups.json` (~63 MB)

```json
{
  "grupos": [{ /* dados completos do grupo + membros resolvidos */ }],
  "producoes": {
    "bibliografica": [{ /* dados completos com nome do servidor */ }],
    "tecnica": [...],
    "inovacao": [...],
    "concluidas": [...],
    "andamento": [...]
  },
  "meta": { "generatedAt": "...", "sourceDates": {...} }
}
```

Destinado ao relatório de grupos de pesquisa (não ao dashboard principal).

---

## 8. Glossário

| Termo | Definição |
|---|---|
| **Coorte** | Conjunto de estudantes de um mesmo ano de ingresso em um programa de pós-graduação |
| **Coorte Madura** | Coorte cujo prazo esperado de conclusão já foi transcorrido conforme a modalidade |
| **Pesquisador Ativo** | Servidor com ao menos uma produção registrada no período/campus analisado |
| **Em Fluxo Regular** | Estudante matriculado dentro do prazo esperado da coorte |
| **Pendência Ativa** | Estudante matriculado além do prazo esperado da coorte |
| **Evasão/Desligamento** | Consolida: Cancelado, Desligado, Evasão, Abandono, Falecido |
| **Desduplicação** | Técnica que evita que uma mesma produção seja contada múltiplas vezes (por coautoria) |
| **DedupKey** | Chave normalizada (NFD + lowercase + sem não-alfanuméricos, 150 chars) usada para identificar produções duplicadas |
| **Multiautoria** | Uma produção acadêmica com múltiplos autores (servidores IFBA) |
| **SUAP** | Sistema Unificado de Administração Pública do IFBA |
| **DGP** | Diretório de Grupos de Pesquisa do CNPq |
| **PNP** | Plataforma Nilo Peçanha (MEC/SETEC) |
| **PIBIC** | Programa Institucional de Bolsas de Iniciação Científica |
| **PIBITI** | Programa Institucional de Bolsas de Iniciação em Desenvolvimento Tecnológico e Inovação |
| **Qualis** | Sistema CAPES de classificação de periódicos científicos (A1, A2, B1, ..., C) |

---

## 9. Manutenção e Governança

### 9.1 Onde Vivem os Mapeamentos

| Mapeamento | Arquivo | Função/Variável |
|---|---|---|
| Código de campus → Cidade | `src/script.js` | `CAMPUS_TO_CITY` |
| Cidade → Coordenadas | `src/script.js` | `IFBA_COORDS` |
| Cidade → Código (IC) | `scripts/build.js` | `campusMap` |
| Nome de sheet → Chave interna | `scripts/build.js` | `SHEET_MAP` |
| Rótulo de fonte → Nome legível | `scripts/build.js` | `SOURCE_LABELS` |

### 9.2 Checklist para Adicionar Nova Fonte

1. Criar subdiretório em `dados/` com o nome do scraper
2. Adicionar entrada em `SOURCE_LABELS` no `scripts/build.js`
3. Implementar processamento no `main()` do `scripts/build.js`
4. Adicionar array no `result` e em `STATE.raw` no frontend
5. Verificar filtro IFBA (não IFBaiano)
6. Adicionar aba no `index.html` (botão + seção de conteúdo)
7. Adicionar funções de renderização (KPIs, charts, mapa, tabela)
8. Verificar mapeamento de campus
9. Atualizar este documento (proveniência)
10. Executar `node scripts/build.js` e `npm test`
11. Atualizar `AGENTS.md`

### 9.3 Testes Associados

| Arquivo | O que cobre |
|---|---|
| `tests/build.test.js` | `findFiles`, `parseCSV`, `getSourceKey`, `registerSourceFile`, `SHEET_MAP`, `SOURCE_LABELS`, seleção DGP |
| `tests/script.utils.test.js` | Utilitários do frontend |
| `tests/posgraduacao.test.js` | Lógica de pós-graduação |

Execute `npm test` antes de qualquer commit que altere o pipeline ou o frontend.

### 9.4 Arquivos Legacy

O diretório `dados/old/` contém 25 arquivos `.xls` (formato Excel legado, não `.xlsx`) nomeados `{CÓDIGO}-2000-2026.xls`. Foram substituídos pelos `.xlsx` em `scraper-SUAPCNPQ/` e **não são processados** pelo build atual.

---

## 10. Referências

| Recurso | Link/Observação |
|---|---|
| Repositório do projeto | https://github.com/prof-davifr/dashboard-prpgi |
| Dashboard em produção | https://prof-davifr.github.io/dashboard-prpgi/ |
| Scraper DGP (monorepo) | `PRPGI/scraper-DGP/` |
| Scraper SUAP CNPq | `PRPGI/scraper-SUAPCNPQ/` |
| Diretório de Grupos CNPq | https://dgp.cnpq.br |
| Plataforma Nilo Peçanha | https://plataformanilopecanha.mec.gov.br |
| Documentação técnica | `AGENTS.md` na raiz do projeto |
| Guia de desenvolvimento | `docs/` |
