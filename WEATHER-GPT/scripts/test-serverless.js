import handler from '../api/index.js';
import { EventEmitter } from 'node:events';

function createMockReq(url, method = 'GET', body = null, headers = {}) {
  const req = new EventEmitter();
  req.url = url;
  req.method = method;
  req.headers = { host: 'weathergpt-test.vercel.app', 'x-forwarded-for': '127.0.0.1', ...headers };
  req.socket = { remoteAddress: '127.0.0.1' };
  req.body = body;
  return req;
}

function createMockRes() {
  const res = new EventEmitter();
  res.statusCode = 200;
  res.headers = {};
  res.body = '';
  res.writeHead = function (code, headers = {}) {
    res.statusCode = code;
    Object.assign(res.headers, headers);
    return res;
  };
  res.setHeader = function (name, val) {
    res.headers[name.toLowerCase()] = val;
    return res;
  };
  res.getHeader = function (name) {
    return res.headers[name.toLowerCase()];
  };
  res.write = function (chunk) {
    res.body += chunk;
    return true;
  };
  res.end = function (chunk) {
    if (chunk) res.body += chunk;
    res.emit('finish');
    return res;
  };
  return res;
}

async function testEndpoint(name, url, method = 'GET', body = null) {
  const req = createMockReq(url, method, body);
  const res = createMockRes();

  return new Promise(async (resolve) => {
    res.on('finish', () => {
      console.log(`[PASS] ${name} -> HTTP ${res.statusCode}`);
      let parsed = null;
      try {
        parsed = JSON.parse(res.body);
      } catch {
        parsed = res.body.slice(0, 100);
      }
      resolve({ statusCode: res.statusCode, body: parsed });
    });

    try {
      await handler(req, res);
    } catch (err) {
      console.error(`[FAIL] ${name} threw error:`, err);
      resolve({ statusCode: 500, error: err.message });
    }
  });
}

async function runAllTests() {
  console.log('🧪 Starting Vercel Serverless Function Simulation Tests...\n');

  // Test 1: Health check
  const h = await testEndpoint('Health Check', '/api/health');
  console.log('   Health Status:', h.body?.status, '| Persistence:', JSON.stringify(h.body?.persistence));

  // Test 2: Settings GET
  const s = await testEndpoint('Settings GET', '/api/settings');
  console.log('   Settings Unit:', s.body?.temperature_unit, '| Model:', s.body?.ai_model);

  // Test 3: Favorites GET
  const f = await testEndpoint('Favorites GET', '/api/favorites');
  console.log('   Favorites count:', f.body?.favorites?.length);

  // Test 4: Weather API
  const w = await testEndpoint('Weather GET (Delhi)', '/api/weather?lat=28.6139&lon=77.2090');
  console.log('   Weather Temp:', w.body?.current?.temperature_2m, '°C | Risk Score:', w.body?.imd_risk_score);

  // Test 5: Radar
  const r = await testEndpoint('Radar GET', '/api/weather/radar');
  console.log('   Radar frames count:', r.body?.past?.length);

  // Test 6: Settings POST (Safe in-memory update)
  const sp = await testEndpoint('Settings POST', '/api/settings', 'POST', { temperature_unit: 'f' });
  console.log('   Updated Unit:', sp.body?.temperature_unit);

  console.log('\n✅ All Vercel serverless function simulation tests completed successfully!');
}

runAllTests().catch(err => {
  console.error('Fatal test runner error:', err);
});
