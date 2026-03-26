# Dashboard PRPGI – IFBA

Este é o dashboard standalone da PRPGI projetado para ser incorporado via iframe.

## Demonstração Online

O dashboard está hospedado no GitHub Pages e pode ser acessado em:
[https://prof-davifr.github.io/dashboard-prpgi/](https://prof-davifr.github.io/dashboard-prpgi/)

## Fonte de Dados

O dashboard é alimentado por dados provenientes dos lattes dos pesquisadores e do espelhos dos grupos de pesquisa.

## Estrutura do Projeto

- `index.html`: A página principal do dashboard. Contém a estrutura de abas, layout CSS de alta qualidade (glass-morphism, dark mode) e as bibliotecas (Chart.js, Leaflet) via CDN.
- `script.js`: O motor do dashboard. Carrega o arquivo unificado `data.json` assincronamente (gerado durante o build), processa os filtros e métricas e renderiza os gráficos responsivos.
- `build.js`: Script de pré-processamento. Ele varre a pasta `dados/`, lê todos os arquivos `.xls` e `.csv`, extrai e otimiza apenas os campos necessários, remove duplicatas parciais e gera o arquivo `data.json`.
- `dados/`: Pasta contendo os arquivos Excel originais extraídos do Lattes e o arquivo do DGP (`coletor_dgp_ifba.csv`).
- `data.json`: Arquivo consolidado e otimizado servido para a interface pública.

## Como Atualizar os Dados

1. Coloque ou substitua as planilhas do Lattes (`[SIGLA-CAMPUS]_[ANO-INICIAL]_[ANO-FINAL].xls`) e o arquivo DGP (`coletor_dgp_ifba.csv`) na pasta `dados/`. O sistema detecta o período automaticamente pelo nome do arquivo.
2. Certifique-se de ter o [Node.js](https://nodejs.org/) instalado.
3. No terminal do projeto, execute o script de build para gerar o novo consolidado de dados:

   ```bash
   node build.js
   ```

   *(ou `npm run build` se estiver utilizando package.json)*
4. O arquivo `data.json` será atualizado com os novos dados, reduzindo o tempo de carregamento no navegador.

## Implantação e Deploy

Para rodar online no portal do IFBA, basta hospedar `index.html`, `script.js`, `data.json`, `style.css` e demais assets num servidor web padrão e chamá-lo via `<iframe>`. O servidor não precisa processar Excel, pois isso já foi feito estaticamente pela etapa de *build*.
