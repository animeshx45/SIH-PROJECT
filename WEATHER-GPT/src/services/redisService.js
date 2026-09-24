import Redis from 'ioredis';
import config from '../config/env.js';

let redisClient = null;
let isConnected = false;
let hasLoggedFailure = false;

/**
 * Initialize Redis connection with zero-downtime fallback.
 * If Redis is running, it unlocks ultra-fast in-memory caching.
 * If Redis is not running or down, the application continues flawlessly with SQLite.
 */
export async function initRedis() {
  if (redisClient) return redisClient;

  const redisUrl = config.redis?.url || process.env.REDIS_URL;
  if (process.env.VERCEL && !redisUrl && !process.env.REDIS_HOST) {
    return null;
  }
  const host = config.redis?.host || process.env.REDIS_HOST || '127.0.0.1';
  const port = parseInt(config.redis?.port || process.env.REDIS_PORT || '6379', 10);
  const password = config.redis?.password || process.env.REDIS_PASSWORD || undefined;

  try {
    const options = {
      connectTimeout: 2500,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      retryStrategy(times) {
        if (times > 3) {
          // Cease aggressive reconnection attempts to keep logs clean
          return 30000;
        }
        return Math.min(times * 1000, 5000);
      }
    };

    if (password) options.password = password;

    if (redisUrl && redisUrl.trim()) {
      redisClient = new Redis(redisUrl, options);
    } else {
      redisClient = new Redis({
        host,
        port,
        ...options
      });
    }

    redisClient.on('connect', () => {
      isConnected = true;
      hasLoggedFailure = false;
      const target = redisUrl ? redisUrl.replace(/\/\/:[^@]+@/, '//***@') : `${host}:${port}`;
      console.log(`[redis] ⚡ Connected to Redis caching engine at: ${target}`);
    });

    redisClient.on('ready', () => {
      isConnected = true;
    });

    redisClient.on('error', (err) => {
      isConnected = false;
      if (!hasLoggedFailure) {
        hasLoggedFailure = true;
        console.log(`[redis] ℹ️  Redis not active (${err.message || 'Connection refused'}). Falling back to SQLite cache engine.`);
      }
    });

    redisClient.on('close', () => {
      isConnected = false;
    });

    // Test ping asynchronously
    redisClient.ping().then(() => {
      isConnected = true;
    }).catch(() => {
      isConnected = false;
    });

    return redisClient;
  } catch (err) {
    isConnected = false;
    console.log('[redis] Fallback mode active:', err.message);
    return null;
  }
}

/**
 * Check if Redis is currently connected and operational.
 */
export function isRedisAvailable() {
  return isConnected && redisClient !== null && redisClient.status === 'ready';
}

/**
 * Retrieve JSON cached item from Redis.
 */
export async function getCache(key) {
  if (!isRedisAvailable()) return null;
  try {
    const data = await redisClient.get(key);
    if (!data) return null;
    return JSON.parse(data);
  } catch {
    return null;
  }
}

/**
 * Store JSON item in Redis with TTL in seconds.
 */
export async function setCache(key, value, ttlSeconds = 300) {
  if (!isRedisAvailable()) return false;
  try {
    const serialized = JSON.stringify(value);
    await redisClient.set(key, serialized, 'EX', ttlSeconds);
    return true;
  } catch {
    return false;
  }
}

/**
 * Invalidate a cached key from Redis.
 */
export async function delCache(key) {
  if (!isRedisAvailable()) return false;
  try {
    await redisClient.del(key);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get comprehensive Redis operational diagnostics.
 */
export function getRedisStatus() {
  return {
    configured: Boolean(config.redis?.url || process.env.REDIS_URL || process.env.REDIS_HOST),
    connected: isConnected,
    status: isConnected ? 'active' : 'standby (using SQLite fallback)',
    engine: isConnected ? 'Redis v7+' : 'SQLite WAL Engine'
  };
}
