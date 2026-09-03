# TODO — Dashboard PRPGI

Painel de Dados da PRPGI — indicadores de pesquisa, pós-graduação e inovação do IFBA.
Frontend estático (Chart.js + Leaflet + SheetJS) + pipeline ETL em `scripts/build.js` → `data.json`, deploy via GitHub Pages.

---

## 🟣 Remodelagem da aba Pós-Graduação (set/2026)

### Etapa 1 — congelamento (feito)
- [x] **A metodologia de ciclos da PNP saiu do painel principal e virou página própria.**
      `pos-validacao-f85b5515.html` ("Pós-Graduação Validação"), não listada,
      com `robots: noindex, nofollow` e porta de senha no cliente. Arquivos:
      `src/pos-validacao.js` (cópia congelada de `src/posgraduacao.js`),
      `src/pos-validacao-init.js`, `src/pos-validacao-porta.js`,
      `tests/pos-validacao.test.js`, `e2e/pos-validacao.spec.js`.
      Etiqueta `pos-pnp-congelado-2026-09-02` guarda código e `data.json` do
      estado anterior. A senha não é controle de acesso: o GitHub Pages é
      estático e o `data.json` é público.
- [x] **`parseCSV` deixou de perder registros com quebra de linha dentro das
      aspas.** O parser fazia `split('\n')` antes de olhar as aspas; um aluno do
      mestrado com o e-mail acadêmico partido em duas linhas virava dois
      registros defeituosos, ambos descartados. Novo `splitCsvRecords()` varre o
      texto uma vez só. Dois testes de regressão em `tests/build.test.js`.
- [x] **Conferência da coleta do SUAP (02/09/2026).** Mestrado 1813 → 1840 (+27,
      mesmos 7 programas), Especialização 2766 (inalterada), Doutorado 163
      (inalterado). Nenhum programa entrou ou saiu. Confirma que só a
      Especialização sofre perda.
- [x] **`.env` dos três robôs com credencial do SUAP em `600`**
      (`scraper-prpgi`, `scraper-SUAPPos`, `scraper-SUAPCNPQ`).

### Etapa 2 — remodelagem (feita)
- [x] **Aba Pós-Graduação remodelada.** Saíram as três sub-abas e os doze
      gráficos da metodologia PNP; entraram seis KPIs (Alunos, Matriculados,
      Concluintes, Evadidos, Cursos, Campi), cinco gráficos (alunos por campus,
      cursos por campus, situação, programas com mais alunos, ingressos por
      ano), mapa e tabela campus/ano com exportação. Período e campus passaram a
      vir da barra global; ficaram três seletores na aba (curso, categoria,
      situação). `src/posgraduacao.js` reescrito; a versão antiga segue em
      `src/pos-validacao.js`.
      **Para desfazer: `git revert <SHA_ETAPA_2>`.**
- [x] **As dezesseis situações do SUAP entram em cinco grupos**
      (`POSGRAD_SITUACAO_BUCKET`): Matriculado; Concluinte (Concluído,
      Formado); Aperfeiçoado; Evadido (Cancelado, Evasão, Desligado, Abandono,
      Falecido, Cancelamento Compulsório); Outros. Aperfeiçoado tem grupo
      próprio: o aluno cumpriu os créditos sem obter o título de especialista,
      e somá-lo a qualquer um dos outros dois distorce ambos.
- [x] **Filtro Lato Sensu removido dos dois robôs.** Ele descartava 2193 alunos
      de 45 cursos que são especialização de verdade, e sumia com 13 campi da
      aba. Vivia em `scraper-SUAPPos/src/scraper.py` e em
      `scraper-prpgi/src/scrapers/pos.py`; os dois foram corrigidos na mesma
      sessão, senão o robô consolidado desfaria a correção do outro.
- [x] **`PSG` → `PS` em `CAMPUS_CODE_FIX`.** O SUAP trocou o código de Porto
      Seguro entre a coleta de agosto e a de setembro de 2026. `CODIGOS_VALIDOS`
      não conhece `PSG` e a validação é bloqueante, então o build inteiro
      parava.

---

## 🟢 Concluído

### Fundação e Pipeline ETL
- [x] `scripts/build.js` unifica `.xlsx`/`.xls`/`.csv` de `dados/` em `data.json` (SheetJS)
- [x] Deduplicação por campus: prefere `.xlsx` do scraper, cai para `.xls` de `old/` se vazio
- [x] Normalização de códigos de campus (`CAMPUS_CODE_FIX`: VDC→VC, FSA→FS, PAF→PA)
- [x] Guarda `Instituição === IFBA` no pipeline DGP (IFBA ≠ IFBaiano)
- [x] `data-groups.json` (detalhado, para o relatório de grupos)
- [x] Fallback `old/` restaura dados de campi com scraper vazio

### Frontend
- [x] 8 abas: Produção Científica, Técnica, Inovação, Grupos, Pesquisadores, Orientações, Pós-Graduação, IC
- [x] KPIs, gráficos Chart.js, mapas Leaflet georreferenciados, tabelas detalhadas
- [x] Exportação para Excel por aba
- [x] Filtro de período + filtro de campus + filtros específicos de pós-graduação (categoria/status/curso/coorte madura)
- [x] Métricas relativas (por servidor ativo)
- [x] Cache-first via Cache API com fallback para fetch
- [x] Modal "Sobre os dados" com proveniência das fontes
- [x] Responsivo (desktop/tablet/mobile)

### Correções (ago/2026)
- [x] **Pós-graduação: apenas o snapshot SUAP mais recente** — as exportações `alunos_pos_*.csv` são cumulativas (abr ⊆ jul/11 ⊆ jul/21) e o build concatenava as três sem deduplicar por matrícula, inflando os totais ~3x (7.477 registros → 2.521; Ativos Hoje 3.352 → 1.141; VC 213 → 71). Novo `selectPosGraduacaoCsvFiles()` fica com o CSV de timestamp mais recente no nome (fallback mtime)
- [x] **Especialização: prazo de 18 meses (lato sensu)** — maturidade passou de ano inteiro para **meses com granularidade de semestre** (`ano*12 + (semestre-1)*6`, referência = período mais recente nos dados). Especialização usa 18 meses (Resolução CNE/CES nº 1/2018); Mestrado 24; Doutorado 48. Com ref = 2026.1 o resultado coincide com a regra antiga, mas diverge a partir de 2026.2 (2025.1 de especialização ficará madura)
- [x] **Categoria `Especialização` em UTF-8** — o build emitia `Especializao` (ASCII), que não casava com o filtro da UI nem com os mapas de cor/duração do frontend (filtro por Especialização não retornava nada); modalidade normalizada e inferência por nome de curso agora ignora acentos (NFD)
- [x] **Grupos de pesquisa sem campus** — `mapUnidadeToCampus` normaliza acentos nos dois lados da comparação (antes: entrada normalizada × valores acentuados → campi como VC/EUN/ILH caiam em SSA)
- [x] **Mapa de grupos invisível** — `renderGenericMap` resolve `Unidade` DGP ("IFBA - Campus X") → código → cidade canônica antes do `lookupCoords` (antes: 154/197 grupos sem marcador)
- [x] `renderTableGrupos` usa `mapUnidadeToCampus` em vez do loop "última correspondência ganha"
- [x] `IFBA_COORDS`: chave canônica `UBAITABA` (era typo `UBABAITABA`)
- [x] `tests/helpers/browserEnv.js` sincronizado com `src/script.js` (faltavam LF, PIS e coordenadas)
- [x] +9 testes de regressão (Unidade DGP → campus → coordenadas)

### Apresentação
- [x] `docs/apresentacao.html` (Reveal.js) renomeada para "Painel de Dados da PRPGI"
- [x] Logo oficial IFBA (marca vertical 2015, versão branca) na capa — `docs/assets/ifba-logo-branco.svg`

### Testes
- [x] Jest: 276 testes em 6 suítes (build, campus-filter, posgraduacao, script.utils, comparar-pi, acessibilidade)
- [x] Testes VM-based sem browser/jsdom (`tests/helpers/browserEnv.js`)
- [x] Cobertura E2E de filtro de campus contra `data.json` real (26 testes)
- [x] **Playwright E2E (smoke, navegador real)** — `e2e/dashboard.smoke.spec.js` com 9 testes: carga real do `data.json`, mapas Leaflet com circle markers + modal ampliado, Chart.js em todas as 8 abas, troca de abas, filtros (campus e pós-graduação com subtabs), tabela expande/exporta `.xlsx`, modal de metodologia, zero erros de console. Config: `playwright.config.js` (sobe `live-server:8080`, reusa se já rodando). Comandos: `npm run test:e2e` / `test:e2e:headed` / `test:e2e:report`. Jest ignora `e2e/` via `testPathIgnorePatterns`

### LGPD e fundação técnica (ago/2026)
- [x] **`data.json` público anonimizado** — `posgraduacao` não emite mais `nome`/`matricula`/`email_academico`/`email_pessoal`; `dedupKey` e os campos `orientador`/`bolsista` de IC viram pseudônimos estáveis (`pseudonymize()` em `scripts/build.js`, salt em `.build-salt` gitignored). Nenhuma feature mudou: o frontend só usava esses campos em `new Set(...).size`
- [x] **`data-groups.json` fora do versionamento e do histórico** — continha nomes, contatos e composição de equipes; purgado com `git filter-repo`, `.git` caiu de 210 MB → 34 MB
- [x] **`src/shared.js`** — fonte única de `CAMPUS_TO_CITY`, `IFBA_COORDS`, `normalizeText`, `mapUnidadeToCampus` e `lookupCoords`; eliminadas as 4 cópias divergentes (`script.js`, `browserEnv.js`, `campus-filter.test.js`, `comparar_pi.js`). Validado por teste de mutação: reintroduzir o bug de acentos agora quebra 6 testes
- [x] **`npm run build` / `npm run validate`** — scripts criados e README e instruções do repositório reconciliados
- [x] **CI** — `.github/workflows/ci.yml` roda `npm test`, `npm run validate` (estrutura, códigos de campus, ausência de PII) e guarda de 50 MB por arquivo versionado
- [x] Seção obsoleta de monorepo/subtree removida das instruções do repositório (ele é independente)
- [x] **Nomes de servidores vazavam no `data.json` público** — `extrairVinculos` exigia SIAPE de 7+ dígitos, e as linhas de matrícula curta (5 ou 6 dígitos, servidores antigos) caíam no fallback que copiava o `VinculoQueryset` cru para `Servidor`: 3.385 registros com o nome completo de 70 pessoas. Regex para `\d{5,}` em `build.js` e `comparar_pi.js`. Como efeito colateral, o fan-out de coautoria voltou a valer nessas linhas (+484 bibliográfica, +68 técnica, +14 inovação). A guarda LGPD de `tests/build.test.js` só olhava o nome do campo; agora também valida o valor de `Servidor`

### Fase 3 — dados, performance, estrutura e acessibilidade (ago/2026)
- [x] **`docs/validacao/` não versiona mais dados pessoais** — a planilha da DINOV (com `INVENTORES`, `CONTATO`, `Whatsapp`) foi para `dados/validacao/`; `comparar_pi.js` gera relatório público (sem nomes) e interno (completo, não versionado), abortando se PII escapar para o público. `.md`/`.html`/`.pdf` antigos purgados do histórico
- [x] **Guarda de PII em todo arquivo versionado** — `validate-data.js` varre e-mails e telefones em todo texto sob controle de versão, não só no `data.json`
- [x] **Validação bloqueante no build** — `build.js` valida antes de escrever e sai com erro, em vez de só `console.warn`
- [x] **`data.json` de 32 MB → 21 MB** — `dedupKey` virou hash de 16 hex (`shortHash`); era metade do arquivo. Contagens de chaves distintas idênticas. `inovacao` mantém a chave longa, que o `comparar_pi.js` parseia
- [x] **Regressão corrigida: CSV alheio virava grupo de pesquisa** — qualquer `.csv` sob `dados/` fora do DGP/pós caía no processamento de grupos por eliminação (197 → 494 grupos)
- [x] **`comparar_pi.js` coberto por testes** — funções de casamento exportadas e testadas; bloco ponta a ponta se autodesabilita sem a planilha (caso do CI)
- [x] **`src/script.js` (1.618 linhas) dividido** em `core`/`filters`/`charts`/`maps`/`tables`/`cache`; `loadDashboard()` no helper de teste
- [x] **Acessibilidade** — padrão ARIA de abas com navegação por setas, `aria-label` nos 32 gráficos, diálogos com trap e devolução de foco, `caption`/`scope` nas tabelas, `--accent-text` para contraste AA, `:focus-visible` global, skip link
- [x] Verificação no Chrome via DevTools Protocol contra o `data.json` real: 31 KPIs, 14 gráficos, 151 marcadores, zero erros de console
- [x] **Indicadores de pós-graduação alinhados à Plataforma Nilo Peçanha (PNP)** — termos e fórmulas do Guia de Referência Metodológica PNP 2020: ciclo de matrícula, ciclo encerrado, concluinte, evadido, retido, em curso; Conclusão Ciclo (CCiclo), Evasão Ciclo (EvCiclo), Retenção Ciclo (RCiclo) e Índice de Eficiência Acadêmica (IEA = CCiclo + (CCiclo/(CCiclo+EvCiclo))×RCiclo). Maturidade adota a "retenção crítica" PNP (prazo + 12 meses: Mestrado 24+12, Doutorado 48+12, Especialização 18+12). Novos `calculateIEAciclo()` + 4 testes. Modal de metodologia reescrito (Dicionário/Regras/Referências). Prazos-base: Portaria CAPES nº 76/2010 (24/48) e Resolução CNE/CES nº 1/2018 (360 h)

### Aba Inovação: fonte trocada do Lattes para o INPI (ago/2026)
- [x] **Diagnóstico** — a aba contava 988 registros declarados no Lattes contra os ~160 que o INPI conhece nos CNPJs do IFBA (10764307000112) e do CEFET-BA (13941232000196). A maioria era propriedade intelectual de outra titularidade: do próprio pesquisador, de vínculo anterior, ou depósito não formalizado
- [x] **Robô `scraper-INPI`** (repositório irmão novo) — Node puro com jsdom, sem navegador. Quatro bases: patentes (`CpfCnpjDepositante`), programas de computador (`CpfCnpjTitularPrograma`), desenhos industriais (busca avançada por CNPJ **unida** à básica por nome, porque o INPI deixou o CNPJ vazio nos registros antigos) e marcas (fluxo de duas etapas por `Pesquisa_titular.jsp`, que só aparece no menu de dentro da página de detalhe). 17 testes contra amostras de HTML versionadas
- [x] **Particularidades do pePI tratadas** — ISO-8859-1; erro com HTTP 200 no corpo; formulário completo obrigatório (NullPointerException se faltar campo); código INID nos rótulos da ficha de patente; **uma sessão por base**, porque o estado vaza e a busca seguinte devolvia zero — indistinguível de "não há registro", então a coleta saía pela metade sem erro. Daí os pisos de `MINIMO_ESPERADO`
- [x] **`scripts/refresh-inovacao.js`** — espelha o `refresh-grupos.js` (valida antes de escrever, não reescreve se nada mudou). Cascata de campus em três níveis, porque o INPI nunca informa campus: número INPI → nome do autor → sem atribuição. Fan-out por autor mantém o KPI "p/ Servidor" correto. 22 testes
- [x] **`inpi-campus.json` versionado** — o nível 1 da cascata se apaga sozinho: ele consulta os registros do Lattes que a própria execução substitui. E os níveis 1 e 2 dependem de `dados/`, gitignored e ausente no runner. O mapa é o que sobrevive, e é o que o CI usa
- [x] **`SHEET_MAP` sem `registros e patentes`** — o `npm run build` passa a emitir `inovacao: []`. `SHEET_MAP_DETALHADO` mantém a aba para o `data-groups.json`. Ordem obrigatória documentada no README e nas instruções do repositório
- [x] **Frontend** — KPI "Sem Campus Atribuído"; gráfico "Marcas e Outros" renomeado para "Marcas e Desenhos Industriais" (estava vazio, porque o Lattes não trazia marca); modal de metodologia com a fonte INPI e a explicação da queda dos números
- [x] **Workflow `refresh-inovacao.yml`** — mensal (dia 1, 07:00 UTC) mais `workflow_dispatch`, no padrão do `refresh-grupos.yml`

### Apresentação — ajustes de rótulo e layout (ago/2026)
- [x] **Gráfico "Distribuição Qualis" removido** — quase todo o volume caía em "Sem Estrato". O campo `Estrato` continua no `data.json` e na exportação; só o gráfico saiu (`index.html`, `src/charts.js`). Limite de canvas em `tests/acessibilidade.test.js` foi de 32 → 31 e `e2e/dashboard.smoke.spec.js` não espera mais `chart-cientifica-pie`
- [x] **Os sete mapas em linha inteira** — cada mapa saiu da linha dividida; `.map-container.tall` (480 px) em `src/style.css`. O gráfico que sobra sozinho fica com meia largura, centrado (`.chart-row-solo`): a largura vai na linha, não no card, porque dentro do grid a porcentagem é cíclica com o `1fr` e vira `max-content`. Corrige de quebra o mapa da IC, que tinha 400 px dentro de um container de 350 px com `overflow: hidden`. Verificado no Chrome: 910×480 nas 7 abas
- [x] **Rótulos da aba de IC corrigidos** — "Distribuição por Modalidade" → "Distribuição por Modalidade de Bolsa" (valores: PIBIC, PIBITI, PIBIC-EM…) e "Distribuição por Fomento" → "Distribuição por Fonte de Fomento" (valores: FAPESB, CNPq, IFBA-Reitoria, IFBA-Campus — as duas últimas não são agências)
- [x] **Revisão de português** — "Todas Categorias" → "Todas as Categorias"; dois "Periodo" → "Período"; `aria-label` "Desfecho das Coortes" alinhado ao título "Desfecho dos Ciclos"; "Total Produções"/"Total Ativos" → "Total de …"; "Média Pesquisadores/Grupo" → "Média de Pesquisadores/Grupo"; `indísponivel` → `indisponível` em `src/cache.js`
- [x] **"Desenho Insdustrial" corrigido na origem** — o tipo vinha grafado errado da exportação do Lattes e aparecia nos gráficos da aba de Inovação. `TIPO_FIX` em `scripts/build.js` normaliza no build (5 registros); `scripts/comparar_pi.js` continua aceitando a grafia antiga da planilha DINOV

### Pós-graduação — KPI "Em curso" e teste E2E (ago/2026)
- [x] **KPI "Em curso" ficava sempre em zero** — `regularFlow` contava `Matriculado && !isPosGraduacaoMature(r)` sobre `STATE.filtered.posgraduacao`, que o filtro "Ciclos encerrados" (ligado por padrão) já tinha reduzido só a registros maduros. A condição nunca era verdadeira. "Matriculados (M)" também repetia "Retidos" pelo mesmo motivo (395 = 395). Novo `STATE.filtered.posgraduacaoTodosCiclos` em `src/filters.js` aplica o mesmo recorte sem o filtro de ciclo; os três KPIs de gestão passam a contar sobre ele e a identidade M = Em curso + Retidos vale com o filtro ligado ou desligado (1141 = 746 + 395)
- [x] **Teste E2E de pós-graduação corrigido** — falhava desde o commit ab5e215: exigia o primeiro KPI > 0 para VC, mas o campus só tem matrículas em Especialização 2024.2 e 2026.1, e nenhuma delas fecha pela regra de 18+12 meses. Novo helper `kpiValueByLabel` lê o KPI pelo rótulo, não pela posição, e o teste checa a identidade entre os três KPIs de gestão, o que independe da distribuição dos dados. 9/9 testes E2E passam

### Atualização das bases (21/08/2026)
- [x] **Pós-graduação recoletada** — 2549 alunos (1813 mestrado, 573 especialização, 163 doutorado); `posgraduacao` foi de 2521 → 2548. Duas correções no `scraper-SUAPPos` foram necessárias: um `<ul>` da página do SUAP cobre o botão "Acessar" na janela 1920×1080 e o clique nativo do Selenium era interceptado (`src/login.py` agora cai para clique via JavaScript); e o pacote `xlrd` estava pela metade no ambiente (só o `dist-info`), então o pandas caía no openpyxl, que não lê o `.xls` antigo do SUAP, e as três exportações voltavam vazias
- [x] **Lattes recoletado (2024-2026, 29 campi)** — `core/scraper.py` do `scraper-SUAPCNPQ` esperava a tabela de resultados com o limite de 120 min, três vezes; IFBA e PO não têm produção e nunca renderizam tabela, então a coleta inteira travava. Novo `TABLE_TIMEOUT` (10 min, ajustável por `SUAP_TABLE_TIMEOUT_MIN`) marca o campus como "sem produção" e segue
- [x] **Histórico preservado no merge** — o SUAP trocou as siglas de três campi (FS→FSA, PA→PAF, VC→VDC) e o coletor abriu arquivos novos, sem histórico; além disso 19 campi antes vinham de `dados/old/` (2000-2026). O primeiro build perdeu 1094 registros técnicos. Rodando `merge_production_data` dos arquivos antigos sobre os mestres, nada se perde: bibliográfica +2706, técnica +2072, inovação +43, concluídas +1132, andamento +368
- [x] **Campus Itabuna (ITA)** — o SUAP passou a listar Itabuna como campus. `CAMPUS_TO_CITY` ganhou `ITA: ITABUNA` (26 códigos), as coordenadas já existiam em `IFBA_COORDS` porque o DGP listava Itabuna como unidade, e o filtro de campus do `index.html` ganhou a opção. 8 registros

### Automação e estado das bases (31/08/2026)
- [x] **Refresh automático dos grupos de pesquisa rodando ponta a ponta** — a rodada agendada de 31/08/2026 (run 33391536036) passou em 3m27s: clonou o `scraper-DGP`, varreu o DGP/CNPq, atualizou só o array `grupos` do `data.json`, commitou como `prof-davifr` (d047af9) e disparou o deploy do Pages (run 33391821794). O ciclo semanal não depende de credencial nem de `dados/`
- [x] **Bases conferidas no `data.json` publicado** — bibliográfica 50.700, técnica 70.856, inovação 265 (INPI), orientações concluídas 26.131, em andamento 2.545, grupos 210, pós-graduação 2.548, IC 1.333

---

## 📋 Backlog

### 🚨 Bloqueios com prazo

- [x] **CI vermelho desde 27/08/2026, resolvido em 01/09** — o passo "Validar estrutura e ausência de PII" falhava (run 33102453371, commit `beb67bd`) porque a guarda de `scripts/validate-data.js` varre todo arquivo versionado e acusava o endereço no-reply escrito por extenso no `git config user.email` de `.github/workflows/refresh-grupos.yml`. O endereço passou a ser montado em tempo de execução, a partir de `github.repository_owner` e `github.repository_owner_id`: a autoria do commit automático continua a mesma e o arquivo não guarda mais endereço nenhum. A isenção de `.github/workflows/` foi descartada, porque abriria buraco na guarda. Verde no run 33444294599
- [x] **Coleta do INPI passou para a máquina local** — o cron mensal do `refresh-inovacao.yml` foi removido em 01/09. Ele dependia de um PAT (`SCRAPER_INPI_TOKEN`) só porque o runner público precisa alcançar o `scraper-INPI`, que é privado; na máquina do assessor os dois repositórios estão no disco e nenhum token é preciso. O agendamento vive em `scraper-INPI/systemd/`, verifica todo dia e coleta a cada 25 dias. O `workflow_dispatch` continua no lugar, como reserva — e só ele ainda exigiria o segredo
- [ ] **Actions ainda em `@v4` (Node 20 descontinuado)** — toda rodada sai com a anotação "Node.js 20 is deprecated … forced to run on Node.js 24" para `actions/checkout@v4` e `actions/setup-node@v4` (runs 33102453371 e 33391536036). Subir os três workflows (`ci.yml`, `refresh-grupos.yml`, `refresh-inovacao.yml`) para `@v5` antes de o forçamento virar erro

### 🔴 Crítico

- [ ] **Confirmar com a PRPGI o que pode ser público** — a régua atual foi definida tecnicamente (nada de nome, matrícula, e-mail ou telefone no que é versionado). Falta o aval formal sobre granularidade por aba e sobre o tratamento dos dados já expostos no histórico do GitHub
- [ ] **`docs/validacao/relatorio-comparacao-PI.pdf` e `.html`** — foram removidos por vazarem inventores e contatos. Se ainda forem entregáveis, regerar a partir do `.md` público
- [x] **`git push --force`** — verificado em 05/08/2026: `origin/main` == `main` local (bbd138b), histórico remoto de `main`, branch auxiliar e PR #1 sem `data-groups.json` em nenhum commit alcançável; rewrite já publicada. Objetos antigos ainda podem ficar alcançáveis por SHA até o GC do GitHub — para remoção efetiva, abrir chamado no GitHub Support pedindo a purga, e tratar os dados como já expostos

### 🟡 Alta

- [ ] **Mapa da aba Orientações mostra grupos, não orientações** — `src/charts.js:444` chama `renderGenericMap(STATE.filtered.grupos, 'map-orientacoes', …)` com o rótulo "Pesquisadores (aprox.)", enquanto o título do card diz "Distribuição Geográfica" numa aba de orientações. Filtrar por Itabuna deixa o mapa vazio, porque o campus não tem grupo do DGP
- [ ] **Automação dos scrapers** — Lattes/SUAP/DGP/IC ainda exigem exportação manual por campus (citado no slide 11 da apresentação). Pipeline CI/CD completo com os scrapers, agora que o CI base existe
- [ ] **Deploy no CI** — a Action atual só valida; o GitHub Pages continua servindo `main` direto. Avaliar job de deploy explícito (`actions/deploy-pages`) para desacoplar publicação de push

### 🟡 Alta — Automação da lista de grupos de pesquisa (SUAP → DGP)

**Problema**: `scraper-DGP/lista de grupos de pesquisa.txt` é exportada manualmente do SUAP. Hoje o SUAP tem **210 grupos** e a lista antiga tem **197** — **13 grupos novos** ficariam de fora da varredura do DGP (ex.: Coletivo Tereza de Benguela, S3Lab, AfroITEC, GEPAH, NCTI, Casa de Memória Kijemi-Pataxó…). Nenhuma remoção.

**Descobertas (inspeção de `https://suap.ifba.edu.br/admin/cnpq/grupopesquisa/?instituicao=IFBA`)**:
- Django admin changelist, **uma página só** (210 linhas, sem paginação) — "Mostrando 210 Grupos de Pesquisa"
- Tabela `#result_list tbody tr`: `td.field-get_url_grupo_pesquisa a` → ID DGP de 16 dígitos (link `dgp.cnpq.br/.../espelhogrupo/{ID}`); `td.field-descricao` → nome
- Existe também `Exportar para XLS` (`?instituicao=IFBA&export_to_xls=1`), mesmo sistema de tarefas (`djtools`) do `scraper-SUAPPos`
- Login SUAP: campos `#id_username`/`#id_password` + submit via JS (`document.querySelector('form').submit()`) — o clique no botão é interceptado por um overlay `<ul class="_main_menu">`
- Formato de saída esperado pelo Coletor DGP (`parseTXT`): `ID\tNome` com ID de 16 dígitos (header `#\tNome` é ignorado)

- [x] **SUAP (lista de grupos) agendado na máquina local (01/09/2026)** — login institucional e rede do IFBA não cabem em runner público, e a varredura do DGP no Actions parte da lista versionada: até 31/08 a lista tinha um único commit, de 21/08, então grupo criado depois disso ficava invisível. O temporizador em `scraper-DGP/systemd/` verifica todo dia e consulta o SUAP a cada 7 dias; quando a lista muda de verdade, ele publica e dispara a varredura na hora. Primeira execução real em 01/09: 210 grupos, sem novidade
- [ ] **A máquina local precisa alcançar o SUAP** — o temporizador sai sem erro quando está fora da rede do IFBA, e só isso. Se a máquina passar semanas fora da rede, a lista envelhece em silêncio. Um runner institucional resolveria de vez; enquanto não houver, vale conferir a data do último commit da lista de vez em quando

**Fase 1 — lista do SUAP** ✅
- [x] `suap/listar_grupos.py` (Selenium) no repo `scraper-DGP`: login (submit via JS — o botão "Acessar" é interceptado por overlay) → GET do changelist → extrai ID+nome das 210 linhas → escreve `lista de grupos de pesquisa.txt` (`#\tNome` + `ID\tNome`)
- [x] `.env` gitignored (`chmod 600`) com `SUAP_USER`/`SUAP_PASS` (senha atualizada em 21/08/2026 nos 3 `.env`: `scraper-DGP`, `scraper-SUAPCNPQ`, `scraper-SUAPPos`)
- [x] Saída determinística: compara com a lista anterior e loga **13 novos** / **0 removidos**
- [x] Alternativa ao HTML-scrape (`export_to_xls=1`) documentada como plano B — não foi necessária (HTML estável)

**Fase 2 — Coletor DGP headless** ✅
- [x] `cli/coletar.js` + `cli/parser.js` (Node + jsdom): port fiel do parser de `assets/app.js`; **sem proxy CORS** (fetch nativo acessa `dgp.cnpq.br` direto); concorrência/retry/timeout; gera `coletor_dgp_YYYY-MM-DD.csv` (19 colunas, mesmo formato). 1ª rodada: **210/210, 0 erros, ~165 s**

**Fase 3 — encadear no pipeline** ✅
- [x] `pipeline.sh` no `scraper-DGP` encadeia SUAP → DGP → copia CSV para `dashboard-prpgi/dados/scraper-DGP/` → `npm run build` + `validate` + `test`; flags `--skip-suap`/`--dashboard DIR`/`--commit`
- [x] CI no `scraper-DGP` (`.github/workflows/ci.yml`): smoke do parser (fixture + lista versionada) + varredura real de 3 grupos (público, sem PII). O pipeline **completo** (SUAP + CSV com PII) roda localmente — GitHub Actions público não tem credenciais nem pode versionar o CSV
- [x] `lista de grupos de pesquisa.txt` **versionada** (só ID + nome, sem PII); CSV continua gitignored (PII)
- [x] Resultado: `data.json` regenerado com **`grupos=210`** (era 197), `validate` OK, **294 testes passando**

**Automação contínua (GitHub Actions)** ✅
- [x] `.github/workflows/refresh-grupos.yml` — roda **semanal** (seg 06:00 UTC) ou manual (`workflow_dispatch`): clona o `scraper-DGP` (lista + CLI públicos), varre o DGP, atualiza **só o array `grupos`** do `data.json` via `scripts/refresh-grupos.js` e commita/push (mesmo repo, sem PAT). Não precisa de credenciais nem expõe PII (só o `data.json` anonimizado vai ao git)
- [x] `scripts/refresh-grupos.js` — reusa `parseCSV` do `build.js` + `validate` do `validate-data.js`; **não reescreve o arquivo se os grupos não mudaram** (evita diff espúrio)

### 🟢 Média

- [ ] **Bases que o INPI não permite consultar** — topografia de circuitos integrados ("no momento não há Consulta", diz o próprio INPI) e contratos de transferência de tecnologia (exige login com usuário e senha). Nenhuma tinha registro no dashboard. Reavaliar se a PRPGI obtiver credencial do pePI
- [ ] **Pré-agregação por campus/ano/área no build** — **medir antes de fazer.** Números de ago/2026 (desktop): `data.json` são 21 MB, mas o GitHub Pages já serve gzipado, então o download real é **2,2 MB**. O custo dominante é `JSON.parse` (346 ms), seguido do dedup (194 ms) e do filtro (63 ms) sobre 163 mil registros. Num celular mediano isso é ~1–1,7 s de parse, uma vez só (a Cache API evita repetir). A pré-agregação ataca CPU, não bytes — só compensa se o parse virar queixa real de usuário
- [ ] **Acessibilidade: rodar auditoria com leitor de tela** — a estrutura está corrigida (ARIA de abas, rótulo nos 32 gráficos, diálogos com trap de foco, `caption`/`scope` nas tabelas, contraste AA, foco visível), tudo coberto por `tests/acessibilidade.test.js`. Falta a validação qualitativa com NVDA/Orca e a descrição textual dos dados de cada gráfico (tabela alternativa)

### 🔵 Baixa

- [ ] **Drill-down por pesquisador** — clicar num servidor e ver a produção completa (exige decisão LGPD)
- [ ] **Comparação lado a lado entre campi** — seletor multi-campus nos gráficos
- [ ] **Filtro por área do conhecimento** na produção científica
- [ ] **Indicadores de extensão universitária** (novo dataset)
- [ ] **Integração com API do Lattes** em substituição às exportações manuais
- [ ] **Dashboard de programas de pós-graduação individuais** (citado no slide 11)
- [ ] **Nova fonte de dados** — verificar sempre `Instituição` contém "IFBA" antes de processar (regra do AGENTS.md)
- [ ] **Scraper SISPROC (processos da pós-graduação)** — ver seção "SISPROC" abaixo para o plano de download

### 🆕 SISPROC — plano de download (proposta)

O SISPROC (sistema de processos eletrônicos do IFBA) registra os processos da pós-graduação (matrícula, trancamento, defesa, conclusão) que o SUAP não expõe no CSV de alunos. Plano:

1. **Verificar acesso** — `sisproc.ifba.edu.br` resolve para `qualidadeapp02.ifba.edu.br`, mas não respondeu HTTP/HTTPS desta máquina (provavelmente rede interna/VPN do IFBA). Primeiro passo: testar de dentro da rede institucional
2. **Descobrir a API/rotas** — o SISPROC costuma ter área autenticada (Django/Java?) com exportação por filtro (tipo de processo, período, campus). Procurar por endpoints de exportação (CSV/XLSX) ou tabelas paginadas antes de pensar em scraping de HTML
3. **Campos de interesse** — nº do processo, tipo (matrícula/defesa/conclusão/trancamento), interessado (aluno), curso/programa, campus, data de abertura, andamento/situação, data de despacho/conclusão
4. **Implementar seguindo o padrão `scraper-SUAPPos`** (Selenium + login + exportação): novo repo `scraper-SISPROC` com `src/{config,login,scraper,exporter}.py`, saída `alunos_pos_sisproc_YYYYMMDD_HHMMSS.csv` em `dados/scraper-SISPROC/`, guarda `Instituição === IFBA` e LGPD (sem nomes/matrículas no `data.json` público)
5. **Integrar no `build.js`** como fonte reconhecida (mesmo padrão do `scraper-SUAPPos`), com validação de datas de conclusão para refinar "Conclusão (Maduras)" (hoje o corte é só a coorte, pois o SUAP não informa data de conclusão)

---

## 🐛 Issues Conhecidas

- `mapUnidadeToCampus` tem fallback "SSA": Unidade não reconhecida vira Salvador. **Medido em ago/2026: 0 dos 197 grupos caem nesse fallback cego** — os 94 grupos em SSA casam legitimamente com "Salvador" ou com a referência à sede. É uma armadilha latente para dados futuros, não um bug ativo; mudar para `""` + marcação "não identificado" na UI exige decisão de negócio
- `data-groups.json` pode estar defasado em relação a `data.json` se o build falhar no meio (verificar atomicidade da escrita dos dois arquivos)
- `AGENTS.md` (gitignored) ainda pode ter instruções divergentes sobre o comando de build — o README e as instruções do repositório foram reconciliados em `npm run build`
- O salt de pseudonimização vive em `.build-salt` e numa cópia em `~/.config/dashboard-prpgi/build-salt` (ambos `0600`, nenhum versionado). O build restaura da cópia se o local sumir. Perder **os dois** não perde dados, mas gera salt novo e um diff de 21 MB no `data.json` — ao migrar de máquina, leve a cópia junto
- Nenhuma função de renderização tem teste unitário. Para verificar de verdade, dirigir o Chrome pelo DevTools Protocol (`--headless=new --remote-debugging-port=9222`) e checar o DOM vivo. `--dump-dom` com `--virtual-time-budget` **não serve**: fotografa antes de o `data.json` carregar e a página parece travada em "Carregando dados…" mesmo funcionando
- A guarda de telefone em `validate-data.js` exige DDD entre parênteses ou celular com 9 inicial. O formato solto `NNNN-NNNN` é ambíguo demais (colide com números do INPI e intervalos de ano) e não é detectado — a guarda de e-mail é a rede principal
