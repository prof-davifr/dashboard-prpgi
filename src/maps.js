// maps.js — mapas Leaflet e o modal de mapa ampliado.
//
// renderGenericMap() resolve campus/Unidade → cidade canônica antes de
// lookupCoords (src/shared.js); pular essa resolução deixava os grupos do DGP
// sem marcador.


// Basemap do CARTO. Desde set/2026 o serviço exige chave: sem ela os ladrilhos
// vêm com a marca "API KEY REQUIRED" atravessada, em todos os sete mapas.
//
// A chave é de cliente e fica visível a quem abrir a página — é assim que um
// basemap funciona num site estático. Restrinja-a por domínio no painel do
// CARTO; não há como escondê-la aqui.
const CARTO_TILES = 'https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=cb1_2veb_1_cb6a9486977680fa4b9c653c';

function renderGenericMap(data, mapId, color, label, pesquisadoresData = null) {
  if (STATE.leafMaps[mapId]) {
    STATE.leafMaps[mapId].remove();
  }

  const mapElement = $(mapId);
  if (!mapElement) return;

  const bahiaBounds = [[-16.0, -46.0], [-8.0, -34.0]];
  const m = L.map(mapId, {
    maxBounds: bahiaBounds,
    minZoom: 5,
    maxBoundsViscosity: 1.0
  }).setView([-12.50, -41.50], 6);
  L.tileLayer(CARTO_TILES, { attribution: '&copy; CARTO' }).addTo(m);
  STATE.leafMaps[mapId] = m;

  const cityCount = {};
  data.forEach(r => {
    // If it's DGP data, it has city/unidade; if it's Lattes, it has Servidor field with campus
    let city = "";
    if (r.campus) {
      city = CAMPUS_TO_CITY[r.campus] || r.campus;
    } else if (r["Unidade"] || r["Cidade"]) {
      // DGP data: Unidade is like "IFBA - Campus Salvador" → resolve to canonical city
      const campusCode = mapUnidadeToCampus(r["Unidade"] || r["Cidade"]);
      city = CAMPUS_TO_CITY[campusCode] || (r["Unidade"] || r["Cidade"]).trim().toUpperCase();
    }
    if (city) cityCount[city] = (cityCount[city] || 0) + 1;
  });

  // Calculate pesquisadores per city if relative data is provided
  const cityPesquisadores = {};
  if (pesquisadoresData) {
    Object.entries(pesquisadoresData).forEach(([campus, count]) => {
      const city = CAMPUS_TO_CITY[campus] || campus;
      if (city) {
        cityPesquisadores[city] = (cityPesquisadores[city] || 0) + count;
      }
    });
  }

  const counts = Object.values(cityCount);
  const maxCount = counts.length > 0 ? Math.max(...counts) : 1;
  const minRadius = 6;
  const maxRadius = 35;

  const relativeMode = isRelativeMetricsEnabled();

  Object.entries(cityCount).forEach(([city, count]) => {
    const latlng = lookupCoords(city);
    if (!latlng) return; // Hide unknown cities

    // Normalize area (using sqrt) strictly proportional to the max count observed
    // This perfectly distinguishes 10000 from 1000
    const normalizedRadius = minRadius + (Math.sqrt(count) / Math.sqrt(maxCount)) * (maxRadius - minRadius);

    // Calculate relative value if mode is enabled and we have researcher data
    let popupContent = `<b>${city}</b><br>${count} ${label}`;
    if (relativeMode && cityPesquisadores[city] && cityPesquisadores[city] > 0) {
      const relativeValue = (count / cityPesquisadores[city]).toFixed(2);
      popupContent += ` (${relativeValue}/pesquisador)`;
    }

    L.circleMarker(latlng, {
      radius: normalizedRadius,
      fillColor: color,
      color: "#fff",
      weight: 1,
      fillOpacity: 0.7
    }).addTo(m).bindPopup(popupContent);
  });
}

// =====================
// Map Modal
// =====================

const MAP_MODAL_STATE = {
  leafMap: null,
  sourceMapId: null,
  title: ''
};

const MAP_TITLES = {
  'map-cientifica': 'Produções Científicas',
  'map-tecnica': 'Produções Técnicas',
  'map-inovacao': 'Inovação',
  'map-grupos': 'Grupos de Pesquisa',
  'map-pesquisadores': 'Pesquisadores',
  'map-orientacoes': 'Orientações',
  'map-ic': 'Iniciação Científica'
};

function openMapModal(sourceMapId) {
  const modal = $('map-modal');
  const titleEl = $('map-modal-title');
  if (!modal || !titleEl) return;

  MAP_MODAL_STATE.sourceMapId = sourceMapId;
  MAP_MODAL_STATE.title = MAP_TITLES[sourceMapId] || 'Mapa';
  titleEl.textContent = MAP_MODAL_STATE.title;

  // Remove any previous modal map instance
  if (MAP_MODAL_STATE.leafMap) {
    MAP_MODAL_STATE.leafMap.remove();
    MAP_MODAL_STATE.leafMap = null;
  }

  // abrirModal (src/core.js) guarda o foco anterior, marca aria-hidden e leva o
  // foco para dentro do diálogo.
  abrirModal(modal);

  // Rebuild the map inside the modal after a short delay (container must be visible)
  setTimeout(() => {
    rebuildMapInModal(sourceMapId);
  }, 100);
}

function rebuildMapInModal(sourceMapId) {
  const modalMapEl = $('map-modal-map');
  if (!modalMapEl) return;

  // Clear previous content
  modalMapEl.innerHTML = '';

  // Find the source map data from STATE.leafMaps
  const sourceMap = STATE.leafMaps[sourceMapId];
  if (!sourceMap) return;

  // Extract data from the source map's layers
  const layers = sourceMap._layers || {};
  const circles = [];

  Object.values(layers).forEach(layer => {
    if (layer instanceof L.CircleMarker) {
      circles.push({
        latlng: layer.getLatLng(),
        radius: layer.options.radius,
        fillColor: layer.options.fillColor,
        color: layer.options.color,
        weight: layer.options.weight,
        fillOpacity: layer.options.fillOpacity,
        popup: layer.getPopup() ? layer.getPopup().getContent() : ''
      });
    }
  });

  // Recreate map in modal
  const bahiaBounds = [[-16.0, -46.0], [-8.0, -34.0]];
  const m = L.map('map-modal-map', {
    maxBounds: bahiaBounds,
    minZoom: 5,
    maxBoundsViscosity: 1.0
  }).setView([-12.50, -41.50], 5);

  L.tileLayer(CARTO_TILES, { attribution: '&copy; CARTO' }).addTo(m);

  // Recreate circle markers
  circles.forEach(c => {
    const marker = L.circleMarker(c.latlng, {
      radius: c.radius,
      fillColor: c.fillColor,
      color: c.color,
      weight: c.weight,
      fillOpacity: c.fillOpacity
    }).addTo(m);

    if (c.popup) {
      marker.bindPopup(c.popup);
    }
  });

  // Fit view to show all of Bahia at maximum zoom
  m.fitBounds(bahiaBounds);

  MAP_MODAL_STATE.leafMap = m;

  // Invalidate size to ensure proper rendering
  setTimeout(() => m.invalidateSize(), 200);
}

function closeMapModal() {
  const modal = $('map-modal');
  if (!modal) return;

  // Só devolve o foco se o modal estava mesmo aberto: closeMapModal() é
  // chamado em todo Escape da página, inclusive com o diálogo fechado.
  if (modal.classList.contains('active')) {
    fecharModal(modal);
  }

  if (MAP_MODAL_STATE.leafMap) {
    MAP_MODAL_STATE.leafMap.remove();
    MAP_MODAL_STATE.leafMap = null;
  }

  // Clear modal map container
  const modalMapEl = $('map-modal-map');
  if (modalMapEl) modalMapEl.innerHTML = '';

  MAP_MODAL_STATE.sourceMapId = null;
}
