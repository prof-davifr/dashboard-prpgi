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
- [x] Jest: 261 testes em 6 suítes (build, campus-filter, posgraduacao, script.utils, comparar-pi, acessibilidade)
- [x] Testes VM-based sem browser/jsdom (`tests/helpers/browserEnv.js`)
- [x] Cobertura E2E de filtro de campus contra `data.json` real (26 testes)

### LGPD e fundação técnica (ago/2026)
- [x] **`data.json` público anonimizado** — `posgraduacao` não emite mais `nome`/`matricula`/`email_academico`/`email_pessoal`; `dedupKey` e os campos `orientador`/`bolsista` de IC viram pseudônimos estáveis (`pseudonymize()` em `scripts/build.js`, salt em `.build-salt` gitignored). Nenhuma feature mudou: o frontend só usava esses campos em `new Set(...).size`
- [x] **`data-groups.json` fora do versionamento e do histórico** — continha nomes, contatos e composição de equipes; purgado com `git filter-repo`, `.git` caiu de 210 MB → 34 MB
- [x] **`src/shared.js`** — fonte única de `CAMPUS_TO_CITY`, `IFBA_COORDS`, `normalizeText`, `mapUnidadeToCampus` e `lookupCoords`; eliminadas as 4 cópias divergentes (`script.js`, `browserEnv.js`, `campus-filter.test.js`, `comparar_pi.js`). Validado por teste de mutação: reintroduzir o bug de acentos agora quebra 6 testes
- [x] **`npm run build` / `npm run validate`** — scripts criados e README/CLAUDE.md reconciliados
- [x] **CI** — `.github/workflows/ci.yml` roda `npm test`, `npm run validate` (estrutura, códigos de campus, ausência de PII) e guarda de 50 MB por arquivo versionado
- [x] Seção obsoleta de monorepo/subtree removida do `CLAUDE.md` (o repositório é independente)

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

---

## 📋 Backlog

### 🔴 Crítico

- [ ] **`git push --force` pendente** — a reescrita de histórico que removeu `data-groups.json` está feita **só localmente**. Enquanto não for publicada, os nomes e contatos seguem acessíveis no GitHub. Rodar:
  ```
  git push --force origin main
  git push --force origin copilot/organize-campi-dropdown-alphabetically
  ```
  Depois: mesmo com o force-push, os objetos antigos continuam alcançáveis por SHA no GitHub até a coleta de lixo deles — para remoção efetiva, abrir chamado no GitHub Support pedindo a purga, e tratar os dados como já expostos
- [ ] **Confirmar com a PRPGI o que pode ser público** — a régua atual foi definida tecnicamente (nada de nome, matrícula, e-mail ou telefone no que é versionado). Falta o aval formal sobre granularidade por aba e sobre o tratamento dos dados já expostos no histórico do GitHub
- [ ] **`docs/validacao/relatorio-comparacao-PI.pdf` e `.html`** — foram removidos por vazarem inventores e contatos. Se ainda forem entregáveis, regerar a partir do `.md` público

### 🟡 Alta

- [ ] **Automação dos scrapers** — Lattes/SUAP/DGP/IC ainda exigem exportação manual por campus (citado no slide 11 da apresentação). Pipeline CI/CD completo com os scrapers, agora que o CI base existe
- [ ] **Deploy no CI** — a Action atual só valida; o GitHub Pages continua servindo `main` direto. Avaliar job de deploy explícito (`actions/deploy-pages`) para desacoplar publicação de push

### 🟢 Média

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

---

## 🐛 Issues Conhecidas

- `mapUnidadeToCampus` tem fallback "SSA": Unidade não reconhecida vira Salvador. **Medido em ago/2026: 0 dos 197 grupos caem nesse fallback cego** — os 94 grupos em SSA casam legitimamente com "Salvador" ou com a referência à sede. É uma armadilha latente para dados futuros, não um bug ativo; mudar para `""` + marcação "não identificado" na UI exige decisão de negócio
- `data-groups.json` pode estar defasado em relação a `data.json` se o build falhar no meio (verificar atomicidade da escrita dos dois arquivos)
- `AGENTS.md` (gitignored) ainda pode ter instruções divergentes sobre o comando de build — README e `CLAUDE.md` foram reconciliados em `npm run build`
- O salt de pseudonimização (`.build-salt`) não é versionado: se for perdido, os pseudônimos de `data.json` mudam no build seguinte, gerando um diff grande (sem perda de dados). Incluir no backup
- Nenhuma função de renderização tem teste unitário. Para verificar de verdade, dirigir o Chrome pelo DevTools Protocol (`--headless=new --remote-debugging-port=9222`) e checar o DOM vivo. `--dump-dom` com `--virtual-time-budget` **não serve**: fotografa antes de o `data.json` carregar e a página parece travada em "Carregando dados…" mesmo funcionando
- A guarda de telefone em `validate-data.js` exige DDD entre parênteses ou celular com 9 inicial. O formato solto `NNNN-NNNN` é ambíguo demais (colide com números do INPI e intervalos de ano) e não é detectado — a guarda de e-mail é a rede principal
