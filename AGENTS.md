# AGENTS.md – Dashboard PRPGI

## Commands

- `node build.js` – Process Excel/CSV files from `dados/` into `data.json`
- `npm start` – Start dev server on port 8080
- `python archive/server.py` – Start Python HTTP server on port 8000 (legacy)

## Data Structure

- `dados/` contains source files organized by scraper:
  - `scraper-SUAPCNPQ/` – Campus Excel files (`[CAMPUS]-2000-2026.xls`)
  - `scraper-DGP/` – Research groups CSV (`coletor_dgp_ifba.csv`)
  - `scraper-SUAPPos/` – Postgraduate students CSV (not yet integrated)
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