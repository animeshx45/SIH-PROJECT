import { logSearch } from '../database/db.js';
import { getCache, setCache } from './redisService.js';

const POPULAR_INDIAN_CITIES = [
  { name: 'Hyderabad', admin1: 'Telangana', country: 'India', latitude: 17.3850, longitude: 78.4867, aliases: ['hyderabad', 'hyd'] },
  { name: 'Delhi', admin1: 'Delhi', country: 'India', latitude: 28.6139, longitude: 77.2090, aliases: ['delhi', 'new delhi', 'ncr'] },
  { name: 'Mumbai', admin1: 'Maharashtra', country: 'India', latitude: 19.0760, longitude: 72.8777, aliases: ['mumbai', 'bombay'] },
  { name: 'Bengaluru', admin1: 'Karnataka', country: 'India', latitude: 12.9716, longitude: 77.5946, aliases: ['bengaluru', 'bangalore', 'blr'] },
  { name: 'Chennai', admin1: 'Tamil Nadu', country: 'India', latitude: 13.0827, longitude: 80.2707, aliases: ['chennai', 'madras'] },
  { name: 'Kolkata', admin1: 'West Bengal', country: 'India', latitude: 22.5726, longitude: 88.3639, aliases: ['kolkata', 'calcutta'] },
  { name: 'Pune', admin1: 'Maharashtra', country: 'India', latitude: 18.5204, longitude: 73.8567, aliases: ['pune', 'poona'] },
  { name: 'Ahmedabad', admin1: 'Gujarat', country: 'India', latitude: 23.0225, longitude: 72.5714, aliases: ['ahmedabad', 'amdavad'] },
  { name: 'Jaipur', admin1: 'Rajasthan', country: 'India', latitude: 26.9124, longitude: 75.7873, aliases: ['jaipur'] },
  { name: 'Lucknow', admin1: 'Uttar Pradesh', country: 'India', latitude: 26.8467, longitude: 80.9462, aliases: ['lucknow'] },
  { name: 'Visakhapatnam', admin1: 'Andhra Pradesh', country: 'India', latitude: 17.6868, longitude: 83.2185, aliases: ['visakhapatnam', 'vizag'] },
  { name: 'Vijayawada', admin1: 'Andhra Pradesh', country: 'India', latitude: 16.5062, longitude: 80.6480, aliases: ['vijayawada', 'bezawada'] },
  { name: 'Warangal', admin1: 'Telangana', country: 'India', latitude: 17.9689, longitude: 79.5941, aliases: ['warangal'] },
  { name: 'Chandigarh', admin1: 'Chandigarh', country: 'India', latitude: 30.7333, longitude: 76.7794, aliases: ['chandigarh'] },
  { name: 'Bhopal', admin1: 'Madhya Pradesh', country: 'India', latitude: 23.2599, longitude: 77.4126, aliases: ['bhopal'] },
  { name: 'Patna', admin1: 'Bihar', country: 'India', latitude: 25.5941, longitude: 85.1376, aliases: ['patna'] },
  { name: 'Kochi', admin1: 'Kerala', country: 'India', latitude: 9.9312, longitude: 76.2673, aliases: ['kochi', 'cochin'] },
  { name: 'Surat', admin1: 'Gujarat', country: 'India', latitude: 21.1702, longitude: 72.8311, aliases: ['surat'] },
  { name: 'Nagpur', admin1: 'Maharashtra', country: 'India', latitude: 21.1458, longitude: 79.0882, aliases: ['nagpur'] },
  { name: 'Indore', admin1: 'Madhya Pradesh', country: 'India', latitude: 22.7196, longitude: 75.8577, aliases: ['indore'] },
  { name: 'Shimla', admin1: 'Himachal Pradesh', country: 'India', latitude: 31.1048, longitude: 77.1734, aliases: ['shimla'] },
  { name: 'Srinagar', admin1: 'Jammu and Kashmir', country: 'India', latitude: 34.0837, longitude: 74.7973, aliases: ['srinagar'] },
  { name: 'Goa', admin1: 'Goa', country: 'India', latitude: 15.2993, longitude: 74.1240, aliases: ['goa', 'panaji', 'panjim'] },
  { name: 'Agra', admin1: 'Uttar Pradesh', country: 'India', latitude: 27.1767, longitude: 78.0081, aliases: ['agra'] },
  { name: 'Varanasi', admin1: 'Uttar Pradesh', country: 'India', latitude: 25.3176, longitude: 82.9739, aliases: ['varanasi', 'banaras', 'kashi'] },
  { name: 'Kanpur', admin1: 'Uttar Pradesh', country: 'India', latitude: 26.4499, longitude: 80.3319, aliases: ['kanpur'] },
  { name: 'Amritsar', admin1: 'Punjab', country: 'India', latitude: 31.6340, longitude: 74.8723, aliases: ['amritsar'] },
  { name: 'Guwahati', admin1: 'Assam', country: 'India', latitude: 26.1445, longitude: 91.7362, aliases: ['guwahati'] },
  { name: 'Coimbatore', admin1: 'Tamil Nadu', country: 'India', latitude: 11.0168, longitude: 76.9558, aliases: ['coimbatore'] },
  { name: 'Dehradun', admin1: 'Uttarakhand', country: 'India', latitude: 30.3165, longitude: 78.0322, aliases: ['dehradun'] },
  { name: 'Bhubaneswar', admin1: 'Odisha', country: 'India', latitude: 20.2961, longitude: 85.8245, aliases: ['bhubaneswar'] },
  { name: 'Ranchi', admin1: 'Jharkhand', country: 'India', latitude: 23.3441, longitude: 85.3096, aliases: ['ranchi'] },
  { name: 'Raipur', admin1: 'Chhattisgarh', country: 'India', latitude: 21.2514, longitude: 81.6296, aliases: ['raipur'] },
  { name: 'Thiruvananthapuram', admin1: 'Kerala', country: 'India', latitude: 8.5241, longitude: 76.9366, aliases: ['thiruvananthapuram', 'trivandrum'] },
  { name: 'London', admin1: 'England', country: 'United Kingdom', latitude: 51.5074, longitude: -0.1278, aliases: ['london'] },
  { name: 'Dubai', admin1: 'Dubai', country: 'United Arab Emirates', latitude: 25.2048, longitude: 55.2708, aliases: ['dubai'] },
  { name: 'Singapore', admin1: 'Singapore', country: 'Singapore', latitude: 1.3521, longitude: 103.8198, aliases: ['singapore'] },
  { name: 'New York', admin1: 'New York', country: 'United States', latitude: 40.7128, longitude: -74.0060, aliases: ['new york', 'nyc'] },
  { name: 'Tokyo', admin1: 'Tokyo', country: 'Japan', latitude: 35.6762, longitude: 139.6503, aliases: ['tokyo'] },
  { name: 'Paris', admin1: 'Île-de-France', country: 'France', latitude: 48.8566, longitude: 2.3522, aliases: ['paris'] }
];

export async function searchLocations(query) {
  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    return POPULAR_INDIAN_CITIES.slice(0, 5).map(c => ({
      ...c,
      label: `${c.name}, ${c.admin1}, ${c.country}`
    }));
  }

  const cleanQuery = query.trim().toLowerCase();
  const redisKey = `geocode:${cleanQuery}`;

  // Check Redis cache
  const cachedGeocode = await getCache(redisKey);
  if (cachedGeocode && Array.isArray(cachedGeocode) && cachedGeocode.length > 0) {
    return cachedGeocode;
  }

  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cleanQuery)}&count=8&language=en&format=json`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.results) && data.results.length > 0) {
        const results = data.results.map(item => ({
          name: item.name,
          admin1: item.admin1 || '',
          country: item.country || 'India',
          latitude: item.latitude,
          longitude: item.longitude,
          label: `${item.name}${item.admin1 ? ', ' + item.admin1 : ''}, ${item.country || ''}`
        }));

        if (results[0]) {
          logSearch(cleanQuery, results[0].label, results[0].latitude, results[0].longitude);
        }

        // Cache in Redis for 24 hours (86400 seconds)
        await setCache(redisKey, results, 86400);

        return results;
      }
    }
  } catch (err) {
    console.warn('[geocode] Open-Meteo search error:', err.message);
  }

  // Fallback matching from local cities list with alias support
  const matches = POPULAR_INDIAN_CITIES.filter(c => 
    c.name.toLowerCase().includes(cleanQuery) ||
    c.admin1.toLowerCase().includes(cleanQuery) ||
    (c.aliases && c.aliases.some(a => cleanQuery.includes(a) || a.includes(cleanQuery)))
  ).map(c => ({
    name: c.name,
    admin1: c.admin1,
    country: c.country,
    latitude: c.latitude,
    longitude: c.longitude,
    label: `${c.name}, ${c.admin1}, ${c.country}`
  }));

  return matches.length > 0 ? matches : POPULAR_INDIAN_CITIES.slice(0, 3).map(c => ({
    ...c,
    label: `${c.name}, ${c.admin1}, ${c.country}`
  }));
}
