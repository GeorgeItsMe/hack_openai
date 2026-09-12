import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { request } from 'node:http';
import { AmbiguousAuth } from '../src/server/ambiguous-auth';
import { AmbiguousIntegration } from '../src/server/ambiguous';
import { createApp } from '../src/server/http';
import { AMBIGUOUS_MCP, AMBIGUOUS_ORIGIN, focusReport } from '../src/shared/ambiguous';
import { ambiguousCommands } from '../src/extension/ambiguous-worker';
import { initialState, normalizeLanguage } from '../src/shared/types';
import { createSession } from '../src/shared/engine';
import { mergeSync, syncRecords } from '../src/shared/sync';
import { saveTask } from '../src/shared/projects';
import { ambiguousFixture, channelId, messageId, sentId } from './ambiguous-fixture';

test('Ambiguous OAuth uses SDK discovery, registration, PKCE and one-use loopback state; tokens stay private', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'tabby-ambiguous-auth-')); const file = join(dir, 'oauth.json');
  let challenge = ''; let exchanges = 0; let revoked = 0; let tokenGate = Promise.resolve(); let onExchange = () => {}; let release = () => {};
  const fetcher: typeof fetch = async (raw, init) => {
    const url = new URL(String(raw)); assert.equal(url.origin, AMBIGUOUS_ORIGIN); assert.equal(init?.redirect, 'error');
    if (url.pathname === '/.well-known/oauth-protected-resource') return Response.json({ resource: AMBIGUOUS_MCP, authorization_servers: [AMBIGUOUS_ORIGIN], scopes_supported: ['*'] });
    if (url.pathname.includes('oauth-authorization-server')) return Response.json({ issuer: AMBIGUOUS_ORIGIN, authorization_endpoint: AMBIGUOUS_ORIGIN + '/oauth/authorize', token_endpoint: AMBIGUOUS_ORIGIN + '/oauth/token', registration_endpoint: AMBIGUOUS_ORIGIN + '/oauth/register', response_types_supported: ['code'], grant_types_supported: ['authorization_code'], token_endpoint_auth_methods_supported: ['none'], code_challenge_methods_supported: ['S256'] });
    if (url.pathname === '/oauth/register') {
      const input = JSON.parse(String(init?.body)); assert.equal(input.token_endpoint_auth_method, 'none'); assert.match(input.redirect_uris[0], /^http:\/\/127\.0\.0\.1:\d+\/ambiguous\/callback$/);
      return Response.json({ ...input, client_id: 'fixture-public-client' }, { status: 201 });
    }
    if (url.pathname === '/oauth/token') {
      const body = new URLSearchParams(String(init?.body)); assert.equal(body.get('grant_type'), 'authorization_code'); assert.equal(body.get('code'), 'fixture-code');
      assert.equal(createHash('sha256').update(body.get('code_verifier')!).digest('base64url'), challenge); exchanges++; onExchange(); await tokenGate;
      return Response.json({ access_token: 'fixture-private-access', token_type: 'Bearer', expires_in: 3600 });
    }
    if (url.pathname === '/oauth/revoke') { revoked++; return new Response(''); }
    throw new Error('Unexpected OAuth URL');
  };
  const auth = new AmbiguousAuth(file, '', fetcher);
  try {
    assert.equal((await auth.status()).configured, false);
    const url = new URL((await auth.connect()).authorizationUrl!); challenge = url.searchParams.get('code_challenge')!;
    assert.equal(url.origin, AMBIGUOUS_ORIGIN); assert.equal(url.searchParams.get('code_challenge_method'), 'S256'); assert.ok(challenge);
    const callback = url.searchParams.get('redirect_uri')!;
    assert.equal((await fetch(callback + '?state=wrong&code=fixture-code')).status, 400); assert.equal(exchanges, 0);
    const correct = callback + '?' + new URLSearchParams({ state: url.searchParams.get('state')!, code: 'fixture-code' });
    assert.equal((await fetch(correct, { method: 'POST' })).status, 400);
    const response = await fetch(correct); assert.equal(response.status, 200); assert.ok(!(await response.text()).includes('fixture-private-access'));
    assert.equal(exchanges, 1); assert.equal((await stat(file)).mode & 0o777, 0o600);
    assert.ok(!JSON.stringify(await auth.status()).includes('fixture-private-access'));
    const restored = new AmbiguousAuth(file, '', fetcher); assert.equal(await restored.key(), 'fixture-private-access');
    await auth.disconnect(); assert.equal((await auth.status()).configured, false); assert.equal(revoked, 1); await assert.rejects(readFile(file), /ENOENT/);
    const denied = new URL((await auth.connect()).authorizationUrl!);
    assert.equal((await fetch(denied.searchParams.get('redirect_uri')! + '?' + new URLSearchParams({ state: denied.searchParams.get('state')!, error: 'access_denied' }))).status, 400);
    assert.equal((await auth.status()).error, 'AMBIGUOUS_AUTH_DENIED'); assert.equal(exchanges, 1);
    tokenGate = new Promise<void>(resolve => { release = resolve; }); const started = new Promise<void>(resolve => { onExchange = resolve; });
    const delayed = new URL((await auth.connect()).authorizationUrl!); challenge = delayed.searchParams.get('code_challenge')!;
    const callbackResult = fetch(delayed.searchParams.get('redirect_uri')! + '?' + new URLSearchParams({ state: delayed.searchParams.get('state')!, code: 'fixture-code' })).catch(() => null);
    await started; await auth.disconnect(); release(); await callbackResult; await new Promise<void>(resolve => setImmediate(resolve));
    assert.equal((await auth.status()).configured, false); await assert.rejects(readFile(file), /ENOENT/);
  } finally { release(); auth.cancel(); await rm(dir, { recursive: true, force: true }); }
});

for (const transport of ['mcp', 'rest'] as const) test(`Ambiguous ${transport}: actual protocol reads and allowlists, durable duplicate protection, unknown delivery`, async () => {
  const dir = await mkdtemp(join(tmpdir(), 'tabby-ambiguous-protocol-')); const fixture = await ambiguousFixture();
  const config = { key: 'fixture-ambiguous-key', transport, authFile: join(dir, 'oauth.json'), receiptFile: join(dir, 'receipts.json') };
  const service = new AmbiguousIntegration(config, fixture.fetcher);
  try {
    assert.deepEqual(await service.channels(), { channels: [{ id: channelId, name: 'design-fixture', type: 'private' }], truncated: false });
    const messages = await service.messages({ channelId, cursor: 'older-page' }); assert.equal(messages.messages[0].id, messageId);
    assert.ok(!JSON.stringify(messages).includes('private@example')); assert.equal(fixture.calls.at(-1)?.args.cursor, 'older-page');
    await assert.rejects(service.messages({ channelId, url: 'https://evil.test' }), /INVALID_REQUEST/);
    const report = { requestId: crypto.randomUUID(), channelId, threadId: messageId, content: 'Reviewed focus report · fixture' };
    const sent = await Promise.all([service.send(report), service.send(report)]); assert.equal(sent[0].messageId, sentId); assert.equal(sent[1].replayed, true);
    const restored = new AmbiguousIntegration(config, fixture.fetcher); assert.equal((await restored.send(report)).replayed, true);
    assert.equal(fixture.calls.filter(c => c.name === 'send_message').length, 1);
    await assert.rejects(restored.send({ ...report, content: 'Changed' }), /AMBIGUOUS_REPORT_CHANGED/);
    const receiptText = await readFile(config.receiptFile, 'utf8'); assert.ok(!receiptText.includes(report.content)); assert.ok(!receiptText.includes(config.key)); assert.equal((await stat(config.receiptFile)).mode & 0o777, 0o600);
    fixture.setMode('timeout'); const uncertain = { ...report, requestId: crypto.randomUUID() };
    await assert.rejects(service.send(uncertain), /AMBIGUOUS_DELIVERY_UNKNOWN/);
    const callCount = fixture.calls.length; fixture.setMode('ok'); await assert.rejects(restored.send(uncertain), /AMBIGUOUS_DELIVERY_UNKNOWN/); assert.equal(fixture.calls.length, callCount);
    fixture.setMode('wrong-destination'); await assert.rejects(service.send({ ...report, requestId: crypto.randomUUID() }), /AMBIGUOUS_DELIVERY_UNKNOWN/);
    if (transport === 'mcp') {
      fixture.setMode('missing-tool'); const before = await readFile(config.receiptFile, 'utf8');
      await assert.rejects(service.send({ ...report, requestId: crypto.randomUUID() }), /AMBIGUOUS_TOOL_UNAVAILABLE/); assert.equal(await readFile(config.receiptFile, 'utf8'), before);
    }
    fixture.setMode('ok'); const beforeCancel = fixture.calls.length;
    await assert.rejects(service.send({ ...report, requestId: crypto.randomUUID() }, AbortSignal.abort())); assert.equal(fixture.calls.length, beforeCancel);
    await writeFile(config.receiptFile, '{invalid'); await assert.rejects(service.send({ ...report, requestId: crypto.randomUUID() }), /AMBIGUOUS_RECEIPT_ERROR/);
  } finally { service.cancel(); await fixture.close(); await rm(dir, { recursive: true, force: true }); }
});

test('Ambiguous auth failures allow OAuth reconnection and HTTP routes preserve Host, Origin and pair-token checks', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'tabby-ambiguous-http-')); const authFile = join(dir, 'oauth.json'); let modelCalls = 0;
  await writeFile(authFile, JSON.stringify({ access_token: 'expired-fixture-token', token_type: 'Bearer' }));
  const service = new AmbiguousIntegration({ authFile, receiptFile: join(dir, 'receipts.json'), transport: 'rest' }, async () => new Response('private upstream error', { status: 401 }));
  const config = { port: 0, extensionId: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', pairToken: 'fixture-local-pair-token-'.repeat(3) };
  const app = createApp(config, { status: async () => { modelCalls++; return {} as any; }, run: async () => { modelCalls++; return {} as any; } }, undefined, service);
  await new Promise<void>(resolve => app.listen(0, '127.0.0.1', resolve)); config.port = (app.address() as { port: number }).port;
  const valid = { Origin: `chrome-extension://${config.extensionId}`, 'X-Tabby-Token': config.pairToken };
  const post = (path: string, headers = {}, body = {}) => fetch(`http://127.0.0.1:${config.port}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
  try {
    assert.equal((await post('/ambiguous/status', { ...valid, Origin: 'https://evil.test' })).status, 403);
    const wrongHost = await new Promise<number | undefined>((resolve, reject) => { const req = request({ hostname: '127.0.0.1', port: config.port, path: '/ambiguous/status', method: 'POST', headers: { ...valid, Host: 'evil.test', 'Content-Type': 'application/json' } }, res => { res.resume(); resolve(res.statusCode); }); req.on('error', reject); req.end('{}'); });
    assert.equal(wrongHost, 403);
    assert.equal((await post('/ambiguous/status', { Origin: valid.Origin })).status, 401);
    assert.equal((await post('/ambiguous/send', valid, { url: 'https://evil.test' })).status, 400);
    assert.equal((await post('/ambiguous/channels', valid, { unexpected: true })).status, 400);
    const failed = await post('/ambiguous/channels', valid); assert.equal(failed.status, 401); assert.ok(!(await failed.text()).includes('private upstream'));
    assert.equal((await service.status()).configured, false); await assert.rejects(readFile(authFile), /ENOENT/);
    assert.equal((await post('/ai', { Origin: valid.Origin })).status, 401); assert.equal(modelCalls, 0);
  } finally { service.cancel(); await new Promise<void>(resolve => app.close(() => resolve())); await rm(dir, { recursive: true, force: true }); }
});

test('Ambiguous drafts, fixed report destinations, explicit confirmation, cancellation and worker restart recovery', async () => {
  const state = initialState(); state.ambiguous.enabled = true; const calls: Array<{ path: string; body: any }> = [];
  let release!: () => void; let entered!: () => void; const started = new Promise<void>(resolve => { entered = resolve; }); const wait = new Promise<void>(resolve => { release = resolve; });
  let queue = Promise.resolve<unknown>(undefined);
  const commands = ambiguousCommands({ state: () => state, save: async () => {}, serial: fn => { const next = queue.then(fn); queue = next.catch(() => {}); return next; }, api: async (path, body) => { calls.push({ path, body }); entered(); await wait; return { messageId: sentId, replayed: false }; } });
  state.ambiguous.channels = [{ id: channelId, name: 'design', type: 'private' }]; state.ambiguous.capturedAt = Date.now();
  state.ambiguous.messages = [{ id: messageId, channelId, threadId: null, content: 'Review the design\nRead the brief', author: 'Alex', createdAt: null }];
  await commands.handle({ type: 'AMBIGUOUS_DRAFT', messageId }); assert.equal(state.tasks.length, 0); assert.equal(state.taskDraft?.ambiguous?.threadId, messageId); assert.equal(calls.length, 0);
  const source = state.taskDraft!.ambiguous!; const task = saveTask(state, { ...state.taskDraft, status: 'planned' }); task.ambiguous = source;
  await assert.rejects(commands.handle({ type: 'AMBIGUOUS_DRAFT', messageId }), /AMBIGUOUS_ALREADY_IMPORTED/);
  state.session = createSession(task.title, task.id, 25); state.session.ambiguous = source;
  await assert.rejects(commands.handle({ type: 'AMBIGUOUS_PREPARE_REPORT', sessionId: state.session.id }), /AMBIGUOUS_SESSION_REQUIRED/);
  state.session.phase = 'finished'; state.session.endedAt = Date.now(); state.session.totals.unknown = 60000;
  await commands.handle({ type: 'AMBIGUOUS_PREPARE_REPORT', sessionId: state.session.id }); assert.equal(calls.length, 0); assert.match(state.ambiguous.report!.content, /Unclassified: 1.0 min/);
  await assert.rejects(commands.handle({ type: 'AMBIGUOUS_SEND_REPORT', reportId: state.session.id, content: 'Test' }), /CONFIRM_REQUIRED/); assert.equal(calls.length, 0);
  const pending = commands.handle({ type: 'AMBIGUOUS_SEND_REPORT', reportId: state.session.id, content: 'Reviewed', confirm: true, channelId: sentId, threadId: sentId }); await started;
  await assert.rejects(commands.handle({ type: 'AMBIGUOUS_SEND_REPORT', reportId: state.session.id, content: 'Reviewed', confirm: true }), /AMBIGUOUS_SENDING/);
  assert.equal(calls[0].body.channelId, channelId); assert.equal(calls[0].body.threadId, messageId);
  const restored = normalizeLanguage(structuredClone(state)); assert.equal(restored.ambiguous.report?.state, 'unknown'); assert.equal(restored.session?.ambiguousReport?.state, 'unknown');
  commands.invalidate(); release(); await pending; assert.equal(state.ambiguous.report, undefined); assert.equal(state.session.ambiguousReport?.state, 'unknown');
  await assert.rejects(commands.handle({ type: 'AMBIGUOUS_PREPARE_REPORT', sessionId: state.session.id }), /AMBIGUOUS_DELIVERY_UNKNOWN/);
  state.settings.excludedSites = ['app.ambiguous.ai']; await assert.rejects(commands.handle({ type: 'AMBIGUOUS_DRAFT', messageId }), /PAGE_UNAVAILABLE/);
});

test('Ambiguous provenance remains local across sync merges and factual reports omit unrelated data', () => {
  const state = initialState(); const task = saveTask(state, { title: 'Focus task', steps: [], status: 'planned' }, 10);
  task.ambiguous = { channelId, messageId, threadId: messageId, channelName: 'Private team' };
  const records = syncRecords(state); assert.ok(!JSON.stringify(records).includes(channelId)); assert.ok(!JSON.stringify(records).includes('Private team'));
  const remote = structuredClone(records); const key = Object.keys(remote)[0]; (remote[key] as any).title = 'Updated on another device'; (remote[key] as any).updatedAt = 20;
  mergeSync(state, remote); assert.equal(state.tasks[0].ambiguous?.threadId, messageId);
  const secondDevice = initialState(); mergeSync(secondDevice, remote); assert.equal(secondDevice.tasks[0].ambiguous, undefined);
  state.settings.pairToken = 'PRIVATE_PAIR_TOKEN'; saveTask(state, { title: 'UNRELATED_PRIVATE_TASK', steps: [], status: 'done' }, 25);
  const session = createSession('Focus goal', task.id, 25, 20); session.phase = 'finished'; session.endedAt = 50;
  const report = focusReport(state, session); assert.ok(!report.includes('UNRELATED')); assert.ok(!report.includes('PRIVATE_PAIR_TOKEN')); assert.ok(!report.includes('marked done'));
});
