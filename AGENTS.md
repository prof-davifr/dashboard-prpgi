# AGENTS.md – Dashboard PRPGI

## ⚠️ Critical: IFBA ≠ IFBaiano

These are **two completely different federal institutions**:
- **IFBA** = Instituto Federal de Educação, Ciência e Tecnologia **da Bahia** — headquarters in Salvador, ~25 campuses across Bahia. **This is what this dashboard covers.**
- **IFBaiano** = Instituto Federal **Baiano** — a separate institution with its own campuses (Guanambi, Catu, Itapetinga, Santa Inês, etc.).

Any new data source integration **must** verify `Instituição` contains `"IFBA"` before processing. The `build.js` DGP CSV pipeline already enforces this guard.

## Campus Code Map (IFBA only)

| Code | City |
|------|------|
| BAR | Barreiras |
| BRU | Brumado |
| CAM | Camaçari |
| CFO | Campo Formoso |
| EC | Euclides da Cunha |
| EUN | Eunápolis |
| FS | Feira de Santana |
| ILH | Ilhéus |
| IRE | Irecê |
| JAC | Jacobina |
| JAG | Jaguaquara |
| JEQ | Jequié |
| JUA | Juazeiro |
| LF | Lauro de Freitas |
| PA | Paulo Afonso |
| PIS | Polo de Inovação Salvador |
| PS | Porto Seguro |
| SAJ | Santo Antônio de Jesus |
| SAM | Santo Amaro |
| SEA | Seabra |
| SF | Simões Filho |
| SSA | Salvador |
| UBA | Ubatã |
| VAL | Valença |
| VC | Vitória da Conquista |

## Commands

- `node build.js` – Process Excel/CSV files from `dados/` into `data.json`
- `npm start` – Start dev server on port 8080
- `python archive/server.py` – Start Python HTTP server on port 8000 (legacy)

## Data Structure

- `dados/` contains source files organized by scraper:
  - `scraper-SUAPCNPQ/` – Campus Excel files (`[CAMPUS]-2000-2026.xls`)
  - `scraper-DGP/` – Research groups CSV (`coletor_dgp_ifba.csv`)
  - `scraper-SUAPPos/` – Postgraduate students CSV (`alunos_pos_*.csv`)
- `build.js` recursively scans `dados/` for `.xls` and `.csv` files
- Output `data.json` is ~26MB, contains all processed data for dashboard
- `archive/` contains legacy scripts (e.g., `server.py`)
- `docs/` contains technical documentation and specifications

## Development

- Static dashboard: `index.html`, `src/script.js`, `src/style.css`
- No build step required for frontend changes
- Data updates: place files in correct `dados/` subdirectory, run `node build.js`
- Dashboard hosted at https://prof-davifr.github.io/dashboard-prpgi/

## Notes

- Excel processing uses `xlsx` library via Node.js
- `server.py` is legacy (now in `archive/`); use `npm start` for development
- `data.json` is git-ignored due to size; generated fresh on build
- Campus codes extracted from filename prefixes (e.g., `SSA-2000-2026.xls` → `SSA`)
- The `CAMPUS_TO_CITY` map and `IFBA_COORDS` object in `src/script.js` must be kept in sync with the campus code table above