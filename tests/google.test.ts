import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { GoogleIntegration } from '../src/server/google';
import { createApp } from '../src/server/http';

// Real loopback OAuth/HTTP exchanges, with explicit Google API fixtures. No Google account or AI is called.
test('Google OAuth uses PKCE, validates state, persists private tokens, reads events/mail and revokes', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'tabby-google-')); const file = join(dir, 'tokens.json');
  let challenge = ''; let service = 'calendar'; let exchanges = 0; let refreshes = 0;
  const scope = () => `https://www.googleapis.com/auth/${service === 'calendar' ? 'calendar.events.readonly' : 'gmail.readonly'}`;
  const fetcher: typeof fetch = async (url, options) => {
    const u = new URL(String(url));
    if (u.pathname === '/token') {
      const params = new URLSearchParams(String(options?.body));
      assert.equal(params.get('client_id'), 'fixture.apps.googleusercontent.com');
      if (params.get('grant_type') === 'authorization_code') { exchanges++; assert.equal(createHash('sha256').update(params.get('code_verifier')!).digest('base64url'), challenge); }
      else { refreshes++; assert.ok(params.get('refresh_token')); }
      return Response.json({ access_token: 'fixture-google-access', refresh_token: 'fixture-google-refresh', expires_in: 3600, scope: scope() });
    }
    if (u.pathname === '/revoke') return new Response('');
    assert.equal((options?.headers as Record<string, string>).Authorization, 'Bearer fixture-google-access');
    if (u.pathname.includes('/calendar/')) {
      assert.equal(u.searchParams.get('singleEvents'), 'true'); assert.equal(u.searchParams.get('orderBy'), 'startTime');
      return Response.json({ items: [{ id: 'all-day', summary: 'Planning day', start: { date: '2026-09-14' }, end: { date: '2026-09-15' }, htmlLink: 'https://calendar.google.com/calendar/event?eid=fixture' }, { id: 'cancelled', status: 'cancelled', start: { date: '2026-09-14' } }, { id: 'meeting', summary: 'Design review', start: { dateTime: '2026-09-14T10:00:00+04:00' }, end: { dateTime: '2026-09-14T11:00:00+04:00' }, htmlLink: 'javascript:alert(1)' }] });
    }
    if (u.pathname.endsWith('/messages')) return Response.json({ messages: [{ id: 'mail1' }] });
    assert.equal(u.searchParams.get('format'), 'metadata');
    return Response.json({ id: 'mail1', internalDate: '1700000000000', snippet: 'Please prepare the review.', payload: { headers: [{ name: 'Subject', value: 'Review follow-up' }, { name: 'From', value: 'Test sender' }] } });
  };
  const google = new GoogleIntegration({ clientId: 'fixture.apps.googleusercontent.com', clientSecret: 'fixture-secret', tokenFile: file }, fetcher);
  try {
    for (const selected of ['calendar', 'gmail'] as const) {
      service = selected;
      const { url } = await google.connect({ service }); const auth = new URL(url);
      challenge = auth.searchParams.get('code_challenge')!;
      assert.equal(auth.searchParams.get('scope'), scope()); assert.equal(auth.searchParams.get('code_challenge_method'), 'S256');
      assert.ok(!url.includes('fixture-secret')); assert.ok(!url.includes('fixture-google-access'));
      const callback = auth.searchParams.get('redirect_uri')!;
      assert.equal((await fetch(callback + '?state=wrong&code=fixture')).status, 400);
      const good = await fetch(callback + '?' + new URLSearchParams({ state: auth.searchParams.get('state')!, code: 'fixture-code' }));
      assert.equal(good.status, 200); assert.ok(!(await good.text()).includes('fixture-google-access'));
      assert.equal((await google.status())[selected], true);
    }
    assert.equal(exchanges, 2); assert.equal(refreshes, 0);
    assert.equal((await stat(file)).mode & 0o777, 0o600);
    const events = await google.calendar(); assert.equal(events.events.length, 2); assert.equal(events.events[0].allDay, true); assert.equal(events.events[1].url, '');
    const inbox = await google.gmail(); assert.equal(inbox.messages[0].title, 'Review follow-up'); assert.equal(inbox.messages[0].snippet, 'Please prepare the review.');
    const publicData = JSON.stringify({ status: await google.status(), events, inbox });
    assert.ok(!publicData.includes('fixture-google-access')); assert.ok(!publicData.includes('fixture-google-refresh'));
    const restored = new GoogleIntegration({ clientId: 'fixture.apps.googleusercontent.com', tokenFile: file }, fetcher); assert.equal((await restored.status()).calendar, true);
    assert.equal((await google.disconnect()).revoked, true); assert.equal((await google.status()).calendar, false); await assert.rejects(readFile(file), /ENOENT/);
  } finally { google.cancel(); await rm(dir, { recursive: true, force: true }); }
});

test('Google denied consent, malformed bodies and missing credentials are explicit', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'tabby-google-errors-')); let calls = 0;
  const google = new GoogleIntegration({ clientId: 'fixture.apps.googleusercontent.com', tokenFile: join(dir, 'tokens.json') }, async () => { calls++; throw new Error('upstream secret'); });
  try {
    await assert.rejects(google.connect({ service: 'calendar', arbitrary: true }), /INVALID_REQUEST/);
    const auth = new URL((await google.connect({ service: 'calendar' })).url);
    const response = await fetch(auth.searchParams.get('redirect_uri')! + '?' + new URLSearchParams({ state: auth.searchParams.get('state')!, error: 'access_denied' }));
    assert.equal(response.status, 400); assert.equal((await google.status()).error, 'GOOGLE_ACCESS_DENIED'); assert.equal(calls, 0);
    await assert.rejects(google.calendar(), /GOOGLE_RECONNECT/);
    const disabled = new GoogleIntegration({ clientId: '', tokenFile: join(dir, 'none.json') }); await assert.rejects(disabled.connect({ service: 'gmail' }), /GOOGLE_NOT_CONFIGURED/);
  } finally { google.cancel(); await rm(dir, { recursive: true, force: true }); }
});

test('expired Google tokens refresh once across concurrent reads and a rejected access token is retried', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'tabby-google-refresh-')); const file = join(dir, 'tokens.json'); let refreshes = 0; let rejectAccess = false; let revoked = false;
  await writeFile(file, JSON.stringify({ clientId: 'fixture.apps.googleusercontent.com', tokens: { calendar: { access_token: 'expired', refresh_token: 'fixture-refresh', expiresAt: 0, scope: 'https://www.googleapis.com/auth/calendar.events.readonly' } } }), { mode: 0o600 });
  const google = new GoogleIntegration({ clientId: 'fixture.apps.googleusercontent.com', tokenFile: file }, async (url, options) => {
    if (String(url).endsWith('/token')) {
      const body = new URLSearchParams(String(options?.body)); assert.equal(body.get('grant_type'), 'refresh_token'); assert.equal(body.get('refresh_token'), 'fixture-refresh');
      refreshes++; if (revoked) return new Response('private upstream error', { status: 400 });
      return Response.json({ access_token: `fresh-${refreshes}`, expires_in: 3600 });
    }
    if (rejectAccess) { rejectAccess = false; return new Response('', { status: 401 }); }
    assert.equal((options?.headers as Record<string, string>).Authorization, `Bearer fresh-${refreshes}`);
    return Response.json({ items: [] });
  });
  try {
    await Promise.all([google.calendar(), google.calendar()]); assert.equal(refreshes, 1);
    rejectAccess = true; await google.calendar(); assert.equal(refreshes, 2);
    rejectAccess = true; revoked = true; await assert.rejects(google.calendar(), /GOOGLE_RECONNECT/);
    assert.equal((await google.status()).calendar, false); await assert.rejects(readFile(file), /ENOENT/);
  } finally { google.cancel(); await rm(dir, { recursive: true, force: true }); }
});

test('disconnect during an OAuth exchange prevents late credentials from resurrecting', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'tabby-google-race-')); let release!: () => void; let entered!: () => void;
  const started = new Promise<void>(resolve => { entered = resolve; }); const blocked = new Promise<void>(resolve => { release = resolve; });
  const google = new GoogleIntegration({ clientId: 'fixture.apps.googleusercontent.com', tokenFile: join(dir, 'tokens.json') }, async () => { entered(); await blocked; return Response.json({ access_token: 'late', refresh_token: 'late', expires_in: 3600 }); });
  try {
    const auth = new URL((await google.connect({ service: 'calendar' })).url);
    const callback = fetch(auth.searchParams.get('redirect_uri')! + '?' + new URLSearchParams({ state: auth.searchParams.get('state')!, code: 'fixture' }));
    await started; assert.equal((await google.status()).pending, 'calendar'); await google.disconnect(); release();
    assert.equal((await callback).status, 400); assert.equal((await google.status()).calendar, false);
    await assert.rejects(readFile(join(dir, 'tokens.json')), /ENOENT/);
  } finally { release?.(); google.cancel(); await rm(dir, { recursive: true, force: true }); }
});

test('Google API routes retain extension Origin and token checks and never invoke the model', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'tabby-google-http-')); let modelCalls = 0;
  const google = new GoogleIntegration({ clientId: '', tokenFile: join(dir, 'tokens.json') });
  const config = { port: 0, extensionId: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', pairToken: 'fixture-pairing-token-'.repeat(3) };
  const app = createApp(config, { status: async () => { modelCalls++; return {} as any; }, run: async () => { modelCalls++; return {} as any; } }, google);
  await new Promise<void>(resolve => app.listen(0, '127.0.0.1', resolve)); config.port = (app.address() as { port: number }).port;
  const post = (path: string, headers = {}, body = '{}') => fetch(`http://127.0.0.1:${config.port}${path}`, { method: 'POST', body, headers: { 'Content-Type': 'application/json', ...headers } });
  const valid = { Origin: `chrome-extension://${config.extensionId}`, 'X-Tabby-Token': config.pairToken };
  try {
    assert.equal((await post('/google/status', { ...valid, Origin: 'https://evil.example' })).status, 403);
    assert.equal((await post('/google/status', { Origin: valid.Origin })).status, 401);
    assert.deepEqual(await (await post('/google/status', valid)).json(), { configured: false, calendar: false, gmail: false, pending: null });
    assert.equal((await post('/google/calendar', valid, '{"url":"https://evil.example"}')).status, 400);
    assert.equal((await post('/google/connect', valid, '{"service":"drive"}')).status, 400);
    assert.equal(modelCalls, 0);
  } finally { await new Promise<void>(resolve => app.close(() => resolve())); await rm(dir, { recursive: true, force: true }); }
});
