// @ts-check
const { defineConfig } = require('@playwright/test');

/**
 * Smoke tests E2E (navegador real, Chromium).
 *
 * Cobrem o que o Jest+VM não enxerga: renderização real de Leaflet e
 * Chart.js, troca de abas, modais, exportação e ausência de erros JS.
 *
 * Requer rede: os assets (Chart.js/Leaflet/xlsx) vêm de CDNs no index.html.
 * O servidor de desenvolvimento é o mesmo do `npm start` (live-server:8080),
 * reutilizado se já estiver rodando.
 */
module.exports = defineConfig({
  testDir: './e2e',
  timeout: 120_000, // data.json tem ~22 MB; a 1ª carga é lenta
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 2,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:8080',
    viewport: { width: 1280, height: 800 },
    actionTimeout: 20_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: {
    command: 'npx live-server --port=8080 --no-browser',
    url: 'http://localhost:8080/',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
