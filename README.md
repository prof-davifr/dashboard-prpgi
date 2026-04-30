# 📊 Dashboard PRPGI – IFBA

Este é o dashboard institucional da Pró-Reitoria de Pesquisa, Pós-Graduação e Inovação (PRPGI) do IFBA. Um sistema *standalone* de alta performance, projetado para visualização de indicadores acadêmicos e científicos, pronto para integração via `<iframe>`.
---

## 🚀 Demonstração Online

O dashboard está hospedado no GitHub Pages e pode ser acessado em:
👉 **[https://prof-davifr.github.io/dashboard-prpgi/](https://prof-davifr.github.io/dashboard-prpgi/)**

---

## 📂 Estrutura do Projeto

O projeto é organizado para ser leve e fácil de manter, utilizando uma arquitetura de dados estáticos pré-processados.

### 🏛️ Núcleo da Aplicação
- `index.html`: Estrutura principal e ponto de entrada do dashboard.
- `src/style.css`: Estilização premium e responsiva (extraída do HTML).
- `src/script.js`: Motor principal de carregamento, filtros e renderização.
- `src/pesquisadores.js` & `src/posgraduacao.js`: Módulos lógicos especializados.
- `data.json`: Base de dados consolidada (gerada durante o build).

### 🛠️ Ferramentas e Dados
- `build.js`: Script Node.js que unifica e otimiza os dados brutos.
- `dados/`: Repositório de fontes brutas (Excel/CSV) organizadas por scraper.
- `package.json`: Definições de dependências e scripts de automação.

### 📚 Documentação e Arquivos
- `docs/`: Especificações técnicas, notas de metodologia e manuais.
- `docs/assets/`: Ativos de design e mockups originais.
- `archive/`: Arquivos legados e ferramentas de teste temporárias (ex: `server.py`).

---

## 🔄 Fluxo de Atualização de Dados

Para atualizar os números do dashboard, siga o processo de *ETL* simplificado:

1.  **Coleta**: Insira os novos arquivos `.xls` ou `.csv` nas respectivas subpastas dentro de `dados/`.
2.  **Processamento**: Execute o motor de unificação:
    ```bash
    npm run build
    # ou
    node build.js
    ```
3.  **Validação**: Verifique o tamanho e conteúdo do novo `data.json` gerado.
4.  **Deploy**: Faça o push para o repositório. O GitHub Pages atualizará a visualização automaticamente.

---

## 🧪 Desenvolvimento Local

Para rodar o projeto em ambiente de desenvolvimento com *hot-reload* (via `browser-sync` se configurado ou servidor simples):

```bash
npm start
```

O servidor iniciará na porta `8080`.

---

## 🛠️ Tecnologias Utilizadas

- **Visualização**: [Chart.js](https://www.chartjs.org/)
- **Mapas**: [Leaflet.js](https://leafletjs.com/)
- **Processamento de Dados**: [SheetJS (XLSX)](https://sheetjs.com/)
- **Estética**: Vanilla CSS com variáveis para temas dinâmicos.

---

### 📝 Notas de Versão (WIP)
Atualmente, estamos integrando o módulo de **Pós-Graduação**, permitindo a visualização de coortes, taxas de conclusão e risco acadêmico diretamente no painel. Veja o roadmap em [`docs/POSGRADUACAO_TODO.md`](docs/POSGRADUACAO_TODO.md).

---
© 2026 IFBA – PRPGI
