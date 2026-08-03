# TODO — Dashboard PRPGI

Painel de Dados da PRPGI — indicadores de pesquisa, pós-graduação e inovação do IFBA.
Frontend estático (Chart.js + Leaflet + SheetJS) + pipeline ETL em `scripts/build.js` → `data.json`, deploy via GitHub Pages.

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
- [x] Jest: 205 testes em 4 suítes (build, campus-filter, posgraduacao, script.utils)
- [x] Testes VM-based sem browser/jsdom (`tests/helpers/browserEnv.js`)
- [x] Cobertura E2E de filtro de campus contra `data.json` real (26 testes)

### LGPD e fundação técnica (ago/2026)
- [x] **`data.json` público anonimizado** — `posgraduacao` não emite mais `nome`/`matricula`/`email_academico`/`email_pessoal`; `dedupKey` e os campos `orientador`/`bolsista` de IC viram pseudônimos estáveis (`pseudonymize()` em `scripts/build.js`, salt em `.build-salt` gitignored). Nenhuma feature mudou: o frontend só usava esses campos em `new Set(...).size`
- [x] **`data-groups.json` fora do versionamento e do histórico** — continha nomes, contatos e composição de equipes; purgado com `git filter-repo`, `.git` caiu de 210 MB → 34 MB
- [x] **`src/shared.js`** — fonte única de `CAMPUS_TO_CITY`, `IFBA_COORDS`, `normalizeText`, `mapUnidadeToCampus` e `lookupCoords`; eliminadas as 4 cópias divergentes (`script.js`, `browserEnv.js`, `campus-filter.test.js`, `comparar_pi.js`). Validado por teste de mutação: reintroduzir o bug de acentos agora quebra 6 testes
- [x] **`npm run build` / `npm run validate`** — scripts criados e README/CLAUDE.md reconciliados
- [x] **CI** — `.github/workflows/ci.yml` roda `npm test`, `npm run validate` (estrutura, códigos de campus, ausência de PII) e guarda de 50 MB por arquivo versionado
- [x] Seção obsoleta de monorepo/subtree removida do `CLAUDE.md` (o repositório é independente)

---

## 📋 Backlog

### 🔴 Crítico

- [ ] **`git push --force` pendente** — a reescrita de histórico que removeu `data-groups.json` está feita **só localmente**. Enquanto não for publicada, os nomes e contatos seguem acessíveis no GitHub. Rodar:
  ```
  git push --force origin main
  git push --force origin copilot/organize-campi-dropdown-alphabetically
  ```
  Depois: mesmo com o force-push, os objetos antigos continuam alcançáveis por SHA no GitHub até a coleta de lixo deles — para remoção efetiva, abrir chamado no GitHub Support pedindo a purga, e tratar os dados como já expostos
- [ ] **LGPD: `docs/validacao/` versiona dados pessoais** — descoberto em ago/2026, não estava mapeado. `Controle propriedade intelectual DINOV 2026 - CONCEDIDOS.csv` (298 linhas, versionado e público) tem colunas `INVENTORES`, `COTITULAR NOME`, `CONTATO` e `Whatsapp`, com 135 linhas contendo padrão de telefone. Os relatórios gerados (`relatorio-comparacao-PI.md`/`.html`/`.pdf`) também referenciam inventores. Decidir com a PRPGI: mover o CSV para `dados/` (gitignored) e regerar os relatórios sem colunas pessoais, ou anonimizar na origem. Exige nova purga de histórico

### 🟡 Alta

- [ ] **Automação dos scrapers** — Lattes/SUAP/DGP/IC ainda exigem exportação manual por campus (citado no slide 11 da apresentação). Pipeline CI/CD completo com os scrapers, agora que o CI base existe
- [ ] **Deploy no CI** — a Action atual só valida; o GitHub Pages continua servindo `main` direto. Avaliar job de deploy explícito (`actions/deploy-pages`) para desacoplar publicação de push

### 🟢 Média

- [ ] **Performance: payload de 34 MB no iframe** — primeira carga lenta em conexões móveis; 78k registros técnicos processados no browser. Opções: pré-agregação por campus/ano/área no build para KPIs e gráficos, carregar datasets por aba (fetch sob demanda), habilitar compressão (brotli/gzip) no GitHub Pages
- [ ] **Modularizar `src/script.js` (1.688 linhas monolítico)** — separar `filters.js`, `charts.js`, `maps.js`, `tables.js`, `cache.js` (precedente: `pesquisadores.js`/`posgraduacao.js`)
- [ ] **`comparar_pi.js` (561 linhas, validação manual de PI) como teste automatizado** — transformar em suíte de integridade (cross-check dados.json × fonte DINOV)
- [ ] **Acessibilidade** — contraste, aria-labels, navegação por teclado nos gráficos/tabelas, foco em modais
- [ ] **Validação de dados no build** — schemas por dataset (campos obrigatórios, anos válidos, códigos de campus), falhar o build com relatório claro em vez de apenas `console.warn`

### 🔵 Baixa

- [ ] **Modo escuro** (citado no slide 11)
- [ ] **Drill-down por pesquisador** — clicar num servidor e ver a produção completa (exige decisão LGPD)
- [ ] **Comparação lado a lado entre campi** — seletor multi-campus nos gráficos
- [ ] **Filtro por área do conhecimento** na produção científica
- [ ] **Indicadores de extensão universitária** (novo dataset)
- [ ] **Integração com API do Lattes** em substituição às exportações manuais
- [ ] **Dashboard de programas de pós-graduação individuais** (citado no slide 11)
- [ ] **Nova fonte de dados** — verificar sempre `Instituição` contém "IFBA" antes de processar (regra do AGENTS.md)

---

## 🐛 Issues Conhecidas

- `mapUnidadeToCampus` tem fallback "SSA": Unidade não reconhecida vira Salvador. **Medido em ago/2026: 0 dos 197 grupos caem nesse fallback cego** — os 94 grupos em SSA casam legitimamente com "Salvador" ou com a referência à sede. É uma armadilha latente para dados futuros, não um bug ativo; mudar para `""` + marcação "não identificado" na UI exige decisão de negócio
- `data-groups.json` pode estar defasado em relação a `data.json` se o build falhar no meio (verificar atomicidade da escrita dos dois arquivos)
- `AGENTS.md` (gitignored) ainda pode ter instruções divergentes sobre o comando de build — README e `CLAUDE.md` foram reconciliados em `npm run build`
- O salt de pseudonimização (`.build-salt`) não é versionado: se for perdido, os pseudônimos de `data.json` mudam no build seguinte, gerando um diff grande (sem perda de dados). Incluir no backup
