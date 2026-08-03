/**
 * Helper to load browser-targeted scripts (non-module, global-scope) into a
 * Node.js vm context for unit testing without a real browser or jsdom.
 */
'use strict';

const vm = require('vm');
const fs = require('fs');
const path = require('path');

// Sem cópias locais: os mapeamentos vêm de src/shared.js, a mesma fonte que o
// browser carrega. Manter cópias aqui foi o que deixou o helper dessincronizado
// de script.js (UBA→UBATÃ, LF/PIS ausentes) por vários meses.
const SHARED_PATH = path.join(__dirname, '..', '..', 'src', 'shared.js');
const { CAMPUS_TO_CITY, IFBA_COORDS } = require(SHARED_PATH);

/**
 * Build a minimal mock document suitable for script initialisation.
 * Each call to getElementById/querySelectorAll returns a throwaway stub
 * that satisfies module-level code in script.js.
 */
function makeMockDocument() {
  const elem = () => ({
    textContent: '',
    innerHTML: '',
    style: {},
    value: 'all',
    checked: true,
    dataset: {},
    classList: {
      add: () => {},
      remove: () => {},
      toggle: () => {},
      contains: () => false,
    },
    addEventListener: () => {},
    parentElement: { style: {} },
    appendChild: () => {},
    title: '',
  });

  return {
    getElementById: () => elem(),
    querySelectorAll: () => ({ forEach: () => {} }),
    querySelector: () => null,
    addEventListener: () => {},
    body: { style: {} },
  };
}

/**
 * Create and return a vm context that emulates the browser globals used by
 * script.js / posgraduacao.js.  Extra entries in `overrides` are merged in
 * after the defaults, so callers can supply e.g. a specific STATE.maxYear.
 */
function createBrowserContext(overrides = {}) {
  const STATE = {
    raw: {
      bibliografica: [], tecnica: [], inovacao: [],
      concluidas: [], andamento: [], grupos: [], posgraduacao: [],
    },
    filtered: {
      bibliografica: [], tecnica: [], inovacao: [],
      concluidas: [], andamento: [], grupos: [], posgraduacao: [],
    },
    charts: {},
    leafMaps: {},
    minYear: 2000,
    maxYear: 2024,
  };

  const sandbox = {
    // ── JavaScript built-ins ──────────────────────────────────────────────
    Array, Object, Set, Map, Number, String, Boolean, RegExp, Date,
    Math, JSON, parseInt, parseFloat, isNaN, isFinite,
    NaN, Infinity, undefined,
    Error, TypeError, RangeError, ReferenceError,
    Promise, Symbol, Function,
    // ── Node.js globals ───────────────────────────────────────────────────
    console,
    // ── Browser globals (minimal stubs) ──────────────────────────────────
    document: makeMockDocument(),
    window: { addEventListener: () => {} },
    // ── Dashboard-specific globals ────────────────────────────────────────
    STATE,
    CAMPUS_TO_CITY,
    IFBA_COORDS,
    // ── Third-party library stubs ─────────────────────────────────────────
    Chart: function () { this.destroy = () => {}; },
    L: {
      map: () => ({
        setView: function () { return this; },
        addLayer: () => {},
        invalidateSize: () => {},
        remove: () => {},
      }),
      tileLayer: () => ({ addTo: () => {} }),
      circleMarker: () => ({
        addTo: function () { return this; },
        bindPopup: function () { return this; },
      }),
    },
    caches: undefined,
    fetch: undefined,
    ...overrides,
  };

  vm.createContext(sandbox);

  // shared.js entra no contexto antes de qualquer outro script, exatamente como
  // no index.html — é ele que define CAMPUS_TO_CITY, IFBA_COORDS,
  // normalizeText, mapUnidadeToCampus e lookupCoords como globais.
  loadScript(sandbox, SHARED_PATH);

  return sandbox;
}

/**
 * Load a browser script file into an existing vm context and return the
 * (mutated) context so callers can access the functions it defined.
 */
function loadScript(ctx, scriptPath) {
  const code = fs.readFileSync(scriptPath, 'utf-8');
  vm.runInContext(code, ctx);
  return ctx;
}

/**
 * Ordem de carga dos scripts do dashboard — a mesma do index.html.
 * shared.js fica de fora: createBrowserContext já o carrega no contexto.
 */
const DASHBOARD_SCRIPTS = [
  'core.js', 'filters.js', 'charts.js', 'maps.js', 'tables.js',
  'pesquisadores.js', 'posgraduacao.js', 'cache.js'
];

/**
 * Carrega o dashboard inteiro no contexto, na ordem do index.html. Usar isto
 * em vez de apontar para um módulo isolado: as funções de um arquivo dependem
 * de globais definidos nos outros, exatamente como no browser.
 */
function loadDashboard(ctx, apenas = DASHBOARD_SCRIPTS) {
  const base = path.join(__dirname, '..', '..', 'src');
  apenas.forEach(f => loadScript(ctx, path.join(base, f)));
  return ctx;
}

module.exports = {
  createBrowserContext,
  loadScript,
  loadDashboard,
  DASHBOARD_SCRIPTS,
  CAMPUS_TO_CITY,
  IFBA_COORDS
};
