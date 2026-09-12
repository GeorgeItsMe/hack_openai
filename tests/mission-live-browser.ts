import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CLOUD_AI_ENDPOINT, TABBY_EXTENSION_ORIGIN } from '../src/shared/cloud';
import type { AppState } from '../src/shared/types';

// Paid shared-service check. Real public resource + real DeepSeek; synthetic goal and UI confirmations.
if (!process.argv.includes('--live')) throw new Error('Pass --live to run a paid real DeepSeek mission plan from the published ZIP.');
const temp = await mkdtemp(join(tmpdir(), 'tabby-mission-live-')); const run = promisify(execFile);
let browser: Awaited<ReturnType<typeof chromium.launchPersistentContext>> | undefined;
try {
  const expected = JSON.parse(await readFile('public/downloads/Tabby.json', 'utf8'));
  const response = await fetch('https://tabby-pi.vercel.app/downloads/Tabby.zip'); assert.equal(response.status, 200);
  const bytes = Buffer.from(await response.arrayBuffer()); assert.equal(createHash('sha256').update(bytes).digest('hex'), expected.sha256);
  const extension = join(temp, 'Tabby'); const zip = join(temp, 'Tabby.zip');
  await writeFile(zip, bytes); await mkdir(extension); await run('unzip', ['-q', zip, '-d', extension]);
  browser = await chromium.launchPersistentContext(join(temp, 'profile'), { channel: 'chromium', headless: true, viewport: { width: 1440, height: 1050 }, args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`] });
  const requests: string[] = []; const errors: string[] = [];
  browser.on('request', r => { if (/^https?:/.test(r.url())) requests.push(r.url()); });
  const reference = await browser.newPage(); await reference.goto('https://react.dev/learn/state-a-components-memory', { waitUntil: 'domcontentloaded' });
  const page = await browser.newPage(); page.on('pageerror', e => errors.push(e.message)); await page.goto(TABBY_EXTENSION_ORIGIN + '/sidepanel.html');
  const cmd = (type: string, payload: Record<string, unknown> = {}) => page.evaluate(async ({ type, payload }) => { const result = await chrome.runtime.sendMessage({ type, ...payload }); if (!result.ok) throw new Error(result.error); return result.data; }, { type, payload });
  const get = (): Promise<AppState> => cmd('GET');
  await page.getByRole('button', { name: 'Enable AI', exact: true }).click(); await expect.poll(async () => (await get()).ai.connected, { timeout: 35000 }).toBe(true);
  await page.getByLabel('Your mission', { exact: true }).fill('Build a tiny React counter with a plus button and a reset button. Use the open React state reference. Plan a working example I can test within 25 minutes.');
  await page.getByRole('button', { name: 'Plan my mission', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Start this plan', exact: true })).toBeVisible({ timeout: 35000 });
  let state = await get(); const draft = state.missions.draft!;
  assert.equal(state.ai.model, 'deepseek-v3.2'); assert.equal(state.tasks.length, 0); assert.equal(state.session, null);
  assert.ok(draft.plan.steps.length >= 1 && draft.plan.steps.length <= 5); assert.ok(draft.resources.some(r => r.url.includes('react.dev/learn/state-a-components-memory')));
  await mkdir('artifacts', { recursive: true }); await page.screenshot({ path: 'artifacts/tabby-mission-live-plan.png', fullPage: true });
  console.log('PASS: published ZIP prepares a validated real DeepSeek mission plan and selects the actual open React resource before approval.');
  await page.getByRole('button', { name: 'Start this plan', exact: true }).click(); await expect.poll(async () => (await get()).missions.current?.grouping).toBe('done');
  await cmd('PAUSE'); state = await get();
  assert.equal(state.tasks.length, draft.plan.steps.length); assert.equal(state.session!.missionId, draft.id);
  assert.equal(await page.evaluate(async id => (await chrome.tabGroups.get(id)).color, state.missions.current!.groupId!), 'orange');
  await page.setViewportSize({ width: 390, height: 950 }); await page.screenshot({ path: 'artifacts/tabby-mission-live-active.png', fullPage: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  // Synthetic UI confirmations verify state transitions, not the completion of an external React project.
  for (const step of state.missions.current!.steps) {
    const latest = await get(); const task = latest.tasks.find(t => t.id === step.taskId)!;
    await cmd('MISSION_COMPLETE_STEP', { stepId: step.id, expectedUpdatedAt: task.updatedAt });
  }
  await expect(page.locator('h1')).toHaveText('You followed through.'); await page.reload(); state = await get();
  assert.equal(state.missions.current!.status, 'completed'); assert.equal(state.tasks.filter(t => t.status === 'done').length, draft.plan.steps.length);
  assert.equal(state.settings.aiMode, 'cloud'); assert.equal(state.settings.pairToken, ''); assert.equal(state.settings.mcpToken, ''); assert.equal(state.settings.readText, false);
  assert.ok(!requests.some(url => /^http:\/\/(127\.0\.0\.1|localhost)/.test(url))); assert.ok(requests.some(url => url.startsWith(CLOUD_AI_ENDPOINT)));
  assert.deepEqual(errors, []);
  await writeFile('artifacts/tabby-mission-live.json', JSON.stringify({ at: new Date().toISOString(), version: expected.version, sha256: expected.sha256, realModel: true, model: state.ai.model, goal: draft.goal, plan: draft.plan, resources: draft.resources.map(r => ({ title: r.title, url: r.url })), actualChromeGroup: true, linkedTasks: state.tasks.length, confirmedUiProgressPersisted: true, confirmationsAreSynthetic: true, noLoopbackRequests: true, noCredentials: true, usage: state.usage }, null, 2));
  console.log('PASS: actual orange Chrome group, linked tasks, compact UI, synthetic step confirmations and persisted completion with no local setup; version ' + expected.version + '.');
} finally { await browser?.close(); await rm(temp, { recursive: true, force: true }); }
