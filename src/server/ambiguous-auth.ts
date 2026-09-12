import { createServer, type Server } from 'node:http';
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile, rename, rm } from 'node:fs/promises';
import { dirname } from 'node:path';
import { auth, type OAuthClientProvider } from '@modelcontextprotocol/sdk/client/auth.js';
import type { OAuthClientInformationMixed, OAuthTokens } from '@modelcontextprotocol/sdk/shared/auth.js';
import { AMBIGUOUS_MCP, AMBIGUOUS_ORIGIN } from '../shared/ambiguous';
import { AppError } from './provider';
export async function privateJson(file: string, data: unknown) {
  await mkdir(dirname(file), { recursive: true, mode: 0o700 }); const temp = file + '.' + randomBytes(8).toString('hex') + '.tmp';
  try { await writeFile(temp, JSON.stringify(data), { mode: 0o600, flag: 'wx' }); await rename(temp, file); }
  finally { await rm(temp, { force: true }); }
}
export class AmbiguousAuth {
  private tokens?: OAuthTokens; private loading?: Promise<void>; private epoch = 0; private callback?: Server;
  private timer?: ReturnType<typeof setTimeout>; private error?: string; private writing: Promise<void> = Promise.resolve();
  constructor(private file: string, private apiKey = '', private fetcher: typeof fetch = fetch) {}
  private async load() {
    this.loading ??= (async () => {
      try { const value = JSON.parse(await readFile(this.file, 'utf8')); if (typeof value.access_token === 'string' && typeof value.token_type === 'string' && value.token_type.toLowerCase() === 'bearer') this.tokens = value; }
      catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') this.error = 'AMBIGUOUS_AUTH_REQUIRED'; }
    })();
    await this.loading;
  }
  async key() { await this.load(); return this.apiKey || this.tokens?.access_token || ''; }
  async rejectedKey(key: string) {
    await this.load(); if (this.apiKey || this.tokens?.access_token !== key) return;
    this.tokens = undefined; this.error = 'AMBIGUOUS_AUTH_REQUIRED';
    await this.writing.catch(() => {}); await rm(this.file, { force: true });
  }
  async status() { return { configured: !!await this.key(), pending: !!this.callback, ...(this.error ? { error: this.error } : {}) }; }
  cancel() { this.epoch++; clearTimeout(this.timer); this.callback?.closeAllConnections(); this.callback?.close(); this.callback = undefined; }
  async disconnect() {
    await this.load(); this.cancel(); const token = this.tokens?.access_token; this.tokens = undefined; await this.writing.catch(() => {}); await rm(this.file, { force: true });
    if (token) await this.fetcher(AMBIGUOUS_ORIGIN + '/oauth/revoke', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token }), redirect: 'error', signal: AbortSignal.timeout(5000) }).catch(() => {});
    this.error = undefined;
  }
  async connect(): Promise<{ authorizationUrl?: string }> {
    await this.load(); if (await this.key()) return {};
    this.cancel(); this.error = undefined; const epoch = this.epoch; const state = randomBytes(32).toString('hex');
    let verifier = ''; let client: OAuthClientInformationMixed | undefined; let authorizationUrl = ''; let exchanged = false;
    const guardedFetch: typeof fetch = async (raw, init) => {
      const url = new URL(typeof raw === 'string' ? raw : raw instanceof URL ? raw.href : raw.url);
      if (url.origin !== AMBIGUOUS_ORIGIN) throw new AppError('AMBIGUOUS_AUTH_FAILED');
      return this.fetcher(raw, { ...init, redirect: 'error', signal: AbortSignal.timeout(15000) });
    };
    const callback = createServer(async (req, res) => {
      const address = callback.address(); const port = typeof address === 'object' && address ? address.port : 0;
      const url = new URL(req.url || '/', `http://127.0.0.1:${port}`);
      res.setHeader('Content-Type', 'text/plain; charset=utf-8'); res.setHeader('Cache-Control', 'no-store'); res.setHeader('Referrer-Policy', 'no-referrer');
      if (req.method !== 'GET' || req.headers.host !== `127.0.0.1:${port}` || url.pathname !== '/ambiguous/callback' || url.searchParams.get('state') !== state || epoch !== this.epoch || exchanged) { res.writeHead(400); res.end('Invalid or expired connection request.'); return; }
      exchanged = true;
      try {
        if (url.searchParams.has('error') || !url.searchParams.get('code')) throw new AppError('AMBIGUOUS_AUTH_DENIED');
        await auth(provider, { serverUrl: AMBIGUOUS_MCP, authorizationCode: url.searchParams.get('code')!, resourceMetadataUrl: new URL(AMBIGUOUS_ORIGIN + '/.well-known/oauth-protected-resource'), fetchFn: guardedFetch });
        if (epoch !== this.epoch) throw new AppError('AMBIGUOUS_AUTH_FAILED');
        res.end('Ambiguous connected. Return to Tabby and load your channels.');
      } catch (e) { if (epoch === this.epoch) this.error = e instanceof AppError ? e.code : 'AMBIGUOUS_AUTH_FAILED'; res.writeHead(400); res.end('Connection was not completed. Return to Tabby and try again.'); }
      finally { if (this.callback === callback) { clearTimeout(this.timer); this.callback = undefined; } callback.close(); }
    });
    this.callback = callback;
    await new Promise<void>((resolve, reject) => { callback.once('error', reject); callback.listen(0, '127.0.0.1', resolve); });
    const address = callback.address(); if (!address || typeof address === 'string') throw new AppError('AMBIGUOUS_AUTH_FAILED');
    const redirectUrl = `http://127.0.0.1:${address.port}/ambiguous/callback`;
    const provider: OAuthClientProvider = {
      redirectUrl, clientMetadata: { client_name: 'Tabby focus companion', redirect_uris: [redirectUrl], grant_types: ['authorization_code'], response_types: ['code'], token_endpoint_auth_method: 'none', scope: '*' },
      state: () => state, clientInformation: () => client, saveClientInformation: value => { client = value; },
      tokens: () => undefined,
      saveTokens: async value => {
        if (epoch !== this.epoch) throw new AppError('AMBIGUOUS_AUTH_FAILED');
        this.writing = this.writing.catch(() => {}).then(async () => { if (epoch !== this.epoch) return; await privateJson(this.file, value); if (epoch === this.epoch) this.tokens = value; });
        await this.writing;
      },
      saveCodeVerifier: value => { verifier = value; }, codeVerifier: () => verifier,
      redirectToAuthorization: url => { if (url.origin !== AMBIGUOUS_ORIGIN || url.pathname !== '/oauth/authorize') throw new AppError('AMBIGUOUS_AUTH_FAILED'); authorizationUrl = url.href; },
    };
    this.timer = setTimeout(() => { if (epoch === this.epoch) { this.error = 'AMBIGUOUS_AUTH_EXPIRED'; this.cancel(); } }, 5 * 60000);
    try {
      await auth(provider, { serverUrl: AMBIGUOUS_MCP, resourceMetadataUrl: new URL(AMBIGUOUS_ORIGIN + '/.well-known/oauth-protected-resource'), fetchFn: guardedFetch });
      if (!authorizationUrl || epoch !== this.epoch) throw new AppError('AMBIGUOUS_AUTH_FAILED');
      return { authorizationUrl };
    } catch { if (epoch === this.epoch) this.cancel(); throw new AppError('AMBIGUOUS_AUTH_FAILED'); }
  }
}
