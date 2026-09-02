/**
 * Smoke test E2E da página Pós-Graduação Validação (congelada).
 *
 * Ela não é uma aba do painel principal: é uma página própria, com porta de
 * senha e sem Leaflet nem SheetJS. O teste cobre a porta, a carga dos dados,
 * as três sub-abas e o filtro de campus.
 *
 * A senha vem de POS_VALIDACAO_SENHA. Sem a variável, o teste é pulado: o hash
 * gravado em src/pos-validacao-porta.js é da senha real, que não fica no
 * repositório.
 */
const { test, expect } = require('@playwright/test');
const { collectJsErrors, kpiValueByLabel, chartHasData } = require('./helpers');

const PAGINA = '/pos-validacao-f85b5515.html';
const SENHA = process.env.POS_VALIDACAO_SENHA;

test.skip(!SENHA, 'defina POS_VALIDACAO_SENHA para rodar o smoke da página de validação');

async function abrirPagina(page) {
  await page.goto(PAGINA, { waitUntil: 'domcontentloaded' });
  await page.fill('#porta-senha', SENHA);
  await page.click('#porta-form button');
  await page.waitForFunction(
    () => {
      const loading = document.getElementById('loading');
      const kpis = document.querySelectorAll('#kpi-posgraduacao-overview .kpi-value');
      return loading && loading.style.display === 'none' && kpis.length > 0;
    },
    null,
    { timeout: 90_000 },
  );
}

test('a porta esconde a página até a senha certa', async ({ page }) => {
  await page.goto(PAGINA, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#tab-posgraduacao')).toBeHidden();

  await page.fill('#porta-senha', 'senha-errada');
  await page.click('#porta-form button');
  await expect(page.locator('#porta-erro')).toHaveText(/Senha incorreta/);
  await expect(page.locator('#tab-posgraduacao')).toBeHidden();

  await page.fill('#porta-senha', SENHA);
  await page.click('#porta-form button');
  await expect(page.locator('#tab-posgraduacao')).toBeVisible();
});

test('carrega os indicadores por ciclo sem erro de JS', async ({ page }) => {
  const errors = collectJsErrors(page);
  await abrirPagina(page);

  // Os filtros se populam a partir do data.json, não do HTML.
  await expect(page.locator('#posgrad-campus-filter option')).not.toHaveCount(1);
  await expect(page.locator('#posgrad-curso-filter option')).not.toHaveCount(1);

  expect(await chartHasData(page, 'chart-posgraduacao-evolucao')).toBe(true);

  const encerrados = await kpiValueByLabel(page, 'kpi-posgraduacao-overview', 'Ciclos encerrados');
  expect(encerrados).toBeGreaterThan(0);

  // A identidade que motivou o STATE.filtered.posgraduacaoTodosCiclos:
  // Matriculados = Em curso + Retidos, com o filtro de ciclo ligado.
  const matriculados = await kpiValueByLabel(page, 'kpi-posgraduacao-overview', 'Matriculados (M)');
  const emCurso = await kpiValueByLabel(page, 'kpi-posgraduacao-overview', 'Em curso');
  const retidos = await kpiValueByLabel(page, 'kpi-posgraduacao-overview', 'Retidos');
  expect(matriculados).toBe(emCurso + retidos);

  expect(errors.page).toEqual([]);
  expect(errors.console).toEqual([]);
});

test('as três sub-abas desenham', async ({ page }) => {
  await abrirPagina(page);

  await page.click('.sub-tab-btn[data-subtarget="subtab-cursos"]');
  await expect
    .poll(async () => chartHasData(page, 'chart-posgraduacao-curso-evolucao'), { timeout: 15_000 })
    .toBe(true);

  await page.click('.sub-tab-btn[data-subtarget="subtab-campus"]');
  await expect
    .poll(async () => chartHasData(page, 'chart-posgraduacao-campus-evolucao'), { timeout: 15_000 })
    .toBe(true);
});

test('o filtro de campus reduz o recorte', async ({ page }) => {
  await abrirPagina(page);

  const antes = await kpiValueByLabel(page, 'kpi-posgraduacao-overview', 'Ciclos encerrados');
  await page.selectOption('#posgrad-campus-filter', 'VC');
  await expect
    .poll(async () => kpiValueByLabel(page, 'kpi-posgraduacao-overview', 'Ciclos encerrados'), { timeout: 15_000 })
    .toBeLessThan(antes);
});
