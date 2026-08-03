// core.js — estado global, utilidades e chrome da interface.
//
// Primeiro script do dashboard depois de shared.js: define STATE e o atalho $,
// dos quais todos os outros módulos dependem. Também cuida da troca de abas,
// dos modais e do toast.

// script.js – PRPGI Dashboard core logic
// Data is pre-built into data.json by scripts/build.js (run: node scripts/build.js)


const STATE = {
  raw: {
    bibliografica: [],
    tecnica: [],
    inovacao: [],
    concluidas: [],
    andamento: [],
    grupos: [],
    posgraduacao: [],
    ic: []
  },
  filtered: {},
  charts: {},
  leafMaps: {},
  minYear: 1947,
  maxYear: new Date().getFullYear()
};

// Utilities for DOM
const $ = id => document.getElementById(id);

document.getElementById('year').textContent = new Date().getFullYear();

function formatDateTimePtBr(isoString) {
  if (!isoString) return "não disponível";
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return "não disponível";
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function renderSourceUpdates(meta) {
  const sourceDates = meta && meta.sourceDates ? meta.sourceDates : {};
  const entries = Object.values(sourceDates)
    .sort((a, b) => (a.label || '').localeCompare(b.label || '', 'pt-BR'))
    .map(source => `${source.label}: ${formatDateTimePtBr(source.modifiedAt)}`);

  const text = entries.length > 0
    ? `Fontes: ${entries.join(' | ')}`
    : 'Fontes: não disponível';

  if ($('source-updates-display')) $('source-updates-display').textContent = text;
  if ($('source-updates-modal')) $('source-updates-modal').textContent = `Atualização por fonte: ${entries.length > 0 ? entries.join(' | ') : 'não disponível'}.`;
}

// Tab switching
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const previousActiveTab = document.querySelector('.tab-btn.active');
    const switchingToPosGraduacao = e.target.dataset.target === 'tab-posgraduacao';
    const switchingFromPosGraduacao = previousActiveTab && previousActiveTab.dataset.target === 'tab-posgraduacao';
    const switchingToPesquisadores = e.target.dataset.target === 'tab-pesquisadores';

    document.querySelectorAll('.tab-btn').forEach(b => {
      b.classList.remove('active');
      // Roving tabindex: só a aba ativa entra na ordem de tabulação; as
      // outras são alcançadas pelas setas, como manda o padrão ARIA de tabs.
      b.setAttribute('aria-selected', 'false');
      b.setAttribute('tabindex', '-1');
    });
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    e.target.classList.add('active');
    e.target.setAttribute('aria-selected', 'true');
    e.target.setAttribute('tabindex', '0');
    $(e.target.dataset.target).classList.add('active');

    // Fix for Leaflet maps in hidden tabs
    setTimeout(() => {
      Object.values(STATE.leafMaps).forEach(m => {
        if (m) m.invalidateSize();
      });
    }, 100);

    // Reset post-graduation filters if switching away from that tab
    if (switchingFromPosGraduacao && !switchingToPosGraduacao) {
      const posgradFilters = ['posgrad-categoria-filter', 'posgrad-status-filter', 'posgrad-campus-filter', 'posgrad-curso-filter'];
      posgradFilters.forEach(id => {
        const elem = $(id);
        if (elem && elem.value !== 'all') {
          elem.value = 'all';
        }
      });
      if ($('posgrad-matured-only-toggle')) $('posgrad-matured-only-toggle').checked = true;
      processData();
    }

    // Re-render post-graduation charts if that tab is now active
    if (switchingToPosGraduacao) {
      renderChartsPosGraduacao();
    }
    
    // Re-render pesquisadores charts if that tab is now active
    if (switchingToPesquisadores) {
      renderChartsPesquisadores();
    }
  });
  
  // Re-render IC charts when IC tab becomes active
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if ($('tab-ic') && $('tab-ic').classList.contains('active')) {
        renderChartsIC();
      }
    });
  });
});

// Navegação por teclado nas abas (padrão ARIA tablist): setas movem entre as
// abas, Home/End vão para a primeira/última. Sem isto, com roving tabindex o
// teclado só alcançaria a aba ativa.
document.querySelector('.tabs') && document.querySelector('.tabs').addEventListener('keydown', (e) => {
  const teclas = ['ArrowRight', 'ArrowLeft', 'Home', 'End'];
  if (!teclas.includes(e.key)) return;

  const abas = [...document.querySelectorAll('.tab-btn')];
  if (abas.length === 0) return;
  const atual = abas.indexOf(document.activeElement);
  if (atual === -1) return;

  let alvo;
  if (e.key === 'ArrowRight') alvo = (atual + 1) % abas.length;
  else if (e.key === 'ArrowLeft') alvo = (atual - 1 + abas.length) % abas.length;
  else if (e.key === 'Home') alvo = 0;
  else alvo = abas.length - 1;

  e.preventDefault();
  abas[alvo].focus();
  abas[alvo].click();
});

// Extract distinct Servidor ID
function extractServidorIds(records) {
  const ids = new Set();
  records.forEach(r => {
    if (r["Servidor"]) ids.add(r["Servidor"]);
  });
  return ids;
}

// Get count of distinct servidores per campus
function getServidoresPerCampus(records) {
  const campusMap = {}; // campus -> Set of servidor IDs
  records.forEach(r => {
    if (r["Servidor"] && r.campus) {
      if (!campusMap[r.campus]) campusMap[r.campus] = new Set();
      campusMap[r.campus].add(r["Servidor"]);
    }
  });
  // Convert Sets to counts
  const result = {};
  Object.keys(campusMap).forEach(campus => {
    result[campus] = campusMap[campus].size;
  });
  return result;
}

// Get total distinct servidores across all campuses
function getTotalServidores(records) {
  return extractServidorIds(records).size;
}

// Get total active researchers across ALL data sources (for relative metrics divisor)
function getTotalActiveResearchers() {
  const allIdsArray = [];
  [STATE.filtered.bibliografica, STATE.filtered.tecnica, STATE.filtered.concluidas, STATE.filtered.andamento].forEach(arr => {
    arr.forEach(r => {
      if (r["Servidor"]) {
        allIdsArray.push(r["Servidor"]);
      }
    });
  });
  return new Set(allIdsArray).size;
}

// Check if relative metrics mode is active
function isRelativeMetricsEnabled() {
  const toggle = $('relative-metrics-toggle');
  return toggle ? toggle.checked : false;
}

// Format relative metric value (with 2 decimal places)
function formatRelativeValue(value, divisor) {
  if (divisor === 0 || divisor === null || divisor === undefined) return '0';
  const result = value / divisor;
  return result.toFixed(2);
}

// =====================
// Tab: Pesquisadores
// =====================


// =====================
// Toast notification
// =====================

function showToast(message, durationMs = 6000) {
  const container = $('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  container.appendChild(toast);
  // Trigger animation
  requestAnimationFrame(() => toast.classList.add('toast--visible'));
  setTimeout(() => {
    toast.classList.remove('toast--visible');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  }, durationMs);
}

// Update filter visibility based on active tab
function updateFilterVisibility() {
  const activeTab = document.querySelector('.tab-btn.active');
  if (!activeTab) return;
  
  const isPosGraduacaoTab = activeTab.dataset.target === 'tab-posgraduacao';
  const periodFilter = $('period-filter');
  
  // Show/hide unique toggle (not needed for post-graduation)
  const uniqueToggle = $('unique-toggle');
  if (uniqueToggle) {
    uniqueToggle.parentElement.style.display = isPosGraduacaoTab ? 'none' : 'flex';
  }
  if (periodFilter) {
    periodFilter.style.display = isPosGraduacaoTab ? 'none' : '';
  }
}

function getChartColors(count) {
  const palette = ["#4D90FE", "#F44336", "#4CAF50", "#FFC107", "#9C27B0", "#00BCD4", "#E91E63", "#FF9800", "#795548", "#607D8B"];
  return Array.from({ length: count }, (_, index) => palette[index % palette.length]);
}

// Acessibilidade de modais: guarda quem tinha o foco antes de abrir, para
// devolvê-lo ao fechar, e prende o Tab dentro do diálogo enquanto ele está
// aberto — sem isso o teclado sai do modal e navega a página por baixo.
let focoAntesDoModal = null;

const FOCAVEIS = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function prenderFoco(modal, e) {
  if (e.key !== 'Tab') return;
  const focaveis = [...modal.querySelectorAll(FOCAVEIS)].filter(el => el.offsetParent !== null);
  if (focaveis.length === 0) return;
  const primeiro = focaveis[0];
  const ultimo = focaveis[focaveis.length - 1];

  if (e.shiftKey && document.activeElement === primeiro) {
    e.preventDefault();
    ultimo.focus();
  } else if (!e.shiftKey && document.activeElement === ultimo) {
    e.preventDefault();
    primeiro.focus();
  }
}

function abrirModal(modal) {
  focoAntesDoModal = document.activeElement;
  modal.classList.add('active');
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  const alvo = modal.querySelector(FOCAVEIS);
  if (alvo) alvo.focus();
}

function fecharModal(modal) {
  modal.classList.remove('active');
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  if (focoAntesDoModal && focoAntesDoModal.focus) focoAntesDoModal.focus();
  focoAntesDoModal = null;
}

// Methodology Modal
document.addEventListener('DOMContentLoaded', () => {
  const modalBtn = document.getElementById('methodology-btn');
  const modal = document.getElementById('methodology-modal');
  const modalClose = document.getElementById('modal-close');

  if (modalBtn && modal) {
    modalBtn.addEventListener('click', () => {
      abrirModal(modal);
      // Update year display
      document.getElementById('min-year-display').textContent = STATE.minYear;
      document.getElementById('max-year-display').textContent = STATE.maxYear;
    });
  }

  if (modalClose && modal) {
    modalClose.addEventListener('click', () => fecharModal(modal));
  }

  // Close on overlay click
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) fecharModal(modal);
    });
    modal.addEventListener('keydown', (e) => prenderFoco(modal, e));
  }

  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal && modal.classList.contains('active')) {
      fecharModal(modal);
    }
    if (e.key === 'Escape') {
      closeMapModal();
    }
  });

  // Map modal: add expand buttons to each map container
  document.querySelectorAll('.map-container').forEach(container => {
    const mapId = container.querySelector('[id^="map-"]')?.id;
    if (!mapId) return;

    // Create expand button
    const btn = document.createElement('button');
    btn.className = 'map-expand-btn';
    btn.innerHTML = '&#x2922;'; // ⤢ symbol
    btn.title = 'Ampliar mapa';
    btn.setAttribute('aria-label', 'Ampliar mapa');
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openMapModal(mapId);
    });
    container.appendChild(btn);
  });

  // Map modal: close button
  const mapModalClose = $('map-modal-close');
  if (mapModalClose) {
    mapModalClose.addEventListener('click', closeMapModal);
  }

  // Map modal: close on backdrop click
  const mapModal = $('map-modal');
  if (mapModal) {
    mapModal.addEventListener('click', (e) => {
      if (e.target === mapModal) {
        closeMapModal();
      }
    });
  }
});
