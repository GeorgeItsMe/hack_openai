import { createServer, type IncomingMessage } from 'node:http';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { mcpInputs, mcpOutputs, type McpRequest, type McpTool } from '../shared/mcp';
const profileSchema = z.object({ profileId: z.uuid() }).strict();
const replySchema = z.object({ profileId: z.uuid(), id: z.uuid(), data: z.unknown().optional(), error: z.string().regex(/^[A-Z_]+$/).max(80).optional() }).strict();
export class McpBroker {
  private profile?: string;
  private seen = 0;
  private poll?: { send: (request: McpRequest | null) => void; timer: ReturnType<typeof setTimeout> };
  private pending = new Map<string, { request: McpRequest; resolve: (v: any) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  constructor(private timeout = 12000) {}
  private disconnect() {
    if (this.poll) { clearTimeout(this.poll.timer); this.poll.send(null); this.poll = undefined; }
    for (const p of this.pending.values()) { clearTimeout(p.timer); p.reject(new Error('BROWSER_DISCONNECTED')); }
    this.pending.clear(); this.profile = undefined;
  }
  close() { this.disconnect(); }
  async call(tool: McpTool, args: unknown) {
    const parsed = mcpInputs[tool].safeParse(args); if (!parsed.success) throw new Error('INVALID_ARGUMENTS');
    if (!this.profile || Date.now() - this.seen > 30000) { this.disconnect(); throw new Error('BROWSER_DISCONNECTED'); }
    if (this.pending.size >= 16) throw new Error('MCP_BUSY');
    const request: McpRequest = { id: randomUUID(), tool, args: parsed.data, expiresAt: Date.now() + this.timeout };
    return new Promise<Record<string, unknown>>((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(request.id); reject(new Error('BROWSER_TIMEOUT')); }, this.timeout);
      this.pending.set(request.id, { request, resolve, reject, timer });
      if (this.poll) { const poll = this.poll; this.poll = undefined; clearTimeout(poll.timer); poll.send(request); }
    });
  }
  createHttp(port: number, extensionId: string, token: string) {
    const origin = `chrome-extension://${extensionId}`;
    if (token.length < 32) throw new Error('MCP_TOKEN_REQUIRED');
    return createServer(async (req, res) => {
      res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff');
      const send = (status: number, data: unknown) => { if (!res.destroyed && !res.writableEnded) { res.writeHead(status); res.end(JSON.stringify(data)); } };
      if (req.headers.host !== `127.0.0.1:${port}` || req.headers.origin !== origin) return send(403, { error: 'MCP_FORBIDDEN' });
      res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin');
      if (req.method === 'OPTIONS') { res.setHeader('Access-Control-Allow-Methods', 'POST'); res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Tabby-MCP-Token'); return send(204, null); }
      const a = Buffer.from(String(req.headers['x-tabby-mcp-token'] || '')), b = Buffer.from(token);
      if (a.length !== b.length || !timingSafeEqual(a, b)) return send(401, { error: 'MCP_UNAUTHORIZED' });
      if (req.method !== 'POST' || !['/bridge/poll', '/bridge/reply', '/bridge/disconnect'].includes(req.url || '')) return send(404, { error: 'NOT_FOUND' });
      if (!req.headers['content-type']?.startsWith('application/json')) return send(415, { error: 'INVALID_REQUEST' });
      try {
        const body = await read(req); const parsed = (req.url === '/bridge/reply' ? replySchema : profileSchema).safeParse(body);
        if (!parsed.success) return send(400, { error: 'INVALID_REQUEST' });
        const profileId = parsed.data.profileId;
        if (this.profile && Date.now() - this.seen > 30000) this.disconnect();
        if (this.profile && this.profile !== profileId) return send(409, { error: 'MCP_PROFILE_IN_USE' });
        if (req.url === '/bridge/disconnect') { if (this.profile === profileId) this.disconnect(); return send(200, {}); }
        if (req.url === '/bridge/poll') {
          if (this.poll) return send(409, { error: 'MCP_POLL_IN_PROGRESS' });
          this.profile = profileId; this.seen = Date.now();
          const next = [...this.pending.values()].find(p => p.request.expiresAt > Date.now());
          if (next) return send(200, { request: next.request });
          const poll = { send: (request: McpRequest | null) => { this.seen = Date.now(); send(200, { request }); }, timer: setTimeout(() => { if (this.poll === poll) { this.poll = undefined; poll.send(null); } }, 20000) };
          this.poll = poll;
          res.on('close', () => { if (this.poll === poll) { clearTimeout(poll.timer); this.poll = undefined; } });
        } else {
          const response = replySchema.parse(body); const p = this.pending.get(response.id);
          if (!p || p.request.expiresAt < Date.now() || this.profile !== profileId) return send(409, { error: 'STALE_RESPONSE' });
          this.pending.delete(response.id); clearTimeout(p.timer); this.seen = Date.now();
          if (response.error) p.reject(new Error(response.error));
          else {
            const data = mcpOutputs[p.request.tool].safeParse(response.data);
            if (!data.success || Date.now() - data.data.capturedAt > this.timeout || data.data.capturedAt > Date.now() + 1000) p.reject(new Error('INVALID_BRIDGE_RESPONSE'));
            else p.resolve(data.data);
          }
          send(200, {});
        }
      } catch { send(400, { error: 'INVALID_REQUEST' }); }
    });
  }
}
async function read(req: IncomingMessage) {
  let size = 0; const chunks: Buffer[] = [];
  for await (const chunk of req) { size += chunk.length; if (size > 4000000) throw new Error('TOO_LARGE'); chunks.push(chunk); }
  return JSON.parse(Buffer.concat(chunks).toString());
}
