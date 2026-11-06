window.__meshmapStarted = true;
const config = document.body ? document.body.dataset : {};
const queryParams = new URLSearchParams(window.location.search);
const cleanConfigValue = (value) => {
  const str = String(value || '').trim();
  return /^\{\{[^{}]+\}\}$/.test(str) ? '' : str;
};
const parseNumberParam = (value) => {
  if (value == null) return null;
  const str = String(value).trim();
  if (!str) return null;
  const num = Number(str);
  return Number.isFinite(num) ? num : null;
};
const clampNumber = (value, min, max) => Math.min(max, Math.max(min, value));
const parseBoolParam = (value) => {
  if (value == null) return null;
  const str = String(value).trim().toLowerCase();
  if (!str) return null;
  if (['1', 'true', 'yes', 'on'].includes(str)) return true;
  if (['0', 'false', 'no', 'off'].includes(str)) return false;
  if (!Number.isNaN(Number(str))) return Number(str) > 0;
  return null;
};
const escapeHtmlAttr = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;');
const escapeHtml = escapeHtmlAttr;
const parseHistoryFilterParam = (value) => {
  if (value == null) return null;
  const str = String(value).trim().toLowerCase();
  if (!str) return null;
  if (str === 'all' || str === '0') return 0;
  if (str === 'blue' || str === '1') return 1;
  if (str === 'yellow' || str === '2') return 2;
  if (str === 'yellowred' || str === 'yellow+red' || str === 'yellow-red' || str === '3') return 3;
  if (str === 'red' || str === '4') return 4;
  return null;
};
const parseRouteByteFilterParam = (value) => {
  if (value == null) return null;
  const str = String(value).trim().toLowerCase();
  if (!str) return null;
  if (str === 'all' || str === '0' || str === '*') return 'all';
  if (str === '1' || str === '1b' || str === '1-byte' || str === '1byte') return '1b';
  if (str === '2' || str === '2b' || str === '2-byte' || str === '2byte') return '2b';
  if (str === '3' || str === '3b' || str === '3-byte' || str === '3byte') return '3b';
  return null;
};
const parseByteFilterSet = (value) => {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const selected = new Set();
  raw.split(/[,+\s|]+/).forEach((part) => {
    const parsed = parseRouteByteFilterParam(part);
    if (parsed === 'all') {
      selected.clear();
      selected.add('all');
    } else if (parsed) {
      selected.add(parsed);
    }
  });
  if (!selected.size) return null;
  if (selected.has('all')) return new Set(['all']);
  return selected;
};
const serializeByteFilterSet = (selected) => {
  if (!selected || selected.has('all') || !selected.size) return 'all';
  return ['1b', '2b', '3b'].filter((value) => selected.has(value)).join(',') || 'all';
};
const queryLat = parseNumberParam(queryParams.get('lat') ?? queryParams.get('latitude'));
const queryLon = parseNumberParam(queryParams.get('lon') ?? queryParams.get('lng') ?? queryParams.get('long') ?? queryParams.get('longitude'));
const queryZoom = parseNumberParam(queryParams.get('zoom'));
const queryLayer = String(queryParams.get('layer') || queryParams.get('map') || '').toLowerCase();
const queryHistoryVisible = parseBoolParam(queryParams.get('history'));
const queryHeatVisible = parseBoolParam(queryParams.get('heat'));
const queryCoverageVisible = parseBoolParam(queryParams.get('coverage'));
const queryLabelsVisible = parseBoolParam(queryParams.get('labels'));
const queryNodesVisible = parseBoolParam(queryParams.get('nodes'));
const queryLegendVisible = parseBoolParam(queryParams.get('legend'));
const queryMenuVisible = parseBoolParam(
  queryParams.get('menu') || queryParams.get('hud') || queryParams.get('panel')
);
const queryUnits = String(queryParams.get('units') || queryParams.get('unit') || '').toLowerCase();
const queryLinkedDevice = String(
  queryParams.get('node') ||
  queryParams.get('repeater') ||
  queryParams.get('device') ||
  queryParams.get('device_id') ||
  queryParams.get('public_key') ||
  queryParams.get('pubkey') ||
  ''
).trim();
const linkedDeviceParamNames = ['node', 'repeater', 'device', 'device_id', 'public_key', 'pubkey'];
const queryHistoryFilter = parseHistoryFilterParam(
  queryParams.get('history_filter') || queryParams.get('historyFilter') || queryParams.get('historyfilter')
);
const queryRouteByteFilter = parseByteFilterSet(
  queryParams.get('route_bytes') ||
  queryParams.get('routeBytes') ||
  queryParams.get('routebytes')
);
const queryHistoryByteFilter = parseByteFilterSet(
  queryParams.get('history_bytes') ||
  queryParams.get('historyBytes') ||
  queryParams.get('historybytes')
);
const queryRouteNodeFilter = String(
  queryParams.get('route_nodes') || queryParams.get('routeNodes') || ''
).trim();
const queryVisibleRoles = String(queryParams.get('roles') || '').trim();
const queryPeersActive = parseBoolParam(
  queryParams.get('peers') ||
  queryParams.get('peer_tool') ||
  queryParams.get('peerTool')
);
const initialUpdateAvailable = parseBoolParam(config.updateAvailable);
const initialUpdateLocal = (config.updateLocal || '').trim();
const initialUpdateRemote = (config.updateRemote || '').trim();
const reportError = typeof window.__meshmapReportError === 'function'
  ? window.__meshmapReportError
  : (message) => console.warn(message);
const appVersion = (config.appVersion || 'dev').trim() || 'dev';
console.info(`[meshmap] version ${appVersion}`);
let serverTimeOffsetMs = 0;

function setServerTimeOffset(serverTimeSeconds) {
  const serverMs = Number(serverTimeSeconds) * 1000;
  if (!Number.isFinite(serverMs) || serverMs <= 0) return;
  serverTimeOffsetMs = serverMs - Date.now();
}

function getServerNowMs() {
  return Date.now() + serverTimeOffsetMs;
}

const envStartLat = parseFloat(config.mapStartLat);
const envStartLon = parseFloat(config.mapStartLon);
const envStartZoom = Number(config.mapStartZoom);
const defaultLat = Number.isFinite(envStartLat) ? envStartLat : 42.3601;
const defaultLon = Number.isFinite(envStartLon) ? envStartLon : -71.1500;
const defaultZoom = Number.isFinite(envStartZoom) && envStartZoom > 0 ? envStartZoom : 10;
const mapStartLat = Number.isFinite(queryLat) ? queryLat : defaultLat;
const mapStartLon = Number.isFinite(queryLon) ? queryLon : defaultLon;
const mapStartZoom = Number.isFinite(queryZoom) && queryZoom > 0 ? queryZoom : defaultZoom;
const mapRadiusKm = Number(config.mapRadiusKm) || 0;
const trailMaxSegmentKm = Math.max(0, Number(config.trailMaxSegmentKm) || 0);
const mapRadiusShow = String(config.mapRadiusShow).toLowerCase() === 'true';
const mapBoundaryMode = String(config.mapBoundaryMode || 'radius').toLowerCase();
const mapBoundaryShow = String(config.mapBoundaryShow).toLowerCase() === 'true';
const mapBoundaryName = String(config.mapBoundaryName || '').trim();
const mapBoundaryDataEl = document.getElementById('map-boundary-data');
let mapBoundaryPoints = [];
if (mapBoundaryDataEl) {
  try {
    const parsed = JSON.parse(mapBoundaryDataEl.textContent || '[]');
    if (Array.isArray(parsed)) {
      mapBoundaryPoints = parsed
        .map((pt) => Array.isArray(pt) && pt.length >= 2 ? [Number(pt[0]), Number(pt[1])] : null)
        .filter((pt) => Array.isArray(pt) && Number.isFinite(pt[0]) && Number.isFinite(pt[1]));
    }
  } catch (_err) {
    mapBoundaryPoints = [];
  }
}
let baseLayer = String(config.mapDefaultLayer || 'dark').trim().toLowerCase();
const validLayers = new Set(['dark', 'light']);
if (validLayers.has(queryLayer)) {
  baseLayer = queryLayer;
}
if (!validLayers.has(baseLayer)) {
  baseLayer = 'dark';
}

const map = L.map('map', { zoomControl: false, preferCanvas: true }).setView([mapStartLat, mapStartLon], mapStartZoom);
const vectorRenderer = L.canvas({ padding: 0.3 });
const animatedLineRenderer = L.svg({ padding: 0.3 });
L.control.zoom({ position: 'bottomright' }).addTo(map);
if (!map.getPane('peerPane')) {
  map.createPane('peerPane');
}
const peerPane = map.getPane('peerPane');
if (peerPane) {
  peerPane.style.zIndex = '340';
  peerPane.style.pointerEvents = 'none';
}
if (!map.getPane('arcadePane')) {
  map.createPane('arcadePane');
}
const arcadePane = map.getPane('arcadePane');
if (arcadePane) {
  arcadePane.style.zIndex = '345';
  arcadePane.style.pointerEvents = 'none';
}
// Basemaps: OpenFreeMap public vector styles only (MapLibre GL via leaflet-maplibre-gl).
// No raster tile providers are used; when WebGL/MapLibre is unavailable the map
// falls back to a plain background instead of fetching tiles elsewhere.
const openFreeMapStyleUrls = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/dark'
};
const openFreeMapAttribution = (
  '<a href="https://openfreemap.org/" target="_blank" rel="noopener">OpenFreeMap</a> ' +
  '<a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">&copy; OpenMapTiles</a> ' +
  'Data from <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'
);
const baseLayers = { light: null, dark: null };
try {
  if (window.maplibregl?.supported() && typeof L.maplibreGL === 'function') {
    Object.keys(openFreeMapStyleUrls).forEach((name) => {
      baseLayers[name] = L.maplibreGL({
        style: openFreeMapStyleUrls[name],
        attributionControl: { customAttribution: openFreeMapAttribution }
      });
    });
  }
} catch (_err) {
  baseLayers.light = null;
  baseLayers.dark = null;
}
if (!baseLayers.light && !baseLayers.dark) {
  reportError('Vector basemap unavailable in this browser; showing a plain background.');
}
let mapRadiusCircle = null;
const activeBoundaryShow = mapBoundaryShow || mapRadiusShow;
if (mapBoundaryMode === 'radius' && activeBoundaryShow && mapRadiusKm > 0) {
  mapRadiusCircle = L.circle([mapStartLat, mapStartLon], {
    radius: mapRadiusKm * 1000.0,
    color: '#38bdf8',
    weight: 2,
    dashArray: '6 8',
    fillColor: '#38bdf8',
    fillOpacity: 0.05,
    interactive: false
  }).addTo(map);
}
let mapBoundaryPolygon = null;
if (mapBoundaryMode === 'polygon' && activeBoundaryShow && mapBoundaryPoints.length >= 3) {
  mapBoundaryPolygon = L.polygon(mapBoundaryPoints, {
    color: '#38bdf8',
    weight: 2,
    dashArray: '6 8',
    fillColor: '#38bdf8',
    fillOpacity: 0.04,
    interactive: false
  }).addTo(map);
  if (mapBoundaryName) {
    mapBoundaryPolygon.bindTooltip(escapeHtml(mapBoundaryName), {
      permanent: false,
      direction: 'center',
      sticky: false,
      opacity: 0.9
    });
  }
}
const storedLayer = localStorage.getItem('meshmapBaseLayer');
if (!validLayers.has(queryLayer) && validLayers.has(storedLayer)) {
  baseLayer = storedLayer;
}

const prodMode = String(config.prodMode).toLowerCase() === 'true';
const apiToken = config.prodToken || '';
const qrCodeButtonEnabled =
  String(config.qrCodeButtonEnabled).toLowerCase() === 'true';
const routeHistoryEnabled =
  String(config.routeHistoryEnabled).trim().toLowerCase() === 'true';
const publicPathPrefix = String(config.appBasePath || '').trim();
const apiPath = (path) => {
  const p = path.startsWith('/') ? path : `/${path}`;
  if (!publicPathPrefix) return p;
  return `${publicPathPrefix}${p}`;
};
if (map.attributionControl) {
  const privacyHref = escapeHtmlAttr(apiPath('/privacy'));
  map.attributionControl.addAttribution(
    `<a href="${privacyHref}" target="_blank" rel="noopener">Privacy</a>`
  );
}
const tokenHeaders = () => (prodMode && apiToken ? { 'x-access-token': apiToken } : {});
const withToken = (path) => {
  const resolved = apiPath(path);
  if (!prodMode || !apiToken) return resolved;
  const url = new URL(resolved, window.location.origin);
  url.searchParams.set('token', apiToken);
  return `${url.pathname}${url.search}`;
};

const markers = new Map();   // device_id -> Leaflet marker
const polylines = new Map(); // device_id -> Leaflet polyline
const markerLayer = L.layerGroup().addTo(map);
const trailLayer = L.layerGroup().addTo(map);
let nodesVisible = true;
let mqttOnlyVisible = false;
const routeLines = new Map(); // route_id -> { line, timeout }
const routeCache = new Map(); // route_id -> raw route payload
const deviceMeta = new Map(); // device_id -> { lat, lon, name }
const historyLines = new Map(); // edge_id -> { line, count }
const historyCache = new Map(); // edge_id -> raw edge data
let mqttPresenceKnown = false;
let mqttConnectedTotal = 0;
const historyLayer = L.layerGroup();
const peerLayer = L.layerGroup();
const peerLines = new Map(); // peer_id -> line
const routeLayer = L.layerGroup().addTo(map);
const arcadeLayer = L.layerGroup();
const hopLayer = L.layerGroup();
const hopMarkers = new Map(); // route_id -> [markers]
let hopsVisible = false;
let arcadeModeEnabled = false;
const FLOW_MIN_DURATION_MS = 2800;
const FLOW_MAX_DURATION_MS = 9000;
let arcadeAnimFrame = null;

function routeStyleForDisplay(payloadType, routeMode, arcadeMode = false) {
  const isFanout = routeMode === 'fanout';
  const payloadNum = Number(payloadType);
  const isAdvert = payloadNum === 4;
  const isTrace = payloadNum === 8 || payloadNum === 9;
  const isMessage = payloadNum === 2 || payloadNum === 5;
  const style = {
    color: isAdvert
      ? '#ef4444'
      : (isTrace ? '#facc15' : (isMessage ? '#ff7a1a' : (isFanout ? '#2b8cff' : '#ff7a1a'))),
    weight: isFanout ? 4 : 5,
    opacity: isFanout ? 0.85 : 0.9,
    lineCap: 'butt',
    lineJoin: 'miter',
  };
  if (isAdvert) {
    style.dashArray = '2 10';
  } else if (isMessage) {
    style.dashArray = '6 12';
  } else if (isTrace) {
    style.dashArray = '8 14';
  } else if (!isFanout) {
    style.dashArray = '8 14';
  }
  if (arcadeMode) {
    style.weight = isFanout ? 3 : 2.5;
    style.opacity = 0.42;
    style.lineCap = 'round';
    style.lineJoin = 'round';
    if (isAdvert) {
      style.dashArray = '2 16';
    } else if (isMessage) {
      style.dashArray = '2 18';
    } else if (isTrace) {
      style.dashArray = '2 22';
    } else {
      style.dashArray = '2 20';
    }
  }
  return style;
}

function setArcadeModeEnabled(enabled, persist = true) {
  arcadeModeEnabled = Boolean(enabled);
  if (arcadeModeEnabled && nodesVisible) {
    if (!map.hasLayer(routeLayer)) {
      routeLayer.addTo(map);
    }
    if (!map.hasLayer(arcadeLayer)) {
      arcadeLayer.addTo(map);
    }
    routeLines.forEach((entry, routeId) => {
      if (entry && Array.isArray(entry.routePoints)) {
        syncArcadeForRoute(routeId, entry.routePoints);
      }
      if (entry && entry.line) {
        entry.line.setStyle(
          routeStyleForDisplay(entry.payloadType, entry.routeMode, true)
        );
        const lineEl = entry.line.getElement();
        if (lineEl) {
          lineEl.classList.remove('route-animated');
        }
      }
    });
    syncAllRouteDisplays();
    startArcadeLoop();
  } else {
    routeLines.forEach((_entry, routeId) => removeArcadeMarker(routeId));
    routeLines.forEach((entry) => {
      if (!entry || !entry.line) return;
      entry.line.setStyle(
        routeStyleForDisplay(entry.payloadType, entry.routeMode, false)
      );
      const lineEl = entry.line.getElement();
      if (lineEl) {
        lineEl.classList.add('route-animated');
      }
    });
    if (map.hasLayer(arcadeLayer)) {
      map.removeLayer(arcadeLayer);
    }
    stopArcadeLoop();
  }
}
const heatDefaultOn = parseBoolParam(config.heatDefaultOn) ?? true;
const mqttOnlineSeconds = Number(config.mqttOnlineSeconds) || 300;
const mqttOnlineStatusTtlSeconds = Number(config.mqttOnlineStatusTtlSeconds) || mqttOnlineSeconds;
const mqttOnlineInternalTtlSeconds = Number(config.mqttOnlineInternalTtlSeconds) || mqttOnlineSeconds;
const defaultDistanceUnits = config.distanceUnits || 'mi';
const heatAvailable = typeof L.heatLayer === 'function';
const heatLayer = heatAvailable ? L.heatLayer([], {
  radius: 28,
  blur: 22,
  minOpacity: 0.2,
  maxZoom: 16,
  gradient: { 0.2: '#fbbf24', 0.5: '#f97316', 0.8: '#ef4444', 1.0: '#b91c1c' }
}) : null;
const heatPoints = [];
const HEAT_TTL_MS = 10 * 60 * 1000;
const coverageApiUrl = cleanConfigValue(config.coverageApiUrl);
const customLinkUrl = cleanConfigValue(config.customLinkUrl);
const packetAnalyzerUrl = cleanConfigValue(config.packetAnalyzerUrl);
const coreScopeUrl = cleanConfigValue(config.corescopeUrl);
const coverageEnabled = Boolean(coverageApiUrl);
const coverageLayer = L.layerGroup();
let coverageVisible = false;
let coverageData = null;
let meshMapperCoverageRects = [];
let meshMapperCoverageSource = null;
let meshMapperCoverageExpanded = [];
let coverageProvider = '';
let coverageRegion = '';
let coverageAttributionHtml = '';
const historyPanel = document.getElementById('history-panel');
const historyLegendGroup = document.getElementById('legend-history-group');
const coverageLegendGroup = document.getElementById('legend-coverage-group');
const historyPanelLabel = document.getElementById('history-panel-label');
const historyPanelCollapse = document.getElementById('history-panel-collapse');
const peersPanel = document.getElementById('peers-panel');
const peersPanelCollapse = document.getElementById('peers-panel-collapse');
const peersTitle = document.getElementById('peers-title');
const peersWindow = document.getElementById('peers-window');
const peersStatus = document.getElementById('peers-status');
const peersMeta = document.getElementById('peers-meta');
const peersInHeading = document.getElementById('peers-in-heading');
const peersOutHeading = document.getElementById('peers-out-heading');
const peersIn = document.getElementById('peers-in');
const peersOut = document.getElementById('peers-out');
const peersToggle = document.getElementById('peers-toggle');
const peersClear = document.getElementById('peers-clear');
const peersFilter = document.getElementById('peers-filter');
const routeDetailsPanel = document.getElementById('route-details-panel');
const routeDetailsTitle = document.getElementById('route-details-title');
const routeDetailsContent = document.getElementById('route-details-content');
const routeDetailsTotal = document.getElementById('route-details-total');
const routeDetailsCollapse = document.getElementById('route-details-collapse');
const qrModal = document.getElementById('qr-modal');
const qrModalBackdrop = document.getElementById('qr-modal-backdrop');
const qrModalClose = document.getElementById('qr-modal-close');
const qrModalTitle = document.getElementById('qr-modal-title');
const qrModalLabel = document.getElementById('qr-modal-label');
const qrModalImage = document.getElementById('qr-modal-image');
let activeRouteDetailsMeta = null;
let activeRouteDetailsId = null;
const deviceData = new Map();
const linkedDeviceTarget = normalizeLinkedDeviceTarget(queryLinkedDevice);
let linkedDeviceFocusDone = !linkedDeviceTarget;
const searchInput = document.getElementById('node-search');
const searchResults = document.getElementById('node-search-results');
const nodeSizeInput = document.getElementById('node-size');
const nodeSizeValue = document.getElementById('node-size-value');
let searchMatches = [];
let focusDeviceToken = 0;
const storedLabels = localStorage.getItem('meshmapShowLabels');
let showLabels = storedLabels === 'true';
if (storedLabels === null) {
  localStorage.setItem('meshmapShowLabels', 'false');
}
const validUnits = new Set(['km', 'mi']);
let distanceUnits = (localStorage.getItem('meshmapDistanceUnits2') || defaultDistanceUnits || 'mi').toLowerCase();
if (!validUnits.has(distanceUnits)) {
  distanceUnits = 'mi';
  localStorage.setItem('meshmapDistanceUnits2', distanceUnits);
}
if (validUnits.has(queryUnits)) {
  distanceUnits = queryUnits;
  localStorage.setItem('meshmapDistanceUnits2', distanceUnits);
}
const NODE_RADIUS_MIN = 2;
const NODE_RADIUS_MAX = 14;
const envNodeRadius = Number(config.nodeRadius);
const defaultNodeRadius = Number.isFinite(envNodeRadius) ? envNodeRadius : 2;
let nodeMarkerRadius = defaultNodeRadius;
const storedRadius = parseNumberParam(localStorage.getItem('meshmapNodeRadius2'));
if (Number.isFinite(storedRadius)) {
  nodeMarkerRadius = storedRadius;
}
nodeMarkerRadius = clampNumber(nodeMarkerRadius, NODE_RADIUS_MIN, NODE_RADIUS_MAX);
if (!Number.isFinite(storedRadius)) {
  localStorage.setItem('meshmapNodeRadius2', String(nodeMarkerRadius));
}
const historyLabel = document.getElementById('history-window-label');
const historyFilter = document.getElementById('history-filter');
const historyFilterLabel = document.getElementById('history-filter-label');
const historyByteFilterSelect = document.getElementById('history-byte-filter');
const historyLinkSizeInput = document.getElementById('history-link-size');
const historyLinkSizeValue = document.getElementById('history-link-size-value');
const routeByteFilterSelect = document.getElementById('route-byte-filter');
const routeNodeFilterInput = document.getElementById('route-node-filter');
const routeNodeFilterResults = document.getElementById('route-node-filter-results');
const roleFilterButtons = [...document.querySelectorAll('[data-role-filter]')];
let historyWindowSeconds = null;
if (!routeHistoryEnabled) {
  historyWindowSeconds = 0;
}
const historyToolVersion = '1';
localStorage.setItem('meshmapHistoryToolVersion', historyToolVersion);
let historyVisible = false;
let historyPanelHidden = false;
const peersDefaultOpen = parseBoolParam(config.peersDefaultOpen) === true;
let peersActive = false;
let peersSelectedId = null;
let peersData = null;
let peersRequestToken = 0;
let peersFilterText = '';
let historyFilterMode = Number(localStorage.getItem('meshmapHistoryFilter') || '0');
if (queryHistoryFilter != null) {
  historyFilterMode = queryHistoryFilter;
  localStorage.setItem('meshmapHistoryFilter', String(historyFilterMode));
}
if (![0, 1, 2, 3, 4].includes(historyFilterMode)) {
  historyFilterMode = 0;
  localStorage.setItem('meshmapHistoryFilter', '0');
}
if (historyFilter) {
  historyFilter.value = String(historyFilterMode);
}
const ROUTE_BYTE_FILTER_VALUES = new Set(['all', '1b', '2b', '3b']);
const normalizeByteFilterSet = (selected) => {
  const values = selected instanceof Set ? selected : parseByteFilterSet(selected);
  if (!values || !values.size || values.has('all')) return new Set(['all']);
  const filtered = new Set([...values].filter((value) => ROUTE_BYTE_FILTER_VALUES.has(value) && value !== 'all'));
  return filtered.size ? filtered : new Set(['all']);
};
const defaultRouteByteFilter = parseByteFilterSet(config.routeByteFilterDefault) || new Set(['all']);
const defaultHistoryByteFilter = parseByteFilterSet(config.historyByteFilterDefault) || new Set(['all']);
// Path-byte filtering is disabled in this build: always show all paths.
let routeByteFilter = new Set(['all']);
let historyByteFilter = new Set(['all']);
let routeNodeFilterText = queryRouteNodeFilter ||
  localStorage.getItem('meshmapRouteNodeFilter') || '';
let routeNodeMatches = [];
const roleDefaultConfig = {
  repeater: parseBoolParam(config.showRepeatersDefault) !== false,
  companion: parseBoolParam(config.showCompanionsDefault) !== false,
  room: parseBoolParam(config.showRoomServersDefault) !== false,
  unknown: parseBoolParam(config.showUnknownDefault) !== false
};
const parseVisibleRoles = (raw) => {
  const values = new Set(
    String(raw || '').toLowerCase().split(',').map(value => value.trim()).filter(Boolean)
  );
  return new Set(
    ['repeater', 'companion', 'room', 'unknown'].filter(role => values.has(role))
  );
};
const storedVisibleRoles = localStorage.getItem('meshmapVisibleRoles');
let visibleRoles = storedVisibleRoles === null
  ? new Set(Object.keys(roleDefaultConfig).filter(role => roleDefaultConfig[role]))
  : parseVisibleRoles(storedVisibleRoles);
if (queryParams.has('roles')) {
  visibleRoles = parseVisibleRoles(queryVisibleRoles);
  localStorage.setItem('meshmapVisibleRoles', [...visibleRoles].join(','));
}
if (routeNodeFilterInput) routeNodeFilterInput.value = routeNodeFilterText;
const setByteFilterChecks = (root, selected) => {
  if (!root) return;
  const normalized = normalizeByteFilterSet(selected);
  root.querySelectorAll('input[type="checkbox"]').forEach((input) => {
    input.checked = normalized.has(input.value);
  });
  const label = root.querySelector('.byte-summary-label');
  if (label) {
    const text = serializeByteFilterSet(normalized)
      .split(',')
      .map((value) => ({ all: 'All', '1b': '1-byte', '2b': '2-byte', '3b': '3-byte' }[value] || value))
      .join(', ');
    label.textContent = text;
  }
};
const selectedByteFilterFromGroup = (root, changedInput = null) => {
  if (!root) return new Set(['all']);
  const allInput = root.querySelector('input[value="all"]');
  const specific = [...root.querySelectorAll('input[type="checkbox"]')]
    .filter((input) => input.value !== 'all');
  if (changedInput && changedInput.value === 'all' && changedInput.checked) {
    specific.forEach((input) => { input.checked = false; });
    return new Set(['all']);
  }
  if (changedInput && changedInput.value !== 'all' && changedInput.checked && allInput) {
    allInput.checked = false;
  }
  const selected = new Set(
    specific.filter((input) => input.checked).map((input) => input.value)
  );
  if (!selected.size || selected.size === specific.length) {
    if (allInput) allInput.checked = true;
    specific.forEach((input) => { input.checked = false; });
    return new Set(['all']);
  }
  return normalizeByteFilterSet(selected);
};
const positionByteDropdown = (root) => {
  if (!root || !root.open) return;
  const summary = root.querySelector('summary');
  const panel = root.querySelector('.byte-check-options');
  if (!summary || !panel) return;
  const rect = summary.getBoundingClientRect();
  const width = Math.max(rect.width, 128);
  const panelHeight = Math.max(panel.offsetHeight, 1);
  const viewportPad = 8;
  const left = Math.min(
    Math.max(viewportPad, rect.right - width),
    Math.max(viewportPad, window.innerWidth - width - viewportPad)
  );
  const belowTop = rect.bottom + 4;
  const aboveTop = rect.top - panelHeight - 4;
  const top = belowTop + panelHeight + viewportPad <= window.innerHeight
    ? belowTop
    : Math.max(viewportPad, aboveTop);
  panel.style.width = `${width}px`;
  panel.style.left = `${left}px`;
  panel.style.top = `${top}px`;
};
const setupByteDropdown = (root) => {
  if (!root) return;
  root.addEventListener('toggle', () => {
    if (root.open) {
      [routeByteFilterSelect, historyByteFilterSelect].forEach((other) => {
        if (other && other !== root) other.open = false;
      });
      requestAnimationFrame(() => positionByteDropdown(root));
    }
  });
};
setupByteDropdown(routeByteFilterSelect);
setupByteDropdown(historyByteFilterSelect);
document.addEventListener('click', (ev) => {
  const target = ev.target;
  [routeByteFilterSelect, historyByteFilterSelect].forEach((root) => {
    if (root && root.open && !root.contains(target)) {
      root.open = false;
    }
  });
});
document.addEventListener('keydown', (ev) => {
  if (ev.key !== 'Escape') return;
  [routeByteFilterSelect, historyByteFilterSelect].forEach((root) => {
    if (root) root.open = false;
  });
});
window.addEventListener('resize', () => {
  positionByteDropdown(routeByteFilterSelect);
  positionByteDropdown(historyByteFilterSelect);
});
setByteFilterChecks(routeByteFilterSelect, routeByteFilter);
setByteFilterChecks(historyByteFilterSelect, historyByteFilter);
const HISTORY_LINK_MIN = 0.1;
const HISTORY_LINK_MID = 1;
const HISTORY_LINK_MAX = 2;
const envHistoryLinkScale = Number(config.historyLinkScale);
let historyLinkScale = Number.isFinite(envHistoryLinkScale) ? envHistoryLinkScale : 1;
const storedHistoryLinkScale = parseNumberParam(localStorage.getItem('meshmapHistoryLinkScale'));
if (Number.isFinite(storedHistoryLinkScale)) {
  historyLinkScale = storedHistoryLinkScale;
}
historyLinkScale = clampNumber(historyLinkScale, HISTORY_LINK_MIN, HISTORY_LINK_MAX);
if (!Number.isFinite(storedHistoryLinkScale)) {
  localStorage.setItem('meshmapHistoryLinkScale', String(historyLinkScale));
}
const sliderToHistoryScale = (value) => {
  const t = clampNumber(Number(value), 0, 100);
  if (t <= 50) {
    return HISTORY_LINK_MIN + (t / 50) * (HISTORY_LINK_MID - HISTORY_LINK_MIN);
  }
  return HISTORY_LINK_MID + ((t - 50) / 50) * (HISTORY_LINK_MAX - HISTORY_LINK_MID);
};
const historyScaleToSlider = (scale) => {
  const v = clampNumber(scale, HISTORY_LINK_MIN, HISTORY_LINK_MAX);
  if (v <= HISTORY_LINK_MID) {
    return ((v - HISTORY_LINK_MIN) / (HISTORY_LINK_MID - HISTORY_LINK_MIN)) * 50;
  }
  return 50 + ((v - HISTORY_LINK_MID) / (HISTORY_LINK_MAX - HISTORY_LINK_MID)) * 50;
};
const updateHistoryLinkSizeUI = () => {
  if (historyLinkSizeInput) {
    historyLinkSizeInput.value = String(Math.round(historyScaleToSlider(historyLinkScale)));
  }
  if (historyLinkSizeValue) historyLinkSizeValue.textContent = `${historyLinkScale.toFixed(1)}x`;
};
updateHistoryLinkSizeUI();
const storedHeat = localStorage.getItem('meshmapShowHeat');
let heatVisible = storedHeat !== null ? storedHeat === 'true' : heatDefaultOn;
if (storedHeat === null) {
  localStorage.setItem('meshmapShowHeat', heatDefaultOn ? 'true' : 'false');
}
const mqttWindowLabel = document.getElementById('mqtt-online-label');
const mqttOnlyToggle = document.getElementById('mqtt-only-toggle');
if (mqttWindowLabel) {
  const mqttWindowSeconds = Math.max(
    mqttOnlineSeconds,
    mqttOnlineStatusTtlSeconds,
    mqttOnlineInternalTtlSeconds
  );
  mqttWindowLabel.textContent = `MQTT online (last ${formatOnlineWindow(mqttWindowSeconds)})`;
}
function updateMqttOnlyToggleUi() {
  if (!mqttOnlyToggle) return;
  mqttOnlyToggle.classList.toggle('active', mqttOnlyVisible);
  mqttOnlyToggle.setAttribute('aria-pressed', mqttOnlyVisible ? 'true' : 'false');
  mqttOnlyToggle.textContent = mqttOnlyVisible ? 'All' : 'Only';
  mqttOnlyToggle.title = mqttOnlyVisible
    ? 'Show all nodes'
    : 'Only show MQTT online nodes';
}
updateMqttOnlyToggleUi();

const HISTORY_PANEL_COLLAPSED_KEY = 'meshmapHistoryPanelCollapsed';
const PEERS_PANEL_COLLAPSED_KEY = 'meshmapPeersPanelCollapsed';
const ROUTE_DETAILS_PANEL_COLLAPSED_KEY = 'meshmapRouteDetailsPanelCollapsed';
let historyPanelCollapsed =
  parseBoolParam(localStorage.getItem(HISTORY_PANEL_COLLAPSED_KEY)) === true;
let peersPanelCollapsed =
  parseBoolParam(localStorage.getItem(PEERS_PANEL_COLLAPSED_KEY)) === true;
let routeDetailsPanelCollapsed =
  parseBoolParam(localStorage.getItem(ROUTE_DETAILS_PANEL_COLLAPSED_KEY)) === true;

function resolveRole(d) {
  const role = (d.role || '').toLowerCase();
  if (role.includes('repeater')) return 'repeater';
  if (role.includes('companion')) return 'companion';
  if (role.includes('room')) return 'room';
  return 'unknown';
}

function meshCoreContactTypeForDevice(d) {
  const role = String(d?.role || '').toLowerCase();
  if (role.includes('repeater')) return 2;
  if (role.includes('room')) return 3;
  if (role.includes('sensor')) return 4;
  return 1;
}

function markerStyleForRole(role) {
  // companion: always orange; repeater/room/unknown: white on the dark map, black on the light map
  if (role === 'companion') {
    return { color: '#ea580c', fillColor: '#ff7a1a', fillOpacity: 0.95, radius: nodeMarkerRadius, weight: 1 };
  }
  const dot = document.body.classList.contains('dark-map') ? '#ffffff' : '#000000';
  return { color: dot, fillColor: dot, fillOpacity: 0.95, radius: nodeMarkerRadius, weight: 1 };
}

function markerStyleForDevice(d) {
  const role = resolveRole(d);
  const base = markerStyleForRole(role);
  return base;  // no special MQTT-online highlight
}

function applyMqttPresenceSummary(summary) {
  if (!summary || typeof summary !== 'object') return;
  if (summary.connected_total != null) {
    const n = Number(summary.connected_total);
    if (Number.isFinite(n) && n >= 0) {
      mqttConnectedTotal = Math.floor(n);
      mqttPresenceKnown = true;
    }
  }
}

function setStats() {
  const onlineOnMap = Array.from(deviceData.values()).filter(isMqttOnline).length;
  const onlineTotal = mqttPresenceKnown ? mqttConnectedTotal : onlineOnMap;
  const totalRoutes = routeLines.size;
  const visibleRoutes = getVisibleRouteCount();
  const routeFiltersInactive = routeByteFilter.has('all') &&
    !routeNodeFilterText.trim();
  const routeLabel = routeFiltersInactive || visibleRoutes === totalRoutes
    ? `${visibleRoutes} routes`
    : `${visibleRoutes}/${totalRoutes} routes`;
  document.getElementById('stats').textContent = `${markers.size} active devices • ${onlineTotal} MQTT online • ${routeLabel} • ${historyLines.size} history`;
}

let statsFramePending = false;
let deferStats = false;

function scheduleStatsUpdate() {
  if (statsFramePending) return;
  statsFramePending = true;
  window.requestAnimationFrame(() => {
    statsFramePending = false;
    setStats();
  });
}

function refreshStats() {
  if (deferStats) {
    scheduleStatsUpdate();
    return;
  }
  setStats();
}

function formatOnlineWindow(seconds) {
  if (!seconds || seconds <= 0) return '0 min';
  if (seconds >= 3600) {
    const hours = Math.round(seconds / 3600);
    return `${hours} hr`;
  }
  const minutes = Math.max(1, Math.round(seconds / 60));
  return `${minutes} min`;
}

// Geohash decoder (simple implementation)
function geohashDecode(geohash) {
  const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';
  const BASE32_DICT = {};
  for (let i = 0; i < BASE32.length; i++) {
    BASE32_DICT[BASE32[i]] = i;
  }
  let even = true;
  let lat = [-90.0, 90.0];
  let lon = [-180.0, 180.0];
  let lat_err = 90.0;
  let lon_err = 180.0;
  for (let i = 0; i < geohash.length; i++) {
    const c = geohash[i];
    const cd = BASE32_DICT[c];
    for (let j = 0; j < 5; j++) {
      if (even) {
        lon_err /= 2;
        if ((cd & (16 >> j)) > 0) {
          lon[0] = (lon[0] + lon[1]) / 2;
        } else {
          lon[1] = (lon[0] + lon[1]) / 2;
        }
      } else {
        lat_err /= 2;
        if ((cd & (16 >> j)) > 0) {
          lat[0] = (lat[0] + lat[1]) / 2;
        } else {
          lat[1] = (lat[0] + lat[1]) / 2;
        }
      }
      even = !even;
    }
  }
  return {
    latitude: (lat[0] + lat[1]) / 2,
    longitude: (lon[0] + lon[1]) / 2,
    error: { latitude: lat_err, longitude: lon_err }
  };
}

function geohashDecodeBbox(geohash) {
  const decoded = geohashDecode(geohash);
  const latErr = decoded.error.latitude;
  const lonErr = decoded.error.longitude;
  return [
    decoded.latitude - latErr,
    decoded.longitude - lonErr,
    decoded.latitude + latErr,
    decoded.longitude + lonErr
  ];
}

function successRateToColor(rate) {
  const clampedRate = Math.max(0, Math.min(1, rate));
  let red, green, blue;
  if (clampedRate >= 0.8) {
    const t = (clampedRate - 0.8) / 0.2;
    red = Math.round(0 + (50 - 0) * t);
    green = Math.round(100 + (150 - 100) * t);
    blue = Math.round(0 + (50 - 0) * t);
  } else if (clampedRate >= 0.6) {
    const t = (clampedRate - 0.6) / 0.2;
    red = Math.round(50 + (255 - 50) * t);
    green = Math.round(150 + (165 - 150) * t);
    blue = Math.round(50 - 50 * t);
  } else if (clampedRate >= 0.4) {
    const t = (clampedRate - 0.4) / 0.2;
    red = 255;
    green = Math.round(165 + (100 - 165) * t);
    blue = 0;
  } else if (clampedRate >= 0.2) {
    const t = (clampedRate - 0.2) / 0.2;
    red = 255;
    green = Math.round(100 - 100 * t);
    blue = 0;
  } else {
    red = 255;
    green = 0;
    blue = 0;
  }
  const toHex = (n) => {
    const hex = n.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(red)}${toHex(green)}${toHex(blue)}`;
}

async function fetchCoverageData() {
  try {
    const response = await fetch(withToken('/coverage'));
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    const data = await response.json();
    return {
      data,
      provider: String(response.headers.get('x-coverage-provider') || '').trim().toLowerCase(),
      region: String(response.headers.get('x-coverage-region') || '').trim().toUpperCase()
    };
  } catch (err) {
    const errorMsg = err && err.message ? err.message : String(err);
    reportError(`Failed to fetch coverage data: ${errorMsg}`);
    return null;
  }
}

function buildCoverageAttributionHtml() {
  if (coverageProvider !== 'meshmapper' || !coverageRegion) return '';
  if (!/^[A-Z0-9-]+$/.test(coverageRegion)) return '';
  const regionHost = coverageRegion.toLowerCase();
  return `<a href="https://${regionHost}.meshmapper.net" target="_blank" rel="noopener noreferrer">MeshMapper</a>`;
}

function updateCoverageAttribution() {
  const next = (coverageVisible && coverageData) ? buildCoverageAttributionHtml() : '';
  if (coverageAttributionHtml && map && map.attributionControl) {
    map.attributionControl.removeAttribution(coverageAttributionHtml);
    coverageAttributionHtml = '';
  }
  if (next && map && map.attributionControl) {
    map.attributionControl.addAttribution(next);
    coverageAttributionHtml = next;
  }
}

function updateCoverageLegend() {
  if (!coverageLegendGroup) return;
  const active = coverageVisible && coverageProvider === 'meshmapper' && Array.isArray(coverageData) && coverageData.length > 0;
  coverageLegendGroup.classList.toggle('active', active);
}

function getRenderBounds() {
  if (!map || !map.getBounds) return null;
  try {
    return map.getBounds().pad(0.2);
  } catch (_err) {
    return null;
  }
}

function boundsIntersectsViewport(south, west, north, east) {
  const viewport = getRenderBounds();
  if (!viewport) return true;
  const tileBounds = L.latLngBounds([[south, west], [north, east]]);
  return viewport.intersects(tileBounds);
}

function latLngInViewport(lat, lon) {
  const viewport = getRenderBounds();
  if (!viewport) return true;
  return viewport.contains([lat, lon]);
}

function syncLayerMembership(layer, item, shouldAttach) {
  if (!layer || !item) return;
  const attached = item.__attached === true;
  if (shouldAttach && !attached) {
    layer.addLayer(item);
    item.__attached = true;
    return;
  }
  if (!shouldAttach && attached) {
    layer.removeLayer(item);
    item.__attached = false;
  }
}

function coverageTimeLabel(ts) {
  const raw = typeof ts === 'string' ? Number.parseInt(ts, 10) : ts;
  if (!Number.isFinite(raw) || raw <= 0) return '';
  const ms = raw < 946684800000 ? raw * 1000 : raw;
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString();
}

function meshMapperCoveragePriority(type) {
  switch (String(type || '').trim().toUpperCase()) {
    case 'BIDIR':
      return 6;
    case 'DISC':
    case 'TRACE':
    case 'DISC/TRACE':
      return 5;
    case 'TX':
      return 4;
    case 'RX':
      return 3;
    case 'DEAD':
      return 2;
    case 'DROP':
      return 1;
    default:
      return 0;
  }
}

function expandMeshMapperCoverageSquares(data) {
  const merged = new Map();
  for (const square of data) {
    const bounds = square?.bounds;
    if (!bounds) continue;
    const south = Number(bounds.south);
    const west = Number(bounds.west);
    const north = Number(bounds.north);
    const east = Number(bounds.east);
    if (![south, west, north, east].every(Number.isFinite)) continue;
    const latStep = north - south;
    const lonStep = east - west;
    if (!(latStep > 0) || !(lonStep > 0)) continue;
    const priority = meshMapperCoveragePriority(square.coverage_type);
    const timestamp = Number(square.timestamp) || 0;
    for (let latOffset = -1; latOffset <= 1; latOffset += 1) {
      for (let lonOffset = -1; lonOffset <= 1; lonOffset += 1) {
        const nextSouth = south + (latStep * latOffset);
        const nextWest = west + (lonStep * lonOffset);
        const nextNorth = nextSouth + latStep;
        const nextEast = nextWest + lonStep;
        const key = `${nextSouth.toFixed(7)}:${nextWest.toFixed(7)}`;
        const current = merged.get(key);
        const shouldReplace = !current
          || priority > current.__priority
          || (priority === current.__priority && timestamp > current.__timestamp);
        if (!shouldReplace) continue;
        merged.set(key, {
          ...square,
          bounds: {
            south: nextSouth,
            west: nextWest,
            north: nextNorth,
            east: nextEast
          },
          __priority: priority,
          __timestamp: timestamp,
          __source_grid_id: square.grid_id || null
        });
      }
    }
  }
  return Array.from(merged.values());
}

function buildMeshMapperCoverageRect(square) {
  const bounds = square?.bounds;
  if (!bounds) return null;
  const south = Number(bounds.south);
  const west = Number(bounds.west);
  const north = Number(bounds.north);
  const east = Number(bounds.east);
  if (![south, west, north, east].every(Number.isFinite)) return null;
  const fillColor = square.fill_color || '#1e7e34';
  const rect = L.rectangle([[south, west], [north, east]], {
    renderer: vectorRenderer,
    stroke: true,
    color: square.border_color || fillColor,
    weight: 0.4,
    opacity: 0.22,
    fillOpacity: 0.5,
    fillColor
  });
  const details = [];
  if (square.coverage_type) {
    details.push(`Type: ${escapeHtml(square.coverage_type)}`);
  }
  if (square.snr !== null && square.snr !== undefined) {
    details.push(`SNR: ${escapeHtml(square.snr)} dB`);
  }
  const when = coverageTimeLabel(square.timestamp);
  if (when) details.push(`Updated: ${escapeHtml(when)}`);
  if (square.__source_grid_id) {
    details.push(`Source grid: ${escapeHtml(square.__source_grid_id)}`);
  }
  rect.bindPopup(details.join('<br/>'), { maxWidth: 320 });
  rect.__coverageBounds = { south, west, north, east };
  rect.__attached = false;
  return rect;
}

function renderMeshMapperCoverage(data) {
  coverageLayer.clearLayers();
  meshMapperCoverageSource = data;
  meshMapperCoverageExpanded = expandMeshMapperCoverageSquares(data);
  meshMapperCoverageRects = [];
  for (const square of meshMapperCoverageExpanded) {
    const rect = buildMeshMapperCoverageRect(square);
    if (rect) meshMapperCoverageRects.push(rect);
  }
  return syncMeshMapperCoverageViewport();
}

function syncMeshMapperCoverageViewport() {
  let rendered = 0;
  for (const rect of meshMapperCoverageRects) {
    const bounds = rect?.__coverageBounds;
    if (!bounds) continue;
    const visible = boundsIntersectsViewport(
      bounds.south,
      bounds.west,
      bounds.north,
      bounds.east
    );
    syncLayerMembership(coverageLayer, rect, visible);
    if (visible) rendered++;
  }
  return rendered;
}

function renderCoverage(data) {
  coverageLayer.clearLayers();
  meshMapperCoverageRects = [];
  meshMapperCoverageSource = null;
  meshMapperCoverageExpanded = [];
  if (!data || !Array.isArray(data)) {
    updateCoverageAttribution();
    updateCoverageLegend();
    return;
  }
  if (data.some(sample => sample && typeof sample === 'object' && sample.bounds)) {
    renderMeshMapperCoverage(data);
    updateCoverageAttribution();
    updateCoverageLegend();
    return;
  }
  // Aggregate samples by 6-char geohash prefix (coverage tile level)
  const tileMap = new Map(); // 6-char prefix -> { heard: count, lost: count, samples: [...] }
  for (const sample of data) {
    const hash = sample.hash || sample.name || sample.id;
    if (!hash) continue;
    const tileHash = hash.substring(0, 6); // Use 6-char prefix for coverage tiles
    if (!tileMap.has(tileHash)) {
      tileMap.set(tileHash, { heard: 0, lost: 0, samples: [], latestTime: 0, snr: null, rssi: null, paths: new Set() });
    }
    const tile = tileMap.get(tileHash);
    const observed = sample.observed !== undefined ? sample.observed : (sample.metadata?.observed !== undefined ? sample.metadata.observed : ((sample.path || sample.metadata?.path || []).length > 0));
    if (observed) {
      tile.heard++;
    } else {
      tile.lost++;
    }
    tile.samples.push(sample);
    const time = sample.time || sample.metadata?.time || 0;
    // Convert to number if it's a string, and handle milliseconds vs seconds
    let timeValue = typeof time === 'string' ? parseInt(time, 10) : (typeof time === 'number' ? time : 0);
    // If time looks like seconds (less than year 2000 in milliseconds), convert to milliseconds
    if (timeValue > 0 && timeValue < 946684800000) {
      timeValue = timeValue * 1000;
    }
    if (timeValue > tile.latestTime) {
      tile.latestTime = timeValue;
      tile.snr = sample.snr !== null && sample.snr !== undefined ? sample.snr : (sample.metadata?.snr !== null && sample.metadata?.snr !== undefined ? sample.metadata.snr : tile.snr);
      tile.rssi = sample.rssi !== null && sample.rssi !== undefined ? sample.rssi : (sample.metadata?.rssi !== null && sample.metadata?.rssi !== undefined ? sample.metadata.rssi : tile.rssi);
    }
    const path = sample.path || sample.metadata?.path || [];
    path.forEach(p => tile.paths.add(p));
  }
  let rendered = 0;
  for (const [tileHash, tile] of tileMap.entries()) {
    try {
      const [minLat, minLon, maxLat, maxLon] = geohashDecodeBbox(tileHash);
      if (!boundsIntersectsViewport(minLat, minLon, maxLat, maxLon)) continue;
      const totalSamples = tile.heard + tile.lost;
      if (totalSamples === 0) continue;
      const heardRatio = totalSamples > 0 ? tile.heard / totalSamples : 0;
      const color = successRateToColor(heardRatio);
      const baseOpacity = 0.75 * Math.min(1, totalSamples / 10);
      const opacity = heardRatio > 0 ? baseOpacity * heardRatio : Math.max(baseOpacity, 0.4);
      const rect = L.rectangle([[minLat, minLon], [maxLat, maxLon]], {
        renderer: vectorRenderer,
        color: color,
        weight: 1,
        fillOpacity: Math.max(opacity, 0.2),
        fillColor: color
      });
      let details = `Heard: ${tile.heard} Lost: ${tile.lost} (${(100 * heardRatio).toFixed(0)}%)`;
      if (tile.paths.size > 0) {
        const repeaters = Array.from(tile.paths)
          .slice(0, 5)
          .map(r => escapeHtml(String(r).toUpperCase()));
        details += `<br/>Repeaters: ${repeaters.join(', ')}${tile.paths.size > 5 ? '...' : ''}`;
      }
      if (tile.snr !== null && tile.snr !== undefined) {
        details += `<br/>SNR: ${escapeHtml(tile.snr)} dB`;
      }
      if (tile.rssi !== null && tile.rssi !== undefined) {
        details += `<br/>RSSI: ${escapeHtml(tile.rssi)} dBm`;
      }
      rect.bindPopup(details, { maxWidth: 320 });
      coverageLayer.addLayer(rect);
      rendered++;
    } catch (err) {
      // Silently skip invalid tiles
    }
  }
  updateCoverageAttribution();
  updateCoverageLegend();
}

function setCoverageVisible(visible) {
  coverageVisible = visible;
  const btn = document.getElementById('coverage-toggle');
  if (btn) {
    btn.classList.toggle('active', visible);
    btn.textContent = visible ? 'Hide coverage' : 'Coverage';
  }
  if (!nodesVisible) {
    if (coverageLayer && map.hasLayer(coverageLayer)) {
      map.removeLayer(coverageLayer);
    }
    updateCoverageAttribution();
    updateCoverageLegend();
    return;
  }
  if (visible) {
    if (!map.hasLayer(coverageLayer)) {
      coverageLayer.addTo(map);
    }
    if (!coverageData) {
      fetchCoverageData().then(result => {
        if (result && Array.isArray(result.data)) {
          coverageData = result.data;
          coverageProvider = result.provider || '';
          coverageRegion = result.region || '';
          if (result.data.length === 0) {
            reportError('Coverage database appears to be empty. Add coverage data to your coverage map server.');
          }
          renderCoverage(result.data);
        } else {
          updateCoverageLegend();
          reportError('Coverage API returned invalid data format');
        }
      });
    } else {
      renderCoverage(coverageData);
    }
  } else {
    if (map.hasLayer(coverageLayer)) {
      map.removeLayer(coverageLayer);
    }
    updateCoverageAttribution();
    updateCoverageLegend();
  }
}

function updateNodeSizeUi() {
  if (nodeSizeInput) {
    nodeSizeInput.value = String(nodeMarkerRadius);
  }
  if (nodeSizeValue) {
    nodeSizeValue.textContent = `${nodeMarkerRadius}px`;
  }
}

function setNodeMarkerRadius(value, persist = true) {
  const next = clampNumber(Number(value), NODE_RADIUS_MIN, NODE_RADIUS_MAX);
  if (!Number.isFinite(next)) return;
  nodeMarkerRadius = next;
  if (persist) {
    localStorage.setItem('meshmapNodeRadius2', String(nodeMarkerRadius));
  }
  updateNodeSizeUi();
  refreshOnlineMarkers();
}

function setNodesVisible(visible) {
  nodesVisible = visible;
  const btn = document.getElementById('nodes-toggle');
  if (btn) {
    btn.classList.toggle('active', !visible);
    btn.textContent = visible ? 'Hide nodes' : 'Show nodes';
  }
  if (visible) {
    if (!map.hasLayer(markerLayer)) {
      markerLayer.addTo(map);
    }
    if (!map.hasLayer(trailLayer)) {
      trailLayer.addTo(map);
    }
    if (!map.hasLayer(routeLayer)) {
      routeLayer.addTo(map);
    }
    if (arcadeModeEnabled && !map.hasLayer(arcadeLayer)) {
      arcadeLayer.addTo(map);
    }
    if (historyVisible && !map.hasLayer(historyLayer)) {
      historyLayer.addTo(map);
      renderHistoryFromCache();
    }
    if (heatVisible && heatLayer && !map.hasLayer(heatLayer)) {
      heatLayer.addTo(map);
    }
    if (coverageVisible && !map.hasLayer(coverageLayer)) {
      coverageLayer.addTo(map);
    }
    if (peersActive && !map.hasLayer(peerLayer)) {
      peerLayer.addTo(map);
    }
    if (peersActive && peersData) {
      renderCurrentPeers();
    }
    refreshViewportLayers();
    if (arcadeModeEnabled) {
      routeLines.forEach((entry, routeId) => {
        if (entry && Array.isArray(entry.routePoints)) {
          syncArcadeForRoute(routeId, entry.routePoints);
        }
      });
      syncAllRouteDisplays();
      startArcadeLoop();
    }
  } else if (map.hasLayer(markerLayer)) {
    map.removeLayer(markerLayer);
    if (map.hasLayer(trailLayer)) {
      map.removeLayer(trailLayer);
    }
    if (map.hasLayer(routeLayer)) {
      map.removeLayer(routeLayer);
    }
    if (map.hasLayer(arcadeLayer)) {
      map.removeLayer(arcadeLayer);
    }
    if (map.hasLayer(historyLayer)) {
      map.removeLayer(historyLayer);
      clearHistoryLayer();
    }
    if (heatLayer && map.hasLayer(heatLayer)) {
      map.removeLayer(heatLayer);
    }
    if (coverageLayer && map.hasLayer(coverageLayer)) {
      map.removeLayer(coverageLayer);
    }
    if (map.hasLayer(peerLayer)) {
      map.removeLayer(peerLayer);
    }
    stopArcadeLoop();
  } else if (map.hasLayer(trailLayer)) {
    map.removeLayer(trailLayer);
  } else {
    if (map.hasLayer(routeLayer)) {
      map.removeLayer(routeLayer);
    }
    if (map.hasLayer(arcadeLayer)) {
      map.removeLayer(arcadeLayer);
    }
    if (map.hasLayer(historyLayer)) {
      map.removeLayer(historyLayer);
      clearHistoryLayer();
    }
    if (heatLayer && map.hasLayer(heatLayer)) {
      map.removeLayer(heatLayer);
    }
    if (map.hasLayer(peerLayer)) {
      map.removeLayer(peerLayer);
    }
    stopArcadeLoop();
  }
}

function updateHistoryPanelVisibility() {
  if (!historyPanel) return;
  if (!routeHistoryEnabled) {
    historyPanel.classList.remove('active');
    historyPanel.setAttribute('hidden', 'hidden');
    historyPanel.style.display = 'none';
    return;
  }
  const shouldShow = historyVisible && !historyPanelHidden;
  historyPanel.classList.toggle('active', shouldShow);
  if (shouldShow) {
    historyPanel.removeAttribute('hidden');
    historyPanel.style.display = 'block';
  } else {
    historyPanel.setAttribute('hidden', 'hidden');
    historyPanel.style.display = 'none';
  }
}

function setHistoryPanelHidden(hidden) {
  historyPanelHidden = Boolean(hidden);
  if (historyPanelHidden) {
    setHistoryPanelCollapsed(true);
  }
  updateHistoryPanelVisibility();
  layoutSidePanels();
}

function setHistoryVisible(visible) {
  if (!routeHistoryEnabled) {
    historyVisible = false;
    historyPanelHidden = true;
    if (historyLegendGroup) {
      historyLegendGroup.classList.remove('active');
      historyLegendGroup.setAttribute('hidden', 'hidden');
      historyLegendGroup.style.display = 'none';
    }
    const btnDisabled = document.getElementById('history-toggle');
    if (btnDisabled) {
      btnDisabled.classList.remove('active');
    }
    if (map.hasLayer(historyLayer)) {
      map.removeLayer(historyLayer);
    }
    clearHistoryLayer();
    historyCache.clear();
    updateHistoryPanelVisibility();
    layoutSidePanels();
    return;
  }
  historyVisible = visible;
  if (visible) {
    historyPanelHidden = false;
    setHistoryPanelCollapsed(false);
  }
  const btn = document.getElementById('history-toggle');
  if (btn) {
    btn.classList.toggle('active', visible);
    btn.textContent = visible ? 'History: on' : 'History tool';
  }
  updateHistoryPanelVisibility();
  if (historyLegendGroup) {
    historyLegendGroup.classList.toggle('active', visible);
  }
  if (visible) {
    if (!map.hasLayer(historyLayer)) {
      historyLayer.addTo(map);
    }
    renderHistoryFromCache();
    updateHistoryRendering();
  } else if (map.hasLayer(historyLayer)) {
    map.removeLayer(historyLayer);
    clearHistoryLayer();
  }
  layoutSidePanels();
}

function setHopsVisible(visible) {
  hopsVisible = visible;
  const btn = document.getElementById('hops-toggle');
  if (btn) {
    btn.classList.toggle('active', visible);
    btn.textContent = visible ? 'Hide hops' : 'Show hops';
  }
  if (visible) {
    if (!map.hasLayer(hopLayer)) {
      hopLayer.addTo(map);
    }
    // Render for all existing routes
    for (const [id, entry] of routeLines.entries()) {
      renderHopMarkers(id, entry.meta);
    }
  } else {
    if (map.hasLayer(hopLayer)) {
      map.removeLayer(hopLayer);
    }
    clearAllHopMarkers();
    hideRouteDetailsPanel();
    layoutSidePanels();
  }
}

function makeArcadeIcon() {
  return L.divIcon({
    className: 'flow-marker',
    html: '<div class="flow-icon"></div>',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

function buildArcadePath(points) {
  if (!Array.isArray(points) || points.length < 2) return null;
  const latLngs = points.map((point) => L.latLng(point[0], point[1]));
  const segments = [];
  let total = 0;
  for (let idx = 0; idx < latLngs.length - 1; idx += 1) {
    const start = latLngs[idx];
    const end = latLngs[idx + 1];
    const length = start.distanceTo(end);
    if (!(length > 0)) continue;
    segments.push({
      start,
      end,
      startDistance: total,
      length,
    });
    total += length;
  }
  if (!(total > 0) || !segments.length) return null;
  return { latLngs, segments, total };
}

function interpolateArcadePosition(path, distance) {
  if (!path || !Array.isArray(path.segments) || !path.segments.length) return null;
  const clamped = Math.max(0, Math.min(distance, path.total));
  for (let idx = 0; idx < path.segments.length; idx += 1) {
    const segment = path.segments[idx];
    const segmentEnd = segment.startDistance + segment.length;
    if (clamped <= segmentEnd || idx === path.segments.length - 1) {
      const ratio = segment.length > 0
        ? (clamped - segment.startDistance) / segment.length
        : 0;
      const lat = segment.start.lat + ((segment.end.lat - segment.start.lat) * ratio);
      const lng = segment.start.lng + ((segment.end.lng - segment.start.lng) * ratio);
      const startPoint = map.latLngToLayerPoint(segment.start);
      const endPoint = map.latLngToLayerPoint(segment.end);
      const angle = Math.atan2(
        endPoint.y - startPoint.y,
        endPoint.x - startPoint.x
      ) * (180 / Math.PI);
      return { latlng: L.latLng(lat, lng), angle };
    }
  }
  return null;
}

function stopArcadeLoop() {
  if (arcadeAnimFrame != null) {
    window.cancelAnimationFrame(arcadeAnimFrame);
    arcadeAnimFrame = null;
  }
}

function updateArcadeMarker(entry, nowMs) {
  if (!entry || !entry.arcadeMarker || !entry.arcadeMarker.marker || !entry.arcadeMarker.path) return;
  const elapsed = Math.max(0, nowMs - entry.arcadeMarker.startedAt);
  const cycle = entry.arcadeMarker.durationMs > 0
    ? (elapsed % entry.arcadeMarker.durationMs)
    : 0;
  const distance = entry.arcadeMarker.path.total * (cycle / entry.arcadeMarker.durationMs);
  const resolved = interpolateArcadePosition(entry.arcadeMarker.path, distance);
  if (!resolved) return;
  entry.arcadeMarker.marker.setLatLng(resolved.latlng);
  const el = entry.arcadeMarker.marker.getElement();
  const icon = el ? el.querySelector('.flow-icon') : null;
  if (icon) {
    icon.style.transform = `rotate(${resolved.angle}deg)`;
  }
}

function animateArcadeMarkers(nowMs) {
  if (!arcadeModeEnabled || !nodesVisible || !map.hasLayer(arcadeLayer)) {
    stopArcadeLoop();
    return;
  }
  let activeCount = 0;
  routeLines.forEach((entry) => {
    if (!entry || !entry.arcadeMarker || !entry.arcadeMarker.marker || !entry.arcadeMarker.path) return;
    activeCount += 1;
    updateArcadeMarker(entry, nowMs);
  });
  if (!activeCount) {
    stopArcadeLoop();
    return;
  }
  arcadeAnimFrame = window.requestAnimationFrame(animateArcadeMarkers);
}

function startArcadeLoop() {
  if (arcadeAnimFrame != null || !arcadeModeEnabled || !nodesVisible || !map.hasLayer(arcadeLayer)) {
    return;
  }
  arcadeAnimFrame = window.requestAnimationFrame(animateArcadeMarkers);
}

function removeArcadeMarker(routeId) {
  const entry = routeLines.get(routeId);
  if (!entry || !entry.arcadeMarker || !entry.arcadeMarker.marker) return;
  arcadeLayer.removeLayer(entry.arcadeMarker.marker);
  entry.arcadeMarker = null;
}

function syncArcadeForRoute(id, points) {
  const entry = routeLines.get(id);
  if (!entry) return;
  if (!arcadeModeEnabled || !nodesVisible || !Array.isArray(points) || points.length < 2) {
    removeArcadeMarker(id);
    return;
  }
  const path = buildArcadePath(points);
  if (!path) {
    removeArcadeMarker(id);
    return;
  }
  if (!entry.arcadeMarker || !entry.arcadeMarker.marker) {
    entry.arcadeMarker = {
      marker: L.marker(path.latLngs[0], {
        icon: makeArcadeIcon(),
        pane: 'arcadePane',
        interactive: false,
        keyboard: false,
      }).addTo(arcadeLayer),
      startedAt: performance.now(),
      durationMs: FLOW_MIN_DURATION_MS,
      path,
    };
  }
  entry.arcadeMarker.path = path;
  entry.arcadeMarker.durationMs = clampNumber(path.total * 6, FLOW_MIN_DURATION_MS, FLOW_MAX_DURATION_MS);
  if (!Number.isFinite(entry.arcadeMarker.startedAt)) {
    entry.arcadeMarker.startedAt = performance.now();
  }
  updateArcadeMarker(entry, performance.now());
  startArcadeLoop();
}

function toggleArcadeMode() {
  setArcadeModeEnabled(!arcadeModeEnabled);
  console.info(`[meshmap] arcade mode ${arcadeModeEnabled ? 'on' : 'off'}`);
}

const ARCADE_SEQUENCE = [
  'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
  'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight',
  'b', 'a'
];
let arcadeSequenceIndex = 0;

function handleArcadeSequenceKey(ev) {
  const target = ev.target;
  if (
    target &&
    (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
  ) {
    return;
  }
  const key = String(ev.key || '');
  const expected = ARCADE_SEQUENCE[arcadeSequenceIndex];
  if (key === expected) {
    arcadeSequenceIndex += 1;
    if (arcadeSequenceIndex >= ARCADE_SEQUENCE.length) {
      arcadeSequenceIndex = 0;
      toggleArcadeMode();
    }
    return;
  }
  arcadeSequenceIndex = key === ARCADE_SEQUENCE[0] ? 1 : 0;
}

document.addEventListener('keydown', handleArcadeSequenceKey);

function stringHashColor(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
  return '#' + '00000'.substring(0, 6 - c.length) + c;
}

function clearHopMarkersForRoute(routeId) {
  if (!hopMarkers.has(routeId)) return;
  hopMarkers.get(routeId).forEach(m => hopLayer.removeLayer(m));
  hopMarkers.delete(routeId);
}

function clearAllHopMarkers() {
  hopMarkers.forEach((_markers, routeId) => {
    clearHopMarkersForRoute(routeId);
  });
}

function hideRouteDetailsPanel() {
  if (routeDetailsPanel) {
    routeDetailsPanel.hidden = true;
    routeDetailsPanel.classList.remove('active');
    routeDetailsPanel.style.display = 'none';
  }
  activeRouteDetailsMeta = null;
  activeRouteDetailsId = null;
}

function routeHashByteWidth(hash) {
  const normalized = normalizeHopHashPrefix(hash);
  if (!normalized) return null;
  return normalized.length / 2;
}

function routeMatchesByteFilter(meta) {
  if (!meta || routeByteFilter.has('all')) return true;
  const hashes = Array.isArray(meta.hashes) ? meta.hashes : [];
  if (!hashes.length) return false;
  return hashes.some((hash) => routeByteFilter.has(`${routeHashByteWidth(hash)}b`));
}

function routeMatchesNodeFilter(meta) {
  const terms = routeNodeFilterText.toLowerCase().split(',')
    .map(term => term.trim()).filter(Boolean);
  if (!terms.length) return true;
  if (!meta) return false;
  const routeDeviceIds = new Set([
    meta.origin_id,
    meta.receiver_id,
    ...(Array.isArray(meta.points)
      ? meta.points.map(point => point && point.point_id)
      : [])
  ].filter(Boolean));
  const currentDeviceValues = [];
  routeDeviceIds.forEach((id) => {
    const device = deviceData.get(id);
    if (!device) return;
    currentDeviceValues.push(device.name, deviceDisplayName(device));
  });
  const pointValues = Array.isArray(meta.points)
    ? meta.points.flatMap(point => [
      point.point_id,
      point.point_label,
      point.node_prefix,
      point.hop_hash
    ])
    : [];
  const values = [
    meta.origin_id,
    meta.origin_label,
    meta.receiver_id,
    meta.receiver_label,
    meta.sender_name,
    ...currentDeviceValues,
    ...(Array.isArray(meta.hashes) ? meta.hashes : []),
    ...pointValues
  ].filter(Boolean).map(value => String(value).toLowerCase());
  return terms.some(term => values.some(value => value.includes(term)));
}

function routePointRole(point) {
  const device = point && point.point_id ? deviceData.get(point.point_id) : null;
  if (device) return resolveRole(device);
  const label = String(point && point.role_label || '').toLowerCase();
  if (label.includes('repeater')) return 'repeater';
  if (label.includes('companion')) return 'companion';
  if (label.includes('room')) return 'room';
  return 'unknown';
}

function visibleRouteSegments(meta) {
  if (!meta || !Array.isArray(meta.points)) return [];
  const segments = [];
  let current = [];
  const finishSegment = () => {
    if (current.length >= 2) segments.push(current);
    current = [];
  };
  meta.points.forEach((point) => {
    if (point && point.endpoint_only) return;
    if (!Number.isFinite(point && point.lat) || !Number.isFinite(point && point.lon)) {
      finishSegment();
      return;
    }
    if (visibleRoles.has(routePointRole(point))) {
      current.push(point);
    } else {
      finishSegment();
    }
  });
  finishSegment();
  return segments;
}

function routeMatchesRoleFilter(meta) {
  return visibleRouteSegments(meta).length > 0;
}

function routeVisibleForCurrentFilters(meta) {
  return nodesVisible && !mqttOnlyVisible &&
    routeMatchesByteFilter(meta) && routeMatchesNodeFilter(meta) &&
    routeMatchesRoleFilter(meta);
}

function getVisibleRouteCount() {
  let count = 0;
  routeLines.forEach((entry) => {
    if (routeVisibleForCurrentFilters(entry && entry.meta)) {
      count += 1;
    }
  });
  return count;
}

function syncRouteEntryDisplay(routeId, entry) {
  if (!entry || !entry.line) return;
  const roleSegments = visibleRouteSegments(entry.meta);
  const visible = routeVisibleForCurrentFilters(entry.meta);
  const style = routeStyleForDisplay(
    entry.payloadType,
    entry.routeMode,
    arcadeModeEnabled
  );
  if (visible) {
    const latLngSegments = roleSegments.map(segment =>
      segment.map(point => [point.lat, point.lon])
    );
    entry.line.setLatLngs(
      latLngSegments.length === 1 ? latLngSegments[0] : latLngSegments
    );
  }
  entry.line.setStyle({
    ...style,
    opacity: visible ? style.opacity : 0,
    fillOpacity: visible ? style.fillOpacity : 0
  });
  if (visible) {
    if (entry.line.bringToFront) {
      entry.line.bringToFront();
    }
    if (arcadeModeEnabled && roleSegments.length) {
      const arcadeSegment = roleSegments.reduce((longest, segment) =>
        segment.length > longest.length ? segment : longest
      );
      syncArcadeForRoute(
        routeId,
        arcadeSegment.map(point => [point.lat, point.lon])
      );
    }
  } else {
    removeArcadeMarker(routeId);
  }
  if (hopsVisible) {
    renderHopMarkers(routeId, entry.meta);
  } else {
    clearHopMarkersForRoute(routeId);
  }
  if (!visible && activeRouteDetailsId === routeId) {
    hideRouteDetailsPanel();
    layoutSidePanels();
  }
}

function syncAllRouteDisplays() {
  const cachedRoutes = Array.from(routeCache.values());
  clearRouteDisplay();
  cachedRoutes.forEach((route) => {
    upsertRoute(route, true);
  });
  refreshStats();
}

function syncRouteFilterDisplays() {
  routeLines.forEach((entry, routeId) => {
    syncRouteEntryDisplay(routeId, entry);
  });
  refreshStats();
}

function renderHopMarkers(routeId, meta) {
  clearHopMarkersForRoute(routeId);
  if (!hopsVisible || !meta || !meta.points || !routeVisibleForCurrentFilters(meta)) {
    return;
  }
  const visibleRoutePoints = new Set(visibleRouteSegments(meta).flat());

  // Generate color
  const color = stringHashColor(routeId);
  const markersList = [];

  meta.points.forEach((pt, index) => {
    if (!visibleRoutePoints.has(pt)) return;
    // Skip 0 (origin) and last (destination) if we only want hops?
    // "displays the hop number" - usually means 1, 2, 3...
    // The request says "route path on the map".
    // "User clicks on ... hop number ... displays hop number alongside repeater name"
    // Usually we want to see intermediate hops.
    // If points includes origin and dest, index 0 is origin (hop 0?), index N is dest.
    // Let's show all for completeness or just intermediates?
    // "Route Details" implies showing the whole path.
    // Let's show all points with their index.

    const lat = pt.lat;
    const lon = pt.lon;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

    const icon = L.divIcon({
      className: 'hop-marker-container', // We'll use innerHTML for styling
      html: `<div class="hop-marker" style="background-color: ${color}; width: 16px; height: 16px;">${index}</div>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8]
    });

    const marker = L.marker([lat, lon], { icon, interactive: true }).addTo(hopLayer);
    marker.on('click', (ev) => {
      L.DomEvent.stop(ev);
      showRouteDetails(meta);
    });
    markersList.push(marker);
  });

  hopMarkers.set(routeId, markersList);
}

function normalizeCoreScopeBaseUrl() {
  if (!coreScopeUrl) return '';
  const base = coreScopeUrl.replace(/#\/?$/, '').replace(/\/+$/, '');
  return /^https?:\/\//i.test(base) ? base : '';
}

function buildCoreScopeLink(kind, value) {
  const base = normalizeCoreScopeBaseUrl();
  const target = String(value || '').trim();
  if (!base || !target) return '';
  const normalizedTarget = /^[0-9a-f]+$/i.test(target) ? target.toLowerCase() : target;
  const encoded = encodeURIComponent(normalizedTarget);
  if (kind === 'node') return `${base}/#/nodes/${encoded}`;
  if (kind === 'trace') return `${base}/#/traces/${encoded}`;
  return `${base}/#/packets/${encoded}`;
}

function showRouteDetails(meta) {
  if (!meta || !routeMatchesByteFilter(meta) || !routeMatchesNodeFilter(meta)) {
    hideRouteDetailsPanel();
    return;
  }
  activeRouteDetailsMeta = meta;
  activeRouteDetailsId = meta.id || null;

  // Show panel
  if (routeDetailsPanel) {
    routeDetailsPanel.classList.add('active');
    routeDetailsPanel.hidden = false;
    routeDetailsPanel.style.display = 'block';
    setRouteDetailsPanelCollapsed(false);
  }

  if (routeDetailsTitle) {
    const routeHash = typeof meta.message_hash === 'string' && meta.message_hash.trim()
      ? meta.message_hash.trim()
      : (typeof meta.id === 'string' ? meta.id.trim() : '');
    const routeLabel = routeHash || 'unknown';
    routeDetailsTitle.innerHTML = '';
    routeDetailsTitle.append(document.createTextNode('Route: '));
    const coreScopePacketUrl = buildCoreScopeLink('packet', routeHash);
    if ((packetAnalyzerUrl || coreScopePacketUrl) && routeHash) {
      const link = document.createElement('a');
      link.href = packetAnalyzerUrl
        ? `${packetAnalyzerUrl}${encodeURIComponent(routeHash)}`
        : coreScopePacketUrl;
      link.target = '_blank';
      link.rel = 'noopener';
      link.className = 'route-hash-link';
      link.textContent = routeLabel;
      link.title = routeHash;
      routeDetailsTitle.append(link);
    } else {
      routeDetailsTitle.append(document.createTextNode(routeLabel));
    }
    routeDetailsTitle.append(document.createTextNode(` (${meta.hop_count} hops)`));
  }
  if (routeDetailsTotal) {
    const totalDistance = Number.isFinite(meta.distance_m)
      ? formatDistanceUnits(meta.distance_m)
      : null;
    routeDetailsTotal.textContent = totalDistance ? `Total distance: ${totalDistance}` : '';
  }

  if (routeDetailsContent) {
    routeDetailsContent.innerHTML = '';

    // Generate list
    const color = stringHashColor(meta.id);
    const displayPoints = meta.points.map((pt) => ({ ...pt }));
    const displayHashes = Array.isArray(meta.hashes) ? [...meta.hashes] : [];

    const resolvePointName = (pt, displayIdx) => {
      const isFirst = displayIdx === 0;
      const isLast = displayIdx === displayPoints.length - 1;
      let label = pt.point_label && pt.point_label !== 'Unknown' ? pt.point_label : null;

      if (!label && isFirst && meta.origin_label && !meta.origin_label.toLowerCase().includes('packet')) {
        label = meta.origin_label;
      }
      if (!label && isLast && meta.receiver_label && !meta.receiver_label.toLowerCase().includes('packet')) {
        label = meta.receiver_label;
      }
      if (!label && pt.point_id) {
        label = deviceLabelFromId(pt.point_id);
      }
      if (!label) {
        return isFirst ? 'Origin' : (isLast ? 'Receiver' : `Hop ${displayIdx}`);
      }
      return label;
    };

    displayPoints.forEach((pt, displayIdx) => {
      const row = document.createElement('div');
      row.className = 'hop-row';

      const paramName = resolvePointName(pt, displayIdx);

      const distInfo = Number.isFinite(pt.hop_distance_m)
        ? formatDistanceUnits(pt.hop_distance_m)
        : '';

      let idInfo = '';
      if (pt.node_prefix) {
        idInfo = `Prefix: ${pt.node_prefix}`;
      }

      let roleInfo = '';
      if (pt.role_label) {
        roleInfo = `Role: ${pt.role_label}`;
      }

      let endpointInfo = '';
      if (pt.endpoint_only && pt.endpoint_kind === 'sender_name') {
        endpointInfo = 'Sender name';
      } else if (pt.endpoint_only && pt.endpoint_kind === 'origin') {
        endpointInfo = 'Origin endpoint';
      } else if (pt.endpoint_only && pt.endpoint_kind === 'receiver') {
        endpointInfo = 'Receiver endpoint';
      }

      const metaInfo = [endpointInfo, roleInfo, distInfo, idInfo].filter(Boolean).join(' • ');

      let badgeContent = displayIdx;
      let badgeClass = 'hop-badge';
      let badgeStyle = `background-color: ${color}`;
      const safeBadgeClass = escapeHtmlAttr(badgeClass);
      const safeBadgeStyle = escapeHtmlAttr(badgeStyle);
      const safeBadgeContent = escapeHtml(badgeContent);
      const safeParamName = escapeHtml(paramName);
      const nodeLink = buildCoreScopeLink('node', pt.point_id);
      const nameHtml = nodeLink
        ? `<a class="hop-node-link" href="${escapeHtmlAttr(nodeLink)}" target="_blank" rel="noopener" title="Open ${escapeHtmlAttr(paramName)} in CoreScope">${safeParamName}</a>`
        : safeParamName;
      const safeMetaInfo = escapeHtml(metaInfo);

      row.innerHTML = `
                   <div class="${safeBadgeClass}" style="${safeBadgeStyle}">${safeBadgeContent}</div>
                   <div class="hop-info">
                      <div class="hop-name" title="${escapeHtmlAttr(paramName)}">${nameHtml}</div>
                      <div class="hop-meta">${safeMetaInfo}</div>
                   </div>
                `;
      routeDetailsContent.appendChild(row);
    });
  }
  layoutSidePanels();
}

function setPeersStatus(text) {
  if (peersStatus) {
    peersStatus.classList.remove('peers-status-action');
    peersStatus.removeAttribute('role');
    peersStatus.removeAttribute('tabindex');
    delete peersStatus.dataset.peerDeviceId;
    peersStatus.textContent = text || '';
    peersStatus.hidden = !text;
  }
}

function setPeersPanelTitle(name = 'Node peers', deviceId = '', windowHours = null) {
  if (peersTitle) {
    peersTitle.textContent = name || 'Node peers';
    if (deviceId) {
      peersTitle.classList.add('peers-title-action');
      peersTitle.setAttribute('role', 'button');
      peersTitle.setAttribute('tabindex', '0');
      peersTitle.dataset.peerDeviceId = deviceId;
      peersTitle.title = 'Focus selected node';
    } else {
      peersTitle.classList.remove('peers-title-action');
      peersTitle.removeAttribute('role');
      peersTitle.removeAttribute('tabindex');
      peersTitle.removeAttribute('title');
      delete peersTitle.dataset.peerDeviceId;
    }
  }
  if (peersWindow) {
    peersWindow.textContent = windowHours ? `${windowHours}h window` : '';
    peersWindow.hidden = !windowHours;
  }
}

function setPeersSelectedStatus(name, deviceId, windowHours = null) {
  setPeersPanelTitle(name, deviceId, windowHours);
  setPeersStatus('');
}

function packetLabel(count, direction) {
  const value = Math.max(0, Math.trunc(Number(count) || 0));
  const suffix = value === 1 ? 'pkt' : 'pkts';
  return `${value} ${direction} ${suffix}`;
}

function peerCountLabel(count) {
  const value = Math.max(0, Math.trunc(Number(count) || 0));
  return `${value} ${value === 1 ? 'peer' : 'peers'}`;
}

function renderPeerHeading(target, title, total, direction, unique, lineLabel) {
  if (!target) return;
  if (total == null || unique == null) {
    target.textContent = title;
    return;
  }
  target.innerHTML = `
    <span class="peer-heading-title">${title}</span>
    <span class="peer-heading-stats">
      <span>${packetLabel(total, direction)}</span>
      <span>${peerCountLabel(unique)}</span>
      <em>(${lineLabel})</em>
    </span>
  `;
}

function setPeerHeadings(
  incomingUnique = null,
  outgoingUnique = null,
  incomingTotal = null,
  outgoingTotal = null
) {
  const inCount = Number(incomingUnique);
  const outCount = Number(outgoingUnique);
  renderPeerHeading(
    peersInHeading,
    'Incoming (heard from)',
    incomingTotal,
    'Rx',
    Number.isFinite(inCount) ? inCount : null,
    'Blue lines'
  );
  renderPeerHeading(
    peersOutHeading,
    'Outgoing (heard by)',
    outgoingTotal,
    'Tx',
    Number.isFinite(outCount) ? outCount : null,
    'Purple lines'
  );
}

function clearPeerLines() {
  peerLines.forEach(line => {
    if (line && peerLayer.hasLayer(line)) {
      peerLayer.removeLayer(line);
    }
  });
  peerLines.clear();
  if (map.hasLayer(peerLayer)) {
    map.removeLayer(peerLayer);
  }
}

function renderPeerLines(origin, incoming, outgoing) {
  clearPeerLines();
  if (!peersActive || !nodesVisible) return;
  if (!origin || origin.lat == null || origin.lon == null) return;
  if (mqttOnlyVisible && peersSelectedId) {
    const selectedDevice = deviceData.get(peersSelectedId);
    if (selectedDevice && !devicePassesMqttOnlyFilter(selectedDevice)) return;
  }
  if (peersSelectedId) {
    const selectedDevice = deviceData.get(peersSelectedId);
    if (selectedDevice && !visibleRoles.has(resolveRole(selectedDevice))) return;
  }
  if (!map.hasLayer(peerLayer)) {
    peerLayer.addTo(map);
  }
  const originLatLng = [origin.lat, origin.lon];
  const drawLine = (peer, color, dash, direction) => {
    if (peer.lat == null || peer.lon == null) return;
    const peerDevice = peer.peer_id ? deviceData.get(peer.peer_id) : null;
    const peerRole = peerDevice
      ? resolveRole(peerDevice)
      : resolveRole({ role: peer.role });
    if (!visibleRoles.has(peerRole)) return;
    if (mqttOnlyVisible && peer.peer_id) {
      if (peerDevice && !devicePassesMqttOnlyFilter(peerDevice)) return;
    }
    const line = L.polyline([originLatLng, [peer.lat, peer.lon]], {
      pane: 'peerPane',
      color,
      weight: 3,
      opacity: 0.85,
      dashArray: dash,
      interactive: false
    }).addTo(peerLayer);
    const key = `${direction}:${peer.peer_id || `${peer.lat},${peer.lon}`}`;
    peerLines.set(key, line);
  };
  incoming.forEach(peer => drawLine(peer, '#38bdf8', '6 8', 'in'));
  outgoing.forEach(peer => drawLine(peer, '#a855f7', '2 6', 'out'));
  if (peerLayer.bringToFront) {
    peerLayer.bringToFront();
  }
}

function normalizedPeerFilter() {
  return String(peersFilterText || '').trim().toLowerCase();
}

function peerMatchesFilter(peer, query) {
  if (!query) return true;
  if (!peer) return false;
  const values = [
    peer.name,
    peer.peer_id,
    peer.role,
    peer.peer_id ? String(peer.peer_id).slice(0, 8) : '',
  ];
  return values.some(value => String(value || '').toLowerCase().includes(query));
}

function rankedPeers(peers) {
  const peerItems = Array.isArray(peers) ? peers : [];
  return peerItems.map((peer, index) => ({
    ...peer,
    rank: index + 1,
  }));
}

function filteredPeers(peers) {
  const peerItems = rankedPeers(peers);
  const query = normalizedPeerFilter();
  if (!query) return peerItems;
  return peerItems.filter(peer => peerMatchesFilter(peer, query));
}

function renderCurrentPeers() {
  if (!peersData) return;
  const origin = { lat: peersData.lat, lon: peersData.lon };
  const incoming = filteredPeers(peersData.incoming || []);
  const outgoing = filteredPeers(peersData.outgoing || []);
  renderPeerList(
    peersIn,
    incoming,
    peersData.incoming_total || 0,
    'incoming',
    origin,
    (peersData.incoming || []).length
  );
  renderPeerList(
    peersOut,
    outgoing,
    peersData.outgoing_total || 0,
    'outgoing',
    origin,
    (peersData.outgoing || []).length
  );
  renderPeerLines(origin, incoming, outgoing);
}

function getPeerDistanceMeters(origin, peer) {
  const apiDistance = Number(peer && peer.distance_m);
  if (Number.isFinite(apiDistance) && apiDistance >= 0) {
    return apiDistance;
  }
  if (!origin || !peer) return null;
  const originLat = Number(origin.lat);
  const originLon = Number(origin.lon);
  const peerLat = Number(peer.lat);
  const peerLon = Number(peer.lon);
  if (![originLat, originLon, peerLat, peerLon].every(Number.isFinite)) {
    return null;
  }
  return haversineMeters(originLat, originLon, peerLat, peerLon);
}

function renderPeerList(target, peers, total, label, origin = null, unfilteredCount = null) {
  if (!target) return;
  target.innerHTML = '';
  const peerItems = Array.isArray(peers) ? peers : [];
  if (peerItems.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'small';
    const filtered = normalizedPeerFilter() && Number(unfilteredCount) > 0;
    empty.textContent = filtered
      ? `No ${label} peers match this filter.`
      : `No ${label} data yet.`;
    target.appendChild(empty);
    return;
  }
  peerItems.forEach((peer, index) => {
    const item = document.createElement('div');
    item.className = 'peer-item';
    const name = peer.name || (peer.peer_id ? `${peer.peer_id.slice(0, 8)}…` : 'Unknown');
    const parsedRank = Number(peer.rank);
    const rank = Number.isFinite(parsedRank) && parsedRank > 0
      ? Math.trunc(parsedRank)
      : index + 1;
    const rankDirection = label === 'incoming' ? 'Rx' : 'Tx';
    const percent = total > 0 ? `${peer.percent.toFixed(1)}%` : '0%';
    const distance = formatPeerDistanceUnits(getPeerDistanceMeters(origin, peer));
    const metaParts = [`${peer.count}`, `${percent}`].map(escapeHtml);
    if (distance) {
      metaParts.push(escapeHtml(distance));
    }
    const meta = metaParts.join('<span class="peer-stat-separator" aria-hidden="true">•</span>');
    item.innerHTML = `
      <span class="peer-identity">
        <span class="peer-rank" aria-label="${rankDirection} rank ${rank}">${rank}</span>
        <span class="peer-name">${escapeHtml(name)}</span>
      </span>
      <span class="peer-count">${meta}</span>
    `;
    const peerKey = peer.peer_id ? ` (${peer.peer_id.slice(0, 8)}…)` : '';
    item.title = `${rankDirection} rank ${rank} • ${name}${peerKey}`;
    item.addEventListener('click', () => {
      if (peer.peer_id) {
        focusDevice(peer.peer_id);
      }
    });
    target.appendChild(item);
  });
}

async function selectPeerNode(deviceId) {
  if (!deviceId) return;
  peersSelectedId = deviceId;
  if (!peersActive) return;
  const requestToken = ++peersRequestToken;
  setPeersPanelTitle();
  setPeersStatus('Loading peers…');
  if (peersMeta) {
    peersMeta.textContent = '';
    peersMeta.hidden = true;
  }
  try {
    const res = await fetch(withToken(`/peers/${encodeURIComponent(deviceId)}`), { headers: tokenHeaders() });
    if (!res.ok) {
      throw new Error(`peers ${res.status}`);
    }
    const data = await res.json();
    if (requestToken !== peersRequestToken || !peersActive || peersSelectedId !== deviceId) return;
    peersData = data;
    const name = data.name || (deviceId ? `${deviceId.slice(0, 8)}…` : 'Unknown');
    const inboundTotal = data.incoming_total || 0;
    const outboundTotal = data.outgoing_total || 0;
    const inboundUnique = data.incoming_unique ?? (data.incoming || []).length;
    const outboundUnique = data.outgoing_unique ?? (data.outgoing || []).length;
    setPeersSelectedStatus(name, deviceId, data.window_hours || 24);
    setPeerHeadings(inboundUnique, outboundUnique, inboundTotal, outboundTotal);
    if (peersMeta) {
      peersMeta.textContent = '';
      peersMeta.hidden = true;
    }
    renderCurrentPeers();
  } catch (err) {
    if (requestToken !== peersRequestToken) return;
    setPeersPanelTitle();
    setPeersStatus('Peer lookup failed.');
    if (peersMeta) {
      peersMeta.textContent = '';
      peersMeta.hidden = true;
    }
    setPeerHeadings();
    renderPeerList(peersIn, [], 0, 'incoming');
    renderPeerList(peersOut, [], 0, 'outgoing');
    peersData = null;
    clearPeerLines();
  }
}

function clearPeers() {
  peersRequestToken += 1;
  peersSelectedId = null;
  peersData = null;
  setPeersPanelTitle();
  setPeersStatus('Select a node to view peers.');
  if (peersMeta) {
    peersMeta.textContent = '';
    peersMeta.hidden = true;
  }
  setPeerHeadings();
  renderPeerList(peersIn, [], 0, 'incoming');
  renderPeerList(peersOut, [], 0, 'outgoing');
  if (peersFilter) peersFilter.value = '';
  peersFilterText = '';
  clearPeerLines();
}

function setPeersActive(active) {
  peersActive = active;
  if (peersToggle) {
    peersToggle.classList.toggle('active', active);
    peersToggle.textContent = active ? 'Peers: select node' : 'Peers tool';
  }
  if (peersPanel) {
    peersPanel.classList.toggle('active', active);
    if (active) {
      setPeersPanelCollapsed(false);
      peersPanel.removeAttribute('hidden');
      peersPanel.style.display = '';
    } else {
      peersPanel.setAttribute('hidden', 'hidden');
      peersPanel.style.display = '';
    }
  }
  if (active && peersData) {
    renderCurrentPeers();
  } else if (active) {
    setPeerHeadings(0, 0);
  }
  if (!active) {
    clearPeers();
  }
  layoutSidePanels();
}

function setHeatVisible(visible) {
  heatVisible = visible;
  const btn = document.getElementById('heat-toggle');
  if (!heatAvailable) {
    heatVisible = false;
    if (btn) {
      btn.disabled = true;
      btn.classList.add('disabled');
      btn.textContent = 'Heat unavailable';
    }
    return;
  }
  if (btn) {
    btn.classList.toggle('active', !visible);
    btn.textContent = visible ? 'Hide heat' : 'Show heat';
  }
  if (!nodesVisible) {
    if (heatLayer && map.hasLayer(heatLayer)) {
      map.removeLayer(heatLayer);
    }
    return;
  }
  if (visible) {
    if (heatLayer && !map.hasLayer(heatLayer)) {
      heatLayer.addTo(map);
    }
  } else if (heatLayer && map.hasLayer(heatLayer)) {
    map.removeLayer(heatLayer);
  }
}

function deviceShortId(d) {
  return d.device_id ? `${d.device_id.slice(0, 8)}…` : '';
}

function deviceDisplayName(d) {
  return d.name || deviceShortId(d) || 'Unknown';
}

function normalizeLinkedDeviceTarget(value) {
  return String(value ?? '').trim().toLowerCase();
}

function linkedDeviceSlug(value) {
  return normalizeLinkedDeviceTarget(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function deviceMatchesLinkedTarget(id, d, target) {
  if (!target) return false;
  const normalizedId = normalizeLinkedDeviceTarget(id);
  if (normalizedId === target) return true;
  if (target.length >= 6 && normalizedId.startsWith(target)) return true;

  const name = d && d.name ? d.name : '';
  const normalizedName = normalizeLinkedDeviceTarget(name);
  if (normalizedName && normalizedName === target) return true;
  const targetSlug = linkedDeviceSlug(target);
  return Boolean(targetSlug && linkedDeviceSlug(name) === targetSlug);
}

function findLinkedDeviceId(target) {
  if (!target) return null;
  for (const [id] of deviceData.entries()) {
    if (normalizeLinkedDeviceTarget(id) === target) return id;
  }
  const matches = [];
  for (const [id, d] of deviceData.entries()) {
    if (deviceMatchesLinkedTarget(id, d, target)) {
      matches.push({ id, d });
    }
  }
  const repeater = matches.find(({ d }) => resolveRole(d) === 'repeater');
  return repeater ? repeater.id : (matches[0] ? matches[0].id : null);
}

function tryFocusLinkedDevice() {
  if (linkedDeviceFocusDone || !linkedDeviceTarget) return false;
  const id = findLinkedDeviceId(linkedDeviceTarget);
  if (!id) return false;
  linkedDeviceFocusDone = true;
  if (!nodesVisible) {
    setNodesVisible(true);
  }
  focusDevice(id, { fromLink: true });
  return true;
}

function getLastSeenTs(d) {
  return d.last_seen_ts || d.ts;
}

function isMqttOnline(d) {
  if (d.mqtt_forced) return true;
  const now = getServerNowMs() / 1000;
  const statusValue = String(d.mqtt_status_value || '').trim().toLowerCase();
  const statusTs = Number(d.mqtt_status_ts) || 0;
  if (
    statusTs &&
    mqttOnlineStatusTtlSeconds > 0 &&
    (now - statusTs) <= mqttOnlineStatusTtlSeconds &&
    (statusValue === 'offline' || statusValue === 'disconnected')
  ) {
    return false;
  }

  const source = String(d.mqtt_online_source || '').trim().toLowerCase();
  if (source === 'internal') {
    const ts = Number(d.mqtt_internal_ts) || Number(d.mqtt_seen_ts) || 0;
    return ts > 0 && mqttOnlineInternalTtlSeconds > 0 && (now - ts) <= mqttOnlineInternalTtlSeconds;
  }
  if (source === 'status') {
    const ts = Number(d.mqtt_status_ts) || Number(d.mqtt_seen_ts) || 0;
    return ts > 0 && mqttOnlineStatusTtlSeconds > 0 && (now - ts) <= mqttOnlineStatusTtlSeconds;
  }

  const lastSeen = Number(d.mqtt_seen_ts) || 0;
  if (!lastSeen) return false;
  return mqttOnlineSeconds > 0 && (now - lastSeen) <= mqttOnlineSeconds;
}

function devicePassesMqttOnlyFilter(d) {
  return !mqttOnlyVisible || isMqttOnline(d);
}

function shouldShowDeviceOnMap(d) {
  return Boolean(d) &&
    nodesVisible &&
    visibleRoles.has(resolveRole(d)) &&
    devicePassesMqttOnlyFilter(d) &&
    latLngInViewport(d.lat, d.lon);
}

function updateRoleFilterUi() {
  roleFilterButtons.forEach((button) => {
    const shown = visibleRoles.has(button.dataset.roleFilter);
    button.textContent = shown ? 'Shown' : 'Hidden';
    button.classList.toggle('active', shown);
    button.setAttribute('aria-pressed', shown ? 'true' : 'false');
  });
}

function setRoleVisible(role, shown) {
  if (shown) visibleRoles.add(role);
  else visibleRoles.delete(role);
  localStorage.setItem('meshmapVisibleRoles', [...visibleRoles].join(','));
  updateRoleFilterUi();
  refreshViewportLayers();
  routeLines.forEach((entry, routeId) => {
    syncRouteEntryDisplay(routeId, entry);
  });
  if (peersActive && peersData) renderCurrentPeers();
  refreshStats();
}

function setMqttOnlyVisible(visible) {
  mqttOnlyVisible = Boolean(visible);
  updateMqttOnlyToggleUi();
  refreshViewportLayers();
  routeLines.forEach((entry, routeId) => {
    syncRouteEntryDisplay(routeId, entry);
  });
  if (peersActive && peersData) {
    const selectedDevice = peersSelectedId ? deviceData.get(peersSelectedId) : null;
    if (selectedDevice && !devicePassesMqttOnlyFilter(selectedDevice)) {
      clearPeerLines();
    } else {
      renderCurrentPeers();
    }
  }
  refreshStats();
}

function updateMarkerLabel(m, d) {
  if (!m || !d) return;
  if (!showLabels) {
    if (m.getTooltip()) m.unbindTooltip();
    return;
  }
  const label = deviceDisplayName(d);
  if (!label) return;
  if (m.getTooltip()) {
    m.setTooltipContent(escapeHtml(label));
  } else {
    m.bindTooltip(escapeHtml(label), {
      permanent: true,
      direction: 'top',
      className: 'node-label',
      offset: [0, -6]
    });
  }
}

function renderSearchResults(query) {
  if (!searchResults) return;
  const q = (query || '').trim().toLowerCase();
  searchMatches = [];
  if (!q) {
    searchResults.hidden = true;
    searchResults.innerHTML = '';
    return;
  }
  for (const [id, d] of deviceData.entries()) {
    const name = (d.name || '').toLowerCase();
    if (name.includes(q) || id.toLowerCase().includes(q)) {
      searchMatches.push({ id, d });
    }
  }
  searchMatches = searchMatches.slice(0, 8);
  if (searchMatches.length === 0) {
    searchResults.hidden = true;
    searchResults.innerHTML = '';
    return;
  }
  searchResults.innerHTML = '';
  searchMatches.forEach(({ id, d }) => {
    const item = document.createElement('div');
    item.className = 'node-search-item';
    const name = document.createElement('span');
    name.textContent = deviceDisplayName(d);
    const shortId = document.createElement('span');
    shortId.className = 'node-search-id';
    shortId.textContent = `${id.slice(0, 8)}…`;
    item.append(name, shortId);
    item.addEventListener('click', () => {
      if (peersActive) {
        selectPeerNode(id);
      }
      focusDevice(id);
    });
    searchResults.appendChild(item);
  });
  searchResults.hidden = false;
}

function routeNodeCurrentQuery() {
  const value = routeNodeFilterInput ? routeNodeFilterInput.value : '';
  const parts = String(value || '').split(',');
  return String(parts[parts.length - 1] || '').trim().toLowerCase();
}

function positionRouteNodeFilterResults() {
  if (!routeNodeFilterInput || !routeNodeFilterResults ||
      routeNodeFilterResults.hidden) return;
  const inputRect = routeNodeFilterInput.getBoundingClientRect();
  const viewportPad = 8;
  const gap = 4;
  const width = Math.min(
    inputRect.width,
    Math.max(1, window.innerWidth - viewportPad * 2)
  );
  const panelHeight = Math.max(routeNodeFilterResults.offsetHeight, 1);
  const left = Math.min(
    Math.max(viewportPad, inputRect.left),
    Math.max(viewportPad, window.innerWidth - width - viewportPad)
  );
  const belowTop = inputRect.bottom + gap;
  const aboveTop = inputRect.top - panelHeight - gap;
  const top = belowTop + panelHeight + viewportPad <= window.innerHeight
    ? belowTop
    : Math.max(viewportPad, aboveTop);
  routeNodeFilterResults.style.width = `${width}px`;
  routeNodeFilterResults.style.left = `${left}px`;
  routeNodeFilterResults.style.right = 'auto';
  routeNodeFilterResults.style.top = `${top}px`;
}

function hideRouteNodeFilterResults() {
  if (!routeNodeFilterResults) return;
  routeNodeFilterResults.hidden = true;
}

function selectRouteNodeFilterMatch(match) {
  if (!routeNodeFilterInput || !routeNodeFilterResults || !match) return;
  const parts = routeNodeFilterInput.value.split(',');
  parts.pop();
  const selected = String(match.d.name || match.id).trim();
  const existing = parts.map(value => value.trim()).filter(Boolean);
  if (!existing.some(value => value.toLowerCase() === selected.toLowerCase())) {
    existing.push(selected);
  }
  routeNodeFilterInput.value = `${existing.join(', ')}, `;
  routeNodeFilterText = routeNodeFilterInput.value;
  localStorage.setItem('meshmapRouteNodeFilter', routeNodeFilterText);
  routeNodeMatches = [];
  routeNodeFilterResults.hidden = true;
  routeNodeFilterResults.innerHTML = '';
  syncRouteFilterDisplays();
  routeNodeFilterInput.focus();
  renderRouteNodeFilterResults();
}

function currentRouteDeviceIds() {
  const ids = new Set();
  routeLines.forEach((entry) => {
    const meta = entry && entry.meta;
    if (!meta) return;
    [meta.origin_id, meta.receiver_id].filter(Boolean).forEach(id => ids.add(id));
    if (Array.isArray(meta.points)) {
      meta.points.forEach((point) => {
        if (point && point.point_id) ids.add(point.point_id);
      });
    }
  });
  return ids;
}

function renderRouteNodeFilterResults() {
  if (!routeNodeFilterResults) return;
  const query = routeNodeCurrentQuery();
  routeNodeMatches = [];
  routeNodeFilterResults.innerHTML = '';
  const parts = String(routeNodeFilterInput && routeNodeFilterInput.value || '').split(',');
  parts.pop();
  const selectedNames = new Set(
    parts.map(value => value.trim().toLowerCase()).filter(Boolean)
  );
  const routeDeviceIds = currentRouteDeviceIds();
  for (const id of routeDeviceIds) {
    const d = deviceData.get(id);
    if (!d) continue;
    const name = String(d.name || '').toLowerCase();
    const displayName = String(d.name || id).trim().toLowerCase();
    const matchesQuery = !query || name.includes(query) ||
      id.toLowerCase().includes(query);
    if (matchesQuery && !selectedNames.has(displayName)) {
      routeNodeMatches.push({ id, d });
    }
  }
  routeNodeMatches.sort((a, b) =>
    deviceDisplayName(a.d).localeCompare(deviceDisplayName(b.d))
  );
  routeNodeMatches = routeNodeMatches.slice(0, 8);
  routeNodeMatches.forEach((match) => {
    const item = document.createElement('div');
    item.className = 'node-search-item';
    const name = document.createElement('span');
    name.textContent = deviceDisplayName(match.d);
    const shortId = document.createElement('span');
    shortId.className = 'node-search-id';
    shortId.textContent = `${match.id.slice(0, 8)}…`;
    item.append(name, shortId);
    item.addEventListener('mousedown', (ev) => ev.preventDefault());
    item.addEventListener('click', () => selectRouteNodeFilterMatch(match));
    routeNodeFilterResults.appendChild(item);
  });
  routeNodeFilterResults.hidden = routeNodeMatches.length === 0;
  if (!routeNodeFilterResults.hidden) {
    window.requestAnimationFrame(positionRouteNodeFilterResults);
  }
}

function focusDevice(id, options = {}) {
  const marker = markers.get(id);
  const d = deviceData.get(id);
  if (!marker || !d) return;
  const targetZoom = Math.max(map.getZoom(), Number(options.minZoom) || 13);
  const openPopup = options.openPopup !== false;
  const latlng = marker.getLatLng();
  const token = ++focusDeviceToken;
  let popupOpened = false;
  const openAfterMove = () => {
    if (token !== focusDeviceToken) return;
    if (popupOpened || !openPopup) return;
    popupOpened = true;
    refreshViewportLayers();
    marker.openPopup();
  };
  map.once('moveend', openAfterMove);
  map.flyTo(latlng, targetZoom, { duration: options.fromLink ? 0.35 : 0.6 });
  window.setTimeout(openAfterMove, options.fromLink ? 450 : 700);
  if (searchInput) searchInput.value = '';
  if (searchResults) {
    searchResults.hidden = true;
    searchResults.innerHTML = '';
  }
}

function setLabelsActive(active) {
  showLabels = active;
  localStorage.setItem('meshmapShowLabels', showLabels ? 'true' : 'false');
  markers.forEach((m, id) => {
    const d = deviceData.get(id);
    if (d) updateMarkerLabel(m, d);
  });
  const labelsToggle = document.getElementById('labels-toggle');
  if (labelsToggle) {
    labelsToggle.textContent = showLabels ? 'Labels On' : 'Labels Off';
    labelsToggle.classList.toggle('active', showLabels);
  }
}

function layoutSidePanels() {
  const panels = [];
  if (historyVisible && historyPanel && historyPanel.classList.contains('active')) panels.push(historyPanel);
  if (peersActive && peersPanel && peersPanel.classList.contains('active')) panels.push(peersPanel);
  if (routeDetailsPanel && routeDetailsPanel.classList.contains('active')) panels.push(routeDetailsPanel);
  const allPanels = [historyPanel, peersPanel, routeDetailsPanel];
  allPanels.forEach(panel => {
    if (!panel) return;
    panel.style.top = '';
    panel.style.bottom = '';
    panel.style.maxHeight = '';
  });
  if (!panels.length) return;
  const gap = 12;
  const availableHeight = Math.max(200, window.innerHeight - 24);
  const totalHeight = panels.reduce((sum, panel) => sum + (panel.offsetHeight || 0), 0)
    + (panels.length - 1) * gap;
  if (totalHeight > availableHeight) {
    const maxPer = Math.max(
      140,
      Math.floor((availableHeight - (panels.length - 1) * gap) / panels.length)
    );
    panels.forEach(panel => {
      panel.style.maxHeight = `${maxPer}px`;
    });
  }
  const isMobile = window.matchMedia('(max-width: 900px)').matches;
  if (isMobile) {
    let bottom = 12;
    panels.slice().reverse().forEach(panel => {
      panel.style.bottom = `${bottom}px`;
      bottom += (panel.offsetHeight || 0) + gap;
    });
    return;
  }
  let top = 18;
  panels.forEach(panel => {
    panel.style.top = `${top}px`;
    top += (panel.offsetHeight || 0) + gap;
  });
}

function setToolPanelCollapsed(panel, button, collapsed, storageKey) {
  if (!panel || !button) return;
  panel.classList.toggle('panel-collapsed', collapsed);
  button.textContent = collapsed ? 'Expand' : 'Minimize';
  button.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
  try {
    localStorage.setItem(storageKey, collapsed ? 'true' : 'false');
  } catch (_err) {
    // ignore storage failures
  }
  layoutSidePanels();
}

function setHistoryPanelCollapsed(collapsed) {
  historyPanelCollapsed = Boolean(collapsed);
  setToolPanelCollapsed(
    historyPanel,
    historyPanelCollapse,
    historyPanelCollapsed,
    HISTORY_PANEL_COLLAPSED_KEY
  );
}

function setPeersPanelCollapsed(collapsed) {
  peersPanelCollapsed = Boolean(collapsed);
  setToolPanelCollapsed(
    peersPanel,
    peersPanelCollapse,
    peersPanelCollapsed,
    PEERS_PANEL_COLLAPSED_KEY
  );
}

function setRouteDetailsPanelCollapsed(collapsed) {
  routeDetailsPanelCollapsed = Boolean(collapsed);
  setToolPanelCollapsed(
    routeDetailsPanel,
    routeDetailsCollapse,
    routeDetailsPanelCollapsed,
    ROUTE_DETAILS_PANEL_COLLAPSED_KEY
  );
}

function formatDistanceUnits(meters) {
  if (meters == null) return '';
  const value = Number(meters);
  if (Number.isNaN(value)) return '';
  if (distanceUnits === 'mi') {
    const miles = value / 1609.344;
    if (miles < 0.5) {
      const feet = value * 3.28084;
      return `${Math.round(feet)} ft`;
    }
    return `${miles.toFixed(2)} mi`;
  }
  if (value >= 1000) return `${(value / 1000).toFixed(2)} km`;
  return `${Math.round(value)} m`;
}

function formatPeerDistanceUnits(meters) {
  if (meters == null) return '';
  const value = Number(meters);
  if (!Number.isFinite(value) || value < 0) return '';
  if (distanceUnits === 'mi') {
    const miles = value / 1609.344;
    const decimals = miles < 10 ? 1 : 0;
    return `${miles.toFixed(decimals)} mi`;
  }
  const km = value / 1000.0;
  const decimals = km < 10 ? 1 : 0;
  return `${km.toFixed(decimals)} km`;
}

function formatDistanceMeters(meters) {
  return formatDistanceUnits(meters);
}

function formatObstructionUnits(meters) {
  if (meters == null) return '';
  const value = Number(meters);
  if (Number.isNaN(value)) return '';
  if (distanceUnits === 'mi') {
    const feet = value * 3.28084;
    return `${feet.toFixed(1)} ft`;
  }
  return `${value.toFixed(1)} m`;
}

function calcReceiverSensitivityDbm(bwHz, noiseFigureDb, snrMinDb) {
  return -174 + (10 * Math.log10(bwHz)) + noiseFigureDb + snrMinDb;
}

function calcFsplAt1mDb(freqMHz) {
  return 32.44 + (20 * Math.log10(freqMHz)) - 60;
}

function calcRangeMeters(maxPathLossDb, freqMHz, pathLossExponent, clutterLossDb) {
  const n = Math.max(1.5, pathLossExponent);
  const fspl1m = calcFsplAt1mDb(freqMHz);
  const lossBudget = maxPathLossDb - fspl1m - (Number.isFinite(clutterLossDb) ? clutterLossDb : 0);
  const exponent = lossBudget / (10 * n);
  return Math.max(1, Math.pow(10, exponent));
}

function formatDistance(meters) {
  if (!Number.isFinite(meters)) return 'unknown';
  return formatDistanceUnits(meters);
}

function haversineMeters(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => deg * (Math.PI / 180);
  const r = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return r * c;
}

function parseOptionalNumber(value) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  if (trimmed === '') return null;
  const num = Number(trimmed);
  return Number.isFinite(num) ? num : null;
}

function formatNumber(value) {
  if (!Number.isFinite(value)) return '0';
  return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function formatLastContact(tsSeconds) {
  if (!tsSeconds) return 'unknown';
  const dt = new Date(tsSeconds * 1000);
  return dt.toLocaleString(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
}

function payloadTypeLabel(pt) {
  const val = Number(pt);
  if (val === 4) return 'Advert';
  if (val === 8 || val === 9) return 'Trace';
  if (val === 2 || val === 5) return 'Message';
  return Number.isFinite(val) ? `Type ${val}` : 'Unknown';
}

function shortHash(hash) {
  if (!hash) return 'unknown';
  const text = String(hash);
  return text.length > 10 ? `${text.slice(0, 10)}…` : text;
}

function deviceLabelFromId(id) {
  if (!id) return 'Unknown';
  const d = deviceData.get(id);
  if (d) return deviceDisplayName(d);
  return `${String(id).slice(0, 8)}…`;
}

function makeHistoryPopup(entry) {
  const count = Number(entry && entry.count) || 1;
  const lastSeen = entry && entry.lastTs ? formatLastContact(entry.lastTs) : 'unknown';
  const rawSamples = entry && Array.isArray(entry.recent) ? entry.recent : [];
  const samples = rawSamples.filter((sample) => (
    sample && (
      sample.message_hash || sample.origin_id || sample.receiver_id || sample.payload_type || sample.topic
    )
  )).slice(0, 3);
  const sampleHtml = samples.length
    ? samples.map((sample) => {
      const when = sample.ts ? formatLastContact(sample.ts) : 'unknown';
      const label = payloadTypeLabel(sample.payload_type);
      const origin = deviceLabelFromId(sample.origin_id);
      const receiver = deviceLabelFromId(sample.receiver_id);
      const routeMode = sample.route_mode ? String(sample.route_mode) : 'path';
      const byteWidths = Array.isArray(sample.route_byte_widths) && sample.route_byte_widths.length
        ? sample.route_byte_widths.map(width => `${width}-byte`).join(', ')
        : 'unknown';
      return `
            <div class="popup-sample">
              <strong>${escapeHtml(label)}</strong> • ${escapeHtml(when)}<br/>
              Origin: ${escapeHtml(origin)}<br/>
              Receiver: ${escapeHtml(receiver)}<br/>
              Route: ${escapeHtml(routeMode)}<br/>
              Bytes: ${escapeHtml(byteWidths)}<br/>
              Hash: ${escapeHtml(shortHash(sample.message_hash))}
            </div>
          `;
    }).join('')
    : '<div class="popup-sample">No packet details yet.</div>';

  return `
        <span class="popup-title">History edge</span>
        <span class="small">
          Count: ${escapeHtml(count)}<br/>
          Last Seen: ${escapeHtml(lastSeen)}<br/>
          ${sampleHtml}
        </span>
      `;
}

function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function trailDistanceKm(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length < 2 || b.length < 2) {
    return 0;
  }
  const lat1 = Number(a[0]);
  const lon1 = Number(a[1]);
  const lat2 = Number(b[0]);
  const lon2 = Number(b[1]);
  if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) return 0;
  return haversineMeters(lat1, lon1, lat2, lon2) / 1000;
}

function splitTrailPoints(trail) {
  const points = Array.isArray(trail)
    ? trail
      .map(p => [Number(p[0]), Number(p[1])])
      .filter(p => Number.isFinite(p[0]) && Number.isFinite(p[1]))
    : [];
  if (points.length < 2 || trailMaxSegmentKm <= 0) return points;
  const segments = [];
  let segment = [points[0]];
  for (let idx = 1; idx < points.length; idx += 1) {
    const point = points[idx];
    const previous = points[idx - 1];
    if (trailDistanceKm(previous, point) > trailMaxSegmentKm) {
      if (segment.length >= 2) segments.push(segment);
      segment = [point];
    } else {
      segment.push(point);
    }
  }
  if (segment.length >= 2) segments.push(segment);
  return segments;
}

function makePopup(d) {
  const lastContact = formatLastContact(getLastSeenTs(d));
  const deviceLabel = deviceShortId(d);
  const qrTitle = (d.name || '').trim() || deviceLabel;
  const publicKey = typeof d.device_id === 'string' ? d.device_id : '';
  const latText = Number(d.lat).toFixed(6);
  const lonText = Number(d.lon).toFixed(6);
  const locationText = `Location: ${latText}, ${lonText}`;
  const publicKeyCopyTitle = 'Copy full public key';
  const qrParams = new URLSearchParams({
    name: qrTitle,
    public_key: publicKey,
    type: String(meshCoreContactTypeForDevice(d)),
    box_size: '14',
    border: '4'
  });
  const qrCodeUrl = publicKey ? withToken(`/qr?${qrParams.toString()}`) : '';
  const popupId = publicKey
    ? `<button
        type="button"
        class="popup-id popup-copy-id popup-copy-trigger"
        data-copy-text="${escapeHtmlAttr(publicKey)}"
        title="${escapeHtmlAttr(publicKeyCopyTitle)}"
      >${escapeHtml(deviceLabel)}</button>`
    : `<span class="popup-id">${escapeHtml(deviceLabel)}</span>`;
  const title = d.name
    ? `<span class="popup-title">${escapeHtml(d.name)}</span>${popupId}`
    : `<span class="popup-title">${popupId}</span>`;
  const role = resolveRole(d);
  const roleLabel = role === 'unknown' ? '' : role.charAt(0).toUpperCase() + role.slice(1);
  const mqttOnline = isMqttOnline(d);
  const popupActions = [];
  if (qrCodeButtonEnabled && qrCodeUrl) {
    popupActions.push(`
      <button
        type="button"
        class="popup-action-button"
        data-qr-url="${escapeHtmlAttr(qrCodeUrl)}"
        data-qr-title="${escapeHtmlAttr(qrTitle)}"
        data-qr-key="${escapeHtmlAttr(publicKey)}"
      >Generate QR Code</button>
    `);
  }
  if (publicKey) {
    const linkLabel = role === 'repeater' ? 'Copy repeater link' : 'Copy node link';
    popupActions.push(`
      <button
        type="button"
        class="popup-action-button"
        data-node-link-id="${escapeHtmlAttr(publicKey)}"
      >${escapeHtml(linkLabel)}</button>
    `);
  }
  return `
        ${title}
        <span class="small">
          ${roleLabel ? `Role: ${escapeHtml(roleLabel)}<br/>` : ``}
          <button
            type="button"
            class="popup-copy-location popup-copy-trigger"
            data-copy-text="${escapeHtmlAttr(locationText)}"
            title="Copy location"
          >${escapeHtml(locationText)}</button><br/>
          Last Contact: ${escapeHtml(lastContact)}<br/>
          ${mqttOnline ? `MQTT: Online<br/>` : ``}
          ${d.rssi != null ? `RSSI: ${escapeHtml(d.rssi)}<br/>` : ``}
          ${d.snr != null ? `SNR: ${escapeHtml(d.snr)}<br/>` : ``}
          ${popupActions.length ? `<div class="popup-actions">${popupActions.join('')}</div>` : ``}
        </span>
      `;
}

async function copyPopupText(ev) {
  const btn = ev?.currentTarget;
  if (!btn) return;
  const text = typeof btn.dataset.copyText === 'string' ? btn.dataset.copyText : '';
  if (!text) return;
  let copied = false;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      copied = true;
    }
  } catch (_err) {
    copied = false;
  }
  const original = btn.textContent || text;
  btn.textContent = copied ? 'Copied' : text;
  window.setTimeout(() => {
    btn.textContent = original;
  }, 1200);
}

function closeQrModal() {
  if (!qrModal) return;
  qrModal.hidden = true;
  if (qrModalImage) {
    qrModalImage.removeAttribute('src');
  }
  if (qrModalTitle) {
    qrModalTitle.textContent = 'Node';
  }
  if (qrModalLabel) {
    qrModalLabel.textContent = '';
    qrModalLabel.hidden = true;
    delete qrModalLabel.dataset.copyText;
    qrModalLabel.removeAttribute('title');
  }
}

function openQrModal(url, title, key) {
  if (!qrModal || !qrModalImage) return;
  qrModalImage.src = url;
  qrModalImage.alt = title ? `QR code for ${title}` : 'QR code';
  if (qrModalTitle) {
    qrModalTitle.textContent = title || 'Node';
  }
  if (qrModalLabel) {
    qrModalLabel.textContent = key ? `${key.slice(0, 8)}…` : '';
    qrModalLabel.hidden = !key;
    if (key) {
      qrModalLabel.dataset.copyText = key;
      qrModalLabel.title = 'Copy full public key';
    } else {
      delete qrModalLabel.dataset.copyText;
      qrModalLabel.removeAttribute('title');
    }
  }
  qrModal.hidden = false;
}

function handleQrPopupClick(ev) {
  const btn = ev?.currentTarget;
  const url = btn?.dataset?.qrUrl;
  if (!url) return;
  ev.preventDefault();
  ev.stopPropagation();
  openQrModal(
    url,
    btn.dataset.qrTitle || '',
    btn.dataset.qrKey || ''
  );
}

function upsertDevice(d, trail) {
  const id = d.device_id;
  const latlng = [d.lat, d.lon];
  const visibleOnMap = shouldShowDeviceOnMap(d);
  const role = resolveRole(d);
  const style = markerStyleForDevice(d);
  deviceData.set(id, d);
  deviceMeta.set(id, { lat: d.lat, lon: d.lon, name: d.name });

  // marker
  if (!markers.has(id)) {
    const m = L.circleMarker(latlng, { ...style, renderer: vectorRenderer });
    m.bindPopup(makePopup(d), {
      maxWidth: 260,
      maxHeight: 320,
      autoPan: false,
      keepInView: false
    });
    const bindPopupActions = () => {
      const root = m.getPopup()?.getElement?.();
      if (!root) return;
      root.querySelectorAll('.popup-copy-trigger').forEach((btn) => {
        if (btn.dataset.boundClick === 'true') return;
        btn.dataset.boundClick = 'true';
        btn.addEventListener('click', copyPopupText);
      });
      root.querySelectorAll('.popup-action-button[data-qr-url]').forEach((btn) => {
        if (btn.dataset.boundQr === 'true') return;
        btn.dataset.boundQr = 'true';
        btn.addEventListener('click', handleQrPopupClick);
      });
      root.querySelectorAll('.popup-action-button[data-node-link-id]').forEach((btn) => {
        if (btn.dataset.boundNodeLink === 'true') return;
        btn.dataset.boundNodeLink = 'true';
        btn.addEventListener('click', copyNodeLink);
      });
    };
    m.on('popupopen', bindPopupActions);
    // Live updates replace popup buttons without reopening the popup.
    m.getPopup().on('contentupdate', bindPopupActions);
    m.on('click', (ev) => {
      const original = ev.originalEvent;
      if (peersActive) {
        selectPeerNode(id);
        m.openPopup();
        if (original) {
          original.preventDefault();
          original.stopPropagation();
        }
        L.DomEvent.stop(ev);
      }
    });
    markers.set(id, m);
    updateMarkerLabel(m, d);
    syncLayerMembership(markerLayer, m, visibleOnMap);
  } else {
    const m = markers.get(id);
    m.setLatLng(latlng);
    m.setPopupContent(makePopup(d));
    if (m.setStyle) m.setStyle(style);
    updateMarkerLabel(m, d);
    syncLayerMembership(markerLayer, m, visibleOnMap);
  }

  // trail polyline (skip companions)
  if (false && role !== 'companion' && Array.isArray(trail) && trail.length >= 2) {  // trails disabled
    const points = splitTrailPoints(trail);
    if (!Array.isArray(points) || points.length < 1) {
      if (polylines.has(id)) {
        trailLayer.removeLayer(polylines.get(id));
        polylines.get(id).__attached = false;
        polylines.delete(id);
      }
    } else if (!polylines.has(id)) {
      const pl = L.polyline(points, {
        renderer: animatedLineRenderer,
        color: '#38bdf8',
        weight: 3,
        opacity: 0.85,
        className: 'trail-animated'
      });
      polylines.set(id, pl);
      syncLayerMembership(trailLayer, pl, visibleOnMap);
    } else {
      const pl = polylines.get(id);
      pl.setLatLngs(points);
      if (pl.setStyle) {
        pl.setStyle({ color: '#38bdf8', weight: 3, opacity: 0.85 });
      }
      syncLayerMembership(trailLayer, pl, visibleOnMap);
    }
  } else if (polylines.has(id)) {
    trailLayer.removeLayer(polylines.get(id));
    polylines.get(id).__attached = false;
    polylines.delete(id);
  }

  refreshStats();
}

function removeDevices(ids) {
  ids.forEach(id => {
    if (markers.has(id)) {
      markerLayer.removeLayer(markers.get(id));
      markers.delete(id);
    }
    if (deviceData.has(id)) {
      deviceData.delete(id);
    }
    if (polylines.has(id)) {
      trailLayer.removeLayer(polylines.get(id));
      polylines.delete(id);
    }
    deviceMeta.delete(id);
  });
  refreshStats();
  refreshOnlineMarkers();
}

function restyleAllMarkers() {
  markers.forEach((m, id) => {
    const d = deviceData.get(id);
    if (d && m.setStyle) m.setStyle(markerStyleForDevice(d));
  });
}

function refreshOnlineMarkers() {
  markers.forEach((m, id) => {
    const d = deviceData.get(id);
    if (!d) return;
    const style = markerStyleForDevice(d);
    if (m.setStyle) m.setStyle(style);
    if (m.getPopup()) m.setPopupContent(makePopup(d));
  });
  refreshViewportLayers();
  refreshStats();
}

function refreshViewportLayers() {
  for (const [id, marker] of markers.entries()) {
    const d = deviceData.get(id);
    syncLayerMembership(markerLayer, marker, shouldShowDeviceOnMap(d));
  }
  for (const [id, line] of polylines.entries()) {
    const d = deviceData.get(id);
    syncLayerMembership(trailLayer, line, shouldShowDeviceOnMap(d));
  }
  if (coverageVisible && coverageData) {
    if (coverageProvider === 'meshmapper' && meshMapperCoverageSource === coverageData && meshMapperCoverageRects.length) {
      syncMeshMapperCoverageViewport();
    } else {
      renderCoverage(coverageData);
    }
  }
}

function clearRouteDisplay() {
  routeLines.forEach((entry, routeId) => {
    if (entry.timeout) clearTimeout(entry.timeout);
    removeArcadeMarker(routeId);
    routeLayer.removeLayer(entry.line);
  });
  routeLines.clear();
  clearAllHopMarkers();
  hideRouteDetailsPanel();
  stopArcadeLoop();
}

function removeRoutes(ids) {
  ids.forEach(id => {
    const entry = routeLines.get(id);
    if (entry) {
      if (entry.timeout) clearTimeout(entry.timeout);
      removeArcadeMarker(id);
      routeLayer.removeLayer(entry.line);
      routeLines.delete(id);
    }
    routeCache.delete(id);
    clearHopMarkersForRoute(id);
    if (activeRouteDetailsId === id) {
      hideRouteDetailsPanel();
    }
  });
  refreshStats();
}

function clearRoutes() {
  clearRouteDisplay();
  routeCache.clear();
  refreshStats();
}

function clearHistoryLayer() {
  historyLines.forEach(entry => {
    if (!entry || !entry.line) return;
    historyLayer.removeLayer(entry.line);
  });
  historyLines.clear();
  refreshHistoryStyles();
  refreshStats();
}

function removeHistoryEdges(ids) {
  ids.forEach(id => {
    const entry = historyLines.get(id);
    if (!entry) return;
    historyLayer.removeLayer(entry.line);
    historyLines.delete(id);
    historyCache.delete(id);
  });
  refreshHistoryStyles();
  refreshStats();
}

function historyWeight(count) {
  const n = Math.max(1, Number(count) || 1);
  const base = Math.min(6, 0.9 + Math.log1p(n) * 1.1);
  return clampNumber(base * historyLinkScale, 0.4, 12);
}

function computeHistoryThresholds() {
  const counts = [];
  historyCache.forEach(edge => {
    const count = historyDisplayCount(edge);
    if (count > 0) {
      counts.push(count);
    }
  });
  if (!counts.length) {
    return { p70: null, p90: null };
  }
  counts.sort((a, b) => a - b);
  const pick = (pct) => {
    const idx = Math.max(0, Math.min(counts.length - 1, Math.floor(pct * (counts.length - 1))));
    return counts[idx];
  };
  const min = counts[0];
  const max = counts[counts.length - 1];
  let p70 = pick(0.7);
  let p90 = pick(0.9);
  if (p70 <= min) p70 = min + 1;
  if (p90 <= p70) p90 = p70 + 1;
  if (p70 > max) {
    p70 = max + 1;
    p90 = max + 2;
  } else if (p90 > max) {
    p90 = max + 1;
  }
  return { p70, p90 };
}

function historyColor(count, thresholds) {
  if (!thresholds || thresholds.p90 == null || thresholds.p70 == null) {
    return '#7dd3fc';
  }
  if (count >= thresholds.p90) return '#ef4444';
  if (count >= thresholds.p70) return '#f59e0b';
  return '#7dd3fc';
}

function historyBand(count, thresholds) {
  if (!thresholds || thresholds.p90 == null || thresholds.p70 == null) {
    return 'cool';
  }
  if (count >= thresholds.p90) return 'hot';
  if (count >= thresholds.p70) return 'warm';
  return 'cool';
}

function historyFilterAllows(count, thresholds) {
  if (historyFilterMode === 0) return true;
  const band = historyBand(count, thresholds);
  if (historyFilterMode === 1) return band === 'cool';
  if (historyFilterMode === 2) return band === 'warm';
  if (historyFilterMode === 3) return band === 'warm' || band === 'hot';
  if (historyFilterMode === 4) return band === 'hot';
  return true;
}

function historyByteFilterWidth() {
  if (historyByteFilter.has('all')) return null;
  return ['1b', '2b', '3b']
    .filter((value) => historyByteFilter.has(value))
    .map((value) => value.slice(0, 1));
}

function historyDisplayCount(edge) {
  if (!edge) return 0;
  const widths = historyByteFilterWidth();
  if (!widths) return Number(edge.count) || 0;
  const counts = edge.byte_counts;
  if (!counts || typeof counts !== 'object') return 0;
  return widths.reduce((total, width) => total + (Number(counts[width]) || 0), 0);
}

function updateHistoryFilterLabel() {
  if (!historyFilterLabel) return;
  let text = 'All links';
  if (historyFilterMode === 1) text = 'Blue links only';
  if (historyFilterMode === 2) text = 'Yellow links only';
  if (historyFilterMode === 3) text = 'Yellow + Red links';
  if (historyFilterMode === 4) text = 'Red links only';
  historyFilterLabel.textContent = text;
}

function updateHistoryRendering() {
  if (!historyVisible || !nodesVisible) return;
  const thresholds = computeHistoryThresholds();
  historyLines.forEach(entry => {
    if (!entry || !entry.line) return;
    const count = historyDisplayCount(entry);
    const shouldShow = count > 0 && historyFilterAllows(count, thresholds);
    entry.line.setStyle({
      color: historyColor(count, thresholds),
      weight: shouldShow ? historyWeight(count) : 0.1,
      opacity: shouldShow ? 0.6 : 0.0,
      lineCap: 'round',
      lineJoin: 'round'
    });
    entry.hidden = !shouldShow;
  });
}

function refreshHistoryStyles() {
  updateHistoryRendering();
}

function updateHistoryFilter(mode) {
  historyFilterMode = Number(mode);
  if (![0, 1, 2, 3, 4].includes(historyFilterMode)) {
    historyFilterMode = 0;
  }
  localStorage.setItem('meshmapHistoryFilter', String(historyFilterMode));
  updateHistoryFilterLabel();
  if (historyVisible && nodesVisible) {
    updateHistoryRendering();
  }
}

function updateHistoryByteFilter(value) {
  historyByteFilter = normalizeByteFilterSet(value);
  localStorage.setItem('meshmapHistoryByteFilter', serializeByteFilterSet(historyByteFilter));
  setByteFilterChecks(historyByteFilterSelect, historyByteFilter);
  if (historyVisible && nodesVisible) {
    updateHistoryRendering();
  }
  refreshStats();
}

function updateHistoryLinkScale(next) {
  const value = Number(next);
  if (!Number.isFinite(value)) return;
  historyLinkScale = clampNumber(sliderToHistoryScale(value), HISTORY_LINK_MIN, HISTORY_LINK_MAX);
  localStorage.setItem('meshmapHistoryLinkScale', String(historyLinkScale));
  updateHistoryLinkSizeUI();
  if (historyVisible && nodesVisible) {
    updateHistoryRendering();
  }
}

function historyEdgeId(edge) {
  if (!edge) return null;
  if (edge.id) return edge.id;
  if (Array.isArray(edge.a) && Array.isArray(edge.b)) {
    return `${edge.a.join(',')}-${edge.b.join(',')}`;
  }
  return null;
}

function renderHistoryEdge(edge) {
  if (!edge || !Array.isArray(edge.a) || !Array.isArray(edge.b)) return;
  const id = historyEdgeId(edge);
  if (!id) return;
  const points = [
    [edge.a[0], edge.a[1]],
    [edge.b[0], edge.b[1]]
  ];
  let entry = historyLines.get(id);
  if (!entry) {
    const line = L.polyline(points, { renderer: vectorRenderer, color: '#7dd3fc', weight: 2, opacity: 0.6 }).addTo(historyLayer);
    entry = { line, count: Number(edge.count) || 1, recent: [], lastTs: null, byte_counts: {} };
    historyLines.set(id, entry);
    line.on('click', (ev) => {
      const popup = makeHistoryPopup(entry);
      line.bindPopup(popup, {
        maxWidth: 300,
        autoPan: true,
        keepInView: true,
        autoPanPadding: [18, 18]
      }).openPopup(ev.latlng);
    });
  } else {
    entry.line.setLatLngs(points);
    entry.count = Number(edge.count) || entry.count || 1;
  }
  entry.recent = Array.isArray(edge.recent) ? edge.recent : [];
  entry.lastTs = edge.last_ts || entry.lastTs;
  entry.byte_counts = edge.byte_counts && typeof edge.byte_counts === 'object'
    ? edge.byte_counts
    : {};
  refreshHistoryStyles();
}

function renderHistoryFromCache() {
  if (!routeHistoryEnabled) return;
  historyCache.forEach(edge => renderHistoryEdge(edge));
  updateHistoryRendering();
  refreshStats();
}

function upsertHistoryEdge(edge) {
  if (!routeHistoryEnabled) return;
  const id = historyEdgeId(edge);
  if (!id) return;
  const edgeData = { ...edge, id };
  historyCache.set(id, edgeData);
  if (!historyVisible || !nodesVisible) {
    refreshStats();
    return;
  }
  renderHistoryEdge(edgeData);
}

function updateHistoryWindowLabel(seconds) {
  if (!routeHistoryEnabled) return;
  const targets = [historyLabel, historyPanelLabel].filter(Boolean);
  if (!targets.length) return;
  let text = 'History';
  if (seconds && seconds > 0) {
    const hours = seconds / 3600;
    if (hours >= 24) {
      text = `History (${Math.round(hours)}h)`;
    } else if (hours >= 1) {
      text = `History (${Math.round(hours * 10) / 10}h)`;
    } else {
      text = `History (${Math.max(1, Math.round(seconds / 60))}m)`;
    }
  }
  targets.forEach(el => {
    el.textContent = text;
  });
}

function refreshHeatLayer() {
  if (!heatLayer) return;
  const now = Date.now();
  const cutoff = now - HEAT_TTL_MS;
  const filtered = heatPoints.filter(p => p.ts >= cutoff);
  heatPoints.length = 0;
  heatPoints.push(...filtered);
  if (!heatVisible || !map.hasLayer(heatLayer)) {
    return;
  }
  heatLayer.setLatLngs(heatPoints.map(p => [p.lat, p.lon, p.weight]));
}

function addHeatPoints(points, tsSeconds, payloadType) {
  if (!heatLayer) return;
  if (!Array.isArray(points) || points.length < 1) return;
  const ts = (tsSeconds ? tsSeconds * 1000 : Date.now());
  points.forEach(p => {
    heatPoints.push({ lat: p[0], lon: p[1], ts, weight: 0.7 });
  });
  refreshHeatLayer();
}

function seedHeat(items) {
  if (!heatLayer) return;
  if (!Array.isArray(items)) return;
  heatPoints.length = 0;
  items.forEach(item => {
    if (!Array.isArray(item) || item.length < 3) return;
    heatPoints.push({
      lat: item[0],
      lon: item[1],
      ts: item[2] * 1000,
      weight: item[3] != null ? item[3] : 0.7
    });
  });
  refreshHeatLayer();
}

function computeRouteDistanceMeters(points) {
  if (!Array.isArray(points) || points.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const next = points[i];
    if (!Array.isArray(prev) || !Array.isArray(next)) continue;
    const [plat, plon] = prev;
    const [nlat, nlon] = next;
    if (!Number.isFinite(plat) || !Number.isFinite(plon) || !Number.isFinite(nlat) || !Number.isFinite(nlon)) {
      continue;
    }
    total += haversineMeters(plat, plon, nlat, nlon);
  }
  return total;
}

function formatSecondsLabel(seconds) {
  if (!Number.isFinite(seconds)) return 'unknown';
  if (seconds <= 0) return 'expired';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = seconds / 60;
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = minutes / 60;
  if (hours < 24) return `${Math.round(hours)}h`;
  const days = hours / 24;
  return `${Math.round(days)}d`;
}

function formatTimestampLabel(tsSeconds) {
  if (!Number.isFinite(tsSeconds)) return 'unknown';
  try {
    return new Date(tsSeconds * 1000).toLocaleString();
  } catch (err) {
    return 'unknown';
  }
}

function normalizeHopHashPrefix(hash) {
  if (!hash) return null;
  const text = String(hash).trim();
  if (!text) return null;
  const raw = text.toLowerCase().startsWith('0x') ? text.slice(2) : text;
  if (!raw) return null;
  let normalized = raw.replace(/\s+/g, '');
  if (!normalized) return null;
  if (!/^[0-9a-fA-F]+$/.test(normalized)) return null;
  if (normalized.length % 2 === 1) {
    normalized = `0${normalized}`;
  }
  if (normalized.length !== 2 && normalized.length !== 4 && normalized.length !== 6) {
    return null;
  }
  return normalized.toUpperCase();
}

function hopPrefixIdLabel(hash) {
  const normalized = normalizeHopHashPrefix(hash);
  if (!normalized) return null;
  return normalized;
}

function hopPrefixDetailLabel(hash) {
  const normalized = normalizeHopHashPrefix(hash);
  if (!normalized) return null;
  const displayPrefix = hopPrefixIdLabel(normalized);
  const bits = displayPrefix.length * 4;
  const decVal = Number.parseInt(displayPrefix, 16);
  if (Number.isFinite(decVal)) {
    if (normalized.length === 2) {
      return `${displayPrefix} (${bits}-bit, ${decVal}, from legacy ${normalized})`;
    }
    return `${displayPrefix} (${bits}-bit, ${decVal})`;
  }
  return displayPrefix;
}


function pointIdNodePrefix(pointId, hopHash = null, fallbackByteWidth = null) {
  if (!pointId) return null;
  const rawPoint = String(pointId).trim();
  if (!/^[0-9a-fA-F]+$/.test(rawPoint)) return null;
  const normalizedPoint = rawPoint.toUpperCase();
  const normalizedHop = normalizeHopHashPrefix(hopHash);
  if (normalizedHop && normalizedPoint.startsWith(normalizedHop)) {
    return normalizedHop;
  }
  const fallbackChars = Number.isFinite(fallbackByteWidth) && fallbackByteWidth > 0
    ? Math.max(2, Math.min(6, Math.round(fallbackByteWidth) * 2))
    : 2;
  return normalizedPoint.slice(0, fallbackChars) || null;
}

function pointIdNodePrefixDetail(pointId, hopHash = null, fallbackByteWidth = null) {
  const prefix = pointIdNodePrefix(pointId, hopHash, fallbackByteWidth);
  if (!prefix) return null;
  const bits = prefix.length * 4;
  const decVal = Number.parseInt(prefix, 16);
  if (Number.isFinite(decVal)) {
    return `${prefix} (${bits}-bit, ${decVal})`;
  }
  return prefix;
}

function pointIdRoleLabel(pointId) {
  if (!pointId) return null;
  const device = deviceData.get(pointId);
  if (!device) return null;
  const role = resolveRole(device);
  if (!role || role === 'unknown') return null;
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function buildRouteDetailsDisplayPoints(route, pointIds) {
  if (!route || !Array.isArray(route.points)) return [];
  const rows = route.points.map((pt, idx) => ({
    coords: pt,
    route_index: idx,
    point_id: pointIds ? pointIds[idx] || null : null,
    endpoint_only: false,
    endpoint_kind: null
  }));

  const senderName = typeof route.sender_name === 'string' ? route.sender_name.trim() : '';
  if (senderName) {
    rows.unshift({
      coords: null,
      route_index: null,
      point_id: null,
      point_label: senderName,
      role_label: 'Companion',
      endpoint_only: true,
      endpoint_kind: 'sender_name'
    });
  }

  const maybeAddCompanionEndpoint = (deviceId, kind) => {
    if (!deviceId) return;
    if (pointIds && pointIds.includes(deviceId)) return;
    const device = deviceData.get(deviceId);
    if (!device || resolveRole(device) !== 'companion') return;
    const lat = Number(device.lat);
    const lon = Number(device.lon);
    const coords = Number.isFinite(lat) && Number.isFinite(lon) ? [lat, lon] : null;
    const row = {
      coords,
      route_index: null,
      point_id: deviceId,
      endpoint_only: true,
      endpoint_kind: kind
    };
    if (kind === 'origin') {
      rows.unshift(row);
    } else {
      rows.push(row);
    }
  };

  maybeAddCompanionEndpoint(route.origin_id, 'origin');
  maybeAddCompanionEndpoint(route.receiver_id, 'receiver');
  return rows;
}

function buildRouteLogMeta(route) {
  if (!route || !Array.isArray(route.points)) return null;
  const pointIds = Array.isArray(route.point_ids) && route.point_ids.length === route.points.length
    ? route.point_ids
    : null;
  const displayPoints = buildRouteDetailsDisplayPoints(route, pointIds);
  const hopCount = Math.max(0, displayPoints.length - 1);
  const distanceMeters = computeRouteDistanceMeters(route.points);
  const expiresSeconds = Number(route.expires_at);
  const expiresInSeconds = Number.isFinite(expiresSeconds)
    ? (expiresSeconds - getServerNowMs() / 1000)
    : null;
  let cumulative = 0;
  const hashes = Array.isArray(route.hashes) ? route.hashes : null;
  const normalizedHashes = hashes
    ? hashes.map((hash) => normalizeHopHashPrefix(hash)).filter(Boolean)
    : [];
  const hashWidths = [
    ...new Set(normalizedHashes.map((hash) => routeHashByteWidth(hash)).filter(Number.isFinite))
  ];
  const fallbackByteWidth = hashWidths.length === 1 ? hashWidths[0] : null;
  const hashForPoint = (pointId, routeIndex) => {
    if (!pointId || !normalizedHashes.length || routeIndex == null) return null;
    const normalizedPoint = String(pointId).trim().toUpperCase();
    const candidateIndexes = [routeIndex, routeIndex - 1, routeIndex + 1]
      .filter((idx) => Number.isInteger(idx) && idx >= 0 && idx < normalizedHashes.length);
    for (const idx of candidateIndexes) {
      const hash = normalizedHashes[idx];
      if (hash && normalizedPoint.startsWith(hash)) return hash;
    }
    return normalizedHashes.find((hash) => normalizedPoint.startsWith(hash)) || null;
  };
  const pointRows = displayPoints.map((entry, idx) => {
    const coords = Array.isArray(entry.coords) ? entry.coords : [];
    const lat = Number(coords[0]);
    const lon = Number(coords[1]);
    let hopDistance = null;
    if (idx > 0 && Number.isFinite(lat) && Number.isFinite(lon)) {
      const prevEntry = displayPoints[idx - 1];
      const prevCoords = Array.isArray(prevEntry.coords) ? prevEntry.coords : [];
      const prevLat = Number(prevCoords[0]);
      const prevLon = Number(prevCoords[1]);
      if (Number.isFinite(prevLat) && Number.isFinite(prevLon)) {
        hopDistance = haversineMeters(prevLat, prevLon, lat, lon);
        if (Number.isFinite(hopDistance)) {
          cumulative += hopDistance;
        }
      }
    }
    const routeIndex = Number.isInteger(entry.route_index) ? entry.route_index : null;
    const pointId = entry.point_id || null;
    const hopHash = hashForPoint(pointId, routeIndex);
    return {
      index: idx,
      lat,
      lon,
      point_id: pointId || null,
      point_label: entry.point_label || (pointId ? deviceLabelFromId(pointId) : null),
      role_label: entry.role_label || pointIdRoleLabel(pointId),
      endpoint_only: !!entry.endpoint_only,
      endpoint_kind: entry.endpoint_kind || null,
      node_prefix: pointIdNodePrefix(pointId, hopHash, fallbackByteWidth),
      node_prefix_detail: pointIdNodePrefixDetail(pointId, hopHash, fallbackByteWidth),
      hop_distance_m: hopDistance,
      hop_distance_label: Number.isFinite(hopDistance) ? formatDistanceUnits(hopDistance) : null,
      cumulative_m: cumulative,
      cumulative_label: Number.isFinite(cumulative) ? formatDistanceUnits(cumulative) : null,
      hop_hash: hopHash || null,
      hop_prefix: hopHash ? hopPrefixIdLabel(hopHash) : null,
      hop_prefix_detail: hopHash ? hopPrefixDetailLabel(hopHash) : null
    };
  });
  return {
    id: route.id,
    route_mode: route.route_mode || 'path',
    payload_type: route.payload_type,
    payload_label: payloadTypeLabel(route.payload_type),
    hop_count: hopCount,
    point_count: route.points.length,
    distance_m: distanceMeters,
    distance_label: Number.isFinite(distanceMeters) && distanceMeters > 0 ? formatDistanceUnits(distanceMeters) : 'unknown',
    origin_id: route.origin_id,
    origin_label: deviceLabelFromId(route.origin_id),
    receiver_id: route.receiver_id,
    receiver_label: deviceLabelFromId(route.receiver_id),
    sender_name: route.sender_name || null,
    message_hash: route.message_hash,
    topic: route.topic,
    snr_values: route.snr_values,
    expires_at: expiresSeconds,
    expires_label: expiresInSeconds != null ? formatSecondsLabel(expiresInSeconds) : 'unknown',
    ts: route.ts,
    ts_label: formatTimestampLabel(route.ts),
    points: pointRows,
    hashes
  };
}

function logRouteDetails(meta, clickLatLng) {
  if (!meta) {
    console.warn('Route details unavailable');
    return;
  }
  const parts = [];
  if (meta.payload_label) parts.push(meta.payload_label);
  parts.push(meta.route_mode);
  parts.push(`${meta.hop_count} hop${meta.hop_count === 1 ? '' : 's'}`);
  if (meta.distance_label && meta.distance_label !== 'unknown') parts.push(meta.distance_label);
  const title = meta.id ? `Route ${meta.id}` : 'Route';
  if (console.groupCollapsed) {
    console.groupCollapsed(`${title}${parts.length ? ` (${parts.join(' • ')})` : ''}`);
  }
  const routeInfo = {
    mode: meta.route_mode,
    payload: meta.payload_label,
    hops: meta.hop_count,
    points: meta.point_count,
    distance: meta.distance_label,
    origin: meta.origin_label,
    receiver: meta.receiver_label,
    started: meta.ts_label,
    expires_in: meta.expires_label,
    message_hash: meta.message_hash,
    topic: meta.topic,
    snr_values: meta.snr_values,
    click: clickLatLng ? { lat: clickLatLng.lat, lon: clickLatLng.lng } : undefined
  };
  console.log('Route details:', routeInfo);
  if (Array.isArray(meta.points) && meta.points.length && console.table) {
    const rows = meta.points.map((pt) => ({
      index: pt.index,
      point_id: pt.point_id ? shortHash(pt.point_id) : null,
      point_label: pt.point_label || null,
      node_prefix: pt.node_prefix || null,
      node_prefix_detail: pt.node_prefix_detail || null,
      lat: Number.isFinite(pt.lat) ? pt.lat.toFixed(6) : pt.lat,
      lon: Number.isFinite(pt.lon) ? pt.lon.toFixed(6) : pt.lon,
      hop_distance: pt.hop_distance_label,
      cumulative: pt.cumulative_label,
      hop_hash: pt.hop_hash ? shortHash(pt.hop_hash) : null,
      hop_prefix: pt.hop_prefix || null,
      hop_prefix_detail: pt.hop_prefix_detail || null
    }));
    console.table(rows);
  }
  if (console.groupCollapsed) {
    console.groupEnd();
  }
}

function handleRouteClick(routeId, ev) {
  if (ev) {
    L.DomEvent.stop(ev);
  }
  const entry = routeLines.get(routeId);
  if (!entry) {
    console.warn('Route entry missing for click', routeId);
    return;
  }
  if (!entry.meta) {
    const latlngs = entry.line.getLatLngs ? entry.line.getLatLngs() : [];
    entry.meta = buildRouteLogMeta({ id: routeId, points: latlngs.map(pt => [pt.lat, pt.lng]) });
  }
  if (!routeMatchesByteFilter(entry.meta)) {
    return;
  }
  logRouteDetails(entry.meta, ev && ev.latlng);
  showRouteDetails(entry.meta);
}

function upsertRoute(r, skipHeat = false) {
  if (!r || !Array.isArray(r.points) || r.points.length < 2) return;
  const id = r.id || `route-${Date.now()}-${Math.random()}`;
  routeCache.set(id, {
    ...r,
    id,
    points: r.points.map((p) => [p[0], p[1]]),
    hashes: Array.isArray(r.hashes) ? [...r.hashes] : r.hashes,
    point_ids: Array.isArray(r.point_ids) ? [...r.point_ids] : r.point_ids,
    snr_values: Array.isArray(r.snr_values) ? [...r.snr_values] : r.snr_values
  });
  const points = r.points.map(p => [p[0], p[1]]);
  const routeMode = r.route_mode || 'path';
  const payloadType = Number(r.payload_type);
  const style = routeStyleForDisplay(payloadType, routeMode, arcadeModeEnabled);

  const routeMeta = buildRouteLogMeta({ ...r, id, points, hashes: r.hashes });
  let entry = routeLines.get(id);
  if (!entry) {
    const line = L.polyline(points, { ...style, renderer: animatedLineRenderer })
      .addTo(routeLayer);
    if (!prodMode) {
      line.on('click', (ev) => handleRouteClick(id, ev));
    }
    entry = { line, timeout: null };
    routeLines.set(id, entry);
  } else {
    entry.line.setLatLngs(points);
    entry.line.setStyle(style);
  }
  entry.meta = routeMeta;
  entry.routePoints = points;
  entry.payloadType = payloadType;
  entry.routeMode = routeMode;
  const lineEl = entry.line.getElement();
  if (lineEl) {
    if (arcadeModeEnabled) {
      lineEl.classList.remove('route-animated');
    } else {
      lineEl.classList.add('route-animated');
    }
  }
  syncRouteEntryDisplay(id, entry);
  if (routeDetailsPanel && !routeDetailsPanel.hidden && activeRouteDetailsId === id) {
    showRouteDetails(entry.meta);
  }

  if (entry.timeout) clearTimeout(entry.timeout);
  if (r.expires_at) {
    const ms = Math.max(1000, (r.expires_at * 1000) - getServerNowMs());
    entry.timeout = setTimeout(() => removeRoutes([id]), ms);
  }

  if (!skipHeat) {
    addHeatPoints(points, r.ts, r.payload_type);
  }
  refreshStats();
}

async function initialSnapshot() {
  try {
    const res = await fetch(withToken('/snapshot'), { headers: tokenHeaders() });
    const snap = await res.json();
    setServerTimeOffset(snap.server_time);
    if (snap.devices) {
      for (const [id, d] of Object.entries(snap.devices)) {
        const trail = snap.trails ? snap.trails[id] : null;
        upsertDevice(d, trail);
      }
      tryFocusLinkedDevice();
    }
    if (Array.isArray(snap.heat)) {
      seedHeat(snap.heat);
    }
    if (Array.isArray(snap.routes)) {
      clearRoutes();
      snap.routes.forEach(r => upsertRoute(r, true));
    }
    if (Array.isArray(snap.history_edges)) {
      if (routeHistoryEnabled) {
        snap.history_edges.forEach(edge => upsertHistoryEdge(edge));
      }
    }
    applyMqttPresenceSummary(snap.mqtt_presence);
    if (snap.history_window_seconds != null) {
      historyWindowSeconds = Number(snap.history_window_seconds);
      updateHistoryWindowLabel(historyWindowSeconds);
    }
    if (snap.update) {
      setUpdateBanner(snap.update);
    }
    refreshStats();
  } catch (e) {
    console.warn("snapshot failed", e);
  }
}

const pendingWsMessages = [];
let wsFlushScheduled = false;

function flushQueuedWsMessages() {
  wsFlushScheduled = false;
  if (!pendingWsMessages.length) return;
  const batch = pendingWsMessages.splice(0, pendingWsMessages.length);
  deferStats = true;
  try {
    for (const msg of batch) {
      handleRealtimeMessage(msg);
    }
  } finally {
    deferStats = false;
  }
  scheduleStatsUpdate();
}

function queueRealtimeMessage(msg) {
  pendingWsMessages.push(msg);
  if (wsFlushScheduled) return;
  wsFlushScheduled = true;
  window.requestAnimationFrame(flushQueuedWsMessages);
}

function handleRealtimeMessage(msg) {
  if (msg.type === "update") {
    upsertDevice(msg.device, msg.trail);
    tryFocusLinkedDevice();
    return;
  }

  if (msg.type === "device_seen") {
    const id = msg.device_id;
    applyMqttPresenceSummary(msg.mqtt_presence);
    const d = deviceData.get(id);
    if (d) {
      if (msg.last_seen_ts) d.last_seen_ts = msg.last_seen_ts;
      if (Object.prototype.hasOwnProperty.call(msg, 'mqtt_seen_ts')) d.mqtt_seen_ts = msg.mqtt_seen_ts;
      if (Object.prototype.hasOwnProperty.call(msg, 'mqtt_online_source')) d.mqtt_online_source = msg.mqtt_online_source;
      if (Object.prototype.hasOwnProperty.call(msg, 'mqtt_status_ts')) d.mqtt_status_ts = msg.mqtt_status_ts;
      if (Object.prototype.hasOwnProperty.call(msg, 'mqtt_status_value')) d.mqtt_status_value = msg.mqtt_status_value;
      if (Object.prototype.hasOwnProperty.call(msg, 'mqtt_internal_ts')) d.mqtt_internal_ts = msg.mqtt_internal_ts;
      if (Object.prototype.hasOwnProperty.call(msg, 'mqtt_packets_ts')) d.mqtt_packets_ts = msg.mqtt_packets_ts;
      deviceData.set(id, d);
      const m = markers.get(id);
      if (m) {
        if (m.setStyle) m.setStyle(markerStyleForDevice(d));
        m.setPopupContent(makePopup(d));
        updateMarkerLabel(m, d);
      }
      refreshStats();
    }
    if (!d) refreshStats();
    return;
  }

  if (msg.type === "mqtt_presence") {
    applyMqttPresenceSummary(msg.mqtt_presence);
    refreshStats();
    return;
  }

  if (msg.type === "route") {
    upsertRoute(msg.route);
    return;
  }

  if (msg.type === "route_remove") {
    removeRoutes(msg.route_ids || []);
    return;
  }

  if (msg.type === "history_edges") {
    if (!routeHistoryEnabled) return;
    const edges = Array.isArray(msg.edges) ? msg.edges : [];
    edges.forEach(edge => upsertHistoryEdge(edge));
    refreshStats();
    return;
  }

  if (msg.type === "history_edges_remove") {
    if (!routeHistoryEnabled) return;
    removeHistoryEdges(msg.edge_ids || []);
    return;
  }

  if (msg.type === "stale") {
    removeDevices(msg.device_ids || []);
  }
}

function connectWS() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const wsSuffix = (prodMode && apiToken) ? `?token=${encodeURIComponent(apiToken)}` : '';
  const ws = new WebSocket(`${proto}://${location.host}${apiPath('/ws')}${wsSuffix}`);

  ws.onopen = () => console.log("ws connected");
  ws.onclose = () => {
    console.log("ws disconnected, retrying...");
    setTimeout(connectWS, 1500);
  };

  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);

    if (msg.type === "snapshot") {
      // same shape as /snapshot
      setServerTimeOffset(msg.server_time);
      deferStats = true;
      try {
        for (const [id, d] of Object.entries(msg.devices || {})) {
          const trail = msg.trails ? msg.trails[id] : null;
          upsertDevice(d, trail);
        }
        tryFocusLinkedDevice();
        clearRoutes();
        if (Array.isArray(msg.heat)) {
          seedHeat(msg.heat);
        }
        if (Array.isArray(msg.routes)) {
          msg.routes.forEach(r => upsertRoute(r, true));
        }
        if (Array.isArray(msg.history_edges)) {
          if (routeHistoryEnabled) {
            msg.history_edges.forEach(edge => upsertHistoryEdge(edge));
          }
        }
        applyMqttPresenceSummary(msg.mqtt_presence);
        if (msg.history_window_seconds != null) {
          historyWindowSeconds = Number(msg.history_window_seconds);
          updateHistoryWindowLabel(historyWindowSeconds);
        }
        if (msg.update) {
          setUpdateBanner(msg.update);
        }
      } finally {
        deferStats = false;
      }
      setStats();
      return;
    }
    queueRealtimeMessage(msg);
  };
}

initialSnapshot();
connectWS();
setStats();
setInterval(refreshHeatLayer, 15000);
setInterval(refreshOnlineMarkers, 30000);
if ('serviceWorker' in navigator) {
  const registerServiceWorker = () => {
    const swPath = apiPath('/sw.js');
    const swScope = publicPathPrefix ? `${publicPathPrefix}/` : '/';
    navigator.serviceWorker.register(swPath, { scope: swScope }).catch(() => { });
  };
  // The ESM renderer may finish after load has already fired.
  if (document.readyState === 'complete') registerServiceWorker();
  else window.addEventListener('load', registerServiceWorker, { once: true });
}

const hopsToggle = document.getElementById('hops-toggle');
if (hopsToggle) {
  hopsToggle.addEventListener('click', () => {
    setHopsVisible(!hopsVisible);
  });
}

setArcadeModeEnabled(arcadeModeEnabled, false);

const legendToggle = document.getElementById('legend-toggle');
const hud = document.querySelector('.hud');
const hudToggle = document.getElementById('hud-toggle');
if (hud && hudToggle) {
  hudToggle.addEventListener('click', (ev) => {
    ev.preventDefault();
    hud.classList.toggle('panel-hidden');
  });
}
if (hud && queryMenuVisible !== null) {
  hud.classList.toggle('panel-hidden', !queryMenuVisible);
}
if (legendToggle && hud) {
  const storedLegend = localStorage.getItem('meshmapLegendCollapsed');
  const overrideLegend = queryLegendVisible === null ? null : !queryLegendVisible;
  const initialLegendCollapsed = overrideLegend !== null ? overrideLegend : storedLegend === 'true';
  if (initialLegendCollapsed) {
    hud.classList.add('legend-collapsed');
    legendToggle.textContent = 'Show legend';
  }
  legendToggle.addEventListener('click', () => {
    const collapsed = hud.classList.toggle('legend-collapsed');
    legendToggle.textContent = collapsed ? 'Show legend' : 'Hide legend';
    localStorage.setItem('meshmapLegendCollapsed', collapsed ? 'true' : 'false');
  });
  if (overrideLegend !== null) {
    localStorage.setItem('meshmapLegendCollapsed', overrideLegend ? 'true' : 'false');
  }
}

if (historyPanelCollapse) {
  historyPanelCollapse.addEventListener('click', () => {
    setHistoryPanelCollapsed(!historyPanelCollapsed);
  });
}
if (peersPanelCollapse) {
  peersPanelCollapse.addEventListener('click', () => {
    setPeersPanelCollapsed(!peersPanelCollapsed);
  });
}
if (routeDetailsCollapse) {
  routeDetailsCollapse.addEventListener('click', () => {
    setRouteDetailsPanelCollapsed(!routeDetailsPanelCollapsed);
  });
}
setHistoryPanelCollapsed(historyPanelCollapsed);
setPeersPanelCollapsed(peersPanelCollapsed);
setRouteDetailsPanelCollapsed(routeDetailsPanelCollapsed);

const customLink = document.getElementById('custom-link');
const updateBanner = document.getElementById('update-banner');
const updateText = document.getElementById('update-text');
const updateDismiss = document.getElementById('update-dismiss');
let updateDismissKey = null;
const setUpdateBanner = (info) => {
  if (!updateBanner) return;
  if (!info || !info.available) {
    updateBanner.hidden = true;
    updateDismissKey = null;
    return;
  }
  const remoteKey = info.remote_short || info.remote || 'update';
  updateDismissKey = remoteKey;
  const dismissed = localStorage.getItem('meshmapUpdateDismissed');
  if (dismissed && dismissed === remoteKey) {
    updateBanner.hidden = true;
    return;
  }
  const localLabel = info.local_short || info.local || 'local';
  const remoteLabel = info.remote_short || info.remote || 'remote';
  if (updateText) {
    updateText.textContent = `Update available (${localLabel} \u2192 ${remoteLabel})`;
  }
  updateBanner.hidden = false;
};
if (customLink) {
  if (customLinkUrl) {
    customLink.setAttribute('href', customLinkUrl);
    customLink.setAttribute('title', customLinkUrl);
  } else {
    customLink.remove();
  }
}
const dismissUpdateBanner = (ev, source = 'click') => {
  if (!updateBanner || updateBanner.hidden) return;
  if (ev) {
    ev.preventDefault();
    ev.stopPropagation();
  }
  const key = updateDismissKey || initialUpdateRemote || 'update';
  try {
    localStorage.setItem('meshmapUpdateDismissed', key);
  } catch (err) {
    // ignore storage failures
  }
  updateBanner.hidden = true;
};

if (updateDismiss) {
  updateDismiss.addEventListener('click', (ev) => dismissUpdateBanner(ev, 'click'));
  updateDismiss.addEventListener('pointerdown', (ev) => dismissUpdateBanner(ev, 'pointerdown'));
  updateDismiss.addEventListener('touchend', (ev) => dismissUpdateBanner(ev, 'touchend'));
}
if (updateBanner) {
  updateBanner.addEventListener('click', (ev) => dismissUpdateBanner(ev, 'banner-click'));
  updateBanner.addEventListener('pointerdown', (ev) => dismissUpdateBanner(ev, 'banner-pointerdown'));
}
if (initialUpdateAvailable) {
  setUpdateBanner({
    available: true,
    local_short: initialUpdateLocal || null,
    remote_short: initialUpdateRemote || null,
    local: initialUpdateLocal || null,
    remote: initialUpdateRemote || null,
  });
}

function clearLinkedDeviceParams(url) {
  linkedDeviceParamNames.forEach((name) => url.searchParams.delete(name));
}

function buildMapShareUrl(options = {}) {
  const center = options.center || map.getCenter();
  const lat = Number(center.lat);
  const lon = Number(center.lng ?? center.lon);
  const zoom = options.zoom == null ? map.getZoom() : options.zoom;
  const url = new URL(window.location.href);
  clearLinkedDeviceParams(url);
  if (Number.isFinite(lat)) url.searchParams.set('lat', lat.toFixed(5));
  if (Number.isFinite(lon)) url.searchParams.set('lon', lon.toFixed(5));
  url.searchParams.set('zoom', String(zoom));
  url.searchParams.set('layer', baseLayer);
  url.searchParams.set('history', historyVisible ? 'on' : 'off');
  url.searchParams.set('heat', heatVisible ? 'on' : 'off');
  url.searchParams.set('coverage', coverageVisible ? 'on' : 'off');
  url.searchParams.set('labels', showLabels ? 'on' : 'off');
  url.searchParams.set('nodes', nodesVisible ? 'on' : 'off');
  url.searchParams.set(
    'legend',
    hud && hud.classList.contains('legend-collapsed') ? 'off' : 'on'
  );
  url.searchParams.set(
    'menu',
    hud && hud.classList.contains('panel-hidden') ? 'off' : 'on'
  );
  url.searchParams.set('units', distanceUnits);
  url.searchParams.set('history_filter', String(historyFilterMode));
  url.searchParams.set('history_bytes', serializeByteFilterSet(historyByteFilter));
  url.searchParams.set('route_bytes', serializeByteFilterSet(routeByteFilter));
  if (routeNodeFilterText.trim()) {
    url.searchParams.set('route_nodes', routeNodeFilterText.trim());
  } else {
    url.searchParams.delete('route_nodes');
  }
  url.searchParams.set('roles', [...visibleRoles].join(','));
  if (options.deviceId) {
    url.searchParams.set('node', options.deviceId);
    url.searchParams.set('nodes', 'on');
  }
  return url.toString();
}

function buildDeviceLink(id, d) {
  const marker = markers.get(id);
  const markerLatLng = marker && marker.getLatLng ? marker.getLatLng() : null;
  const lat = markerLatLng ? markerLatLng.lat : Number(d && d.lat);
  const lon = markerLatLng ? markerLatLng.lng : Number(d && d.lon);
  return buildMapShareUrl({
    center: { lat, lon },
    zoom: Math.max(map.getZoom(), 13),
    deviceId: id
  });
}

async function copyTextWithFallback(text, promptLabel) {
  let copied = false;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      copied = true;
    }
  } catch (_err) {
    copied = false;
  }
  if (!copied) {
    window.prompt(promptLabel, text);
  }
  return copied;
}

async function copyNodeLink(ev) {
  const btn = ev?.currentTarget;
  const id = btn?.dataset?.nodeLinkId || '';
  if (!btn || !id) return;
  ev.preventDefault();
  ev.stopPropagation();
  const d = deviceData.get(id);
  const link = buildDeviceLink(id, d);
  const original = btn.textContent || 'Copy link';
  const copied = await copyTextWithFallback(link, 'Copy node link:');
  btn.textContent = copied ? 'Copied' : original;
  window.setTimeout(() => {
    btn.textContent = original;
  }, 1200);
}

const shareToggle = document.getElementById('share-toggle');
if (qrModalClose) {
  qrModalClose.addEventListener('click', closeQrModal);
}
if (qrModalBackdrop) {
  qrModalBackdrop.addEventListener('click', closeQrModal);
}
if (qrModalLabel) {
  qrModalLabel.addEventListener('click', copyPopupText);
}
document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape' && qrModal && !qrModal.hidden) {
    closeQrModal();
  }
});
if (shareToggle) {
  const resetShareButton = () => {
    shareToggle.classList.remove('copied');
    shareToggle.setAttribute('aria-label', 'Copy share link');
    shareToggle.setAttribute('title', 'Copy share link');
  };
  shareToggle.addEventListener('click', async () => {
    await copyTextWithFallback(buildMapShareUrl(), 'Copy share link:');
    shareToggle.classList.add('copied');
    shareToggle.setAttribute('aria-label', 'Share link copied');
    shareToggle.setAttribute('title', 'Share link copied');
    window.setTimeout(resetShareButton, 1600);
  });
}

const mapToggle = document.getElementById('map-toggle');
let plainBasemapWarned = false;
function setBaseLayer(name) {
  if (!validLayers.has(name)) name = 'dark';
  let target = baseLayers[name];
  if (target) {
    try {
      // Prepare the replacement before removing the last working basemap.
      if (!map.hasLayer(target)) map.addLayer(target);
      const canvas = target.getMaplibreMap().getCanvas();
      if (!canvas.__meshmapContextWatched) {
        canvas.__meshmapContextWatched = true;
        canvas.addEventListener('webglcontextlost', () => {
          // Switching maps destroys the old layer's GL context on purpose; only react to a real loss of the active layer.
          if (!map.hasLayer(target) || baseLayer !== name) return;
          if (map.hasLayer(target)) map.removeLayer(target);
          if (baseLayers[name] === target) baseLayers[name] = null;
          if (baseLayer === name) setBaseLayer(name);
        }, { once: true });
      }
    } catch (_err) {
      if (target && map.hasLayer(target)) map.removeLayer(target);
      baseLayers[name] = null;
      target = null;
    }
  }
  if (!target && !plainBasemapWarned) {
    plainBasemapWarned = true;
    reportError('Vector basemap unavailable; showing a plain background.');
  }
  Object.values(baseLayers).forEach((layer) => {
    if (layer && layer !== target && map.hasLayer(layer)) map.removeLayer(layer);
  });
  document.body.classList.toggle('dark-map', name === 'dark');
  document.body.classList.toggle('plain-map', !target);
  if (typeof restyleAllMarkers === 'function') restyleAllMarkers();
  baseLayer = name;
  localStorage.setItem('meshmapBaseLayer', baseLayer);
  if (mapToggle) {
    mapToggle.hidden = false;
    mapToggle.textContent = baseLayer === 'dark' ? 'Light map' : 'Dark map';
    mapToggle.title = '';
  }
}

if (mapToggle) {
  mapToggle.addEventListener('click', () => {
    setBaseLayer(baseLayer === 'dark' ? 'light' : 'dark');
  });
}
setBaseLayer(baseLayer);

const unitsToggle = document.getElementById('units-toggle');
function setUnitsLabel() {
  if (!unitsToggle) return;
  unitsToggle.textContent = distanceUnits === 'mi' ? 'Units: mi' : 'Units: km';
}
function setDistanceUnits(units, persist = true) {
  if (!validUnits.has(units)) return;
  distanceUnits = units;
  if (persist) {
    localStorage.setItem('meshmapDistanceUnits2', units);
  }
  setUnitsLabel();
  if (activeRouteDetailsMeta && routeDetailsPanel && !routeDetailsPanel.hidden) {
    showRouteDetails(activeRouteDetailsMeta);
  }
  if (peersData) {
    renderCurrentPeers();
  }
}
setUnitsLabel();
if (unitsToggle) {
  unitsToggle.addEventListener('click', () => {
    const next = distanceUnits === 'mi' ? 'km' : 'mi';
    setDistanceUnits(next);
  });
}

if (routeByteFilterSelect) {
  routeByteFilterSelect.addEventListener('change', (ev) => {
    routeByteFilter = selectedByteFilterFromGroup(routeByteFilterSelect, ev.target);
    localStorage.setItem('meshmapRouteByteFilter', serializeByteFilterSet(routeByteFilter));
    setByteFilterChecks(routeByteFilterSelect, routeByteFilter);
    syncAllRouteDisplays();
  });
}

if (routeNodeFilterInput) {
  routeNodeFilterInput.addEventListener('input', (ev) => {
    routeNodeFilterText = String(ev.target.value || '');
    localStorage.setItem('meshmapRouteNodeFilter', routeNodeFilterText);
    syncRouteFilterDisplays();
    renderRouteNodeFilterResults();
  });
  routeNodeFilterInput.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') {
      ev.preventDefault();
      hideRouteNodeFilterResults();
      return;
    }
    if (ev.key === 'Enter' && routeNodeMatches.length) {
      ev.preventDefault();
      selectRouteNodeFilterMatch(routeNodeMatches[0]);
    }
  });
  routeNodeFilterInput.addEventListener('focus', renderRouteNodeFilterResults);
  routeNodeFilterInput.addEventListener('blur', () => {
    window.setTimeout(() => {
      hideRouteNodeFilterResults();
    }, 100);
  });
  if (hud) {
    hud.addEventListener('scroll', positionRouteNodeFilterResults);
  }
}

document.addEventListener('click', (ev) => {
  if (!routeNodeFilterInput || !routeNodeFilterResults) return;
  if (routeNodeFilterInput.contains(ev.target) ||
      routeNodeFilterResults.contains(ev.target)) return;
  hideRouteNodeFilterResults();
});

roleFilterButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const role = button.dataset.roleFilter;
    setRoleVisible(role, !visibleRoles.has(role));
  });
});
updateRoleFilterUi();

const labelsToggle = document.getElementById('labels-toggle');
if (labelsToggle) {
  labelsToggle.addEventListener('click', () => {
    setLabelsActive(!showLabels);
  });
}
if (queryLabelsVisible !== null) {
  showLabels = queryLabelsVisible;
  localStorage.setItem('meshmapShowLabels', showLabels ? 'true' : 'false');
}
setLabelsActive(showLabels);

if (searchInput) {
  searchInput.addEventListener('input', (ev) => {
    renderSearchResults(ev.target.value);
  });
  searchInput.addEventListener('keydown', (ev) => {
    const secret = String(searchInput.value || '').trim().toLowerCase();
    if (ev.key === 'Enter' && (secret === '/waka' || secret === '/arcade')) {
      ev.preventDefault();
      searchInput.value = '';
      renderSearchResults('');
      toggleArcadeMode();
      return;
    }
    if (ev.key === 'Enter' && searchMatches.length > 0) {
      ev.preventDefault();
      focusDevice(searchMatches[0].id);
    }
  });
}
document.addEventListener('click', (ev) => {
  if (!searchResults || !searchInput) return;
  if (searchResults.contains(ev.target) || searchInput.contains(ev.target)) return;
  searchResults.hidden = true;
  searchResults.innerHTML = '';
});
window.addEventListener('resize', () => {
  positionRouteNodeFilterResults();
  layoutSidePanels();
});

const nodesToggle = document.getElementById('nodes-toggle');
if (nodesToggle) {
  const storedNodes = localStorage.getItem('meshmapNodesVisible');
  let initialNodes = storedNodes !== null ? storedNodes === 'true' : true;
  if (queryNodesVisible !== null) {
    initialNodes = queryNodesVisible;
    localStorage.setItem('meshmapNodesVisible', initialNodes ? 'true' : 'false');
  }
  setNodesVisible(initialNodes);
  nodesToggle.addEventListener('click', () => {
    setNodesVisible(!nodesVisible);
    localStorage.setItem('meshmapNodesVisible', nodesVisible ? 'true' : 'false');
  });
}
if (mqttOnlyToggle) {
  mqttOnlyToggle.addEventListener('click', () => {
    setMqttOnlyVisible(!mqttOnlyVisible);
  });
}
updateNodeSizeUi();
if (nodeSizeInput) {
  nodeSizeInput.addEventListener('input', (ev) => {
    setNodeMarkerRadius(ev.target.value);
  });
}

const historyToggle = document.getElementById('history-toggle');
if (historyToggle) {
  if (!routeHistoryEnabled) {
    historyToggle.setAttribute('hidden', 'hidden');
    historyToggle.style.display = 'none';
    setHistoryVisible(false);
  } else {
    let initialHistory = false;
    if (queryHistoryVisible !== null) {
      initialHistory = queryHistoryVisible;
    }
    setHistoryVisible(initialHistory);
    historyToggle.addEventListener('click', () => {
      if (historyVisible && historyPanelHidden) {
        setHistoryPanelHidden(false);
        return;
      }
      setHistoryVisible(!historyVisible);
    });
  }
}
updateHistoryFilterLabel();
if (historyFilter) {
  historyFilter.addEventListener('input', (ev) => {
    updateHistoryFilter(ev.target.value);
  });
}
if (historyByteFilterSelect) {
  historyByteFilterSelect.addEventListener('change', (ev) => {
    updateHistoryByteFilter(selectedByteFilterFromGroup(historyByteFilterSelect, ev.target));
  });
}
if (historyLinkSizeInput) {
  historyLinkSizeInput.addEventListener('input', (ev) => {
    updateHistoryLinkScale(ev.target.value);
  });
}

if (peersToggle) {
  const initialPeersActive =
    queryPeersActive !== null ? queryPeersActive : peersDefaultOpen;
  setPeersActive(initialPeersActive);
  peersToggle.addEventListener('click', () => {
    setPeersActive(!peersActive);
  });
}
if (peersStatus) {
  peersStatus.addEventListener('click', () => {
    if (peersStatus.dataset.peerDeviceId) {
      focusDevice(peersStatus.dataset.peerDeviceId);
    }
  });
  peersStatus.addEventListener('keydown', (ev) => {
    if (!peersStatus.dataset.peerDeviceId) return;
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      focusDevice(peersStatus.dataset.peerDeviceId);
    }
  });
}
if (peersTitle) {
  peersTitle.addEventListener('click', () => {
    if (peersTitle.dataset.peerDeviceId) {
      focusDevice(peersTitle.dataset.peerDeviceId);
    }
  });
  peersTitle.addEventListener('keydown', (ev) => {
    if (!peersTitle.dataset.peerDeviceId) return;
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      focusDevice(peersTitle.dataset.peerDeviceId);
    }
  });
}
if (peersClear) {
  peersClear.addEventListener('click', () => {
    clearPeers();
  });
}
if (peersFilter) {
  peersFilter.addEventListener('input', () => {
    peersFilterText = peersFilter.value || '';
    if (peersData) {
      renderCurrentPeers();
    }
  });
}

const heatToggle = document.getElementById('heat-toggle');
if (heatToggle) {
  const storedHeatVisible = localStorage.getItem('meshmapShowHeat');
  let initialHeat = storedHeatVisible !== null
    ? storedHeatVisible === 'true'
    : heatDefaultOn;
  if (queryHeatVisible !== null) {
    initialHeat = queryHeatVisible;
    localStorage.setItem('meshmapShowHeat', initialHeat ? 'true' : 'false');
  }
  setHeatVisible(initialHeat);
  heatToggle.addEventListener('click', () => {
    try {
      setHeatVisible(!heatVisible);
      localStorage.setItem('meshmapShowHeat', heatVisible ? 'true' : 'false');
    } catch (err) {
      reportError(`Heat toggle failed: ${err && err.message ? err.message : err}`);
      console.error(err);
    }
  });
}

const coverageToggle = document.getElementById('coverage-toggle');
if (coverageToggle && !coverageEnabled) {
  coverageToggle.setAttribute('hidden', 'hidden');
}
if (coverageToggle && coverageEnabled) {
  const storedCoverageVisible = localStorage.getItem('meshmapShowCoverage');
  let initialCoverage = storedCoverageVisible !== null ? storedCoverageVisible === 'true' : false;
  if (queryCoverageVisible !== null) {
    initialCoverage = queryCoverageVisible;
    localStorage.setItem('meshmapShowCoverage', initialCoverage ? 'true' : 'false');
  }
  setCoverageVisible(initialCoverage);
  coverageToggle.addEventListener('click', () => {
    try {
      setCoverageVisible(!coverageVisible);
      localStorage.setItem('meshmapShowCoverage', coverageVisible ? 'true' : 'false');
    } catch (err) {
      reportError(`Coverage toggle failed: ${err && err.message ? err.message : err}`);
    }
  });
}

map.on('moveend', () => {
  refreshViewportLayers();
});
map.on('zoomend', () => {
  refreshViewportLayers();
});

map.on('click', (ev) => {
  const target = ev && ev.originalEvent ? ev.originalEvent.target : null;
  if (target && target.closest && target.closest('.leaflet-popup')) {
    return;
  }
});
