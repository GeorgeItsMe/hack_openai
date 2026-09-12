import { createServer, type Server } from 'node:http';
import { createHash, randomBytes } from 'node:crypto';
import { chmod, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { z } from 'zod';
import { AppError } from './provider';
import { calendarSnapshotSchema, googleLink, googleServiceSchema, mailSnapshotSchema, type GoogleService } from '../shared/workspace';
import { redact } from '../shared/privacy';

const scopes: Record<GoogleService, string> = {
  calendar: 'https://www.googleapis.com/auth/calendar.events.readonly',
  gmail: 'https://www.googleapis.com/auth/gmail.readonly',
};
const tokenSchema = z.object({ access_token: z.string().min(1), refresh_token: z.string().optional(), expiresAt: z.number(), scope: z.string() });
type Token = z.infer<typeof tokenSchema>;
const storeSchema = z.object({ clientId: z.string(), tokens: z.object({ calendar: tokenSchema.optional(), gmail: tokenSchema.optional() }) });
const tokenResponseSchema = z.object({ access_token: z.string().min(1), refresh_token: z.string().optional(), expires_in: z.number().positive(), scope: z.string().optional() });
export interface GoogleConfig { clientId: string; clientSecret?: string; tokenFile: string }
type Pending = { service: GoogleService; state: string; verifier: string; redirect: string; server: Server; timer: ReturnType<typeof setTimeout>; epoch: number };

export class GoogleIntegration {
  private tokens: Partial<Record<GoogleService, Token>> = {};
  private loaded: Promise<void>;
  private pending?: Pending;
  private error?: string;
  private epoch = 0;
  private writes: Promise<void> = Promise.resolve();
  private refreshes = new Map<GoogleService, Promise<Token>>();
  constructor(private config: GoogleConfig, private fetcher: typeof fetch = fetch) {
    this.loaded = this.load();
  }
  private async load() {
    try {
      const stored = storeSchema.parse(JSON.parse(await readFile(this.config.tokenFile, 'utf8')));
      if (stored.clientId === this.config.clientId) this.tokens = stored.tokens;
      await chmod(this.config.tokenFile, 0o600);
    } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') this.error = 'GOOGLE_STORAGE_ERROR'; }
  }
  private persist() {
    // Capture the final state when the queued write runs; disconnect cannot be undone by an old refresh.
    const next = this.writes.catch(() => {}).then(async () => {
      const file = this.config.tokenFile; await mkdir(dirname(file), { recursive: true, mode: 0o700 });
      if (!Object.keys(this.tokens).length) { await rm(file, { force: true }); return; }
      const temp = file + '.tmp';
      await writeFile(temp, JSON.stringify({ clientId: this.config.clientId, tokens: this.tokens }), { mode: 0o600 });
      await chmod(temp, 0o600); await rename(temp, file);
    });
    this.writes = next;
    return next.catch(() => { throw new AppError('GOOGLE_STORAGE_ERROR', 500); });
  }
  async status() {
    await this.loaded;
    return { configured: !!this.config.clientId, calendar: !!this.tokens.calendar, gmail: !!this.tokens.gmail, pending: this.pending?.service ?? null, ...(this.error ? { error: this.error } : {}) };
  }
  cancel() {
    if (this.pending) { clearTimeout(this.pending.timer); this.pending.server.close(); this.pending = undefined; }
  }
  async connect(input: unknown) {
    await this.loaded;
    const parsed = z.object({ service: googleServiceSchema }).strict().safeParse(input);
    if (!parsed.success) throw new AppError('INVALID_REQUEST', 400);
    if (!this.config.clientId) throw new AppError('GOOGLE_NOT_CONFIGURED', 503);
    this.cancel(); this.error = undefined;
    const state = randomBytes(32).toString('base64url'), verifier = randomBytes(48).toString('base64url');
    const epoch = this.epoch;
    const server = createServer((req, res) => {
      res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Referrer-Policy', 'no-referrer'); res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'");
      const finish = (status: number, message: string) => { res.writeHead(status); res.end(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Tabby · Google</title><body style="font:16px system-ui;background:#f6f5f0;color:#272923;max-width:480px;margin:15vh auto;padding:30px"><span style="color:#ff7745;font-weight:700">TABBY</span><h1>${message}</h1><p>Return to the Tabby side panel. You can close this tab.</p></body></html>`); };
      const pending = this.pending;
      const url = new URL(req.url || '/', 'http://127.0.0.1');
      if (req.method !== 'GET' || url.pathname !== '/' || !pending || pending.state !== state || req.headers.host !== new URL(pending.redirect).host || url.searchParams.get('state') !== state) { finish(400, 'This connection request is invalid or expired.'); return; }
      this.cancel();
      if (url.searchParams.has('error')) { this.error = 'GOOGLE_ACCESS_DENIED'; finish(400, 'Google access was not granted.'); return; }
      const code = url.searchParams.get('code');
      if (!code || code.length > 4096) { this.error = 'GOOGLE_AUTH_FAILED'; finish(400, 'Google connection could not finish.'); return; }
      void this.exchange({ code, code_verifier: verifier, redirect_uri: pending.redirect, grant_type: 'authorization_code' })
        .then(async response => {
          if (epoch !== this.epoch) throw new AppError('GOOGLE_AUTH_EXPIRED', 409);
          const scope = response.scope ?? scopes[pending.service];
          if (!scope.split(' ').includes(scopes[pending.service])) throw new AppError('GOOGLE_SCOPE_REQUIRED', 403);
          if (!response.refresh_token) throw new AppError('GOOGLE_AUTH_FAILED', 502);
          this.tokens[pending.service] = { access_token: response.access_token, refresh_token: response.refresh_token, expiresAt: Date.now() + response.expires_in * 1000, scope };
          await this.persist(); this.error = undefined; finish(200, 'Google is connected.');
        }).catch((e: unknown) => { this.error = e instanceof AppError ? e.code : 'GOOGLE_AUTH_FAILED'; finish(400, 'Google connection could not finish. Please try again in Tabby.'); });
    });
    server.requestTimeout = 30000; server.headersTimeout = 10000;
    await new Promise<void>((resolve, reject) => { server.once('error', () => reject(new AppError('GOOGLE_AUTH_FAILED', 503))); server.listen(0, '127.0.0.1', resolve); });
    if (epoch !== this.epoch) { server.close(); throw new AppError('GOOGLE_AUTH_EXPIRED', 409); }
    const address = server.address(); if (!address || typeof address === 'string') throw new AppError('GOOGLE_AUTH_FAILED');
    const redirect = `http://127.0.0.1:${address.port}/`;
    const timer = setTimeout(() => { if (this.pending?.state === state) { this.cancel(); this.error = 'GOOGLE_AUTH_EXPIRED'; } }, 300000); timer.unref();
    this.pending = { service: parsed.data.service, state, verifier, redirect, server, timer, epoch };
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.search = new URLSearchParams({ client_id: this.config.clientId, redirect_uri: redirect, response_type: 'code', scope: scopes[parsed.data.service], state, code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256', access_type: 'offline', prompt: 'consent' }).toString();
    return { url: url.href };
  }
  private async json(url: string, options: RequestInit = {}) {
    let response: Response;
    try { response = await this.fetcher(url, { ...options, redirect: 'error', signal: AbortSignal.any([AbortSignal.timeout(15000), ...(options.signal ? [options.signal] : [])]) }); }
    catch { throw new AppError('GOOGLE_UNREACHABLE', 503); }
    if (!response.ok) {
      await response.body?.cancel();
      throw new AppError(({ 400: 'GOOGLE_AUTH_FAILED', 401: 'GOOGLE_RECONNECT', 403: 'GOOGLE_SCOPE_REQUIRED', 429: 'GOOGLE_RATE_LIMIT' } as Record<number, string>)[response.status] ?? 'GOOGLE_UNAVAILABLE', response.status === 429 ? 429 : 502);
    }
    const reader = response.body?.getReader(); const chunks: Uint8Array[] = []; let size = 0;
    try {
      if (reader) for (;;) { const { value, done } = await reader.read(); if (done) break; size += value.length; if (size > 2_000_000) { await reader.cancel(); throw new Error(); } chunks.push(value); }
      return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
    } catch { throw new AppError('GOOGLE_INVALID_RESPONSE'); }
  }
  private async exchange(parameters: Record<string, string>) {
    const body = new URLSearchParams({ client_id: this.config.clientId, ...(this.config.clientSecret ? { client_secret: this.config.clientSecret } : {}), ...parameters });
    const raw = await this.json('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
    const parsed = tokenResponseSchema.safeParse(raw); if (!parsed.success) throw new AppError('GOOGLE_INVALID_RESPONSE'); return parsed.data;
  }
  private async access(service: GoogleService): Promise<Token> {
    await this.loaded;
    const token = this.tokens[service]; if (!token) throw new AppError('GOOGLE_RECONNECT', 401);
    if (token.expiresAt > Date.now() + 60000) return token;
    const running = this.refreshes.get(service); if (running) return running;
    const epoch = this.epoch;
    const refresh = (async () => {
      if (!token.refresh_token) throw new AppError('GOOGLE_RECONNECT', 401);
      try {
        const result = await this.exchange({ grant_type: 'refresh_token', refresh_token: token.refresh_token });
        if (epoch !== this.epoch || this.tokens[service] !== token) throw new AppError('GOOGLE_RECONNECT', 401);
        const next = { ...token, access_token: result.access_token, refresh_token: result.refresh_token ?? token.refresh_token, expiresAt: Date.now() + result.expires_in * 1000, scope: result.scope ?? token.scope };
        this.tokens[service] = next; await this.persist(); return next;
      } catch (e) {
        if (e instanceof AppError && ['GOOGLE_AUTH_FAILED', 'GOOGLE_RECONNECT'].includes(e.code) && this.tokens[service] === token) { delete this.tokens[service]; await this.persist(); throw new AppError('GOOGLE_RECONNECT', 401); }
        throw e;
      }
    })();
    this.refreshes.set(service, refresh);
    try { return await refresh; } finally { this.refreshes.delete(service); }
  }
  private async get(service: GoogleService, url: string, signal?: AbortSignal): Promise<unknown> {
    const token = await this.access(service);
    try { return await this.json(url, { headers: { Authorization: `Bearer ${token.access_token}` }, signal }); }
    catch (e) {
      if (e instanceof AppError && e.code === 'GOOGLE_RECONNECT' && this.tokens[service] === token) { token.expiresAt = 0; await this.persist(); }
      throw e;
    }
  }
  async calendar(signal?: AbortSignal) {
    const now = Date.now(); const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
    url.search = new URLSearchParams({ timeMin: new Date(now).toISOString(), timeMax: new Date(now + 14 * 86400000).toISOString(), singleEvents: 'true', orderBy: 'startTime', maxResults: '250', fields: 'items(id,status,summary,start,end,location,htmlLink),nextPageToken' }).toString();
    const event = z.object({ id: z.string(), status: z.string().optional(), summary: z.string().optional(), start: z.object({ date: z.string().optional(), dateTime: z.string().optional() }).optional(), end: z.object({ date: z.string().optional(), dateTime: z.string().optional() }).optional(), location: z.string().optional(), htmlLink: z.string().optional() });
    const result = z.object({ items: z.array(event).default([]), nextPageToken: z.string().optional() }).safeParse(await this.get('calendar', url.href, signal));
    if (!result.success) throw new AppError('GOOGLE_INVALID_RESPONSE');
    return calendarSnapshotSchema.parse({ syncedAt: Date.now(), truncated: !!result.data.nextPageToken, events: result.data.items.filter(e => e.status !== 'cancelled' && (e.start?.date || e.start?.dateTime)).map(e => ({ id: e.id, title: redact(e.summary || 'Untitled event', 300), start: e.start!.dateTime || e.start!.date, end: e.end?.dateTime || e.end?.date || '', allDay: !!e.start!.date, location: redact(e.location || '', 300), url: googleLink(e.htmlLink || '', 'calendar') })) });
  }
  async gmail(signal?: AbortSignal) {
    const base = 'https://gmail.googleapis.com/gmail/v1/users/me/messages';
    const list = z.object({ messages: z.array(z.object({ id: z.string().regex(/^[a-zA-Z0-9_-]+$/) })).default([]) }).safeParse(await this.get('gmail', base + '?labelIds=INBOX&maxResults=20', signal));
    if (!list.success) throw new AppError('GOOGLE_INVALID_RESPONSE');
    const item = z.object({ id: z.string(), snippet: z.string().optional(), internalDate: z.string().optional(), payload: z.object({ headers: z.array(z.object({ name: z.string(), value: z.string() })).optional() }).optional() });
    const messages = [];
    // Bounded concurrency; a partial failure is reported instead of publishing an incomplete fresh inbox.
    for (let i = 0; i < list.data.messages.length; i += 5) {
      const batch = await Promise.all(list.data.messages.slice(i, i + 5).map(async ({ id }) => {
        const parsed = item.safeParse(await this.get('gmail', `${base}/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&fields=id,snippet,internalDate,payload(headers)`, signal));
        if (!parsed.success) throw new AppError('GOOGLE_INVALID_RESPONSE'); const mail = parsed.data;
        const header = (name: string) => mail.payload?.headers?.find(h => h.name.toLowerCase() === name)?.value || '';
        return { id: mail.id, title: redact(header('subject') || 'Untitled email', 300), from: redact(header('from'), 300), snippet: redact(mail.snippet || '', 1000), receivedAt: Number(mail.internalDate) || 0, url: `https://mail.google.com/mail/u/0/#inbox/${mail.id}` };
      })); messages.push(...batch);
    }
    return mailSnapshotSchema.parse({ messages, syncedAt: Date.now() });
  }
  async disconnect() {
    await this.loaded; this.epoch++; this.cancel();
    const tokens = Object.values(this.tokens); this.tokens = {}; this.error = undefined; await this.persist();
    const revoked = await Promise.all(tokens.map(async t => {
      try {
        const response = await this.fetcher('https://oauth2.googleapis.com/revoke', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token: t.refresh_token || t.access_token }), signal: AbortSignal.timeout(8000), redirect: 'error' });
        await response.body?.cancel(); return response.ok || response.status === 400;
      } catch { return false; }
    }));
    return { disconnected: true, revoked: revoked.every(Boolean) };
  }
}
