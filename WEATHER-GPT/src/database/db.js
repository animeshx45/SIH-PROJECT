import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import config from '../config/env.js';

let dbInstance = null;
let useMemoryFallback = false;

const memoryStore = {
  settings: { id: 1, temperature_unit: 'c', language: 'en', auto_speak: 0, gemini_api_key: '' },
  favorites: [
    { id: 1, name: 'Hyderabad', admin1: 'Telangana', country: 'India', latitude: 17.3850, longitude: 78.4867, custom_label: 'Home Base' },
    { id: 2, name: 'Delhi', admin1: 'Delhi', country: 'India', latitude: 28.6139, longitude: 77.2090, custom_label: 'Capital' },
    { id: 3, name: 'Mumbai', admin1: 'Maharashtra', country: 'India', latitude: 19.0760, longitude: 72.8777, custom_label: 'West Hub' },
    { id: 4, name: 'Bengaluru', admin1: 'Karnataka', country: 'India', latitude: 12.9716, longitude: 77.5946, custom_label: 'South Tech' },
    { id: 5, name: 'Chennai', admin1: 'Tamil Nadu', country: 'India', latitude: 13.0827, longitude: 80.2707, custom_label: 'Coastal Hub' }
  ],
  weatherCache: new Map(),
  aiLogs: [],
  searchHistory: []
};

export function getDatabase() {
  if (dbInstance) return dbInstance;
  if (useMemoryFallback) return null;

  try {
    const dbPath = config.database.path;
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    console.log(`[db] Initializing SQLite database at: ${dbPath}`);
    dbInstance = new DatabaseSync(dbPath);

    // Performance & Concurrency Pragmas
    try {
      dbInstance.exec(`
        PRAGMA journal_mode = WAL;
        PRAGMA synchronous = NORMAL;
        PRAGMA foreign_keys = ON;
        PRAGMA busy_timeout = 5000;
      `);
    } catch (_) {}

    // Run schema migration
    const schemaPath = path.join(config.rootDir, 'src/database/schema.sql');
    if (fs.existsSync(schemaPath)) {
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      dbInstance.exec(schemaSql);
    }

    return dbInstance;
  } catch (err) {
    console.warn('[db] SQLite initialization notice (using in-memory fallback):', err.message);
    useMemoryFallback = true;
    return null;
  }
}

// User Settings
export function getSettings() {
  const db = getDatabase();
  if (!db) return memoryStore.settings;
  try {
    const stmt = db.prepare('SELECT * FROM user_settings WHERE id = 1');
    return stmt.get() || memoryStore.settings;
  } catch (err) {
    return memoryStore.settings;
  }
}

export function updateSettings(updates = {}) {
  const db = getDatabase();
  const current = getSettings();
  const unit = updates.temperature_unit ?? current.temperature_unit;
  const lang = updates.language ?? current.language;
  const speak = updates.auto_speak !== undefined ? (updates.auto_speak ? 1 : 0) : current.auto_speak;
  const key = updates.gemini_api_key !== undefined ? updates.gemini_api_key : current.gemini_api_key;

  memoryStore.settings = { ...current, temperature_unit: unit, language: lang, auto_speak: speak, gemini_api_key: key };

  if (db) {
    try {
      const stmt = db.prepare(`
        UPDATE user_settings 
        SET temperature_unit = ?, language = ?, auto_speak = ?, gemini_api_key = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = 1
      `);
      stmt.run(unit, lang, speak, key);
    } catch (err) {
      console.warn('[db] updateSettings warning:', err.message);
    }
  }
  return memoryStore.settings;
}

// Favorites Management
export function getFavoritePlaces() {
  const db = getDatabase();
  if (!db) return memoryStore.favorites;
  try {
    const stmt = db.prepare('SELECT * FROM favorite_places ORDER BY id ASC');
    return stmt.all();
  } catch {
    return memoryStore.favorites;
  }
}

export function addFavoritePlace({ name, admin1, country, latitude, longitude, custom_label }) {
  const db = getDatabase();
  if (db) {
    try {
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO favorite_places (name, admin1, country, latitude, longitude, custom_label)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      stmt.run(name, admin1 || '', country || 'India', latitude, longitude, custom_label || '');
      return getFavoritePlaces();
    } catch (err) {
      console.warn('[db] addFavoritePlace warning:', err.message);
    }
  }

  const newFav = {
    id: Date.now(),
    name,
    admin1: admin1 || '',
    country: country || 'India',
    latitude: parseFloat(latitude),
    longitude: parseFloat(longitude),
    custom_label: custom_label || ''
  };
  memoryStore.favorites.push(newFav);
  return memoryStore.favorites;
}

export function removeFavoritePlace(id) {
  const db = getDatabase();
  if (db) {
    try {
      const stmt = db.prepare('DELETE FROM favorite_places WHERE id = ?');
      stmt.run(id);
      return getFavoritePlaces();
    } catch (err) {
      console.warn('[db] removeFavoritePlace warning:', err.message);
    }
  }
  memoryStore.favorites = memoryStore.favorites.filter(f => f.id !== id);
  return memoryStore.favorites;
}

// 15-Minute Weather Caching
export function getCachedWeather(latitude, longitude) {
  const key = `${latitude.toFixed(2)},${longitude.toFixed(2)}`;
  const db = getDatabase();
  if (db) {
    try {
      const stmt = db.prepare('SELECT payload, expires_at FROM weather_cache WHERE cache_key = ?');
      const row = stmt.get(key);
      if (row && Date.now() < row.expires_at) {
        try {
          return JSON.parse(row.payload);
        } catch {
          return null;
        }
      }
    } catch (_) {}
  }

  const mem = memoryStore.weatherCache.get(key);
  if (mem && Date.now() < mem.expires_at) {
    return mem.data;
  }
  return null;
}

export function setCachedWeather(latitude, longitude, data, ttlSeconds = 900) {
  const key = `${latitude.toFixed(2)},${longitude.toFixed(2)}`;
  const now = Date.now();
  const expiresAt = now + (ttlSeconds * 1000);
  memoryStore.weatherCache.set(key, { data, expires_at: expiresAt });

  const db = getDatabase();
  if (db) {
    try {
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO weather_cache (cache_key, latitude, longitude, payload, cached_at, expires_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      stmt.run(key, latitude, longitude, JSON.stringify(data), now, expiresAt);
    } catch (_) {}
  }
}

// Audit Logs
export function logAiConversation(prompt, response, language, latitude, longitude) {
  const db = getDatabase();
  if (db) {
    try {
      const stmt = db.prepare(`
        INSERT INTO ai_conversations (prompt, response, language, latitude, longitude)
        VALUES (?, ?, ?, ?, ?)
      `);
      stmt.run(prompt, response, language, latitude || null, longitude || null);
    } catch (_) {}
  }
}

export function logSearch(query, resolved_name, latitude, longitude) {
  const db = getDatabase();
  if (db) {
    try {
      const stmt = db.prepare(`
        INSERT INTO search_history (query, resolved_name, latitude, longitude)
        VALUES (?, ?, ?, ?)
      `);
      stmt.run(query, resolved_name, latitude, longitude);
    } catch (_) {}
  }
}
