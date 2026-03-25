# Dashboard PRPGI – IFBA

Este é o dashboard standalone da PRPGI projetado para ser incorporado via iframe.

## 🚀 Demonstração Online

O dashboard está hospedado no GitHub Pages e pode ser acessado em:
[https://prof-davifr.github.io/dashboard-prpgi/](https://prof-davifr.github.io/dashboard-prpgi/)


## Estrutura do Projeto

- `index.html`: A página principal do dashboard. Contém a estrutura de abas, layout CSS de alta qualidade (glass-morphism, dark mode) e as bibliotecas (SheetJS, Chart.js, Leaflet) via CDN.
- `script.js`: O motor do dashboard. Carrega os arquivos `.xls` e `.csv` da pasta `dados/` assincronamente, mapeia as métricas estipuladas e renderiza os gráficos responsivos.
- `dados/`: Pasta contendo os arquivos Excel de todos os campi (`[CAM]_1947_2027.xls`) e o arquivo DGP (`coletor_dgp_ifba.csv`). Você pode adicionar/substituir planilhas adicionadas desde que mantenham exatamente o mesmo nome/formato.

## Notas sobre Layout

O layout foi organizado conforme solicitado:
- **Gráficos de Evolução**: Vêm sempre primeiro na aba e ocupam a tela de fora a fora.
- **Outros Gráficos**: Ficam logo abaixo, organizados em uma grade de duas colunas (dois em uma linha), garantindo excelente visualização.
- Além destes, adicionamos cards de KPIs nas partes superiores, e navegação via abas laterais/superiores para transitar entre as 5 áreas de atuação.

Para rodar online no IFBA, basta hospedar `index.html`, `script.js`, as pastas `css/img` (caso tenha) e a pasta `dados/` num servidor web padrão e chamar via `<iframe>` no portal.
