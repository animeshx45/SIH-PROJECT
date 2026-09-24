import { askAi as queryAi, getAiBrief as queryBrief } from '../services/aiService.js';

async function parseBody(req) {
  if (req.body) {
    if (typeof req.body === 'object') return req.body;
    try { return JSON.parse(req.body); } catch (_) { return {}; }
  }
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1e6) {
        req.socket.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

export async function askAi(req, res) {
  try {
    const payload = await parseBody(req);
    const prompt = payload.prompt || payload.question;
    const { weatherContext, language, placeName, persona } = payload;

    if (!prompt || typeof prompt !== 'string') {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Prompt is required.' }));
      return;
    }

    const result = await queryAi({
      prompt,
      weatherContext,
      language: language || 'en',
      placeName: placeName || 'Current Location',
      persona: persona || 'general'
    });

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ...result,
      response: result.answer
    }));
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message || 'AI processing error.' }));
  }
}

export async function getBrief(req, res) {
  try {
    const payload = await parseBody(req);
    const { weatherContext, language, placeName } = payload;

    const result = await queryBrief({
      weatherContext,
      language: language || 'en',
      placeName: placeName || 'Current Location'
    });

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message || 'Failed to generate brief.' }));
  }
}
