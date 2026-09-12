import { AppError, type Provider } from './provider.js';
import { requestSchema } from '../shared/schemas.js';
import { TABBY_EXTENSION_ORIGIN } from '../shared/cloud.js';

// The public hackathon service accepts only Tabby's bounded, validated operations.
// Origin is a browser boundary, not authentication. The production WAF supplies
// per-IP rate limiting across instances (per Vercel region). These process-local
// limits add backpressure; they are deliberately not described as a spend cap.
export function createCloudHandler(provider: Pick<Provider, 'run' | 'status'>, enabled: () => boolean) {
  const windows = new Map<string, { until: number; count: number }>();
  let active = 0;
  let statusCache: { until: number; value: Awaited<ReturnType<Provider['status']>> } | undefined;
  let statusPending: Promise<Awaited<ReturnType<Provider['status']>>> | undefined;
  return async function handle(request: Request): Promise<Response> {
    const headers = new Headers({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', Vary: 'Origin' });
    const send = (status: number, body: unknown) => Response.json(body, { status, headers });
    const fail = (status: number, code: string) => send(status, { error: { code } });
    if (request.headers.get('origin') !== TABBY_EXTENSION_ORIGIN) return fail(403, 'EXTENSION_NOT_ALLOWED');
    headers.set('Access-Control-Allow-Origin', TABBY_EXTENSION_ORIGIN);
    if (request.method === 'OPTIONS') {
      headers.set('Access-Control-Allow-Methods', 'POST');
      headers.set('Access-Control-Allow-Headers', 'Content-Type');
      headers.set('Access-Control-Max-Age', '600');
      return new Response(null, { status: 204, headers });
    }
    const op = new URL(request.url).searchParams.get('op');
    if (request.method !== 'POST' || !['ai', 'status'].includes(op || '')) return fail(404, 'NOT_FOUND');
    if (!enabled()) return fail(503, 'CLOUD_UNAVAILABLE');
    if (!request.headers.get('content-type')?.startsWith('application/json')) return fail(415, 'INVALID_REQUEST');
    if (Number(request.headers.get('content-length') || 0) > 120000) return fail(413, 'REQUEST_TOO_LARGE');
    const now = Date.now();
    for (const [key, value] of windows) if (value.until <= now) windows.delete(key);
    const ip = (request.headers.get('x-vercel-forwarded-for') || request.headers.get('x-forwarded-for') || 'unknown').split(',')[0].slice(0, 80);
    const window = windows.get(ip) || { until: now + 60000, count: 0 };
    if (active >= 8 || window.count >= 30 || windows.size >= 5000) {
      headers.set('Retry-After', '60'); return fail(429, 'CLOUD_RATE_LIMIT');
    }
    window.count++; windows.set(ip, window); active++;
    try {
      const reader = request.body?.getReader(); const chunks: Uint8Array[] = []; let size = 0;
      if (reader) for (;;) {
        const part = await reader.read(); if (part.done) break;
        size += part.value.length;
        if (size > 120000) { await reader.cancel(); return fail(413, 'REQUEST_TOO_LARGE'); }
        chunks.push(part.value);
      }
      let body: unknown;
      try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return fail(400, 'INVALID_REQUEST'); }
      if (op === 'status') {
        if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length) return fail(400, 'INVALID_REQUEST');
        if (!statusCache || statusCache.until <= now) {
          statusPending ||= provider.status().finally(() => { statusPending = undefined; });
          statusCache = { value: await statusPending, until: now + 300000 };
        }
        const { model } = statusCache.value;
        return send(200, { connected: true, code: 'READY', model });
      }
      const parsed = requestSchema.safeParse(body);
      if (!parsed.success) return fail(400, 'INVALID_REQUEST');
      return send(200, await provider.run(parsed.data, request.signal));
    } catch (error) {
      // Never return upstream response bodies, environment values or stack traces.
      if (!(error instanceof AppError)) return fail(503, 'CLOUD_UNAVAILABLE');
      const code = ['API_KEY_INVALID', 'API_BALANCE', 'AI_NOT_CONNECTED'].includes(error.code) ? 'CLOUD_UNAVAILABLE' : error.code;
      return fail(error.status, code);
    } finally { active--; }
  };
}
