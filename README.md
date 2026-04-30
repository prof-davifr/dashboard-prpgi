#  Dashboard PRPGI  IFBA

Este  o dashboard institucional da Pr-Reitoria de Pesquisa, Ps-Graduao e Inovao (PRPGI) do IFBA. Um sistema *standalone* de alta performance, projetado para visualizao de indicadores acadmicos e cientficos, pronto para integrao via `<iframe>`.
---

##  Demonstrao Online

O dashboard est hospedado no GitHub Pages e pode ser acessado em:
 **[https://prof-davifr.github.io/dashboard-prpgi/](https://prof-davifr.github.io/dashboard-prpgi/)**

---

##  Estrutura do Projeto

O projeto  organizado para ser leve e fcil de manter, utilizando uma arquitetura de dados estticos pr-processados.

###  Ncleo da Aplicao
- `index.html`: Estrutura principal e ponto de entrada do dashboard.
- `src/style.css`: Estilizao premium e responsiva (extrada do HTML).
- `src/script.js`: Motor principal de carregamento, filtros e renderizao.
- `src/pesquisadores.js` & `src/posgraduacao.js`: Mdulos lgicos especializados.
- `data.json`: Base de dados consolidada (gerada durante o build).

###  Ferramentas e Dados
- `build.js`: Script Node.js que unifica e otimiza os dados brutos.
- `dados/`: Repositrio de fontes brutas (Excel/CSV) organizadas por scraper.
- `package.json`: Definies de dependncias e scripts de automao.

###  Documentao e Arquivos
- `docs/`: Especificaes tcnicas, notas de metodologia e manuais.
- `docs/assets/`: Ativos de design e mockups originais.
- `archive/`: Arquivos legados e ferramentas de teste temporrias (ex: `server.py`).

---

##  Fluxo de Atualizao de Dados

Para atualizar os nmeros do dashboard, siga o processo de *ETL* simplificado:

1.  **Coleta**: Insira os novos arquivos `.xls` ou `.csv` nas respectivas subpastas dentro de `dados/`.
2.  **Processamento**: Execute o motor de unificao:
    ```bash
    npm run build
    # ou
    node build.js
    ```
3.  **Validao**: Verifique o tamanho e contedo do novo `data.json` gerado.
4.  **Deploy**: Faa o push para o repositrio. O GitHub Pages atualizar a visualizao automaticamente.

---

##  Desenvolvimento Local

Para rodar o projeto em ambiente de desenvolvimento com *hot-reload* (via `browser-sync` se configurado ou servidor simples):

```bash
npm start
```

O servidor iniciar na porta `8080`.

---

##  Tecnologias Utilizadas

- **Visualizao**: [Chart.js](https://www.chartjs.org/)
- **Mapas**: [Leaflet.js](https://leafletjs.com/)
- **Processamento de Dados**: [SheetJS (XLSX)](https://sheetjs.com/)
- **Esttica**: Vanilla CSS com variveis para temas dinmicos.

---

###  Notas de Verso (WIP)
Atualmente, estamos integrando o mdulo de **Ps-Graduao**, permitindo a visualizao de coortes, taxas de concluso e risco acadmico diretamente no painel. Veja o roadmap em [`docs/POSGRADUACAO_TODO.md`](docs/POSGRADUACAO_TODO.md).

---
 2026 IFBA  PRPGI
