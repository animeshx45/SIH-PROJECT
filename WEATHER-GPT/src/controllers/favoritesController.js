import { getFavoritePlaces, addFavoritePlace, removeFavoritePlace } from '../database/db.js';

async function parseBody(req) {
  if (req.body) {
    if (typeof req.body === 'object') return req.body;
    try { return JSON.parse(req.body); } catch (_) { return {}; }
  }
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch (err) { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

export async function getFavorites(req, res) {
  try {
    const list = getFavoritePlaces();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ favorites: list }));
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
}

export async function addFavorite(req, res) {
  try {
    const body = await parseBody(req);
    const { name, admin1, country, latitude, longitude, custom_label } = body;

    if (!name || latitude === undefined || longitude === undefined) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Name, latitude, and longitude are required.' }));
      return;
    }

    const updated = addFavoritePlace({
      name,
      admin1,
      country,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      custom_label
    });

    res.writeHead(201, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ favorites: updated }));
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
}

export async function deleteFavorite(req, res, pathname) {
  try {
    const parts = pathname.split('/');
    const id = parseInt(parts[parts.length - 1], 10);

    if (isNaN(id)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid favorite id.' }));
      return;
    }

    const updated = removeFavoritePlace(id);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ favorites: updated }));
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
}
