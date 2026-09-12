import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createCloudHandler } from '../src/server/cloud';
import { CLOUD_AI_ENDPOINT, TABBY_EXTENSION_ORIGIN } from '../src/shared/cloud';
import type { AppState } from '../src/shared/types';

// Actual Chromium/extension and cloud HTTP boundary; model responses are fixtures.
const calls: unknown[] = []; const headers: Record<string, unknown>[] = [];
const handler = createCloudHandler({
  status: async () => ({ connected: true, code: 'READY', model: 'deepseek-v3.2', available: [] }),
  run: async input => { calls.push(input); return { result: { reply: 'Here is a small task. Confirm the card to save it. Test fixture.', actions: [{ type: 'create_task', title: 'Build the first screen', steps: ['Sketch the layout'], due: '' }] }, model: 'deepseek-v3.2' } as never; },
}, () => true);
const server = createServer(async (req, res) => {
  headers.push(req.headers); const chunks: Buffer[] = []; for await (const chunk of req) chunks.push(chunk);
  const response = await handler(new Request(`http://127.0.0.1${req.url}`, { method: req.method, headers: req.headers as Record<string, string>, ...(req.method === 'POST' ? { body: Buffer.concat(chunks) } : {}) }));
  res.writeHead(response.status, Object.fromEntries(response.headers)); res.end(Buffer.from(await response.arrayBuffer()));
});
server.listen(0, '127.0.0.1'); await once(server, 'listening');
const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
const temp = await mkdtemp(join(tmpdir(), 'tabby-cloud-browser-')); const extension = join(temp, 'extension');
await cp(resolve('dist/extension'), extension, { recursive: true });
const manifest = JSON.parse(await readFile(join(extension, 'manifest.json'), 'utf8'));
manifest.content_security_policy.extension_pages = manifest.content_security_policy.extension_pages.replace('http://127.0.0.1:4318', base);
await writeFile(join(extension, 'manifest.json'), JSON.stringify(manifest));
await writeFile(join(extension, 'worker.js'), (await readFile(join(extension, 'worker.js'), 'utf8')).replaceAll(CLOUD_AI_ENDPOINT, base + '/api/tabby'));
const browser = await chromium.launchPersistentContext(join(temp, 'profile'), { channel: 'chromium', headless: true, viewport: { width: 390, height: 844 }, args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`] });
try {
  const page = await browser.newPage(); const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(TABBY_EXTENSION_ORIGIN + '/sidepanel.html');
  const get = () => page.evaluate(async () => (await chrome.runtime.sendMessage({ type: 'GET' })).data as AppState);
  await expect(page.getByRole('button', { name: 'Enable AI', exact: true })).toBeVisible();
  assert.equal((await get()).settings.aiMode, 'cloud'); assert.equal((await get()).settings.pairToken, '');
  assert.equal(headers.length, 0); console.log('PASS: fresh install needs no token and sends no requests before Enable AI.');
  await page.getByRole('button', { name: 'Enable AI', exact: true }).click();
  await expect.poll(async () => (await get()).ai.connected).toBe(true);
  assert.equal((await get()).settings.consent, true); assert.equal((await get()).settings.readText, false);
  await page.getByRole('button', { name: 'AI chat', exact: true }).click();
  await page.getByLabel('Message Tabby').fill('Create a task to build the first screen.');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(page.locator('.chat-proposal')).toHaveCount(1); assert.equal((await get()).tasks.length, 0);
  await page.getByRole('button', { name: 'Create task', exact: true }).click(); assert.equal((await get()).tasks.length, 1);
  await page.reload(); await page.getByRole('button', { name: 'Tasks', exact: false }).first().click();
  await expect(page.getByRole('heading', { name: 'Build the first screen', exact: true })).toBeVisible();
  assert.equal(calls.length, 1); assert.ok(headers.every(h => !h['x-tabby-token'] && !h.authorization));
  console.log('PASS: one-click cloud connection, AI chat through real HTTP, reviewed task creation/persistence; no local server token sent.');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'One click. A little more clarity.' })).toBeVisible();
  await expect(page.getByLabel('Local server connection token')).not.toBeVisible();
  await expect(page.getByText('MCP connection token', { exact: true })).not.toBeVisible();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await mkdir('artifacts', { recursive: true }); await page.screenshot({ path: 'artifacts/tabby-cloud-settings.png', fullPage: true });
  assert.deepEqual(errors, []); console.log('PASS: AI settings first, technical fields collapsed, 390px layout and no UI errors.');
} finally { await browser.close(); await new Promise<void>(resolve => server.close(() => resolve())); await rm(temp, { recursive: true, force: true }); }
