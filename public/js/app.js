import api from './api.js';
import { translations, applyLanguage } from './i18n.js';

// Global Android Application State
const state = {
  currentPlace: { name: 'Hyderabad', admin1: 'Telangana', country: 'India', latitude: 17.3850, longitude: 78.4867 },
  currentWeather: null,
  activeTab: 'tab-home',
  persona: 'farmer', // 'farmer' | 'pilot' | 'official' | 'traveller' | 'general'
  language: 'en',
  unit: 'c',
  autoSpeak: false,
  favorites: [],
  map: null,
  marker: null,
  radarLayer: null,
  radarBasemapLayer: null,
  radarCityPinsLayer: null,
  homeMap: null,
  homeMarker: null,
  homeRadarLayer: null,
  homeHazardLayer: null,
  homeSatelliteLayer: null,
  radarFrames: [],
  radarIndex: 0,
  radarTimer: null,
  radarHost: 'https://tilecache.rainviewer.com',
  speechSynth: window.speechSynthesis || null,
  recognition: null,
  lastAiAnswer: ''
};

// Weather WMO Code to Emoji & Description
const WMO_MAP = {
  0: { label: 'Clear Sky', icon: '☀️' },
  1: { label: 'Mainly Clear', icon: '🌤️' },
  2: { label: 'Partly Cloudy', icon: '⛅' },
  3: { label: 'Overcast', icon: '☁️' },
  45: { label: 'Foggy', icon: '🌫️' },
  48: { label: 'Rime Fog', icon: '🌫️' },
  51: { label: 'Light Drizzle', icon: '🌦️' },
  53: { label: 'Moderate Drizzle', icon: '🌦️' },
  55: { label: 'Dense Drizzle', icon: '🌧️' },
  61: { label: 'Slight Rain', icon: '🌦️' },
  63: { label: 'Moderate Rain', icon: '🌧️' },
  65: { label: 'Heavy Rain', icon: '⛈️' },
  71: { label: 'Slight Snow', icon: '🌨️' },
  73: { label: 'Moderate Snow', icon: '🌨️' },
  75: { label: 'Heavy Snow', icon: '❄️' },
  80: { label: 'Rain Showers', icon: '🌦️' },
  81: { label: 'Moderate Showers', icon: '🌧️' },
  82: { label: 'Violent Showers', icon: '⛈️' },
  95: { label: 'Thunderstorm', icon: '⛈️' },
  96: { label: 'Thunderstorm + Hail', icon: '⛈️' },
  99: { label: 'Severe Thunderstorm', icon: '🌩️' }
};

document.addEventListener('DOMContentLoaded', () => {
  initAndroidApp();
});

async function initAndroidApp() {
  initClock();
  setupAndroidNavigation();
  setupDrawer();
  setupPersona();
  setupChat();
  setupBottomSheets();
  setupVoice();
  setupCityPicker();
  setupSettings();
  setupTravelPlanner();
  setupAviationAndClimateListeners();
  registerServiceWorker();

  // Load Settings from SQLite Backend
  try {
    const settings = await api.getSettings();
    if (settings) {
      state.unit = settings.temperature_unit || 'c';
      state.language = settings.language || 'en';
      state.autoSpeak = Boolean(settings.auto_speak);
      applyLanguage(state.language);

      const unitEl = document.getElementById('unitSelect');
      if (unitEl) unitEl.value = state.unit;
      const langEl = document.getElementById('langSelect');
      if (langEl) langEl.value = state.language;
      const autoEl = document.getElementById('autoSpeakCheck');
      if (autoEl) autoEl.checked = state.autoSpeak;

      const keyStatus = document.getElementById('aiKeyStatus');
      if (keyStatus) {
        keyStatus.textContent = settings.has_ai_key
          ? `Active (${settings.ai_model || 'WeatherGPT Neural Engine v2.5'})`
          : 'Ready (Heuristic engine active)';
      }
    }
  } catch (err) {
    console.warn('[settings] Initial fetch note:', err.message);
  }

  // Initialize SIH Operational Profile & Location Setup Gate
  setupSihSetupGate();

  // Load initial city weather
  await loadWeather(state.currentPlace.latitude, state.currentPlace.longitude, state.currentPlace.name);

  // Initialize Maps (Home Mini GIS Map & Full Radar Console)
  initHomeMiniMap();
  initLeafletRadarMap();
}

// ── 0. ANDROID SYSTEM CLOCK ──────────────────────────────────────────
function initClock() {
  const clockEl = document.getElementById('statusClock');
  if (!clockEl) return;
  const update = () => {
    const now = new Date();
    const hrs = String(now.getHours()).padStart(2, '0');
    const mins = String(now.getMinutes()).padStart(2, '0');
    clockEl.textContent = `${hrs}:${mins}`;
  };
  update();
  setInterval(update, 10000);
}

// ── 1. WEATHER TELEMETRY LOADER ──────────────────────────────────────
async function loadWeather(lat, lon, placeName, refresh = false) {
  try {
    const data = await api.getWeather(lat, lon, refresh);
    state.currentWeather = data;
    state.currentPlace.latitude = lat;
    state.currentPlace.longitude = lon;
    state.currentPlace.name = placeName || state.currentPlace.name;

    // Update Home Live Glance Pill
    renderHomeGlance(data, state.currentPlace.name);

    // Update Radar Sliding Telemetry Card
    renderRadarTelemetry(data, state.currentPlace.name);

    // Update 7-Day Extended Sheet
    renderExtendedForecast(data);

    // Sync SIH Advanced Meteorological Intelligence modules
    loadNwpData(lat, lon);
    loadAviationData(lat, lon, state.currentPlace.name);
    loadClimateData(lat, lon, state.currentPlace.name);

    // Update Home Mini Map marker & telemetry
    updateHomeMap(lat, lon, state.currentPlace.name, data);

    // Update Full Radar Map marker & position
    if (state.map && state.marker) {
      state.map.setView([lat, lon], 7);
      state.marker.setLatLng([lat, lon]).bindPopup(`<b>${state.currentPlace.name}</b><br>${formatTemp(data.current?.temperature_2m)}`).openPopup();
    }
  } catch (err) {
    console.error('[loadWeather] Error fetching meteorological data:', err);
  }
}

function formatTemp(celsius) {
  if (celsius === undefined || celsius === null) return '--°';
  const val = Math.round(state.unit === 'f' ? (celsius * 9 / 5) + 32 : celsius);
  return `${val}°${state.unit.toUpperCase()}`;
}

// ── 2. RENDER HOME SCREEN GLANCE PILL ────────────────────────────────
function renderHomeGlance(data, placeName) {
  const placeEl = document.getElementById('glancePlace');
  const tempEl = document.getElementById('glanceTemp');
  const condEl = document.getElementById('glanceCondition');
  const rainEl = document.getElementById('glanceRain');
  const chatCityEl = document.getElementById('chatActiveCity');

  if (placeEl) placeEl.textContent = placeName;
  if (chatCityEl) chatCityEl.textContent = placeName;

  const current = data.current || {};
  const daily = data.daily || {};
  const code = current.weather_code ?? 0;
  const wmo = WMO_MAP[code] || { label: 'Clear Sky', icon: '☀️' };

  if (tempEl) tempEl.textContent = formatTemp(current.temperature_2m);
  if (condEl) condEl.textContent = `${wmo.icon} ${wmo.label}`;
  const pop = daily.precipitation_probability_max?.[0] ?? 0;
  if (rainEl) rainEl.textContent = `🌧️ ${pop}%`;
}

// ── 3. RENDER RADAR SLIDING CARD TELEMETRY (Matching Screenshot 3) ───
function renderRadarTelemetry(data, placeName) {
  const radarPlace = document.getElementById('radarPlaceName');
  const radarTempHead = document.getElementById('radarTempHead');
  const iconEl = document.getElementById('telemetryIcon');
  const tempEl = document.getElementById('telemetryTemp');
  const badgeEl = document.getElementById('telemetryConditionBadge');
  const feelsEl = document.getElementById('telemetryFeels');

  const tpRain = document.getElementById('tpRainProb');
  const tpWind = document.getElementById('tpWind');
  const tpHumUv = document.getElementById('tpHumidityUv');
  const tpPressVis = document.getElementById('tpPressureVis');

  const c = data.current || {};
  const d = data.daily || {};
  const code = c.weather_code ?? 0;
  const wmo = WMO_MAP[code] || { label: 'Clear Sky', icon: '☀️' };

  if (radarPlace) radarPlace.textContent = placeName;
  if (radarTempHead) radarTempHead.textContent = formatTemp(c.temperature_2m);

  if (iconEl) iconEl.textContent = wmo.icon;
  if (tempEl) tempEl.textContent = formatTemp(c.temperature_2m);
  if (badgeEl) badgeEl.textContent = wmo.label;

  const feels = formatTemp(c.apparent_temperature ?? c.temperature_2m);
  const clouds = c.cloud_cover ?? 10;
  if (feelsEl) feelsEl.textContent = `Feels like ${feels} • Cloud Cover ${clouds}%`;

  const rainProb = d.precipitation_probability_max?.[0] ?? 0;
  const windSpeed = Math.round(c.wind_speed_10m ?? 0);
  const windGusts = Math.round(c.wind_gusts_10m ?? windSpeed + 5);
  const hum = Math.round(c.relative_humidity_2m ?? 60);
  const uv = (c.uv_index !== undefined) ? Number(c.uv_index).toFixed(1) : '3.0';
  const press = Math.round(c.surface_pressure ?? 1013);
  const vis = (c.visibility !== undefined) ? (c.visibility / 1000).toFixed(1) : '10.0';

  if (tpRain) tpRain.textContent = `${rainProb}% prob`;
  if (tpWind) tpWind.textContent = `${windSpeed} km/h (G ${windGusts})`;
  if (tpHumUv) tpHumUv.textContent = `${hum}% • UV ${uv}`;
  if (tpPressVis) tpPressVis.textContent = `${press} hPa • ${vis} km`;
}

// ── 4. RENDER 7-DAY & HOURLY SHEET ───────────────────────────────────
function renderExtendedForecast(data) {
  const hourlyStrip = document.getElementById('sheetHourlyList');
  const dailyList = document.getElementById('sheetDailyList');

  if (hourlyStrip && data.hourly && data.hourly.time) {
    const times = data.hourly.time.slice(0, 24);
    const temps = data.hourly.temperature_2m || [];
    const codes = data.hourly.weather_code || [];

    hourlyStrip.innerHTML = times.map((t, i) => {
      const d = new Date(t);
      const timeStr = `${d.getHours()}:00`;
      const w = WMO_MAP[codes[i]] || { icon: '🌤️' };
      return `
        <div class="hourly-node">
          <time>${timeStr}</time>
          <span>${w.icon}</span>
          <b>${formatTemp(temps[i])}</b>
        </div>
      `;
    }).join('');
  }

  if (dailyList && data.daily && data.daily.time) {
    const times = data.daily.time;
    const maxT = data.daily.temperature_2m_max || [];
    const minT = data.daily.temperature_2m_min || [];
    const codes = data.daily.weather_code || [];
    const pops = data.daily.precipitation_probability_max || [];

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    dailyList.innerHTML = times.slice(0, 7).map((t, i) => {
      const dt = new Date(t);
      const dayName = (i === 0) ? 'Today' : dayNames[dt.getDay()];
      const w = WMO_MAP[codes[i]] || { label: 'Clear', icon: '☀️' };
      return `
        <div class="daily-row">
          <div class="daily-day">${dayName}</div>
          <div>
            <span class="daily-ico">${w.icon}</span>
            <span class="daily-pop">🌧️ ${pops[i] || 0}%</span>
          </div>
          <div class="daily-temps">
            <span>${formatTemp(maxT[i])}</span>
            <span class="min">${formatTemp(minT[i])}</span>
          </div>
        </div>
      `;
    }).join('');
  }
}

// ── 5. LEAFLET DUAL MAP SYSTEMS (Home Mini GIS + Radar Console) ───────
const BASEMAP_TILES = {
  dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  osm: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  topo: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png'
};

/* ── 5A. HOME MINI LEAFLET MAP ── */
function initHomeMiniMap() {
  const container = document.getElementById('homeMiniLeafletMap');
  if (!container || state.homeMap || typeof L === 'undefined') return;

  const { latitude, longitude } = state.currentPlace;
  state.homeMap = L.map('homeMiniLeafletMap', {
    center: [latitude, longitude],
    zoom: 8,
    zoomControl: false,
    attributionControl: false
  });

  // Dark basemap
  L.tileLayer(BASEMAP_TILES.dark, {
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(state.homeMap);

  // Glowing pulse marker for current selected location
  const pulseIcon = L.divIcon({
    className: 'home-pulse-icon',
    html: `<div style="width:14px;height:14px;background:#c084fc;border:2px solid #ffffff;border-radius:50%;box-shadow:0 0 14px #c084fc;"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7]
  });

  state.homeMarker = L.marker([latitude, longitude], { icon: pulseIcon }).addTo(state.homeMap)
    .bindPopup(`<b>${state.currentPlace.name}</b>`);

  // Radar Overlay if frames are already loaded
  if (state.radarFrames && state.radarFrames.length > 0) {
    const frame = state.radarFrames[state.radarIndex || state.radarFrames.length - 1];
    state.homeRadarLayer = L.tileLayer(`${state.radarHost}${frame.path}/256/{z}/{x}/{y}/2/1_1.png`, {
      opacity: 0.72,
      zIndex: 10
    }).addTo(state.homeMap);
  }

  // Home Radar Card expand button (switches to tab-radar)
  document.getElementById('hrcExpandBtn')?.addEventListener('click', () => {
    document.querySelector('.nav-tab-btn[data-tab="tab-radar"]')?.click();
  });

  // Layer chips on Home Radar Card
  document.querySelectorAll('.hrc-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.hrc-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      const layerType = chip.getAttribute('data-layer');
      handleHomeMapLayer(layerType);
    });
  });

  setTimeout(() => {
    if (state.homeMap) state.homeMap.invalidateSize();
  }, 250);
}

function updateHomeMap(lat, lon, name, data) {
  const hrcCityTag = document.getElementById('hrcCityTag');
  if (hrcCityTag) hrcCityTag.textContent = name;

  if (state.homeMap) {
    state.homeMap.setView([lat, lon], 8);
    if (state.homeMarker) {
      state.homeMarker.setLatLng([lat, lon])
        .bindPopup(`<b>${name}</b><br>${formatTemp(data?.current?.temperature_2m)}`);
    }
    setTimeout(() => state.homeMap.invalidateSize(), 150);
  }
}

function handleHomeMapLayer(layerType) {
  if (!state.homeMap) return;

  if (layerType === 'radar') {
    if (state.homeHazardLayer) {
      state.homeMap.removeLayer(state.homeHazardLayer);
      state.homeHazardLayer = null;
    }
    if (state.homeSatelliteLayer) {
      state.homeMap.removeLayer(state.homeSatelliteLayer);
      state.homeSatelliteLayer = null;
    }
    if (state.homeRadarLayer && !state.homeMap.hasLayer(state.homeRadarLayer)) {
      state.homeRadarLayer.addTo(state.homeMap);
    }
  } else if (layerType === 'satellite') {
    if (state.homeHazardLayer) {
      state.homeMap.removeLayer(state.homeHazardLayer);
      state.homeHazardLayer = null;
    }
    if (state.homeSatelliteLayer) {
      state.homeMap.removeLayer(state.homeSatelliteLayer);
      state.homeSatelliteLayer = null;
    } else {
      state.homeSatelliteLayer = L.tileLayer(BASEMAP_TILES.satellite, {
        maxZoom: 19
      }).addTo(state.homeMap);
    }
  } else if (layerType === 'hazard') {
    if (!state.homeHazardLayer) {
      const circle1 = L.circle([state.currentPlace.latitude, state.currentPlace.longitude], {
        color: '#f59e0b',
        fillColor: '#f59e0b',
        fillOpacity: 0.22,
        radius: 35000
      }).bindPopup('<b>Moderate Convective Risk</b><br>Gust potential 35-45 km/h');

      const circle2 = L.circle([state.currentPlace.latitude + 0.3, state.currentPlace.longitude - 0.2], {
        color: '#ef4444',
        fillColor: '#ef4444',
        fillOpacity: 0.26,
        radius: 20000
      }).bindPopup('<b>Severe Storm Alert</b><br>Rain rate > 25mm/hr');

      state.homeHazardLayer = L.layerGroup([circle1, circle2]).addTo(state.homeMap);
    }
  }
}

/* ── 5B. FULL RADAR CONSOLE MAP ── */
function initLeafletRadarMap() {
  const container = document.getElementById('radarLeafletMap');
  if (!container || state.map || typeof L === 'undefined') return;

  const { latitude, longitude } = state.currentPlace;
  state.map = L.map('radarLeafletMap', {
    center: [latitude, longitude],
    zoom: 7,
    zoomControl: false,
    attributionControl: false
  });

  // Dark basemap with zero watermark
  state.radarBasemapLayer = L.tileLayer(BASEMAP_TILES.dark, {
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(state.map);

  // Pulse Location Marker
  state.marker = L.marker([latitude, longitude]).addTo(state.map)
    .bindPopup(`<b>${state.currentPlace.name}</b>`)
    .openPopup();

  // Create India Metro City Pins Layer
  createCityPinsLayer();

  // Load RainViewer Radar Frames
  api.getRadarFrames().then(radarData => {
    if (radarData && radarData.radar && radarData.radar.past) {
      state.radarFrames = radarData.radar.past;
      state.radarHost = radarData.host || 'https://tilecache.rainviewer.com';
      state.radarIndex = state.radarFrames.length - 1;
      updateRadarLayer();

      // Also ensure Home map radar layer is synced
      if (state.homeMap && !state.homeRadarLayer) {
        const frame = state.radarFrames[state.radarIndex];
        if (frame) {
          state.homeRadarLayer = L.tileLayer(`${state.radarHost}${frame.path}/256/{z}/{x}/{y}/2/1_1.png`, {
            opacity: 0.72,
            zIndex: 10
          }).addTo(state.homeMap);
        }
      }
    }
  }).catch(err => {
    console.warn('[radar] Satellite radar tiles offline:', err.message);
  });

  // Map Controls
  const playBtn = document.getElementById('radarPlayPauseBtn');
  if (playBtn) {
    playBtn.addEventListener('click', () => {
      if (state.radarTimer) {
        clearInterval(state.radarTimer);
        state.radarTimer = null;
        playBtn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"/></svg>';
      } else {
        playBtn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
        state.radarTimer = setInterval(() => {
          if (state.radarFrames.length > 0) {
            state.radarIndex = (state.radarIndex + 1) % state.radarFrames.length;
            updateRadarLayer();
          }
        }, 1100);
      }
    });
  }

  document.getElementById('mapZoomInBtn')?.addEventListener('click', () => state.map?.zoomIn());
  document.getElementById('mapZoomOutBtn')?.addEventListener('click', () => state.map?.zoomOut());
  document.getElementById('mapIndiaOverviewBtn')?.addEventListener('click', () => state.map?.setView([20.5937, 78.9629], 5));
  document.getElementById('radarCenterGpsBtn')?.addEventListener('click', () => {
    state.map?.setView([state.currentPlace.latitude, state.currentPlace.longitude], 8);
  });

  // Layer Toolbox Toggle & Switching
  setupRadarLayerControls();

  // Hazard Filter Chips
  document.querySelectorAll('.hazard-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.hazard-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
    });
  });
}

function createCityPinsLayer() {
  if (!state.map || state.radarCityPinsLayer) return;
  const METRO_PINS = [
    { name: 'New Delhi', lat: 28.6139, lon: 77.2090, tag: 'NCR' },
    { name: 'Mumbai', lat: 19.0760, lon: 72.8777, tag: 'Coastal' },
    { name: 'Bengaluru', lat: 12.9716, lon: 77.5946, tag: 'Plateau' },
    { name: 'Hyderabad', lat: 17.3850, lon: 78.4867, tag: 'Deccan' },
    { name: 'Chennai', lat: 13.0827, lon: 80.2707, tag: 'Coromandel' },
    { name: 'Kolkata', lat: 22.5726, lon: 88.3639, tag: 'Delta' },
    { name: 'Ahmedabad', lat: 23.0225, lon: 72.5714, tag: 'Semi-Arid' },
    { name: 'Pune', lat: 18.5204, lon: 73.8567, tag: 'Western Ghats' },
    { name: 'Jaipur', lat: 26.9124, lon: 75.7873, tag: 'Thar Basin' },
    { name: 'Visakhapatnam', lat: 17.6868, lon: 83.2185, tag: 'Cyclone Radar' },
    { name: 'Kochi', lat: 9.9312, lon: 76.2673, tag: 'Monsoon Gate' },
    { name: 'Shimla', lat: 31.1048, lon: 77.1734, tag: 'Himalayan' }
  ];

  const markers = METRO_PINS.map(p => {
    const pin = L.circleMarker([p.lat, p.lon], {
      radius: 6,
      color: '#a855f7',
      fillColor: '#c084fc',
      fillOpacity: 0.85,
      weight: 2
    });
    pin.bindPopup(`
      <div style="font-family:sans-serif;font-size:12px;color:#1e293b;padding:4px;">
        <b style="font-size:13px;">${p.name}</b> <span style="font-size:10px;background:#e2e8f0;padding:1px 5px;border-radius:4px;">${p.tag}</span><br>
        <button style="margin-top:8px;padding:4px 10px;font-size:11px;background:#9333ea;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:600;" onclick="window.selectCityFromPin('${p.name}', ${p.lat}, ${p.lon})">
          Select ${p.name}
        </button>
      </div>
    `);
    return pin;
  });

  state.radarCityPinsLayer = L.layerGroup(markers).addTo(state.map);
  window.selectCityFromPin = (name, lat, lon) => {
    loadWeather(lat, lon, name);
  };
}

function setupRadarLayerControls() {
  const layersBtn = document.getElementById('mapLayersBtn');
  const panel = document.getElementById('radarLayerPanel');

  layersBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!panel) return;
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
  });

  document.addEventListener('click', (e) => {
    if (panel && panel.style.display === 'block' && !panel.contains(e.target) && e.target !== layersBtn) {
      panel.style.display = 'none';
    }
  });

  // Basemap switch buttons
  document.querySelectorAll('.rlp-btn[data-basemap]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.rlp-btn[data-basemap]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const basemapKey = btn.getAttribute('data-basemap');
      const url = BASEMAP_TILES[basemapKey];
      if (url && state.map) {
        if (state.radarBasemapLayer) state.map.removeLayer(state.radarBasemapLayer);
        state.radarBasemapLayer = L.tileLayer(url, { maxZoom: 19 }).addTo(state.map);
        if (state.radarLayer) state.radarLayer.bringToFront();
      }
    });
  });

  // Checkbox: Live Rain Radar
  document.getElementById('overlayRadarCheck')?.addEventListener('change', (e) => {
    if (!state.map) return;
    if (e.target.checked) {
      if (state.radarLayer && !state.map.hasLayer(state.radarLayer)) state.radarLayer.addTo(state.map);
    } else {
      if (state.radarLayer && state.map.hasLayer(state.radarLayer)) state.map.removeLayer(state.radarLayer);
    }
  });

  // Checkbox: Metro Pins
  document.getElementById('overlayPinsCheck')?.addEventListener('change', (e) => {
    if (!state.map || !state.radarCityPinsLayer) return;
    if (e.target.checked) {
      if (!state.map.hasLayer(state.radarCityPinsLayer)) state.radarCityPinsLayer.addTo(state.map);
    } else {
      if (state.map.hasLayer(state.radarCityPinsLayer)) state.map.removeLayer(state.radarCityPinsLayer);
    }
  });
}

function updateRadarLayer() {
  if (!state.map || state.radarFrames.length === 0) return;
  const frame = state.radarFrames[state.radarIndex];
  if (!frame) return;

  if (state.radarLayer) {
    state.map.removeLayer(state.radarLayer);
  }

  state.radarLayer = L.tileLayer(`${state.radarHost}${frame.path}/256/{z}/{x}/{y}/2/1_1.png`, {
    opacity: 0.72,
    zIndex: 10
  }).addTo(state.map);

  const timeLabel = document.getElementById('radarTimestamp');
  if (timeLabel) {
    const d = new Date(frame.time * 1000);
    timeLabel.textContent = `Reflectivity: ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
}

// ── 6. ANDROID NAVIGATION SYSTEM (3 Primary Tabs) ─────────────────────
function setupAndroidNavigation() {
  const tabButtons = document.querySelectorAll('.nav-tab-btn');
  const tabScreens = document.querySelectorAll('.tab-screen');
  const radarBackBtn = document.getElementById('radarBackBtn');

  function switchTab(tabId) {
    state.activeTab = tabId;

    tabScreens.forEach(screen => {
      if (screen.id === tabId) {
        screen.classList.add('active');
      } else {
        screen.classList.remove('active');
      }
    });

    tabButtons.forEach(btn => {
      if (btn.getAttribute('data-tab') === tabId) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Invalidate maps when switching tabs to ensure tile rendering
    if (tabId === 'tab-radar') {
      setTimeout(() => {
        if (state.map) state.map.invalidateSize();
      }, 150);
    } else if (tabId === 'tab-home') {
      setTimeout(() => {
        if (state.homeMap) state.homeMap.invalidateSize();
      }, 150);
    }
  }

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-tab');
      switchTab(target);
    });
  });

  if (radarBackBtn) {
    radarBackBtn.addEventListener('click', () => switchTab('tab-home'));
  }

  // Top Title Bar GPS quick trigger
  document.getElementById('topGpsBtn')?.addEventListener('click', () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(pos => {
        loadWeather(pos.coords.latitude, pos.coords.longitude, 'Current Location');
      }, () => {
        alert('GPS location permission denied.');
      });
    }
  });

  // Top History / Log button
  document.getElementById('topHistoryBtn')?.addEventListener('click', () => {
    const feed = document.getElementById('conversationFeed');
    feed?.scrollIntoView({ behavior: 'smooth' });
  });

  // Glance Pill Click -> Open City Switcher Sheet (or 7-day telemetry on expand btn)
  document.getElementById('homeGlancePill')?.addEventListener('click', (e) => {
    if (e.target.closest('#glanceExpandBtn')) {
      openBottomSheet('sheet-telemetry');
    } else {
      openBottomSheet('sheet-city-picker');
    }
  });

  document.getElementById('telemetryDetailsBtn')?.addEventListener('click', () => {
    openBottomSheet('sheet-telemetry');
  });
}

// ── 7. ANDROID DRAWER NAVIGATION ─────────────────────────────────────
function setupDrawer() {
  const drawer = document.getElementById('androidDrawer');
  const backdrop = document.getElementById('androidDrawerBackdrop');
  const openBtn = document.getElementById('drawerOpenBtn');
  const closeBtn = document.getElementById('drawerCloseBtn');
  const searchInput = document.getElementById('drawerSearchInput');
  const searchGoBtn = document.getElementById('drawerSearchGoBtn');

  function openDrawer() {
    drawer?.classList.add('open');
    backdrop?.classList.add('open');
  }

  function closeDrawer() {
    drawer?.classList.remove('open');
    backdrop?.classList.remove('open');
  }

  openBtn?.addEventListener('click', openDrawer);
  closeBtn?.addEventListener('click', closeDrawer);
  backdrop?.addEventListener('click', closeDrawer);

  // Drawer nav items
  document.querySelectorAll('.drawer-item').forEach(item => {
    item.addEventListener('click', () => {
      closeDrawer();
      const action = item.getAttribute('data-action');
      const sheet = item.getAttribute('data-sheet');
      if (action) {
        document.querySelector(`.nav-tab-btn[data-tab="${action}"]`)?.click();
      } else if (sheet) {
        openBottomSheet(sheet);
      }
    });
  });

  // Drawer Search
  const doSearch = async () => {
    const q = searchInput?.value.trim();
    if (!q) return;
    try {
      const geo = await api.searchGeocode(q);
      if (geo.results && geo.results[0]) {
        const item = geo.results[0];
        loadWeather(item.latitude, item.longitude, item.name);
        closeDrawer();
      } else {
        alert('Location not found. Please try another place.');
      }
    } catch (err) {
      alert('Search failed: ' + err.message);
    }
  };

  searchGoBtn?.addEventListener('click', doSearch);
  searchInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doSearch();
  });

  // Language Chips in Drawer
  document.querySelectorAll('.drawer-lang-grid .lang-chip').forEach(chip => {
    chip.addEventListener('click', async () => {
      document.querySelectorAll('.drawer-lang-grid .lang-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      const lang = chip.getAttribute('data-lang');
      state.language = lang;
      applyLanguage(lang);
      try { await api.updateSettings({ language: lang }); } catch {}
    });
  });
}

// ── 8. INTELLIGENCE PERSONA SWITCHER (Matching Screenshot 2) ─────────
function setupPersona() {
  const chips = document.querySelectorAll('.persona-chip');
  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      chips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      state.persona = chip.getAttribute('data-persona') || 'general';

      // Visual feedback in feed
      const promptMap = {
        farmer: 'Switched to Agronomy Persona. Tailoring soil moisture, spray windows, and thermal stress thresholds.',
        pilot: 'Switched to Aviation Persona. Tailoring METAR/TAF ceiling, crosswinds, and VFR/IFR clearance.',
        official: 'Switched to Disaster Responder Persona. Monitoring NDMA/SDMA CAP alerts and IMD 4-stage color alerts.',
        traveller: 'Switched to Traveller Persona. Evaluating highway convective hazards and visibility.',
        general: 'Switched to General Citizen Persona. Providing daily clothing and rain schedules.'
      };

      appendBotMessage(`✨ <strong>Persona Adapted</strong>: ${promptMap[state.persona] || 'Profile updated.'}`);
    });
  });

  // Saved Locations Click
  document.querySelectorAll('.loc-item-row').forEach(row => {
    row.addEventListener('click', () => {
      const lat = parseFloat(row.getAttribute('data-lat'));
      const lon = parseFloat(row.getAttribute('data-lon'));
      const name = row.getAttribute('data-name');
      loadWeather(lat, lon, name);
      document.querySelector('.nav-tab-btn[data-tab="tab-home"]')?.click();
    });
  });

  // Add Location
  document.getElementById('addLocationBtn')?.addEventListener('click', () => {
    const loc = prompt('Enter city or district name to monitor:');
    if (loc) {
      api.searchGeocode(loc).then(geo => {
        if (geo.results && geo.results[0]) {
          const item = geo.results[0];
          loadWeather(item.latitude, item.longitude, item.name);
          document.querySelector('.nav-tab-btn[data-tab="tab-home"]')?.click();
        }
      });
    }
  });
}

// ── 8B. SIH OPERATIONAL PROFILE & LOCATION SETUP GATE ────────────────
function setupSihSetupGate() {
  const gate = document.getElementById('sihSetupGate');
  const closeBtn = document.getElementById('setupCloseBtn');
  const launchBtn = document.getElementById('setupLaunchBtn');
  const openGateBtn = document.getElementById('openSetupGateBtn');
  const roleCards = document.querySelectorAll('.setup-role-card');
  const cityChips = document.querySelectorAll('#setupCityChips .city-btn');
  const locationInput = document.getElementById('setupLocationInput');
  const gpsBtn = document.getElementById('setupGpsBtn');
  const langSelect = document.getElementById('setupLangSelect');
  const unitSelect = document.getElementById('setupUnitSelect');

  let selectedRole = localStorage.getItem('sih_role') || 'farmer';
  let selectedCity = localStorage.getItem('sih_city') || 'Hyderabad';
  let selectedLat = parseFloat(localStorage.getItem('sih_lat')) || 17.3850;
  let selectedLon = parseFloat(localStorage.getItem('sih_lon')) || 78.4867;

  state.persona = selectedRole;
  state.currentPlace.name = selectedCity;
  state.currentPlace.latitude = selectedLat;
  state.currentPlace.longitude = selectedLon;

  const roleMeta = {
    farmer: { icon: '🌾', label: 'Farmer' },
    pilot: { icon: '✈️', label: 'Aviator' },
    official: { icon: '🏛️', label: 'Disaster Mgt' },
    traveller: { icon: '🚗', label: 'Traveler' },
    general: { icon: '🏙️', label: 'Citizen' }
  };

  function updateTopRoleBadge(role, city) {
    const meta = roleMeta[role] || roleMeta.general;
    const topRoleIcon = document.getElementById('topRoleIcon');
    const topRoleText = document.getElementById('topRoleText');
    const topCityText = document.getElementById('topCityText');
    if (topRoleIcon) topRoleIcon.textContent = meta.icon;
    if (topRoleText) topRoleText.textContent = meta.label;
    if (topCityText) {
      const shortCity = city.length > 7 ? city.substring(0, 6) + '…' : city;
      topCityText.textContent = shortCity;
    }
  }

  updateTopRoleBadge(selectedRole, selectedCity);

  // Sync role cards
  roleCards.forEach(card => {
    if (card.getAttribute('data-role') === selectedRole) {
      card.classList.add('active');
    } else {
      card.classList.remove('active');
    }
    card.addEventListener('click', () => {
      roleCards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      selectedRole = card.getAttribute('data-role');
    });
  });

  // Sync city chips
  cityChips.forEach(chip => {
    if (chip.getAttribute('data-city') === selectedCity) {
      chip.classList.add('active');
    } else {
      chip.classList.remove('active');
    }
    chip.addEventListener('click', () => {
      cityChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      selectedCity = chip.getAttribute('data-city');
      selectedLat = parseFloat(chip.getAttribute('data-lat'));
      selectedLon = parseFloat(chip.getAttribute('data-lon'));
      if (locationInput) locationInput.value = selectedCity;
    });
  });

  // GPS button
  gpsBtn?.addEventListener('click', () => {
    if (navigator.geolocation) {
      gpsBtn.innerHTML = '<span>⏳</span> Locating...';
      navigator.geolocation.getCurrentPosition(pos => {
        selectedLat = pos.coords.latitude;
        selectedLon = pos.coords.longitude;
        selectedCity = 'GPS Location';
        if (locationInput) locationInput.value = 'Current GPS Location';
        gpsBtn.innerHTML = '<span>✓</span> Locked';
      }, () => {
        gpsBtn.innerHTML = '<span>⚠️</span> Denied';
      });
    }
  });

  // Language & Unit dropdowns
  if (langSelect) {
    langSelect.value = state.language;
    langSelect.addEventListener('change', () => {
      state.language = langSelect.value;
      applyLanguage(state.language);
    });
  }
  if (unitSelect) {
    unitSelect.value = state.unit;
    unitSelect.addEventListener('change', () => {
      state.unit = unitSelect.value;
    });
  }

  // Top header button to re-open setup gate anytime
  openGateBtn?.addEventListener('click', () => {
    gate?.classList.remove('hidden');
    if (locationInput) locationInput.value = state.currentPlace.name;
  });

  // Close button
  closeBtn?.addEventListener('click', () => {
    gate?.classList.add('hidden');
    setTimeout(() => {
      state.homeMap?.invalidateSize();
      state.map?.invalidateSize();
    }, 200);
  });

  // Launch button
  launchBtn?.addEventListener('click', async () => {
    launchBtn.innerHTML = '<span>⚙️ Calibrating Models...</span>';

    const typedQuery = locationInput?.value.trim();
    if (typedQuery && typedQuery !== selectedCity && typedQuery !== 'Current GPS Location') {
      try {
        const geo = await api.searchGeocode(typedQuery);
        if (geo.results && geo.results[0]) {
          selectedCity = geo.results[0].name;
          selectedLat = geo.results[0].latitude;
          selectedLon = geo.results[0].longitude;
        }
      } catch (err) {
        console.warn('[setup] Geocode lookup note:', err.message);
      }
    }

    state.persona = selectedRole;
    state.currentPlace.name = selectedCity;
    state.currentPlace.latitude = selectedLat;
    state.currentPlace.longitude = selectedLon;

    localStorage.setItem('sih_configured', 'true');
    localStorage.setItem('sih_role', selectedRole);
    localStorage.setItem('sih_city', selectedCity);
    localStorage.setItem('sih_lat', String(selectedLat));
    localStorage.setItem('sih_lon', String(selectedLon));

    updateTopRoleBadge(selectedRole, selectedCity);

    // Sync persona chip in chat feed if it exists
    document.querySelectorAll('.persona-chip').forEach(c => {
      if (c.getAttribute('data-persona') === selectedRole) c.classList.add('active');
      else c.classList.remove('active');
    });

    // Load weather for selected city
    await loadWeather(selectedLat, selectedLon, selectedCity, true);

    // Close gate modal
    gate?.classList.add('hidden');
    launchBtn.innerHTML = '<span>🚀 Launch WeatherGPT Intelligence Console</span>';

    // Invalidate both maps to render tiles immediately
    setTimeout(() => {
      if (state.homeMap) state.homeMap.invalidateSize();
      if (state.map) state.map.invalidateSize();
    }, 250);

    // Welcoming persona greeting in chat
    const personaGreetings = {
      farmer: `🌾 <strong>Agromet Kisan Console Initialized</strong>: Calibrated for <strong>${selectedCity}</strong>. Monitoring 0-10cm topsoil moisture, foliar spray windows, thermal stress, and 7-day precipitation anomalies.`,
      pilot: `✈️ <strong>Aviation Dispatch Initialized</strong>: Calibrated for <strong>${selectedCity}</strong>. METAR/TAF ceiling, density altitude, crosswind vectors, and VFR/IFR flight levels active.`,
      official: `🏛️ <strong>Disaster &amp; Crisis Console Initialized</strong>: Calibrated for <strong>${selectedCity}</strong> basin. CAP common alert protocol, IMD 4-stage color alerts, and evacuation routing monitoring active.`,
      traveller: `🚗 <strong>Logistics &amp; Travel Console Initialized</strong>: Calibrated for <strong>${selectedCity}</strong>. Real-time highway convective road hazards, hydroplaning, and visibility metrics active.`,
      general: `🏙️ <strong>Citizen Hyper-Local Console Initialized</strong>: Calibrated for <strong>${selectedCity}</strong>. Real-time temperatures, umbrella advice, UV index, and AQI active.`
    };
    appendBotMessage(personaGreetings[selectedRole] || personaGreetings.general);
  });

  // Saved Locations Click
  document.querySelectorAll('.loc-item-row').forEach(row => {
    row.addEventListener('click', () => {
      const lat = parseFloat(row.getAttribute('data-lat'));
      const lon = parseFloat(row.getAttribute('data-lon'));
      const name = row.getAttribute('data-name');
      loadWeather(lat, lon, name);
      document.querySelector('.nav-tab-btn[data-tab="tab-home"]')?.click();
    });
  });

  // Add Location
  document.getElementById('addLocationBtn')?.addEventListener('click', () => {
    const loc = prompt('Enter city or district name to monitor:');
    if (loc) {
      api.searchGeocode(loc).then(geo => {
        if (geo.results && geo.results[0]) {
          const item = geo.results[0];
          loadWeather(item.latitude, item.longitude, item.name);
          document.querySelector('.nav-tab-btn[data-tab="tab-home"]')?.click();
        }
      });
    }
  });

  document.getElementById('viewAllAlertsBtn')?.addEventListener('click', () => {
    document.querySelector('[data-prompt*="active IMD disaster alerts"]')?.click();
  });
}

// ── 9. CONVERSATIONAL AI & QUICK ACTION CARDS (Screenshot 1) ──────────
function setupChat() {
  const msgInput = document.getElementById('chatMessageInput');
  const sendBtn = document.getElementById('msgSendBtn');
  const feed = document.getElementById('conversationFeed');
  const actionCards = document.querySelectorAll('.action-card-row');
  const listenLastBtn = document.getElementById('listenLastBtn');

  function renderMarkdown(str) {
    if (!str) return '';
    let out = str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    out = out.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    out = out.replace(/`([^`]+)`/g, '<code style="background:rgba(255,255,255,0.1);padding:2px 5px;border-radius:4px">$1</code>');
    
    const lines = out.split('\n');
    let inList = false;
    let res = [];
    for (const l of lines) {
      const trimmed = l.trim();
      if (trimmed.startsWith('### ')) {
        if (inList) { res.push('</ul>'); inList = false; }
        res.push(`<h4 style="margin:10px 0 4px;color:var(--accent-cyan);font-size:14px">${trimmed.substring(4)}</h4>`);
      } else if (trimmed.startsWith('## ') || trimmed.startsWith('# ')) {
        if (inList) { res.push('</ul>'); inList = false; }
        res.push(`<h3 style="margin:12px 0 6px;color:#fff;font-size:15px">${trimmed.replace(/^#+\s*/, '')}</h3>`);
      } else if (trimmed.startsWith('* ') || trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
        if (!inList) { res.push('<ul style="margin:6px 0;padding-left:18px">'); inList = true; }
        const itemContent = trimmed.replace(/^[\*\-•]\s*/, '');
        res.push(`<li style="margin-bottom:4px">${itemContent}</li>`);
      } else {
        if (inList) { res.push('</ul>'); inList = false; }
        if (trimmed) res.push(`<p style="margin:4px 0">${trimmed}</p>`);
      }
    }
    if (inList) res.push('</ul>');
    return res.join('');
  }
  window.renderMarkdown = renderMarkdown;

  function appendUserMessage(text) {
    if (!feed) return;
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble user';
    bubble.innerHTML = `
      <div class="bubble-avatar-glow">🧑‍💻</div>
      <div class="bubble-content"><p>${escapeHtml(text)}</p></div>
    `;
    feed.appendChild(bubble);
    bubble.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }

  function appendBotMessage(html, rawText = '') {
    if (!feed) return;
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble bot';
    bubble.innerHTML = `
      <div class="bubble-avatar-glow">🌦️</div>
      <div class="bubble-content">
        ${html}
        <button class="listen-bubble-btn" title="Listen with voice"><span>🔊</span> Listen</button>
      </div>
    `;
    bubble.querySelector('.listen-bubble-btn')?.addEventListener('click', () => {
      const textToSpeak = rawText || bubble.querySelector('.bubble-content').textContent.replace('🔊 Listen', '').trim();
      speakText(textToSpeak);
    });
    feed.appendChild(bubble);
    bubble.scrollIntoView({ behavior: 'smooth', block: 'end' });
    return bubble;
  }

  window.appendBotMessage = appendBotMessage;

  const askWeatherGPT = async (promptText) => {
    if (!promptText || !promptText.trim()) return;
    appendUserMessage(promptText);

    // Typing bubble
    const typingBubble = appendBotMessage('<p style="color:var(--accent-cyan)">⚡ WeatherGPT Neural Engine calculating atmospheric response...</p>');

    try {
      const res = await api.askAi(promptText, state.currentWeather, state.language, state.currentPlace.name, state.persona);
      state.lastAiAnswer = res.answer || 'No response available.';

      if (typingBubble) {
        typingBubble.querySelector('.bubble-content').innerHTML = `
          ${renderMarkdown(state.lastAiAnswer)}
          <button class="listen-bubble-btn" title="Listen with voice"><span>🔊</span> Listen</button>
        `;
        typingBubble.querySelector('.listen-bubble-btn')?.addEventListener('click', () => {
          speakText(state.lastAiAnswer);
        });
      }

      // If AI response targeted a different city, automatically update active city and telemetry
      if (res.placeName && res.placeName.toLowerCase() !== state.currentPlace.name.toLowerCase()) {
        api.searchGeocode(res.placeName).then(geo => {
          if (geo.results && geo.results[0]) {
            const item = geo.results[0];
            loadWeather(item.latitude, item.longitude, res.placeName);
          }
        }).catch(() => {});
      }

      // Show audio replay button
      const replayBar = document.getElementById('audioReplayBar');
      if (replayBar) replayBar.style.display = 'block';

      if (state.autoSpeak && state.lastAiAnswer) {
        speakText(state.lastAiAnswer);
      }
    } catch (err) {
      if (typingBubble) {
        typingBubble.querySelector('.bubble-content').innerHTML = `<p style="color:var(--accent-red)">⚠️ WeatherGPT connection error: ${escapeHtml(err.message)}</p>`;
      }
    }
  };

  window.askWeatherGPT = askWeatherGPT;

  // Send button & enter key
  if (sendBtn && msgInput) {
    sendBtn.addEventListener('click', () => {
      const text = msgInput.value;
      msgInput.value = '';
      askWeatherGPT(text);
    });

    msgInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const text = msgInput.value;
        msgInput.value = '';
        askWeatherGPT(text);
      }
    });
  }

  // Quick Action Cards Click Handlers (Crop & Spray, Rain, Travel, Severe)
  actionCards.forEach(card => {
    card.addEventListener('click', () => {
      const prompt = card.getAttribute('data-prompt');
      const persona = card.getAttribute('data-persona');
      if (persona) {
        document.querySelector(`.persona-chip[data-persona="${persona}"]`)?.click();
      }
      askWeatherGPT(prompt);
    });
  });

  // Audio Replay button
  listenLastBtn?.addEventListener('click', () => {
    if (state.lastAiAnswer) speakText(state.lastAiAnswer);
  });
}

// ── 10. NATIVE ANDROID BOTTOM SHEETS ─────────────────────────────────
function setupBottomSheets() {
  const overlay = document.getElementById('sheetOverlay');

  window.openBottomSheet = (sheetId) => {
    const sheet = document.getElementById(sheetId);
    if (!sheet) return;
    overlay?.classList.add('open');
    sheet.classList.add('open');
  };

  window.closeBottomSheet = (sheetId) => {
    const sheet = document.getElementById(sheetId);
    sheet?.classList.remove('open');
    if (!document.querySelector('.android-bottom-sheet.open')) {
      overlay?.classList.remove('open');
    }
  };

  overlay?.addEventListener('click', () => {
    document.querySelectorAll('.android-bottom-sheet.open').forEach(s => s.classList.remove('open'));
    overlay.classList.remove('open');
  });

  document.querySelectorAll('[data-close-sheet]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const sheet = e.target.closest('.android-bottom-sheet');
      if (sheet) closeBottomSheet(sheet.id);
    });
  });

  document.querySelectorAll('[data-sheet]').forEach(el => {
    el.addEventListener('click', () => {
      const sheetId = el.getAttribute('data-sheet');
      openBottomSheet(sheetId);
    });
  });
}

// ── 11. VOICE SPEECH SYNTHESIS & RECOGNITION ─────────────────────────
function setupVoice() {
  const voiceBtn = document.getElementById('msgVoiceBtn');
  const orb = document.getElementById('aiOrbWrapper');
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  const toggleRecording = () => {
    if (!SpeechRecognition) {
      appendBotMessage('🎙️ <strong>Voice Recognition Note</strong>: Web Speech Recognition is natively supported in Chrome on HTTPS or localhost. You can also type your query directly in the message bar below!');
      document.getElementById('chatMessageInput')?.focus();
      return;
    }

    if (!state.recognition) {
      state.recognition = new SpeechRecognition();
      state.recognition.continuous = false;
      state.recognition.interimResults = false;

      state.recognition.onresult = (e) => {
        const transcript = e.results[0][0].transcript;
        const input = document.getElementById('chatMessageInput');
        if (input) input.value = transcript;
        voiceBtn?.classList.remove('recording');
        orb?.classList.remove('listening');
        (window.askWeatherGPT || askWeatherGPT)(transcript);
      };

      state.recognition.onerror = (e) => {
        console.warn('[speech] Recognition error:', e.error);
        voiceBtn?.classList.remove('recording');
        orb?.classList.remove('listening');
        if (e.error === 'not-allowed') {
          appendBotMessage('⚠️ <strong>Microphone Permission Blocked</strong>: Please allow microphone access in your browser site permissions to enable voice queries.');
        }
      };

      state.recognition.onend = () => {
        voiceBtn?.classList.remove('recording');
        orb?.classList.remove('listening');
      };
    }

    try {
      if (voiceBtn?.classList.contains('recording')) {
        state.recognition.stop();
        voiceBtn.classList.remove('recording');
        orb?.classList.remove('listening');
      } else {
        voiceBtn?.classList.add('recording');
        orb?.classList.add('listening');
        state.recognition.lang = getLangCode(state.language);
        state.recognition.start();
      }
    } catch (err) {
      console.warn('[speech] Start recognition notice:', err);
      voiceBtn?.classList.remove('recording');
      orb?.classList.remove('listening');
    }
  };

  voiceBtn?.addEventListener('click', toggleRecording);
  orb?.addEventListener('click', toggleRecording);
}

// ── 11B. CITY PICKER & DYNAMIC LOCATION SWITCHER ────────────────────
function setupCityPicker() {
  const input = document.getElementById('cityPickerInput');
  const searchBtn = document.getElementById('cityPickerSearchBtn');
  const gpsBtn = document.getElementById('cityPickerGpsBtn');
  const resultsBox = document.getElementById('citySearchResults');
  const quickChips = document.querySelectorAll('#quickCityChips .city-chip');

  const doSearch = async () => {
    const q = input?.value.trim();
    if (!q) return;
    try {
      if (resultsBox) {
        resultsBox.style.display = 'flex';
        resultsBox.innerHTML = '<div style="color:var(--text-secondary);font-size:12px;padding:8px">🔍 Searching database & geocoding...</div>';
      }
      const geo = await api.searchGeocode(q);
      if (geo.results && geo.results.length > 0) {
        resultsBox.innerHTML = geo.results.map(item => `
          <div class="city-search-row" data-lat="${item.latitude}" data-lon="${item.longitude}" data-name="${item.name}">
            <span><strong>${item.name}</strong> <small style="color:var(--text-secondary)">${item.admin1 || ''}, ${item.country || ''}</small></span>
            <span style="color:#38bdf8;font-weight:700">Switch →</span>
          </div>
        `).join('');

        resultsBox.querySelectorAll('.city-search-row').forEach(row => {
          row.addEventListener('click', () => {
            const lat = parseFloat(row.getAttribute('data-lat'));
            const lon = parseFloat(row.getAttribute('data-lon'));
            const name = row.getAttribute('data-name');
            loadWeather(lat, lon, name);
            closeBottomSheet('sheet-city-picker');
            appendBotMessage(`📍 **Location Updated**: Switched to **${name}**. Atmospheric parameters and Doppler radar refreshed.`);
          });
        });
      } else {
        if (resultsBox) resultsBox.innerHTML = '<div style="color:var(--accent-red);font-size:12px;padding:8px">No places found. Try another city or district.</div>';
      }
    } catch (err) {
      if (resultsBox) resultsBox.innerHTML = `<div style="color:var(--accent-red);font-size:12px;padding:8px">Search error: ${escapeHtml(err.message)}</div>`;
    }
  };

  searchBtn?.addEventListener('click', doSearch);
  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doSearch();
  });

  // GPS button
  gpsBtn?.addEventListener('click', () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          loadWeather(pos.coords.latitude, pos.coords.longitude, 'Current Location');
          closeBottomSheet('sheet-city-picker');
          appendBotMessage('🎯 **GPS Location Acquired**: Local atmospheric sensors calibrated to your real coordinates.');
        },
        () => {
          alert('GPS permission was denied or unavailable. Please pick a city from the list.');
        }
      );
    }
  });

  // Quick City Chips
  quickChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const city = chip.getAttribute('data-city');
      const lat = parseFloat(chip.getAttribute('data-lat'));
      const lon = parseFloat(chip.getAttribute('data-lon'));
      loadWeather(lat, lon, city);
      closeBottomSheet('sheet-city-picker');
      appendBotMessage(`📍 **Location Switched to ${city}**: Weather telemetry, NWP models, and radar updated.`);
    });
  });
}

function getLangCode(lang) {
  const map = { en: 'en-IN', te: 'te-IN', hi: 'hi-IN', mr: 'mr-IN', kn: 'kn-IN', ta: 'ta-IN' };
  return map[lang] || 'en-IN';
}

function speakText(text) {
  if (!state.speechSynth) return;
  state.speechSynth.cancel();
  const clean = text.replace(/[*#_~`]/g, '');
  const utterance = new SpeechSynthesisUtterance(clean);
  utterance.lang = getLangCode(state.language);
  utterance.rate = 1.0;
  state.speechSynth.speak(utterance);
}

// ── 12. NWP, AVIATION & CLIMATE LOADERS ───────────────────────────────
async function loadNwpData(lat, lon) {
  try {
    const data = await api.getNwpModels(lat, lon);
    if (!data || !data.models) return;

    const setCard = (prefix, m) => {
      if (!m) return;
      const tempEl = document.getElementById(`${prefix}Temp`);
      const rainEl = document.getElementById(`${prefix}Rain`);
      const windEl = document.getElementById(`${prefix}Wind`);
      const rainVal = m.rainProb ?? m.rain_prob ?? 0;
      const windVal = m.windSpeed ?? m.wind_speed ?? 0;
      if (tempEl) tempEl.textContent = formatTemp(m.temp);
      if (rainEl) rainEl.textContent = `🌧️ ${rainVal}%`;
      if (windEl) windEl.textContent = `💨 ${windVal} km/h`;
    };

    setCard('gfs', data.models.gfs);
    setCard('ecmwf', data.models.ecmwf);
    setCard('icon', data.models.icon);
    setCard('wrf', data.models.wrf);

    const scoreEl = document.getElementById('nwpConsensusScore');
    const labelEl = document.getElementById('nwpConsensusLabel');
    const spreadEl = document.getElementById('nwpSpread');
    const recEl = document.getElementById('nwpRecommendation');

    const score = data.consensusScore ?? data.consensus_confidence ?? 88;
    const label = data.consensusLabel ?? data.agreement_level ?? 'HIGH CONSENSUS';
    const spread = data.tempSpreadC ?? data.spread_delta_c ?? '0.8';
    const rec = data.recommendation ?? data.ensemble_recommendation ?? 'Ensemble convergence indicates high predictability.';

    if (scoreEl) scoreEl.textContent = `${score}%`;
    if (labelEl) labelEl.textContent = String(label).toUpperCase();
    if (spreadEl) spreadEl.textContent = `Model Spread: ${spread}°C delta`;
    if (recEl) recEl.textContent = rec;
  } catch (err) {
    console.warn('[nwp] Load note:', err.message);
  }
}

async function loadAviationData(lat, lon, placeName, rwyHeading) {
  try {
    const rwyInput = document.getElementById('rwyHeadingInput');
    const rwy = rwyHeading !== undefined ? rwyHeading : (rwyInput ? parseInt(rwyInput.value, 10) || 90 : 90);
    const data = await api.getAviationBrief(lat, lon, placeName, rwy);
    if (!data) return;

    const placeEl = document.getElementById('avPlaceName');
    const icaoEl = document.getElementById('avIcao');
    const crosswindEl = document.getElementById('avCrosswind');
    const headwindEl = document.getElementById('avHeadwind');
    const qnhEl = document.getElementById('avQnh');
    const ceilingEl = document.getElementById('avCeiling');
    const metarCode = document.getElementById('metarRawCode');
    const densityAlt = document.getElementById('avDensityAlt');
    const turbulence = document.getElementById('avTurbulence');
    const advisoryBox = document.getElementById('avAdvisoryBox');
    const catBadge = document.getElementById('aviationCategoryBadge');

    const station = data.aerodrome || data.station_name || placeName;
    const icao = data.icao || 'VOHS';
    const crosswind = data.crosswindKnots ?? data.crosswind_kt ?? 0;
    const headwind = data.headwindKnots ?? (data.headwind_kt ? `${data.headwind_kt} KT` : '0 KT');
    const qnh = data.qnhHpa ?? data.qnh_hpa ?? 1013;
    const ceiling = data.cloudBaseAgl || (data.ceiling_agl_ft ? `${data.ceiling_agl_ft.toLocaleString()} ft AGL` : '3,500 ft AGL');
    const metar = data.metarRaw || data.metar || `${icao} NOSIG`;
    const density = data.densityAltitudeFeet !== undefined ? `${data.densityAltitudeFeet.toLocaleString()} ft` : (data.density_altitude_ft ? `${data.density_altitude_ft.toLocaleString()} ft` : '1,200 ft');
    const turb = data.turbulenceRisk || data.turbulence_risk || 'LIGHT / NIL';
    const adv = data.operationalAdvisory || data.advisory || 'Aerodrome conditions suitable for flight operations.';
    const cat = data.flightCategory || data.category || 'VFR';

    if (placeEl) placeEl.textContent = station;
    if (icaoEl) icaoEl.textContent = `ICAO: ${icao}`;
    if (crosswindEl) crosswindEl.textContent = typeof crosswind === 'number' ? `${crosswind} KT` : String(crosswind);
    if (headwindEl) headwindEl.textContent = typeof headwind === 'number' ? `${headwind} KT` : String(headwind);
    if (qnhEl) qnhEl.textContent = `${qnh} hPa`;
    if (ceilingEl) ceilingEl.textContent = ceiling;
    if (metarCode) metarCode.textContent = metar;
    if (densityAlt) densityAlt.textContent = density;
    if (turbulence) turbulence.textContent = turb;
    if (advisoryBox) advisoryBox.textContent = adv;

    if (catBadge) {
      catBadge.textContent = cat;
      catBadge.className = 'vfr-badge';
      if (cat === 'VFR') {
        catBadge.style.cssText = 'background:rgba(52,211,153,0.18);border:1px solid var(--accent-green);color:var(--accent-green)';
      } else if (cat === 'MVFR') {
        catBadge.style.cssText = 'background:rgba(56,189,248,0.18);border:1px solid var(--accent-cyan);color:var(--accent-cyan)';
      } else {
        catBadge.style.cssText = 'background:rgba(248,113,113,0.18);border:1px solid var(--accent-red);color:var(--accent-red)';
      }
    }
  } catch (err) {
    console.warn('[aviation] Load note:', err.message);
  }
}

let lastClimateData = null;
async function loadClimateData(lat, lon, placeName) {
  try {
    const data = await api.getClimateAnalytics(lat, lon, placeName);
    if (!data) return;
    lastClimateData = data;

    const warmingVal = document.getElementById('climateWarmingVal');
    const monsoonVal = document.getElementById('climateMonsoonVal');
    const heatwaveVal = document.getElementById('climateHeatwaveVal');
    const tableContainer = document.getElementById('decadalTrendsTable');
    const researchSummary = document.getElementById('climateResearchSummary');

    const warming = data.netTemperatureWarming || (data.metrics?.net_warming_anomaly_c ? `+${data.metrics.net_warming_anomaly_c}°C` : '+1.35°C');
    const monsoon = data.monsoonAnalysis?.deviationPct || (data.metrics?.monsoon_rainfall_deviation_pct ? `${data.metrics.monsoon_rainfall_deviation_pct}%` : '+5.0%');
    const heatwave = data.extremeEventsTrend?.[0]?.currentAvg || (data.metrics?.heatwave_days_per_year ? `${data.metrics.heatwave_days_per_year} d/yr` : '24 days/yr');
    const summary = data.researchSummary || data.research_summary || 'Regional climatological assessment indicates steady surface warming.';

    if (warmingVal) warmingVal.textContent = warming;
    if (monsoonVal) monsoonVal.textContent = monsoon;
    if (heatwaveVal) heatwaveVal.textContent = heatwave;
    if (researchSummary) researchSummary.textContent = summary;

    const decadalRows = (data.decadalTrends || data.decadal_analysis || []).map(r => ({
      epoch_period: r.decade || r.epoch_period,
      mean_temp_c: r.meanTempC ?? r.mean_temp_c,
      temp_anomaly_c: r.anomalyC ?? r.temp_anomaly_c,
      monsoon_rainfall_mm: r.annualRainMm ?? r.monsoon_rainfall_mm,
      heatwave_days: r.heatwaveDays ?? r.heatwave_days
    }));

    if (tableContainer && decadalRows.length > 0) {
      let html = `<table class="decadal-table">
        <thead>
          <tr>
            <th>Decade</th>
            <th>Mean °C</th>
            <th>Anomaly</th>
            <th>Rain</th>
            <th>Heat d</th>
          </tr>
        </thead>
        <tbody>`;
      decadalRows.forEach(row => {
        const sign = String(row.temp_anomaly_c).startsWith('+') || Number(row.temp_anomaly_c) >= 0 ? '+' : '';
        const aClass = String(row.temp_anomaly_c).includes('+') || Number(row.temp_anomaly_c) >= 0 ? 'anomaly-pos' : 'anomaly-neg';
        const displayAnomaly = String(row.temp_anomaly_c).startsWith('+') ? row.temp_anomaly_c : `${sign}${row.temp_anomaly_c}`;
        html += `<tr>
          <td><b>${row.epoch_period}</b></td>
          <td>${row.mean_temp_c}°C</td>
          <td class="${aClass}">${displayAnomaly}°C</td>
          <td>${row.monsoon_rainfall_mm}mm</td>
          <td>${row.heatwave_days}</td>
        </tr>`;
      });
      html += `</tbody></table>`;
      tableContainer.innerHTML = html;
    }
  } catch (err) {
    console.warn('[climate] Load note:', err.message);
  }
}

function setupAviationAndClimateListeners() {
  document.getElementById('calcRwyBtn')?.addEventListener('click', () => {
    const rwyInput = document.getElementById('rwyHeadingInput');
    const rwy = parseInt(rwyInput?.value, 10) || 90;
    loadAviationData(state.currentPlace.latitude, state.currentPlace.longitude, state.currentPlace.name, rwy);
  });

  document.getElementById('copyMetarBtn')?.addEventListener('click', () => {
    const raw = document.getElementById('metarRawCode')?.textContent;
    if (raw) {
      navigator.clipboard.writeText(raw).then(() => {
        const btn = document.getElementById('copyMetarBtn');
        if (btn) {
          btn.textContent = '✓ Copied';
          setTimeout(() => { btn.textContent = 'Copy'; }, 1800);
        }
      });
    }
  });

  document.getElementById('exportClimateBtn')?.addEventListener('click', () => {
    if (!lastClimateData) return;
    const decadalRows = (lastClimateData.decadalTrends || lastClimateData.decadal_analysis || []).map(r => ({
      epoch_period: r.decade || r.epoch_period,
      mean_temp_c: r.meanTempC ?? r.mean_temp_c,
      temp_anomaly_c: r.anomalyC ?? r.temp_anomaly_c,
      monsoon_rainfall_mm: r.annualRainMm ?? r.monsoon_rainfall_mm,
      heatwave_days: r.heatwaveDays ?? r.heatwave_days
    }));

    if (decadalRows.length === 0) return;

    const rows = [
      ['Epoch Decade', 'Mean Temp (C)', 'Thermal Anomaly (C)', 'Monsoon Rainfall (mm)', 'Heatwave Days/Yr'],
      ...decadalRows.map(r => [
        r.epoch_period, r.mean_temp_c, r.temp_anomaly_c, r.monsoon_rainfall_mm, r.heatwave_days
      ])
    ];
    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `WeatherGPT_Climate_${state.currentPlace.name}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });
}

// ── 13. SETTINGS & APP PREFERENCES ───────────────────────────────────
function setupSettings() {
  const unitSelect = document.getElementById('unitSelect');
  const langSelect = document.getElementById('langSelect');
  const autoCheck = document.getElementById('autoSpeakCheck');
  const aiKeyInput = document.getElementById('aiKeyInput');
  const saveAiKeyBtn = document.getElementById('saveAiKeyBtn');

  unitSelect?.addEventListener('change', async (e) => {
    state.unit = e.target.value;
    if (state.currentWeather) {
      renderHomeGlance(state.currentWeather, state.currentPlace.name);
      renderRadarTelemetry(state.currentWeather, state.currentPlace.name);
      renderExtendedForecast(state.currentWeather);
    }
    try { await api.updateSettings({ temperature_unit: state.unit }); } catch {}
  });

  langSelect?.addEventListener('change', async (e) => {
    state.language = e.target.value;
    applyLanguage(state.language);
    try { await api.updateSettings({ language: state.language }); } catch {}
  });

  autoCheck?.addEventListener('change', async (e) => {
    state.autoSpeak = e.target.checked;
    try { await api.updateSettings({ auto_speak: state.autoSpeak }); } catch {}
  });

  saveAiKeyBtn?.addEventListener('click', async () => {
    const key = aiKeyInput?.value.trim();
    if (!key) return;
    saveAiKeyBtn.textContent = 'Saving...';
    try {
      await api.updateSettings({ ai_api_key: key });
      saveAiKeyBtn.textContent = '✓ Saved';
      const keyStatus = document.getElementById('aiKeyStatus');
      if (keyStatus) keyStatus.textContent = 'Active (WeatherGPT Neural Engine v2.5)';
      if (aiKeyInput) aiKeyInput.value = '';
      setTimeout(() => { saveAiKeyBtn.textContent = 'Save Key'; }, 2000);
    } catch (err) {
      alert('Failed to save key: ' + err.message);
      saveAiKeyBtn.textContent = 'Save Key';
    }
  });
}

function setupTravelPlanner() {
  const btn = document.getElementById('travelPlanBtn');
  const output = document.getElementById('travelOutput');
  btn?.addEventListener('click', async () => {
    const from = document.getElementById('travelFrom')?.value || 'Hyderabad';
    const to = document.getElementById('travelTo')?.value || 'Mumbai';
    if (output) output.innerHTML = `<p style="color:var(--accent-cyan);margin:0">⚡ Analyzing atmospheric road hazards between <strong>${escapeHtml(from)}</strong> and <strong>${escapeHtml(to)}</strong>...</p>`;

    const prompt = `Evaluate highway road travel weather hazards, rain intervals, fog, and safe driving windows from ${from} to ${to}.`;
    try {
      const res = await api.askAi(prompt, state.currentWeather, state.language, from, 'traveller');
      if (output) {
        output.innerHTML = typeof renderMarkdown === 'function' ? renderMarkdown(res.answer || 'Route analysis completed.') : (res.answer || 'Route analysis completed.');
      }
    } catch (err) {
      if (output) output.innerHTML = `<p style="color:var(--accent-red);margin:0">⚠️ Analysis error: ${escapeHtml(err.message)}</p>`;
    }
  });
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.warn('[pwa] SW registration note:', err.message);
    });
  }
}

function escapeHtml(text) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(text).replace(/[&<>"']/g, m => map[m]);
}
