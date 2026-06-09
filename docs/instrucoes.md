# Especificações Técnicas do Dashboard PRPGI em Números - IFBA

## 1. Notas Técnicas Gerais

- **Fontes de Dados:** Os dados estão distribuídos em múltiplos arquivos, um para cada um dos mais de 20 campi do IFBA.
    1.  `CFO_1947_2027.xls` (Campus Original)
    2.  `SF_1947_2027.xls` (Campus Simões Filho)
    3.  `coletor_dgp_ifba(2).csv` (Grupos de Pesquisa)
- **Unificação de Dados:** Para uma visão institucional completa, os dados das abas "Produções Bibliográficas", "Produções Técnicas", "Orientações Concluídas" e "Orientações em Andamento" dos dois arquivos `.xls` (CFO e SF) devem ser unificados em uma única base de dados para cada tipo de produção/orientação.
- **Tratamento da Coluna `Servidor`:** Esta coluna contém um código complexo (`<VinculoQueryset ...>`). O sistema deve extrair o `ID` numérico (ex: 3451375) e o `Nome` do servidor. O `ID` deve ser usado como a chave primária para todas as contagens e agrupamentos.
- **Múltiplos Autores:** Uma mesma produção pode ter vários `IDs` de servidores na coluna `Servidor`. Para métricas como "Servidores com Produção", cada ID único deve ser contabilizado uma única vez, independentemente de quantas produções tenha.
- **Estrato Qualis:** Para análises de qualidade, considerar apenas valores de estrato como "A1", "A2", "B1", etc. Valores vazios, hífens ("-") ou "Não informado" devem ser desconsiderados ou agrupados como "Sem Estrato".
- **Filtro de Período (Slicer):** Todas as seções, exceto "Grupos de Pesquisa" e "Inovação" (que já tem seu próprio período), devem ser influenciadas por um filtro global de período. Os períodos predefinidos são:
    - Último Ano (ex: 2025)
    - Últimos 2 Anos (ex: 2024-2025)
    - Últimos 5 Anos (ex: 2021-2025)
    - Últimos 10 Anos (ex: 2016-2025)
    - Todo o Período (ex: 1947-2026)
    O filtro deve atuar sobre a coluna `Ano` de cada base de dados.

## 2. Seções do Dashboard e seus KPIs

### Seção 1: Produção Científica (Base: `Produções Bibliográficas` unificada)

- **KPI 1.1 - Total de Produções Bibliográficas:**
    - **Descrição:** Número absoluto de todas as publicações científicas no período selecionado.
    - **Lógica:** `CONTAGEM DE LINHAS` onde o `Ano` está dentro do intervalo do filtro.

- **KPI 1.2 - Total de Artigos Completos:**
    - **Descrição:** Número de artigos publicados em periódicos no período selecionado.
    - **Lógica:** `CONTAGEM DE LINHAS` onde `Tipo` contém "Artigos Completos Publicados em Periódicos" E `Ano` está no intervalo do filtro.

- **KPI 1.3 - Total de Livros e Capítulos:**
    - **Descrição:** Número de livros publicados/organizados e capítulos de livros no período selecionado.
    - **Lógica:** `CONTAGEM DE LINHAS` onde (`Tipo` contém "Livros" OU "Capítulos") E `Ano` está no intervalo do filtro.

- **KPI 1.4 - Produção com Qualis A1/A2:**
    - **Descrição:** Total de artigos em periódicos de alto impacto (Estrato Qualis A1 ou A2) no período selecionado.
    - **Lógica:** `CONTAGEM DE LINHAS` onde (`Estrato` = "A1" OU "A2") E `Ano` está no intervalo do filtro.

- **KPI 1.5 - Servidores com Produção Científica:**
    - **Descrição:** Número de servidores distintos que publicaram ao menos um trabalho científico no período selecionado.
    - **Lógica:** `CONTAGEM DISTINTA` de `IDs` de servidor extraídos da coluna `Servidor` para as linhas onde `Ano` está no intervalo do filtro.

### Seção 2: Produção Técnica (Base: `Produções Técnicas` unificada)

- **KPI 2.1 - Total de Produções Técnicas:**
    - **Descrição:** Número absoluto de todas as produções técnicas no período selecionado.
    - **Lógica:** `CONTAGEM DE LINHAS` onde `Ano` está no intervalo do filtro.

- **KPI 2.2 - Apresentações de Trabalho:**
    - **Descrição:** Total de trabalhos apresentados em eventos no período selecionado.
    - **Lógica:** `CONTAGEM DE LINHAS` onde `Tipo` = "Apresentações de Trabalho" E `Ano` está no intervalo do filtro.

- **KPI 2.3 - Cursos e Eventos Organizados:**
    - **Descrição:** Total de cursos de curta duração ministrados e eventos organizados no período selecionado.
    - **Lógica:** `CONTAGEM DE LINHAS` onde (`Tipo` contém "Cursos de Curta Duração Ministrados" OU "Organização de Eventos") E `Ano` está no intervalo do filtro.

- **KPI 2.4 - Diversidade da Produção Técnica:**
    - **Descrição:** Quantos tipos diferentes de produção técnica foram registrados no período selecionado.
    - **Lógica:** `CONTAGEM DISTINTA` de valores na coluna `Tipo` para as linhas onde `Ano` está no intervalo do filtro.

### Seção 3: Inovação (Base: `Registros e Patentes` unificada de todos os campi)

- **KPI 3.1 - Total de Registros de Propriedade Intelectual:**
    - **Descrição:** Número total de patentes, softwares e desenhos industriais registrados.
    - **Lógica:** `CONTAGEM DE LINHAS` no conjunto de dados. (Pode ser filtrado por `Ano` se desejado).

- **KPI 3.2 - Registros por Tipo (Gráfico de Pizza/Barras):**
    - **Descrição:** Distribuição dos registros por categoria (Patente, Software, Desenho Industrial).
    - **Lógica:** Agrupar os dados pela coluna `Tipo` e contar as linhas de cada grupo.

- **KPI 3.3 - Evolução Anual dos Registros (Gráfico de Linhas):**
    - **Descrição:** Número de registros depositados ou concedidos por ano.
    - **Lógica:** Agrupar os dados pela coluna `Ano` e contar as linhas de cada ano, ordenando cronologicamente.

### Seção 4: Grupos de Pesquisa (Base: `coletor_dgp_ifba(2).csv`)

- **KPI 4.1 - Total de Grupos de Pesquisa:**
    - **Descrição:** Número total de grupos registrados no diretório.
    - **Lógica:** `CONTAGEM DE LINHAS` no conjunto de dados.

- **KPI 4.2 - Grupos Certificados:**
    - **Descrição:** Número de grupos com situação "Certificado" no DGP.
    - **Lógica:** `CONTAGEM DE LINHAS` onde `Situação` = "Certificado".

- **KPI 4.3 - Média de Pesquisadores por Grupo:**
    - **Descrição:** Tamanho médio dos grupos de pesquisa.
    - **Lógica:** `MÉDIA` dos valores numéricos da coluna `Pesquisadores`.

- **KPI 4.4 - Média de Estudantes por Grupo:**
    - **Descrição:** Nível médio de envolvimento de estudantes em grupos de pesquisa.
    - **Lógica:** `MÉDIA` dos valores numéricos da coluna `Estudantes`.

- **KPI 4.5 - Grupos por Área de Conhecimento (Gráfico de Pizza/Barras):**
    - **Descrição:** Contagem de grupos por grande área do conhecimento.
    - **Lógica:** Agrupar os dados pela coluna `Área` (extrair a parte antes do ";" se necessário) e contar as linhas de cada grupo.

- **KPI 4.6 - Distribuição Geográfica dos Grupos (Mapa da Bahia com Bolhas):**
    - **Descrição:** Número de grupos de pesquisa por cidade (unidade).
    - **Lógica:** Agrupar os dados pela coluna `Unidade` e contar as linhas de cada grupo. O tamanho da bolha no mapa corresponde ao número de grupos naquela cidade.

### Seção 5: Pesquisadores e Orientações (Base: Unificada de Orientações e Servidores)

- **KPI 5.1 - Total de Pesquisadores (Servidores com Produção):**
    - **Descrição:** Número de servidores que possuem ao menos uma produção (bibliográfica ou técnica) ou orientação no período selecionado.
    - **Lógica:** Criar uma lista unificada de todos os `IDs` de servidor presentes nas abas `Produções Bibliográficas`, `Produções Técnicas`, `Orientações Concluídas`, `Orientações em Andamento` (todas unificadas) onde o `Ano` está no intervalo do filtro. Calcular a `CONTAGEM DISTINTA` dessa lista.

- **KPI 5.2 - Total de Orientações (Concluídas + Em Andamento):**
    - **Descrição:** Soma de todas as orientações (finalizadas e em andamento) no período selecionado.
    - **Lógica:** `CONTAGEM DE LINHAS` nas abas `Orientações Concluídas` (unificada) e `Orientações em Andamento` (unificada) onde o `Ano` está no intervalo do filtro. Os resultados devem ser apresentados como um único número total, mas também como valores separados nos KPIs 5.3 e 5.4.

- **KPI 5.3 - Total de Orientações Concluídas:**
    - **Descrição:** Número absoluto de orientações finalizadas no período selecionado.
    - **Lógica:** `CONTAGEM DE LINHAS` na aba `Orientações Concluídas` (unificada) onde `Ano` está no intervalo do filtro.

- **KPI 5.4 - Total de Orientações em Andamento:**
    - **Descrição:** Número absoluto de orientações em andamento no período selecionado.
    - **Lógica:** `CONTAGEM DE LINHAS` na aba `Orientações em Andamento` (unificada) onde `Ano` está no intervalo do filtro.

- **KPI 5.5 - Distribuição por Nível de Orientação (Gráfico de Pizza/Barras):**
    - **Descrição:** Proporção de orientações (concluídas + em andamento) por nível (Iniciação Científica, Mestrado, etc.) no período selecionado.
    - **Lógica:** Combinar as bases de orientações concluídas e em andamento. Agrupar pela coluna `Tipo` e contar as linhas de cada grupo para o período do filtro.

- **KPI 5.6 - Distribuição Geográfica dos Pesquisadores (Mapa da Bahia com Bolhas):**
    - **Descrição:** Número de pesquisadores por cidade (unidade) nos grupos de pesquisa.
    - **Fonte:** `coletor_dgp_ifba(2).csv`
    - **Lógica:** Agrupar os dados pela coluna `Unidade`. Para cada grupo, somar os valores da coluna `Pesquisadores`. O tamanho da bolha no mapa corresponde ao número total de pesquisadores naquela cidade.
