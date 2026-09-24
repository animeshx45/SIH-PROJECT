import { MongoClient } from 'mongodb';
import config from '../config/env.js';
import * as sqliteDb from './db.js';

let client = null;
let db = null;
let isConnected = false;

export async function initMongo() {
  const uri = (config.mongodb?.uri || '').trim();
  if (!uri) {
    console.log('[mongodb] No MONGODB_URI configured. Running with embedded persistence fallback.');
    return false;
  }

  try {
    console.log(`[mongodb] Connecting to MongoDB Atlas: ${uri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}...`);
    client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 4000,
      connectTimeoutMS: 4000,
    });

    await client.connect();
    db = client.db(config.mongodb.dbName || 'weatherspt');
    isConnected = true;
    console.log(`[mongodb] Connected successfully to MongoDB Atlas database: "${config.mongodb.dbName || 'weatherspt'}"`);

    // Ensure GeoJSON 2dsphere and TTL Indexes
    try {
      await db.collection('weather_cache').createIndex({ location: '2dsphere' });
      await db.collection('weather_cache').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
      await db.collection('climate_history').createIndex({ location: '2dsphere', recordedAt: -1 });
      await db.collection('ai_conversations').createIndex({ createdAt: -1 });
      await db.collection('favorite_places').createIndex({ location: '2dsphere' });
      console.log('[mongodb] GeoJSON 2dsphere and TTL indexes verified.');
    } catch (idxErr) {
      console.warn('[mongodb] Index creation warning:', idxErr.message);
    }

    return true;
  } catch (err) {
    if (client) {
      try { await client.close(); } catch (_) {}
      client = null;
    }
    console.warn('[mongodb] Connection failed, using SQLite fallback engine:', err.message);
    isConnected = false;
    return false;
  }
}

export function isMongoConnected() {
  return isConnected && db !== null;
}

// Weather Cache (GeoJSON + TTL)
export async function getCachedWeather(lat, lon) {
  if (isMongoConnected()) {
    try {
      const doc = await db.collection('weather_cache').findOne({
        location: {
          $near: {
            $geometry: { type: 'Point', coordinates: [lon, lat] },
            $maxDistance: 5000 // 5 km radius
          }
        },
        expiresAt: { $gt: new Date() }
      });
      if (doc && doc.payload) {
        return typeof doc.payload === 'string' ? JSON.parse(doc.payload) : doc.payload;
      }
    } catch (e) {
      console.warn('[mongodb] Cache lookup fallback:', e.message);
    }
  }
  return sqliteDb.getCachedWeather(lat, lon);
}

export async function setCachedWeather(lat, lon, payload, ttlSeconds = 900) {
  if (isMongoConnected()) {
    try {
      const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
      await db.collection('weather_cache').updateOne(
        {
          location: {
            $near: {
              $geometry: { type: 'Point', coordinates: [lon, lat] },
              $maxDistance: 3000
            }
          }
        },
        {
          $set: {
            location: { type: 'Point', coordinates: [lon, lat] },
            payload,
            updatedAt: new Date(),
            expiresAt
          }
        },
        { upsert: true }
      );
      return;
    } catch (e) {
      console.warn('[mongodb] Cache save fallback:', e.message);
    }
  }
  return sqliteDb.setCachedWeather(lat, lon, payload, ttlSeconds);
}

// Climate History (30 Days)
export async function getClimateHistory(lat, lon) {
  if (isMongoConnected()) {
    try {
      const record = await db.collection('climate_history').findOne({
        location: {
          $near: {
            $geometry: { type: 'Point', coordinates: [lon, lat] },
            $maxDistance: 15000 // 15 km radius
          }
        }
      }, { sort: { recordedAt: -1 } });

      if (record && record.days && record.days.length > 0) {
        return record;
      }
    } catch (e) {
      console.warn('[mongodb] Climate history lookup error:', e.message);
    }
  }
  return null;
}

export async function saveClimateHistory(lat, lon, climateData) {
  if (isMongoConnected()) {
    try {
      await db.collection('climate_history').updateOne(
        {
          location: {
            $near: {
              $geometry: { type: 'Point', coordinates: [lon, lat] },
              $maxDistance: 10000
            }
          }
        },
        {
          $set: {
            location: { type: 'Point', coordinates: [lon, lat] },
            ...climateData,
            recordedAt: new Date()
          }
        },
        { upsert: true }
      );
    } catch (e) {
      console.warn('[mongodb] Climate history save error:', e.message);
    }
  }
}

// AI Conversations
export async function logAiConversation(prompt, response, language, persona, lat, lon) {
  if (isMongoConnected()) {
    try {
      await db.collection('ai_conversations').insertOne({
        prompt,
        response,
        language: language || 'en',
        persona: persona || 'general',
        location: (lat && lon) ? { type: 'Point', coordinates: [lon, lat] } : null,
        createdAt: new Date()
      });
      return;
    } catch (e) {
      console.warn('[mongodb] AI log fallback:', e.message);
    }
  }
  return sqliteDb.logAiConversation(prompt, response, language, lat, lon);
}

// Favorites Management
export async function getFavorites() {
  if (isMongoConnected()) {
    try {
      const docs = await db.collection('favorite_places').find().toArray();
      if (docs && docs.length > 0) {
        return docs.map(d => ({
          id: d._id.toString(),
          name: d.name,
          admin1: d.admin1 || '',
          country: d.country || 'India',
          latitude: d.location?.coordinates?.[1] || d.latitude,
          longitude: d.location?.coordinates?.[0] || d.longitude,
          custom_label: d.custom_label || ''
        }));
      }
    } catch (e) {
      console.warn('[mongodb] Favorites get error:', e.message);
    }
  }
  return sqliteDb.getFavorites();
}

export async function addFavorite(place) {
  const lat = parseFloat(place.latitude);
  const lon = parseFloat(place.longitude);

  if (isMongoConnected()) {
    try {
      const res = await db.collection('favorite_places').updateOne(
        { name: place.name },
        {
          $set: {
            name: place.name,
            admin1: place.admin1 || '',
            country: place.country || 'India',
            location: { type: 'Point', coordinates: [lon, lat] },
            custom_label: place.custom_label || '',
            updatedAt: new Date()
          }
        },
        { upsert: true }
      );
      return { id: res.upsertedId || place.name, ...place };
    } catch (e) {
      console.warn('[mongodb] Favorite add error:', e.message);
    }
  }
  return sqliteDb.addFavorite(place);
}

// Notification & Alert Preferences
export async function getAlertPreferences() {
  if (isMongoConnected()) {
    try {
      const prefs = await db.collection('user_preferences').findOne({ key: 'alert_preferences' });
      if (prefs) return prefs.data;
    } catch (e) {
      console.warn('[mongodb] Alert preferences get error:', e.message);
    }
  }
  return {
    cycloneAlerts: true,
    heavyRainAlerts: true,
    aqiWarningAlerts: true,
    extremeHeatAlerts: true,
    dailyMorningBrief: true,
    briefTime: '07:00'
  };
}

export async function updateAlertPreferences(prefs) {
  if (isMongoConnected()) {
    try {
      await db.collection('user_preferences').updateOne(
        { key: 'alert_preferences' },
        { $set: { key: 'alert_preferences', data: prefs, updatedAt: new Date() } },
        { upsert: true }
      );
      return prefs;
    } catch (e) {
      console.warn('[mongodb] Alert preferences update error:', e.message);
    }
  }
  return prefs;
}
