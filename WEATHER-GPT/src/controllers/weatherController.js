import { getWeatherWithRisk } from '../services/weatherService.js';
import { searchLocations } from '../services/geocodeService.js';

export async function getWeather(req, res, parsedUrl) {
  const lat = parsedUrl.searchParams.get('lat');
  const lon = parsedUrl.searchParams.get('lon');
  const refresh = parsedUrl.searchParams.get('refresh') === 'true';

  if (!lat || !lon) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Missing required lat and lon query parameters.' }));
    return;
  }

  try {
    const data = await getWeatherWithRisk(lat, lon, refresh);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message || 'Failed to fetch weather data.' }));
  }
}

export async function searchGeocode(req, res, parsedUrl) {
  const q = parsedUrl.searchParams.get('q') || '';
  try {
    const results = await searchLocations(q);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ results }));
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message || 'Geocoding search failed.' }));
  }
}

export async function getRadarFrames(req, res) {
  try {
    const response = await fetch('https://api.rainviewer.com/public/weather-maps.json', { signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error('RainViewer API returned ' + response.status);
    const data = await response.json();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  } catch (err) {
    // Graceful fallback with static rainviewer structure
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      version: 'v2',
      host: 'https://tilecache.rainviewer.com',
      radar: {
        past: [{ time: Math.floor(Date.now() / 1000) - 600, path: '/v2/radar/' + (Math.floor(Date.now() / 1000) - 600) + '/256' }],
        nowcast: []
      }
    }));
  }
}

export async function getNwpModels(req, res, parsedUrl) {
  const lat = parsedUrl.searchParams.get('lat') || '17.385';
  const lon = parsedUrl.searchParams.get('lon') || '78.486';
  try {
    const { getNwpMultiModelComparison } = await import('../services/nwpService.js');
    const data = await getNwpMultiModelComparison(lat, lon);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message || 'Failed to retrieve NWP model comparison.' }));
  }
}

export async function getAviation(req, res, parsedUrl) {
  const lat = parsedUrl.searchParams.get('lat') || '17.385';
  const lon = parsedUrl.searchParams.get('lon') || '78.486';
  const city = parsedUrl.searchParams.get('city') || 'Hyderabad';
  const rwy = parseInt(parsedUrl.searchParams.get('rwy') || '90', 10);
  try {
    const { getAviationBriefing } = await import('../services/aviationService.js');
    const weather = await getWeatherWithRisk(lat, lon);
    const data = getAviationBriefing({ weather, placeName: city, runwayHeading: rwy });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message || 'Failed to generate aviation briefing.' }));
  }
}

export async function getClimate(req, res, parsedUrl) {
  const lat = parsedUrl.searchParams.get('lat') || '17.385';
  const lon = parsedUrl.searchParams.get('lon') || '78.486';
  const city = parsedUrl.searchParams.get('city') || 'Region';
  try {
    const { getClimateHistoricalAnalytics } = await import('../services/climateService.js');
    const data = getClimateHistoricalAnalytics(lat, lon, city);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message || 'Failed to retrieve climate analytics.' }));
  }
}
