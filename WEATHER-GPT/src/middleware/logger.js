export function logRequest(req, res, durationMs) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.url} ${res.statusCode} - ${durationMs}ms`);
}
