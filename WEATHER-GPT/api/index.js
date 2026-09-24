import { handleRequest } from '../src/app.js';

export default async function handler(req, res) {
  try {
    await handleRequest(req, res);
  } catch (err) {
    console.error('[vercel-serverless] Unhandled error:', err);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Serverless execution error', details: err.message }));
    }
  }
}
