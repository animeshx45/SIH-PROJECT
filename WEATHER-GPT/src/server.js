import { createApp } from './app.js';
import config from './config/env.js';
import { getDatabase, getSettings } from './database/db.js';
import { initMongo } from './database/mongo.js';
import { initRedis } from './services/redisService.js';

async function startServer() {
  console.log('===========================================================');
  console.log('  🌦️  Weather SPT / WeatherGPT — Production Server');
  console.log('===========================================================');

  try {
    getDatabase();
    console.log('[db] Embedded SQLite database initialized.');
  } catch (err) {
    console.error('[db] Error initializing SQLite database:', err);
  }

  const settings = getSettings();
  const hasAiKey = Boolean(config.ai.apiKey || (settings.gemini_api_key && settings.gemini_api_key.trim().length > 5));

  console.log(`[config] Node.js Runtime: ${process.version}`);
  console.log(`[config] Environment: ${config.env}`);
  console.log(`[ai] WeatherGPT Neural Engine: ${hasAiKey ? 'ACTIVE (v2.5 Production Engine)' : 'READY (Local Expert Heuristic Engine Active)'}`);

  const app = createApp();
  const server = app.listen(config.port, '0.0.0.0', () => {
    console.log('-----------------------------------------------------------');
    console.log(`🚀 WeatherGPT is running at: http://127.0.0.1:${config.port}`);
    console.log(`📡 Localhost URL: http://localhost:${config.port}`);
    console.log(`🛡️ Rate limiting: ${config.rateLimit.maxRequests} req / ${config.rateLimit.windowMs / 1000}s`);
    console.log('-----------------------------------------------------------');

    // Automatically open browser once server is confirmed listening on desktop
    if (process.env.AUTO_OPEN !== 'false' && !process.env.VERCEL && process.platform === 'win32') {
      import('node:child_process').then(({ exec }) => {
        exec(`start http://127.0.0.1:${config.port}`);
      }).catch(() => {});
    }
  });

  // Connect to MongoDB Atlas & Redis asynchronously in background without blocking HTTP server
  (async () => {
    try {
      await initMongo();
    } catch (e) {
      console.warn('[mongodb] Notice:', e.message);
    }
    try {
      await initRedis();
    } catch (e) {
      console.warn('[redis] Notice:', e.message);
    }
  })();

  const shutdown = () => {
    console.log('\n[server] Shutting down WeatherGPT server...');
    server.close(() => {
      console.log('[server] HTTP server closed.');
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

startServer().catch(err => {
  console.error('[server] Startup error:', err);
  process.exit(1);
});
