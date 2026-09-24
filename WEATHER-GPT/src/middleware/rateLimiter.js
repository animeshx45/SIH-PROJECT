import config from '../config/env.js';

const requestStore = new Map();

export function checkRateLimit(ip) {
  const now = Date.now();
  const windowMs = config.rateLimit.windowMs;
  const maxRequests = config.rateLimit.maxRequests;

  let clientRecord = requestStore.get(ip);
  if (!clientRecord || (now - clientRecord.startTime) > windowMs) {
    clientRecord = { startTime: now, count: 1 };
    requestStore.set(ip, clientRecord);
    return true;
  }

  clientRecord.count += 1;
  if (clientRecord.count > maxRequests) {
    return false;
  }
  return true;
}

// Cleanup stale records periodically
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of requestStore.entries()) {
    if (now - record.startTime > config.rateLimit.windowMs) {
      requestStore.delete(ip);
    }
  }
}, 300000);
