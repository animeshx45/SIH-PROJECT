import { getSettings as fetchDbSettings, updateSettings } from '../database/db.js';
import config from '../config/env.js';

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

export async function getSettings(req, res) {
  try {
    const s = fetchDbSettings();
    const effectiveKey = (config.gemini.apiKey || s.gemini_api_key || '').trim();
    const maskedKey = effectiveKey.length > 8 
      ? effectiveKey.slice(0, 4) + '••••••••' + effectiveKey.slice(-4) 
      : (effectiveKey ? '••••••••' : '');

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      temperature_unit: s.temperature_unit,
      language: s.language,
      auto_speak: Boolean(s.auto_speak),
      has_ai_key: Boolean(effectiveKey),
      has_gemini_key: Boolean(effectiveKey),
      ai_key_preview: maskedKey,
      gemini_key_preview: maskedKey,
      ai_model: 'WeatherGPT Neural Engine v2.5',
      gemini_model: 'WeatherGPT Neural Engine v2.5'
    }));
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
}

export async function saveSettings(req, res) {
  try {
    const body = await parseBody(req);
    // Allow ai_api_key or gemini_api_key in payload
    if (body.ai_api_key !== undefined) {
      body.gemini_api_key = body.ai_api_key;
    }
    const updated = updateSettings(body);
    const effectiveKey = (config.ai.apiKey || updated.gemini_api_key || '').trim();

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      temperature_unit: updated.temperature_unit,
      language: updated.language,
      auto_speak: Boolean(updated.auto_speak),
      has_ai_key: Boolean(effectiveKey),
      has_gemini_key: Boolean(effectiveKey)
    }));
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
}
