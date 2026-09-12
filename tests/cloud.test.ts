import test from 'node:test';
import assert from 'node:assert/strict';
import { createCloudHandler } from '../src/server/cloud';
import { AppError } from '../src/server/provider';
import { apiTarget } from '../src/extension/ai-transport';
import { CLOUD_AI_ENDPOINT, TABBY_EXTENSION_ORIGIN } from '../src/shared/cloud';
import { initialState, normalizeLanguage } from '../src/shared/types';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import ts from 'typescript';

test('compiled cloud function imports in plain Node ESM without a TypeScript loader', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'tabby-cloud-runtime-'));
  try {
    await writeFile(join(temp, 'package.json'), '{"type":"module"}');
    await symlink(resolve('node_modules'), join(temp, 'node_modules'), 'dir');
    for (const file of ['api/tabby.ts', 'src/server/cloud.ts', 'src/server/provider.ts', 'src/shared/cloud.ts', 'src/shared/schemas.ts', 'src/shared/privacy.ts', 'src/shared/workspace.ts']) {
      const output = join(temp, file.replace(/\.ts$/, '.js')); await mkdir(dirname(output), { recursive: true });
      const compiled = ts.transpileModule(await readFile(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
      await writeFile(output, compiled.outputText);
    }
    const { stdout } = await promisify(execFile)(process.execPath, ['--input-type=module', '-e', "import handler from './api/tabby.js'; const response = await handler.fetch(new Request('https://tabby-pi.vercel.app/api/tabby?op=status')); if (response.status !== 403) process.exit(1); console.log('ESM function loaded');"], { cwd: temp });
    assert.match(stdout, /ESM function loaded/);
  } finally { await rm(temp, { recursive: true, force: true }); }
});

test('existing local installations retain their routing; fresh installs default to cloud without consent', () => {
  const fresh = initialState();
  assert.equal(fresh.settings.aiMode, 'cloud'); assert.equal(fresh.settings.consent, false);
  const old = initialState(); old.settings.pairToken = 'existing-private-local-token';
  delete (old.settings as Partial<typeof old.settings>).aiMode;
  normalizeLanguage(old); assert.equal(old.settings.aiMode, 'local');
  assert.equal(old.settings.pairToken, 'existing-private-local-token');
});

function fixture() {
  const calls: unknown[] = []; let catalogCalls = 0;
  const handler = createCloudHandler({
    status: async () => { catalogCalls++; return { connected: true, code: 'READY', model: 'deepseek-v3.2', available: ['private-catalog-entry'] }; },
    run: async input => { calls.push(input); return { result: { nextStep: 'Start with one small task.' }, model: 'deepseek-v3.2' } as never; },
  }, () => true);
  return { handler, calls, catalogCalls: () => catalogCalls };
}
function request(op = 'ai', body: unknown = { kind: 'next', context: { language: 'en', goal: 'Build a form' } }, origin = TABBY_EXTENSION_ORIGIN) {
  return new Request(`${CLOUD_AI_ENDPOINT}?op=${op}`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}
test('cloud AI never sends pairing credentials; Google and Ambiguous keep authenticated loopback routing', () => {
  const settings = { aiMode: 'cloud' as const, pairToken: 'private-local-token' };
  assert.equal(apiTarget(settings, 'ai').url, CLOUD_AI_ENDPOINT + '?op=ai');
  assert.deepEqual(apiTarget(settings, 'ai').headers, { 'Content-Type': 'application/json' });
  for (const path of ['google/status', 'ambiguous/send']) {
    assert.equal(apiTarget(settings, path).url, 'http://127.0.0.1:4318/' + path);
    assert.equal(apiTarget(settings, path).headers['X-Tabby-Token'], settings.pairToken);
  }
  assert.throws(() => apiTarget({ aiMode: 'local', pairToken: '' }, 'ai'), /PAIRING_REQUIRED/);
  assert.equal(apiTarget({ aiMode: 'cloud', pairToken: '' }, 'status').cloud, true);
});
test('cloud rejects wrong/missing origins and arbitrary operations before model calls', async () => {
  const f = fixture();
  assert.equal((await f.handler(request('ai', {}, 'https://other.example'))).status, 403);
  assert.equal((await f.handler(request('ai', {}, ''))).status, 403);
  assert.equal((await f.handler(request('google/connect', {}))).status, 404);
  assert.equal((await f.handler(new Request(CLOUD_AI_ENDPOINT, { headers: { Origin: TABBY_EXTENSION_ORIGIN } }))).status, 404);
  assert.equal(f.calls.length, 0);
});
test('cloud preflight authorizes only the stable extension and POST content type', async () => {
  const response = await fixture().handler(new Request(CLOUD_AI_ENDPOINT, { method: 'OPTIONS', headers: { Origin: TABBY_EXTENSION_ORIGIN } }));
  assert.equal(response.status, 204); assert.equal(response.headers.get('access-control-allow-origin'), TABBY_EXTENSION_ORIGIN);
  assert.equal(response.headers.get('access-control-allow-headers'), 'Content-Type');
});
test('cloud validates and bounds context; clients cannot choose a provider, URL or model', async () => {
  const f = fixture();
  for (const body of [{ kind: 'chat', context: { language: 'en' } }, { kind: 'next', model: 'expensive-model', context: { language: 'en' } }, { kind: 'next', context: { language: 'en', page: { title: 'a', url: 'https://example.com', seconds: 1, text: 'x'.repeat(4001) } } }]) {
    assert.equal((await f.handler(request('ai', body))).status, 400);
  }
  assert.equal((await f.handler(request('ai', { junk: 'x'.repeat(120001) }))).status, 413);
  assert.equal(f.calls.length, 0);
  assert.equal((await f.handler(request())).status, 200); assert.equal(f.calls.length, 1);
});
test('cloud caches catalog checks and excludes the provider catalog from public status', async () => {
  const f = fixture();
  const response = await f.handler(request('status', {}));
  assert.deepEqual(await response.json(), { connected: true, code: 'READY', model: 'deepseek-v3.2' });
  await f.handler(request('status', {})); assert.equal(f.catalogCalls(), 1);
  assert.equal((await f.handler(request('status', { arbitrary: 'data' }))).status, 400);
});
test('cloud rate limit stops model calls and provides retry guidance', async () => {
  const f = fixture();
  for (let i = 0; i < 30; i++) assert.equal((await f.handler(request())).status, 200);
  const response = await f.handler(request());
  assert.equal(response.status, 429); assert.equal(response.headers.get('retry-after'), '60'); assert.equal(f.calls.length, 30);
});
test('cloud kill switch and failures never expose account errors or secret data', async () => {
  let calls = 0;
  const provider = { status: async () => { throw new Error('private-secret'); }, run: async () => { calls++; throw new AppError('API_KEY_INVALID'); } };
  const disabled = createCloudHandler(provider, () => false);
  assert.equal((await disabled(request())).status, 503); assert.equal(calls, 0);
  const enabled = createCloudHandler(provider, () => true);
  assert.deepEqual(await (await enabled(request())).json(), { error: { code: 'CLOUD_UNAVAILABLE' } });
  const error = await enabled(request('status', {})); assert.equal(error.status, 503); assert.ok(!(await error.text()).includes('private-secret'));
});
