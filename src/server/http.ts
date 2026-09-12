import { createServer, type IncomingMessage } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { AppError, type Provider } from './provider';
export interface ServerConfig { port: number; extensionId: string; pairToken: string }
export function createApp(config: ServerConfig, provider: Pick<Provider, 'run' | 'status'>) {
  const origin = `chrome-extension://${config.extensionId}`; let active = 0; let requests: number[] = [];
  const safeToken = (value: string) => { const a = Buffer.from(value), b = Buffer.from(config.pairToken); return b.length >= 32 && a.length === b.length && timingSafeEqual(a, b); };
  return createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff');
    const send = (status: number, data: unknown) => { if (!res.destroyed) { res.writeHead(status); res.end(JSON.stringify(data)); } };
    if (req.headers.host !== `127.0.0.1:${config.port}` || req.headers.origin !== origin) return send(403, { error: { code: 'EXTENSION_NOT_ALLOWED' } });
    res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin');
    if (req.method === 'OPTIONS') { res.setHeader('Access-Control-Allow-Methods', 'POST'); res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-FocusTab-Token'); res.setHeader('Access-Control-Allow-Private-Network', 'true'); res.writeHead(204); res.end(); return; }
    if (!safeToken(String(req.headers['x-focustab-token'] ?? ''))) return send(401, { error: { code: 'PAIRING_REQUIRED' } });
    if (req.method !== 'POST' || !['/status', '/ai'].includes(req.url ?? '')) return send(404, { error: { code: 'NOT_FOUND' } });
    if (!req.headers['content-type']?.startsWith('application/json')) return send(415, { error: { code: 'INVALID_REQUEST' } });
    const now = Date.now(); requests = requests.filter(t => now - t < 60000);
    if (active >= 3 || requests.length >= 20) { res.setHeader('Retry-After', '60'); return send(429, { error: { code: 'LOCAL_RATE_LIMIT' } }); }
    requests.push(now); active++;
    const controller = new AbortController(); res.on('close', () => { if (!res.writableEnded) controller.abort(); });
    try {
      const body = await readBody(req);
      const result = req.url === '/status' ? await provider.status() : await provider.run(body, controller.signal);
      send(200, result);
    } catch (e) {
      const error = e instanceof AppError ? e : new AppError('SERVER_ERROR', 500);
      send(error.status, { error: { code: error.code, ...(error.available ? { available: error.available.slice(0, 200) } : {}) } });
    } finally { active--; }
  });
}
async function readBody(req: IncomingMessage) {
  let length = 0; const chunks: Buffer[] = [];
  for await (const chunk of req) { length += chunk.length; if (length > 120000) throw new AppError('REQUEST_TOO_LARGE', 413); chunks.push(chunk); }
  try { return JSON.parse(Buffer.concat(chunks).toString() || '{}'); } catch { throw new AppError('INVALID_REQUEST', 400); }
}
