import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import type { AppState } from '../src/shared/types';

// Real extension UI/worker/storage; Google and AI responses are explicitly injected fixtures.
// A private copy of the production bundle avoids touching an existing demo or port 4318.
const temp = await mkdtemp(join(tmpdir(), 'tabby-google-chat-')); const extension = join(temp, 'extension');
await cp(resolve('dist/extension'), extension, { recursive: true });
const manifest = JSON.parse(await readFile(join(extension, 'manifest.json'), 'utf8'));
const id = createHash('sha256').update(Buffer.from(manifest.key, 'base64')).digest('hex').slice(0, 32).replace(/[0-9a-f]/g, c => String.fromCharCode(97 + parseInt(c, 16)));
const browser = await chromium.launchPersistentContext(join(temp, 'profile'), { channel: 'chromium', headless: true, viewport: { width: 390, height: 850 }, args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`] });
const results: string[] = []; const errors: string[] = [];
const pass = (label: string) => { results.push(label); console.log('PASS: ' + label); };
try {
  const worker = browser.serviceWorkers()[0] || await browser.waitForEvent('serviceworker');
  await worker.evaluate('globalThis.__name = (fn) => fn'); // tsx names nested fixture functions.
  await worker.evaluate(() => {
    const fixture = { requests: [] as any[], slow: false, connected: true };
    (globalThis as any).__googleChatFixture = fixture;
    (globalThis as any).__fixtureFetch = async (raw: string, options: RequestInit) => {
      const url = new URL(String(raw)); const body = JSON.parse(String(options?.body || '{}'));
      fixture.requests.push({ path: url.pathname, body });
      const result = (data: unknown) => Promise.resolve(new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } }));
      if (url.pathname === '/status') return result({ connected: true, code: 'READY', model: 'deepseek-v3.2', available: [] });
      if (url.pathname === '/google/status') return result({ configured: true, calendar: fixture.connected, gmail: fixture.connected, pending: null });
      if (url.pathname === '/google/calendar') {
        const start = new Date(Date.now() + 2 * 3600000).toISOString();
        return result({ events: [{ id: 'event1', title: 'Design review · test fixture', start, end: new Date(Date.now() + 3 * 3600000).toISOString(), allDay: false, location: 'Studio', url: 'https://calendar.google.com/calendar/event?eid=fixture' }], syncedAt: Date.now(), truncated: false });
      }
      if (url.pathname === '/google/gmail') return result({ messages: [{ id: 'mail1', title: 'Prepare the review · test fixture', from: 'Alex · test fixture', snippet: 'Please prepare three options for our review.', receivedAt: Date.now(), url: 'https://mail.google.com/mail/u/0/#inbox/mail1' }], syncedAt: Date.now() });
      if (url.pathname === '/google/disconnect') { fixture.connected = false; return result({ disconnected: true, revoked: true }); }
      if (url.pathname === '/ai' && body.kind === 'chat') {
        if (fixture.slow) await new Promise((resolve, reject) => { const timeout = setTimeout(resolve, 10000); options?.signal?.addEventListener('abort', () => { clearTimeout(timeout); reject(new Error('cancelled')); }); });
        return result({ result: { reply: 'Start with a small review preparation task. This is a test fixture; confirm the card to save it.', actions: [{ type: 'create_task', title: 'Draft three design options', steps: ['Review the brief', 'Sketch three approaches'], due: '' }] }, model: 'deepseek-v3.2', usage: { total_tokens: 40 } });
      }
      if (url.pathname === '/ai' && body.kind === 'task') return result({ result: { title: 'Prepare three design options', steps: ['Review the brief'], due: '', dueEvidence: '' }, model: 'deepseek-v3.2' });
      throw new Error('Unexpected fixture request');
    };
    globalThis.fetch = (globalThis as any).__fixtureFetch;
  });
  const page = await browser.newPage(); page.on('pageerror', e => errors.push(e.message));
  await page.goto(`chrome-extension://${id}/sidepanel.html`);
  const cmd = async (type: string, payload: Record<string, unknown> = {}) => page.evaluate(async ({ type, payload }) => { const reply = await chrome.runtime.sendMessage({ type, ...payload }); if (!reply.ok) throw new Error(reply.error); return reply.data; }, { type, payload });
  const get = (): Promise<AppState> => cmd('GET');
  await cmd('SETTINGS', { settings: { pairToken: 'fixture-browser-pair-token-'.repeat(3), consent: true } });
  await cmd('CONNECT');
  await page.getByRole('button', { name: 'Calendar & mail', exact: true }).click();
  assert.ok((await page.locator('.sidebar').boundingBox())!.height < 180, 'Narrow navigation must stay in one row');
  await expect(page.locator('.agenda-event')).toContainText('Design review');
  assert.equal(await worker.evaluate(() => (globalThis as any).__googleChatFixture.requests.filter((r: any) => r.path === '/ai').length), 0);
  await page.locator('.agenda-event').getByRole('button', { name: 'Add task', exact: true }).click();
  await cmd('GOOGLE_IMPORT', { service: 'calendar', id: 'event1' }); assert.equal((await get()).tasks.length, 1);
  assert.match((await get()).tasks[0].source, /eid=fixture/);
  pass('calendar sync uses no AI; real UI imports one task and duplicate imports are idempotent');
  await mkdir('artifacts', { recursive: true }); await page.screenshot({ path: 'artifacts/tabby-calendar-fixture.png', fullPage: true });
  await page.getByRole('tab', { name: 'Gmail' }).click(); await expect(page.locator('.mail-item')).toContainText('Prepare the review');
  await page.locator('.mail-item').getByRole('button', { name: 'AI draft' }).click();
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Prepare three design options');
  assert.equal((await get()).tasks.length, 1);
  await page.getByRole('button', { name: 'Save task', exact: true }).click();
  assert.equal((await get()).tasks.length, 2); assert.equal((await get()).tasks[0].external?.service, 'gmail');
  pass('Gmail preview becomes an AI draft, then saves only after review; original email link is retained');
  await page.getByRole('button', { name: 'AI chat', exact: true }).click();
  await page.getByLabel('Message Tabby').fill('Create a small review task.'); await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.locator('.chat-proposal')).toHaveCount(1); assert.equal((await get()).tasks.length, 2);
  await page.getByRole('button', { name: 'Create task', exact: true }).click();
  const state = await get(); const proposal = state.chat.messages.at(-1)!.proposals![0];
  assert.equal(state.tasks.length, 3); await cmd('CHAT_APPLY', { proposalId: proposal.id }); assert.equal((await get()).tasks.length, 3);
  const requests = await worker.evaluate(() => (globalThis as any).__googleChatFixture.requests);
  const chat = requests.find((r: any) => r.body.kind === 'chat'); assert.deepEqual(chat.body.context.chat.events, []);
  assert.ok(!JSON.stringify(chat.body).includes('fixture-browser-pair-token')); assert.ok(!JSON.stringify(chat.body).includes('Please prepare three options'));
  await page.screenshot({ path: 'artifacts/tabby-chat-fixture.png', fullPage: true });
  await page.reload(); await page.getByRole('button', { name: 'AI chat', exact: true }).click(); await expect(page.locator('.chat-proposal.applied')).toHaveCount(1);
  pass('chat persists; proposals require confirmation and resist replay; calendar/email data is absent by default');
  await page.getByLabel('Include calendar').check(); await page.getByLabel('Message Tabby').fill('Plan around my meetings.'); await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.locator('.chat-message.assistant')).toHaveCount(2);
  assert.equal(await worker.evaluate(() => (globalThis as any).__googleChatFixture.requests.filter((r: any) => r.body.kind === 'chat').at(-1).body.context.chat.events.length), 1);
  pass('calendar context is sent only after its separate checkbox is enabled');
  await worker.evaluate(() => { (globalThis as any).__googleChatFixture.slow = true; });
  await page.getByLabel('Message Tabby').fill('A delayed request.'); await page.getByRole('button', { name: 'Send message' }).click(); await expect(page.getByRole('button', { name: 'Stop response' })).toBeVisible();
  await page.getByRole('button', { name: 'Stop response' }).click(); await expect(page.getByRole('button', { name: 'Send message' })).toBeVisible();
  assert.equal((await get()).chat.pendingId, undefined); assert.equal((await get()).chat.messages.filter(m => m.role === 'assistant').length, 2);
  pass('cancelling an in-flight chat response keeps prior history and applies no late actions');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.setViewportSize({ width: 1280, height: 900 }); await page.screenshot({ path: 'artifacts/tabby-chat-desktop-fixture.png', fullPage: true });
  await cmd('SETTINGS', { settings: { excludedSites: ['calendar.google.com'] } }); assert.equal((await get()).google.events.length, 0);
  await assert.rejects(cmd('CHAT_SEND', { text: 'Plan my day', includeCalendar: true }), /PAGE_UNAVAILABLE/);
  await assert.rejects(cmd('GOOGLE_IMPORT', { service: 'calendar', id: 'event1' }), /PAGE_UNAVAILABLE/);
  pass('site exclusions clear calendar snapshots and prevent importing or sharing excluded calendar data');
  await cmd('GOOGLE_DISCONNECT'); const after = await get(); assert.equal(after.google.events.length, 0); assert.equal(after.google.messages.length, 0); assert.equal(after.chat.messages.length, 0); assert.equal(after.tasks.length, 3);
  pass('disconnect clears Google views and chat, retaining confirmed tasks; narrow and desktop layouts work');
  assert.deepEqual(errors, []);
  await writeFile('artifacts/google-chat-browser-results.json', JSON.stringify({ fixture: true, liveGoogle: false, liveAI: false, results }, null, 2));
} finally { await browser.close(); await rm(temp, { recursive: true, force: true }); }
