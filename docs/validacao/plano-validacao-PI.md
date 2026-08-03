# Plano de Validação: Propriedade Intelectual — DINOV vs Dashboard PRPGI

## 1. Objetivo

Comparar os registros de Propriedade Intelectual (PI) concedidos, controlados pela **DINOV/IFBA** (arquivo CSV), com o que está capturado no **dashboard PRPGI** (`data.json → inovacao[]`), gerando um relatório de divergências.

**Regra fundamental: apenas validar. Nenhum dado do dashboard será alterado.**

## 2. Fontes de Dados

### 2.1 DINOV (validação)

| Item | Descrição |
|------|-----------|
| Arquivo | `docs/validacao/Controle propriedade intelectual DINOV 2026 - CONCEDIDOS.csv` |
| Registros | ~298 |
| Encoding | `latin1` (ISO-8859-1) |
| Observação | Células com multi-linhas e campos com vírgula entre aspas |

Campos relevantes do CSV:

| Coluna | Conteúdo |
|--------|----------|
| `Nº INPI` | Número do registro no INPI — principal chave de matching (ex: `PI0802052-3`, `BR 102012007763-9`, `11781-2`) |
| `OBJETO` | Tipo: `PI` (patente), `SO` (software), `DI` (desenho industrial), `MU` (modelo de utilidade) |
| `CAMPUS` | Nome do campus (inconsistente: às vezes contém inventores em vez do campus) |
| `INVENTORES` | Nome(s) do(s) inventor(es) |
| `DATA DEPOSITO` | Data de depósito |
| `ANO DEPÓSITO` | Ano de depósito |
| `DATA CONCESSÃO` | Data de concessão |
| `ANO CONCESSÃO` | Ano de concessão |
| `STATUS 1` | `ATIVO` |
| `STATUS 2` | `CONCEDIDO` |
| `TÍTULO INPI` | Título do registro |

### 2.2 Dashboard (data.json → inovacao[])

| Item | Descrição |
|------|-----------|
| Origem | Extraído dos currículos Lattes via scraper SUAP/CNPq (planilhas por campus) |
| Registros | 853 |
| Cobertura | Todos os tipos de PI (incluindo não concedidos, em andamento) |

Campos no `inovacao[]`:

| Campo | Conteúdo |
|-------|----------|
| `Ano` | Ano do registro (string) |
| `Tipo` | `Patente`, `Software`, `Desenho Insdustrial` (sic) |
| `campus` | Código do campus (ex: `SSA`, `BAR`, `CAM`) |
| `dedupKey` | Chave de desduplicação — contém o número do registro embutido (ex: `registrosoupatentesoftwarenumerodoregistrobr5120240039597dataderegistro...`) |
| `Servidor` | ID do servidor no Lattes |

## 3. Estratégia de Matching

### 3.1 Extração do número de registro

**Dashboard**: extrair via regex do `dedupKey`:
```
numerodoregistro([a-z0-9]+)dataderegistro
```
Resultado: `br5120240039597`, `br10202302498`, `5120250027338`

**DINOV**: ler diretamente da coluna `Nº INPI`.

### 3.2 Normalização

Ambos os lados precisam de uma chave comum. Estratégia:

1. **Lowercase** + remover espaços extras
2. **Remover tudo que não é alfanumérico** (hífens, barras, espaços)
3. **Remover prefixos de tipo** (`pi`, `mu`, `br`) quando presentes no início — manter apenas o core numérico
4. Casos especiais: registros com múltiplos números separados por `/` (ex: `MU8903003-6/ PI 0925423-4`) geram **duas entradas normalizadas**

Exemplo de normalização:

| Original | Normalizado |
|----------|-------------|
| `PI0802052-3` | `08020523` |
| `BR 102012007763-9` | `1020120077639` |
| `11781-2` | `117812` |
| `BR512025005135-2` | `5120250051352` |
| `MU8903003-6/ PI 0925423-4` | `89030036` + `09254234` |

### 3.3 Matching

Match exato por chave normalizada.

Categorias de resultado:

| Categoria | Significado |
|-----------|-------------|
| **Casados** | Registro encontrado em ambas as fontes |
| **Só DINOV** | Registro no CSV que não está no dashboard (pode ser concedido que não foi capturado pelo scraper) |
| **Só Dashboard** | Registro no dashboard que não está no CSV (pode ser não-concedido, pendente, ou concedido não listado pela DINOV) |

## 4. Dimensões de Análise

Para registros **casados**:
- **Tipo**: `Tipo` no dashboard vs `OBJETO` no DINOV (ex: Patente ↔ PI, Software ↔ SO)
- **Ano**: `Ano` no dashboard vs `ANO DEPÓSITO` / `ANO CONCESSÃO` no DINOV
- **Campus**: `campus` (código) no dashboard vs `CAMPUS` (nome cidade) no DINOV — requer tradução via `CAMPUS_TO_CITY`

Para registros **só DINOV**:
- Listar `Nº INPI`, `OBJETO`, `CAMPUS`, `ANO CONCESSÃO`, `INVENTORES`
- Identificar possíveis causas: registro muito recente, campus não escaneado, falha no scraper

Para registros **só Dashboard**:
- Listar `Tipo`, `campus`, `Ano`, nº registro
- Identificar possíveis causas: registro não concedido (em andamento/indeferido), concedido mas não repassado à DINOV, registro de outro tipo não controlado

## 5. Relatório de Saída

Formato: Markdown (`docs/validacao/relatorio-comparacao-PI.md`)

Estrutura:
1. **Sumário Executivo** — tabela com contagens totais
2. **Casados** — tabela resumo com consistência (tipo, ano, campus)
3. **Só DINOV** — tabela detalhada dos que faltam no dashboard
4. **Só Dashboard** — tabela detalhada dos extras no dashboard
5. **Distribuição Temporal** — comparativo anos (tabela ou histograma texto)
6. **Distribuição por Campus** — comparativo campus
7. **Observações** — notas sobre qualidade dos dados (ex: campo CAMPUS do CSV inconsistente)

## 6. Script de Validação

Será criado `scripts/comparar_pi.js` com:

```
node scripts/comparar_pi.js
```

Dependências: `xlsx` (já instalado, usado pelo `scripts/build.js`) — para parsing robusto do CSV (encoding latin1, quoted fields, multi-line cells).

## 7. Não Escopo

- ❌ Não altera `data.json`
- ❌ Não altera `scripts/build.js`
- ❌ Não altera `index.html`, `src/script.js` ou qualquer arquivo do dashboard
- ❌ Não integra a validação no pipeline de build
- ❌ Não propaga dados do CSV para o dashboard
