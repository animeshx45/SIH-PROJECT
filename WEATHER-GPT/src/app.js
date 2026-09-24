import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import config from './config/env.js';
import { applySecurityHeaders } from './middleware/security.js';
import { checkRateLimit } from './middleware/rateLimiter.js';
import { logRequest } from './middleware/logger.js';

import * as weatherController from './controllers/weatherController.js';
import * as aiController from './controllers/aiController.js';
import * as favoritesController from './controllers/favoritesController.js';
import * as settingsController from './controllers/settingsController.js';
import * as climateController from './controllers/climateController.js';
import { getRedisStatus } from './services/redisService.js';
import { isMongoConnected } from './database/mongo.js';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webm': 'video/webm',
  '.mp4': 'video/mp4',
};

export async function handleRequest(req, res) {
  const start = Date.now();
  applySecurityHeaders(req, res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const forwarded = req.headers['x-forwarded-for'];
  const clientIp = (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : null) || req.socket?.remoteAddress || 'unknown';
  if (!checkRateLimit(clientIp)) {
    res.writeHead(429, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Too many requests. Please slow down.' }));
    return;
  }

  const host = req.headers.host || 'localhost';
  const parsedUrl = new URL(req.url, `http://${host}`);
  const pathname = parsedUrl.pathname;

    try {
      // ── API ROUTES ────────────────────────
      if (pathname === '/api/health' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'healthy',
          service: 'WeatherGPT Platform (SIH26068)',
          uptimeSeconds: Math.floor(process.uptime()),
          persistence: {
            sqlite: 'connected',
            mongo: isMongoConnected() ? 'connected' : 'standby (using SQLite)'
          },
          cache: getRedisStatus(),
          timestamp: new Date().toISOString()
        }));
        return;
      }

      if (pathname === '/api/weather' && req.method === 'GET') {
        await weatherController.getWeather(req, res, parsedUrl);
        return;
      }
      if (pathname === '/api/weather/radar' && req.method === 'GET') {
        await weatherController.getRadarFrames(req, res);
        return;
      }
      if (pathname === '/api/weather/nwp' && req.method === 'GET') {
        await weatherController.getNwpModels(req, res, parsedUrl);
        return;
      }
      if (pathname === '/api/weather/aviation' && req.method === 'GET') {
        await weatherController.getAviation(req, res, parsedUrl);
        return;
      }
      if (pathname === '/api/weather/climate' && req.method === 'GET') {
        await weatherController.getClimate(req, res, parsedUrl);
        return;
      }
      if (pathname === '/api/climate/history' && req.method === 'GET') {
        await climateController.getClimateHistoryHandler(req, res, parsedUrl);
        return;
      }
      if (pathname === '/api/advisory' && req.method === 'GET') {
        await climateController.getSmartAdvisoryHandler(req, res, parsedUrl);
        return;
      }
      if (pathname === '/api/alerts/preferences' && req.method === 'GET') {
        await climateController.getAlertPreferencesHandler(req, res);
        return;
      }
      if (pathname === '/api/alerts/preferences' && req.method === 'POST') {
        await climateController.updateAlertPreferencesHandler(req, res);
        return;
      }
      if (pathname === '/api/geocode' && req.method === 'GET') {
        await weatherController.searchGeocode(req, res, parsedUrl);
        return;
      }
      if (pathname === '/api/ai/ask' && req.method === 'POST') {
        await aiController.askAi(req, res);
        return;
      }
      if (pathname === '/api/ai/brief' && req.method === 'POST') {
        await aiController.getBrief(req, res);
        return;
      }
      if (pathname === '/api/favorites' && req.method === 'GET') {
        await favoritesController.getFavorites(req, res);
        return;
      }
      if (pathname === '/api/favorites' && req.method === 'POST') {
        await favoritesController.addFavorite(req, res);
        return;
      }
      if (pathname.startsWith('/api/favorites/') && req.method === 'DELETE') {
        await favoritesController.deleteFavorite(req, res, pathname);
        return;
      }
      if (pathname === '/api/settings' && req.method === 'GET') {
        await settingsController.getSettings(req, res);
        return;
      }
      if (pathname === '/api/settings' && req.method === 'POST') {
        await settingsController.saveSettings(req, res);
        return;
      }

      // ── STATIC FILE SERVING ───────────────
      let relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '');
      const filePath = path.join(config.publicDir, relativePath);

      if (!filePath.startsWith(config.publicDir)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }

      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': contentType });
        fs.createReadStream(filePath).pipe(res);
        return;
      }

      // Fallback to index.html for PWA Single Page routing
      const indexPath = path.join(config.publicDir, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        fs.createReadStream(indexPath).pipe(res);
        return;
      }

      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not Found' }));
    } catch (err) {
      console.error('[router] Error:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal Server Error' }));
    } finally {
      logRequest(req, res, Date.now() - start);
    }
}

export function createApp() {
  return http.createServer(handleRequest);
}
