/**
 * shared.js — fonte única dos mapeamentos de campus do dashboard.
 *
 * Este arquivo existe porque `CAMPUS_TO_CITY`, `IFBA_COORDS` e
 * `mapUnidadeToCampus` estavam duplicados em quatro lugares (src/script.js,
 * tests/helpers/browserEnv.js, tests/campus-filter.test.js e
 * scripts/comparar_pi.js). As cópias divergiram: a de campus-filter.test.js
 * não normalizava acentos, então passava enquanto a implementação real
 * falhava — foi o que escondeu o bug de grupos sem campus (ago/2026).
 *
 * Qualquer mudança em código/cidade/coordenada de campus acontece SÓ aqui.
 *
 * ⚠️ Cobre apenas o IFBA (Instituto Federal da Bahia). NÃO adicionar campi do
 * IFBaiano (Instituto Federal Baiano) — são instituições distintas.
 *
 * Carregado como script global no browser (antes de script.js) e via
 * require() no Node — daí o rodapé UMD.
 */

/** Maiúsculas sem acentos — base de todas as comparações de texto livre. */
function normalizeText(s) {
  if (!s) return '';
  return s.toString().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

const CAMPUS_TO_CITY = {
  "BAR": "BARREIRAS", "BRU": "BRUMADO", "CAM": "CAMAÇARI", "CFO": "CAMPO FORMOSO",
  "EC": "EUCLIDES DA CUNHA", "EUN": "EUNÁPOLIS", "FS": "FEIRA DE SANTANA",
  "ILH": "ILHÉUS", "IRE": "IRECÊ", "JAC": "JACOBINA", "JAG": "JAGUAQUARA",
  "JEQ": "JEQUIÉ", "LF": "LAURO DE FREITAS", "SAM": "SANTO AMARO", "SEA": "SEABRA",
  "SF": "SIMÕES FILHO", "UBA": "UBAITABA", "VAL": "VALENÇA", "VC": "VITÓRIA DA CONQUISTA",
  "SAJ": "SANTO ANTÔNIO DE JESUS", "JUA": "JUAZEIRO", "PA": "PAULO AFONSO",
  "PIS": "POLO DE INOVAÇÃO SALVADOR", "PS": "PORTO SEGURO", "SSA": "SALVADOR"
};

// Coordenadas precisas das cidades do IFBA. As chaves são normalizadas
// (maiúsculas sem acento) — lookupCoords normaliza a entrada antes da busca,
// então não é preciso manter variantes acentuadas.
// ITABUNA não é campus, mas aparece como Unidade em registros do DGP.
const IFBA_COORDS = {
  "SALVADOR": [-12.9714, -38.5014],
  "FEIRA DE SANTANA": [-12.2666, -38.9666],
  "VITORIA DA CONQUISTA": [-14.8661, -40.8394],
  "ILHEUS": [-14.7889, -39.0494],
  "ITABUNA": [-14.7869, -39.2800],
  "JEQUIE": [-13.8580, -40.0830],
  "VALENCA": [-13.3700, -39.0730],
  "SANTO AMARO": [-12.5445, -38.7135],
  "CAMACARI": [-12.6975, -38.3241],
  "SIMOES FILHO": [-12.7844, -38.4025],
  "IRECE": [-11.3040, -41.8557],
  "BARREIRAS": [-12.1528, -44.9900],
  "BRUMADO": [-14.2045, -41.6663],
  "EUNAPOLIS": [-16.3720, -39.5815],
  "JACOBINA": [-11.1818, -40.5181],
  "JUAZEIRO": [-9.4124, -40.5055],
  "PAULO AFONSO": [-9.4005, -38.2163],
  "SANTO ANTONIO DE JESUS": [-12.9680, -39.2618],
  "SEABRA": [-12.4187, -41.7702],
  "EUCLIDES DA CUNHA": [-10.5085, -39.0150],
  "UBAITABA": [-14.2255, -39.3245],
  "JAGUAQUARA": [-13.5283, -39.9713],
  "PORTO SEGURO": [-16.4442, -39.0644],
  "CAMPO FORMOSO": [-10.5100, -40.3200],
  "LAURO DE FREITAS": [-12.8967, -38.3286],
  "POLO DE INOVACAO SALVADOR": [-12.9714, -38.5014]
};

// Cidades da maior para a menor: "SANTO ANTÔNIO DE JESUS" precisa ser testada
// antes de "SANTO AMARO" para que a Unidade certa vença o `includes`.
const SORTED_CAMPUS_ENTRIES = Object.entries(CAMPUS_TO_CITY)
  .sort((a, b) => b[1].length - a[1].length);

/**
 * Resolve a Unidade textual do DGP ("IFBA - Campus de Vitória da Conquista")
 * para o código de campus. Compara sempre em texto normalizado nos dois
 * lados — normalizar só a entrada era o bug de ago/2026.
 */
function mapUnidadeToCampus(unidade) {
  if (!unidade) return "";
  const u = normalizeText(unidade);
  // Referências genéricas à reitoria/sede caem em Salvador
  if (u.includes('INSTITUTO FEDERAL') && !u.includes('CAMPUS') && !u.includes('POLO')) {
    return "SSA";
  }
  for (const [code, city] of SORTED_CAMPUS_ENTRIES) {
    if (u.includes(normalizeText(city))) return code;
  }
  return "SSA"; // Fallback: unidade não identificada é tratada como Salvador
}

/** Cidade (acentuada ou não) → [lat, lon], ou null se desconhecida. */
function lookupCoords(city) {
  if (!city) return null;
  return IFBA_COORDS[normalizeText(city)] || null;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    normalizeText,
    CAMPUS_TO_CITY,
    IFBA_COORDS,
    SORTED_CAMPUS_ENTRIES,
    mapUnidadeToCampus,
    lookupCoords
  };
}
