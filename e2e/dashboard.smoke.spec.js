/**
 * Smoke tests E2E do Dashboard PRPGI (navegador real via Playwright).
 *
 * Escopo proposital: validar o que o Jest+VM NÃO cobre — renderização real
 * (Leaflet, Chart.js), interação de UI (abas, filtros, modais, exportação)
 * e ausência de erros JS. Dados numéricos exatos ficam no Jest.
 */
const { test, expect } = require('@playwright/test');
const { gotoDashboard, collectJsErrors, firstKpiValue, mapCircles, chartHasData } = require('./helpers');

const TABS = [
  { btn: '#aba-cientifica', panel: '#tab-cientifica', canvases: ['chart-cientifica-evolucao'] },
  { btn: '#aba-tecnica', panel: '#tab-tecnica', canvases: ['chart-tecnica-evolucao', 'chart-tecnica-pie'] },
  { btn: '#aba-inovacao', panel: '#tab-inovacao', canvases: ['chart-inovacao-evo-1', 'chart-inovacao-pie'] },
  { btn: '#aba-grupos', panel: '#tab-grupos', canvases: ['chart-grupos-evo-combined', 'chart-grupos-pie'] },
  { btn: '#aba-pesquisadores', panel: '#tab-pesquisadores', canvases: ['chart-pesquisadores-evolucao', 'chart-pesquisadores-area'] },
  { btn: '#aba-orientacoes', panel: '#tab-orientacoes', canvases: ['chart-orientacoes-evo-1', 'chart-orientacoes-pie'] },
  { btn: '#aba-posgraduacao', panel: '#tab-posgraduacao', canvases: ['chart-posgraduacao-evolucao', 'chart-posgraduacao-status'] },
  { btn: '#aba-ic', panel: '#tab-ic', canvases: ['chart-ic-evolucao', 'chart-ic-modalidade'] },
];

const MAPS = ['map-cientifica', 'map-tecnica', 'map-inovacao', 'map-grupos', 'map-pesquisadores', 'map-orientacoes', 'map-ic'];

test.beforeEach(async ({ page }) => {
  await gotoDashboard(page);
});

test('carrega e inicializa com dados reais', async ({ page }) => {
  // Filtros populados
  await expect(page.locator('#period-filter option').first()).toHaveText(/Todo o Período \(\d{4}-\d{4}\)/);
  await expect(page.locator('#campus-filter option')).toHaveCount(26); // "Todos" + 25 campi

  // KPIs da aba científica com valores
  const total = await firstKpiValue(page, 'kpi-cientifica');
  expect(total).toBeGreaterThan(1000);

  // Datasets carregados no STATE
  const sizes = await page.evaluate(() => ({
    bibliografica: STATE.raw.bibliografica.length,
    tecnica: STATE.raw.tecnica.length,
    grupos: STATE.raw.grupos.length,
    posgraduacao: STATE.raw.posgraduacao.length,
    ic: STATE.raw.ic.length,
  }));
  expect(sizes.bibliografica).toBeGreaterThan(1000);
  expect(sizes.tecnica).toBeGreaterThan(1000);
  expect(sizes.grupos).toBeGreaterThan(0);
  expect(sizes.posgraduacao).toBeGreaterThan(0);
  expect(sizes.ic).toBeGreaterThan(0);

  // Footer com data de processamento
  await expect(page.locator('#last-update-display')).not.toHaveText('...');
});

test('mapas Leaflet renderizam circle markers', async ({ page }) => {
  for (const mapId of MAPS) {
    // espera os circle markers surgirem (renderização assíncrona do SVG)
    await expect.poll(async () => mapCircles(page, mapId), { timeout: 15_000 }).toBeGreaterThan(0);
  }
  // mapa da científica cobre os 25 campi
  expect(await mapCircles(page, 'map-cientifica')).toBe(25);
});

test('gráficos Chart.js renderizam em todas as abas', async ({ page }) => {
  // Gráficos da aba ativa (científica) já existem ao carregar
  expect(await chartHasData(page, 'chart-cientifica-evolucao')).toBe(true);

  for (const { btn, panel, canvases } of TABS) {
    await page.click(btn);
    await expect(page.locator(panel)).toHaveClass(/active/);
    await expect(page.locator(btn)).toHaveAttribute('aria-selected', 'true');

    for (const canvasId of canvases) {
      // renderização é re-disparada ao ativar a aba; dá margem para o Chart.js
      await expect
        .poll(async () => chartHasData(page, canvasId), { timeout: 15_000 })
        .toBe(true);
    }
  }
});

test('filtro por campus atualiza KPIs e mapas', async ({ page }) => {
  const total = await firstKpiValue(page, 'kpi-cientifica');

  await page.selectOption('#campus-filter', 'SSA');
  const ssa = await firstKpiValue(page, 'kpi-cientifica');
  expect(ssa).toBeGreaterThan(0);
  expect(ssa).toBeLessThan(total);

  await page.selectOption('#campus-filter', 'VC');
  const vc = await firstKpiValue(page, 'kpi-cientifica');
  expect(vc).toBeGreaterThan(0);
  expect(vc).not.toBe(ssa);

  // Mapa reflete o filtro (círculos por cidade = menos cidades, não 0)
  await expect.poll(async () => mapCircles(page, 'map-cientifica'), { timeout: 15_000 }).toBeGreaterThan(0);
});

test('pós-graduação: filtros de gestão e subtabs funcionam', async ({ page }) => {
  await page.click('#aba-posgraduacao');
  await expect(page.locator('#tab-posgraduacao')).toHaveClass(/active/);

  // Filtro de campus da pós populado com opções reais
  await expect(page.locator('#posgrad-campus-filter option')).not.toHaveCount(1);

  const total = await firstKpiValue(page, 'kpi-posgraduacao-overview');

  await page.selectOption('#posgrad-campus-filter', 'VC');
  const vc = await firstKpiValue(page, 'kpi-posgraduacao-overview');
  expect(vc).toBeGreaterThan(0);
  expect(vc).toBeLessThanOrEqual(total);

  // Subtabs
  await page.click('[data-subtarget="subtab-cursos"]');
  await expect(page.locator('#subtab-cursos')).toHaveClass(/active/);
  await expect
    .poll(async () => chartHasData(page, 'chart-posgraduacao-curso-evolucao'), { timeout: 15_000 })
    .toBe(true);

  await page.click('[data-subtarget="subtab-campus"]');
  await expect(page.locator('#subtab-campus')).toHaveClass(/active/);
  await expect
    .poll(async () => chartHasData(page, 'chart-posgraduacao-campus-evolucao'), { timeout: 15_000 })
    .toBe(true);
});

test('tabela detalhada expande e exporta para Excel', async ({ page }) => {
  await page.click('.table-toggle-btn');
  await expect(page.locator('#table-cientifica-container')).toHaveClass(/active/);
  const rows = await page.locator('#table-cientifica-content table tbody tr').count();
  expect(rows).toBeGreaterThan(0);

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 30_000 }),
    page.click('.export-btn'),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
});

test('modal de metodologia abre e fecha', async ({ page }) => {
  await page.click('#methodology-btn');
  await expect(page.locator('#methodology-modal')).toHaveClass(/active/);
  await expect(page.locator('#methodology-modal-title')).toBeVisible();

  await page.click('#modal-close');
  await expect(page.locator('#methodology-modal')).not.toHaveClass(/active/);
});

test('modal de mapa ampliado renderiza círculos', async ({ page }) => {
  // botão expandir é anexado ao .map-container (pai do mapa), não dentro do #map-cientifica
  await page.locator('.map-container').first().locator('.map-expand-btn').click();
  await expect(page.locator('#map-modal')).toHaveClass(/active/);
  await expect
    .poll(async () => page.locator('#map-modal-map path.leaflet-interactive').count(), { timeout: 15_000 })
    .toBeGreaterThan(0);

  await page.click('#map-modal-close');
  await expect(page.locator('#map-modal')).not.toHaveClass(/active/);
});

test('não há erros de JavaScript no console', async ({ page }) => {
  // navegação já aconteceu no beforeEach — recolhe erros desde o início
  const fresh = await page.context().newPage();
  const errors = collectJsErrors(fresh);
  await gotoDashboard(fresh);
  await fresh.click('#aba-posgraduacao');
  await fresh.click('.map-expand-btn').catch(() => {});
  await fresh.waitForTimeout(3000);

  expect(errors.page, `pageerror: ${errors.page.join('\n')}`).toEqual([]);
  // ignora apenas falhas benignas de rede (tiles CDN, favicon)
  const relevant = errors.console.filter(
    (e) => !/favicon|net::ERR|Failed to load resource|ERR_NAME_NOT_RESOLVED/i.test(e),
  );
  expect(relevant, `console.error: ${relevant.join('\n')}`).toEqual([]);
  await fresh.close();
});
