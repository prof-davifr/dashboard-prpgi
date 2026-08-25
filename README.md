# Dashboard PRPGI - IFBA

Este é o dashboard institucional da Pró-Reitoria de Pesquisa, Pós-Graduação e Inovação (PRPGI) do IFBA. Um sistema *standalone* de alta performance, projetado para visualização de indicadores acadêmicos e científicos, pronto para integração via `<iframe>`.

---

## Demonstração Online

O dashboard está hospedado no GitHub Pages e pode ser acessado em:  
**[https://prof-davifr.github.io/dashboard-prpgi/](https://prof-davifr.github.io/dashboard-prpgi/)**

---

## Estrutura do Projeto

O projeto é organizado para ser leve e fácil de manter, utilizando uma arquitetura de dados estáticos pré-processados.

### Núcleo da Aplicação
- `index.html`: Estrutura principal e ponto de entrada do dashboard.
- `src/style.css`: Estilização premium e responsiva (extraída do HTML).
- `src/script.js`: Motor principal de carregamento, filtros e renderização.
- `src/pesquisadores.js` & `src/posgraduacao.js`: Módulos lógicos especializados.
- `data.json`: Base de dados consolidada (gerada durante o build).

### Ferramentas e Dados
- `scripts/build.js`: Script Node.js que unifica e otimiza os dados brutos.
- `dados/`: Repositório de fontes brutas (Excel/CSV) organizadas por scraper.
- `package.json`: Definições de dependências e scripts de automação.

### Documentação e Arquivos
- `docs/`: Especificações técnicas, notas de metodologia e manuais.
- `docs/assets/`: Ativos de design e mockups originais.
- `archive/`: Arquivos legados e ferramentas de teste temporárias (ex: `server.py`).

---

## Fluxo de Atualização de Dados

Para atualizar os números do dashboard, siga o processo de *ETL* simplificado:

1. **Coleta**: Insira os novos arquivos `.xls` ou `.csv` nas respectivas subpastas dentro de `dados/`.
2. **Processamento**: Execute o motor de unificação:
    ```bash
    npm run build
    ```
3. **Inovação**: O `npm run build` deixa a aba Inovação **vazia de propósito** —
   a fonte dela é o INPI, não o Lattes. Colete e aplique:
    ```bash
    cd ../scraper-INPI && node cli/coletar.js --out /tmp/inpi.csv
    cd -            && node scripts/refresh-inovacao.js /tmp/inpi.csv
    ```
   Sem este passo o dashboard publica a aba Inovação em branco. O CSV traz nomes
   de autores: não versione, e apague depois de usar.
4. **Validação**: Rode as verificações de integridade e a suíte de testes:
    ```bash
    npm run validate   # estrutura, códigos de campus e ausência de dados pessoais
    npm test
    ```
5. **Deploy**: Faça o push para o repositório. O GitHub Pages atualizará a visualização automaticamente, e a Action de CI roda `npm test` + `npm run validate` a cada push.

### Dados pessoais (LGPD)

`data.json` é **público** (servido pelo GitHub Pages), então o build nunca escreve
dados pessoais nele:

- **Pós-graduação**: nome, matrícula e e-mails não entram no arquivo. A identidade
  do aluno sobrevive apenas como `dedupKey` pseudonimizada, o que preserva a
  deduplicação e a contagem de alunos únicos.
- **IC**: `orientador` e `bolsista` são pseudônimos estáveis — o dashboard só usa
  esses campos para contar pessoas distintas.
- **Lattes**: `Servidor` já é a matrícula SIAPE, não o nome.

#### O salt de pseudonimização

A pseudonimização usa um salt criado automaticamente no primeiro build e guardado
em dois lugares, nenhum deles versionado:

| Arquivo | Papel |
|---|---|
| `.build-salt` (raiz do projeto) | usado pelo build |
| `~/.config/dashboard-prpgi/build-salt` | cópia de segurança, fora da árvore do projeto |

Ambos com permissão `0600`. **É segredo**: quem o tiver consegue reverter os
pseudônimos do `data.json` por força bruta (matrículas são enumeráveis).

Se `.build-salt` sumir — reclone, `git clean`, máquina nova — o build o restaura
da cópia e avisa no console, mantendo os pseudônimos idênticos. Perder **os dois**
não causa perda de dados, mas gera um salt novo: o `data.json` seguinte reescreve
todos os pseudônimos e o diff fica com 21 MB sem nenhuma mudança real. Se isso
acontecer, recupere o salt antigo antes de commitar.

Ao migrar de máquina, copie `~/.config/dashboard-prpgi/build-salt` junto.

`data-groups.json` (~64 MB) **não é versionado**: contém nomes, contatos e
composição das equipes de pesquisa, e não é consumido pelo dashboard. Ele é
regenerado por `npm run build` junto com o `data.json`, e serve ao projeto
`relatorio-grupos-pesquisa`.

---

## Desenvolvimento Local

Para rodar o projeto em ambiente de desenvolvimento com *hot-reload* (via `browser-sync` se configurado ou servidor simples):

```bash
npm start
```

O servidor iniciará na porta `8080`.

---

## Tecnologias Utilizadas

- **Visualização**: [Chart.js](https://www.chartjs.org/)
- **Mapas**: [Leaflet.js](https://leafletjs.com/)
- **Processamento de Dados**: [SheetJS (XLSX)](https://sheetjs.com/)
- **Estética**: Vanilla CSS com variáveis para temas dinâmicos.

---
© 2026 IFBA - PRPGI
