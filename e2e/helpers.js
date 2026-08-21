/**
 * Helpers compartilhados dos smoke tests.
 */

/**
 * Navega para o dashboard e espera a carga de dados terminar
 * (overlay #loading escondido + KPIs da aba científica populados).
 */
async function gotoDashboard(page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    () => {
      const loading = document.getElementById('loading');
      const kpis = document.querySelectorAll('#kpi-cientifica .kpi-value');
      return loading && loading.style.display === 'none' && kpis.length > 0;
    },
    null,
    { timeout: 90_000 },
  );
}

/**
 * Instala coletores de erros JS e retorna o objeto de coleta.
 * pageerror = exceção não tratada; console error = console.error().
 */
function collectJsErrors(page) {
  const errors = { page: [], console: [] };
  page.on('pageerror', (err) => errors.page.push(String(err.message || err)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.console.push(msg.text());
  });
  return errors;
}

/**
 * Lê o primeiro valor KPI de um grid como número puro (remove separadores).
 */
async function firstKpiValue(page, gridId) {
  const text = await page.locator(`#${gridId} .kpi-value`).first().innerText();
  const digits = text.replace(/[^\d]/g, '');
  return digits ? Number(digits) : 0;
}

/**
 * Lê um KPI pelo rótulo visível, como número puro. Mais estável que a posição:
 * a ordem dos cards muda quando um KPI entra ou sai.
 */
async function kpiValueByLabel(page, gridId, label) {
  return page.evaluate(
    ({ gridId, label }) => {
      const card = [...document.querySelectorAll(`#${gridId} .kpi-card`)].find(
        (c) => c.querySelector('.kpi-label') && c.querySelector('.kpi-label').textContent.trim() === label,
      );
      if (!card) return null;
      const digits = card.querySelector('.kpi-value').textContent.replace(/[^\d]/g, '');
      return digits ? Number(digits) : 0;
    },
    { gridId, label },
  );
}

/** Conta circle markers (SVG paths) renderizados por um mapa Leaflet. */
const mapCircles = (page, mapId) =>
  page.locator(`#${mapId} path.leaflet-interactive`).count();

/** Retorna true se o canvas tem um gráfico Chart.js registrado com datasets. */
async function chartHasData(page, canvasId) {
  return page.evaluate((id) => {
    const canvas = document.getElementById(id);
    if (!canvas) return false;
    const chart = window.Chart && Chart.getChart(canvas);
    return !!(chart && chart.data && chart.data.datasets && chart.data.datasets.length > 0);
  }, canvasId);
}

module.exports = { gotoDashboard, collectJsErrors, firstKpiValue, kpiValueByLabel, mapCircles, chartHasData };
