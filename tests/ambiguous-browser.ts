import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { AmbiguousIntegration } from '../src/server/ambiguous';
import { createApp } from '../src/server/http';
import { ambiguousFixture, channelId, messageId } from './ambiguous-fixture';
import type { AppState } from '../src/shared/types';

// Full Chrome -> authenticated local HTTP -> SDK MCP -> contract fixture path.
// Only the local HTTP port is changed in a temporary copy of the production bundle.
const temp = await mkdtemp(join(tmpdir(), 'tabby-ambiguous-browser-')); const extension = join(temp, 'extension');
await cp(resolve('dist/extension'), extension, { recursive: true });
const manifest = JSON.parse(await readFile(join(extension, 'manifest.json'), 'utf8'));
const id = createHash('sha256').update(Buffer.from(manifest.key, 'base64')).digest('hex').slice(0, 32).replace(/[0-9a-f]/g, c => String.fromCharCode(97 + parseInt(c, 16)));
const fixture = await ambiguousFixture(); let modelCalls = 0;
const service = new AmbiguousIntegration({ key: 'fixture-ambiguous-key', authFile: join(temp, 'oauth.json'), receiptFile: join(temp, 'receipts.json') }, fixture.fetcher);
const config = { port: 0, extensionId: id, pairToken: 'fixture-local-pairing-token-'.repeat(3) };
const server = createApp(config, { status: async () => { modelCalls++; return {} as any; }, run: async () => { modelCalls++; return {} as any; } }, undefined, service);
await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve)); config.port = (server.address() as { port: number }).port;
for (const filename of ['worker.js', 'manifest.json']) {
  const file = join(extension, filename); await writeFile(file, (await readFile(file, 'utf8')).replaceAll('127.0.0.1:4318', `127.0.0.1:${config.port}`));
}
const browser = await chromium.launchPersistentContext(join(temp, 'profile'), { channel: 'chromium', headless: true, viewport: { width: 390, height: 850 }, args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`] });
const results: string[] = []; const errors: string[] = [];
const pass = (label: string) => { results.push(label); console.log('PASS: ' + label); };
try {
  const page = await browser.newPage(); page.on('pageerror', e => errors.push(e.message)); await page.goto(`chrome-extension://${id}/sidepanel.html`);
  const cmd = async (type: string, payload: Record<string, unknown> = {}) => page.evaluate(async ({ type, payload }) => { const r = await chrome.runtime.sendMessage({ type, ...payload }); if (!r.ok) throw new Error(r.error); return r.data; }, { type, payload });
  const get = (): Promise<AppState> => cmd('GET');
  await cmd('SETTINGS', { settings: { pairToken: config.pairToken, consent: false } });
  await page.getByRole('button', { name: 'Ambiguous', exact: true }).click();
  await page.getByRole('button', { name: 'Connect Ambiguous', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Load channels', exact: true })).toBeVisible(); assert.equal(fixture.calls.length, 0);
  await page.getByRole('button', { name: 'Load channels', exact: true }).click();
  await expect(page.getByLabel('Ambiguous channel')).toBeEnabled(); await page.getByLabel('Ambiguous channel').selectOption(channelId);
  await expect(page.locator('.ambiguous-message').first()).toContainText('Prepare three design options'); assert.equal(modelCalls, 0);
  assert.ok(!JSON.stringify(await get()).includes('fixture-ambiguous-key'));
  await mkdir('artifacts', { recursive: true }); await page.screenshot({ path: 'artifacts/tabby-ambiguous-messages-fixture.png', fullPage: true });
  pass('real Chrome explicitly loads private channel/messages through authenticated HTTP and SDK MCP, without AI or upstream credentials in storage');
  await page.getByRole('button', { name: 'Review task', exact: true }).click();
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Prepare three design options · fixture'); assert.equal((await get()).tasks.length, 0);
  const originalDraft = (await get()).taskDraft!; await cmd('CLEAR_DRAFT');
  await assert.rejects(cmd('SAVE_TASK', { task: { ...originalDraft, status: 'planned' } }), /STALE_RESPONSE/); await cmd('AMBIGUOUS_DRAFT', { messageId });
  await page.getByLabel('Title', { exact: true }).fill('Sketch three design options'); await page.getByRole('button', { name: 'Save task', exact: true }).click();
  await expect(page.locator('.task-row')).toHaveCount(1); const task = (await get()).tasks[0]; assert.equal(task.ambiguous?.messageId, messageId);
  await assert.rejects(cmd('AMBIGUOUS_DRAFT', { messageId }), /AMBIGUOUS_ALREADY_IMPORTED/);
  pass('message becomes an editable draft; only Save task creates the task, with original thread metadata and duplicate prevention');
  await page.getByRole('button', { name: 'Focus on this', exact: true }).click(); await page.getByRole('button', { name: /^Start focusing/ }).click();
  await expect(page.getByRole('button', { name: 'Stop session', exact: true })).toBeVisible(); assert.equal((await get()).session?.ambiguous?.threadId, messageId);
  await page.getByRole('button', { name: /^Tasks/ }).click(); await page.getByRole('button', { name: 'Mark done', exact: true }).click();
  await page.getByRole('button', { name: 'Stop session', exact: true }).click();
  await page.getByRole('button', { name: 'Insights', exact: true }).click(); await page.getByRole('button', { name: 'Share to Ambiguous', exact: true }).click();
  await expect(page.getByLabel('Session report')).toHaveValue(/The focus task was marked done during this session\./);
  const sessionId = (await get()).session!.id; assert.equal(fixture.calls.filter(c => c.name === 'send_message').length, 0);
  await assert.rejects(cmd('AMBIGUOUS_SEND_REPORT', { reportId: sessionId, content: 'Unconfirmed' }), /CONFIRM_REQUIRED/);
  await page.getByLabel('Session report').fill('Three design options prepared. Ready for review. · fixture');
  await page.screenshot({ path: 'artifacts/tabby-ambiguous-report-fixture.png', fullPage: true });
  await page.getByRole('button', { name: 'Send report to Ambiguous', exact: true }).click(); await expect(page.getByText('Report sent to the original thread.', { exact: true })).toBeVisible();
  const sent = fixture.calls.filter(c => c.name === 'send_message'); assert.equal(sent.length, 1); assert.equal(sent[0].args.thread_id, messageId); assert.equal(sent[0].args.content, 'Three design options prepared. Ready for review. · fixture');
  await cmd('AMBIGUOUS_SEND_REPORT', { reportId: sessionId, content: 'Three design options prepared. Ready for review. · fixture', confirm: true }); assert.equal(fixture.calls.filter(c => c.name === 'send_message').length, 1);
  pass('actual focus session finishes, report opens for review, explicit send reaches the original MCP thread once, and replay does not send again');
  await page.reload(); await page.getByRole('button', { name: 'Ambiguous', exact: true }).click(); await expect(page.getByText('Report sent to the original thread.', { exact: true })).toBeVisible();
  // Second session: simulate a server-side failure after a write was attempted.
  await cmd('START', { goal: task.title, taskId: task.id, minutes: 25 }); await cmd('STOP'); const secondId = (await get()).session!.id;
  await cmd('AMBIGUOUS_PREPARE_REPORT', { sessionId: secondId }); fixture.setMode('timeout');
  await page.getByRole('button', { name: 'Send report to Ambiguous', exact: true }).click(); await expect(page.getByRole('button', { name: 'Copy report', exact: true })).toBeVisible();
  const attempts = fixture.calls.filter(c => c.name === 'send_message').length;
  await page.reload(); await page.getByRole('button', { name: 'Ambiguous', exact: true }).click(); await expect(page.getByRole('button', { name: 'Copy report', exact: true })).toBeVisible();
  await assert.rejects(cmd('AMBIGUOUS_PREPARE_REPORT', { sessionId: secondId }), /AMBIGUOUS_DELIVERY_UNKNOWN/); assert.equal(fixture.calls.filter(c => c.name === 'send_message').length, attempts);
  pass('lost delivery response stays unconfirmed across reloads; no automatic retry or duplicate report is possible');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true); assert.ok((await page.locator('.sidebar').boundingBox())!.height < 180);
  await page.setViewportSize({ width: 1280, height: 900 }); await page.screenshot({ path: 'artifacts/tabby-ambiguous-desktop-fixture.png', fullPage: true });
  await cmd('SETTINGS', { settings: { excludedSites: ['app.ambiguous.ai'] } }); assert.equal((await get()).ambiguous.messages.length, 0);
  await assert.rejects(cmd('AMBIGUOUS_CHANNELS'), /PAGE_UNAVAILABLE/);
  await cmd('AMBIGUOUS_DISCONNECT'); assert.equal((await get()).ambiguous.enabled, false); assert.equal((await get()).tasks.length, 1); assert.equal(modelCalls, 0); assert.deepEqual(errors, []);
  pass('390px/desktop layouts render; site exclusion and disconnect clear chat snapshots while preserving confirmed tasks');
  await writeFile('artifacts/ambiguous-browser-results.json', JSON.stringify({ actualChrome: true, actualMcpTransport: true, liveAmbiguous: false, aiProviderCalls: modelCalls, results }, null, 2));
} finally { await browser.close(); service.cancel(); server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); await fixture.close(); await rm(temp, { recursive: true, force: true }); }
