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

// Real Chromium, HTTP, storage and tab groups. All model responses here are explicit fixtures.
const requests: any[] = []; let delay = false; let release: (() => void) | undefined;
const handler = createCloudHandler({
  status: async () => ({ connected: true, code: 'READY', model: 'deepseek-v3.2', available: [] }),
  run: async (input: any) => {
    requests.push(input);
    if (delay && (input.kind === 'mission' || input.kind === 'next')) await new Promise<void>(resolve => { release = resolve; });
    const tab = input.context.tabs?.find((t: any) => t.title === 'React form reference');
    const result = input.kind === 'mission' ? { title: 'Build a working login form', outcome: 'A form with a checked submit flow.', steps: [
      { title: 'Build the fields', instruction: 'Create email and password inputs and a submit button.', doneWhen: 'Both fields accept typed values.', minutes: 10, tabIds: tab ? [tab.tabId] : [], searchQuery: '' },
      { title: 'Check the submission', instruction: 'Try one valid and one invalid submission.', doneWhen: 'Both outcomes are checked.', minutes: 15, tabIds: [], searchQuery: 'React form submit example' },
    ] } : input.kind === 'next' ? { nextStep: 'Fixture: add only the email input in the next two minutes.' } : { category: input.context.page?.title.includes('Cats') ? 'distracting' : 'aligned', reason: 'Fixture: this page differs from the current step.', nextStep: 'Return to your form reference.' };
    return { result, model: 'deepseek-v3.2', usage: { total_tokens: 10 } } as never;
  },
}, () => true);
const server = createServer(async (req, res) => {
  if (!req.url?.startsWith('/api/')) { res.setHeader('content-type', 'text/html'); res.end(`<title>${req.url === '/react' ? 'React form reference' : req.url === '/cats' ? 'Cats entertainment' : 'Excluded or pinned page'}</title><h1>Explicit browser test fixture</h1>`); return; }
  const chunks: Buffer[] = []; for await (const chunk of req) chunks.push(chunk);
  const response = await handler(new Request(`http://127.0.0.1${req.url}`, { method: req.method, headers: req.headers as Record<string, string>, ...(req.method === 'POST' ? { body: Buffer.concat(chunks) } : {}) }));
  res.writeHead(response.status, Object.fromEntries(response.headers)); res.end(Buffer.from(await response.arrayBuffer()));
});
server.listen(0, '127.0.0.1'); await once(server, 'listening');
const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
const temp = await mkdtemp(join(tmpdir(), 'tabby-mission-browser-')); const extension = join(temp, 'extension');
await cp(resolve('dist/extension'), extension, { recursive: true });
for (const file of ['worker.js', 'manifest.json']) { const path = join(extension, file); await writeFile(path, (await readFile(path, 'utf8')).replaceAll(CLOUD_AI_ENDPOINT, base + '/api/tabby').replaceAll('http://127.0.0.1:4318', base)); }
const browser = await chromium.launchPersistentContext(join(temp, 'profile'), { channel: 'chromium', headless: true, viewport: { width: 390, height: 950 }, args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`] });
const checks: string[] = []; const pass = (s: string) => { checks.push(s); console.log('PASS:', s); };
try {
  const page = await browser.newPage(); const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(TABBY_EXTENSION_ORIGIN + '/sidepanel.html');
  const cmd = (type: string, payload: Record<string, unknown> = {}) => page.evaluate(async ({ type, payload }) => { const result = await chrome.runtime.sendMessage({ type, ...payload }); if (!result.ok) throw new Error(result.error); return result.data; }, { type, payload });
  const get = (): Promise<AppState> => cmd('GET');
  await expect(page.locator('h1')).toHaveText('Give Tabby a mission.');
  await assert.rejects(cmd('MISSION_PLAN', { goal: 'Build a React login form', minutes: 25 }), /CONSENT_REQUIRED/); assert.equal(requests.length, 0);
  await page.getByRole('button', { name: 'Enable AI', exact: true }).click();
  await expect.poll(async () => (await get()).ai.connected).toBe(true);
  const work = await browser.newPage(); await work.goto(base + '/react');
  const cats = await browser.newPage(); await cats.goto(base + '/cats');
  await page.evaluate(async url => { await chrome.tabs.create({ url, pinned: true, active: false }); }, base + '/pinned');
  await page.bringToFront(); await page.getByLabel('Your mission', { exact: true }).fill('Build and test a React login form');
  await page.getByRole('button', { name: 'Plan my mission', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Start this plan', exact: true })).toBeVisible();
  let state = await get(); const draftId = state.missions.draft!.id; const workId = state.missions.draft!.resources[0].tabId;
  assert.equal(state.tasks.length, 0); assert.equal(state.session, null); assert.equal(state.missions.draft!.resources.length, 1);
  assert.ok(!requests[0].context.tabs.some((t: any) => t.url.endsWith('/pinned')));
  assert.equal(await page.evaluate(async id => (await chrome.tabs.get(id)).groupId, workId), -1);
  await mkdir('artifacts', { recursive: true }); await page.screenshot({ path: 'artifacts/tabby-mission-plan.png', fullPage: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  pass('Consent and review precede all workspace mutations; real tab snapshot excludes pinned tabs; 390px plan fits.');
  await page.getByRole('button', { name: 'Start this plan', exact: true }).click();
  await expect.poll(async () => (await get()).missions.current?.grouping).toBe('done');
  state = await get(); assert.equal(state.tasks.length, 2); assert.equal(state.session!.missionId, draftId);
  assert.equal(await page.evaluate(async id => (await chrome.tabGroups.get(id)).color, state.missions.current!.groupId!), 'orange');
  await cmd('MISSION_START', { draftId, groupTabs: true }); assert.equal((await get()).tasks.length, 2);
  await expect.poll(async () => (await get()).assessment?.category, { timeout: 18000 }).toBe('aligned');
  await cats.bringToFront(); await expect.poll(async () => (await get()).assessment?.category, { timeout: 18000 }).toBe('distracting');
  await expect(page.getByText('A little detour?', { exact: true })).toBeVisible();
  await expect(cats.locator('#tabby-reminder')).toHaveCount(1);
  await cmd('RETURN'); await expect.poll(async () => (await get()).session?.returns).toBe(1);
  assert.ok((await get()).missions.activity.some(a => a.title === 'Returned to a work tab'));
  pass('Approved plan creates actual Chrome orange group, linked tasks and focus once; detour triggers an actual page reminder and work-tab return.');
  await page.getByRole('button', { name: 'I’m stuck', exact: true }).click();
  await expect(page.getByText('Fixture: add only the email input in the next two minutes.', { exact: true }).first()).toBeVisible();
  await cmd('PAUSE'); state = await get(); const sessionId = state.session!.id; const remaining = state.session!.remainingMs;
  const first = state.missions.current!.steps[0]; const timestamp = state.tasks.find(t => t.id === first.taskId)!.updatedAt;
  await assert.rejects(cmd('MISSION_COMPLETE_STEP', { stepId: first.id, expectedUpdatedAt: timestamp! - 1 }), /ITEM_CHANGED/);
  await page.screenshot({ path: 'artifacts/tabby-mission-active.png', fullPage: true });
  await page.getByRole('button', { name: 'Mark step done', exact: true }).click();
  await expect.poll(async () => (await get()).session?.taskId).toBe(state.missions.current!.steps[1].taskId);
  state = await get(); assert.equal(state.session!.id, sessionId); assert.equal(state.session!.remainingMs, remaining); assert.equal(state.session!.phase, 'paused');
  assert.equal(state.missions.current?.coach, undefined); assert.match(state.session!.goal, /Check the submission/);
  await page.reload(); await expect(page.getByRole('heading', { name: 'Check the submission', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Mark step done', exact: true }).click();
  await expect(page.locator('h1')).toHaveText('You followed through.');
  state = await get(); assert.equal(state.missions.current!.status, 'completed'); assert.equal(state.session!.phase, 'finished');
  assert.equal(state.tasks.filter(t => t.status === 'done').length, 2);
  await page.screenshot({ path: 'artifacts/tabby-mission-complete.png', fullPage: true });
  pass('Stuck coaching, stale task rejection, confirmed progress, preserved pause/clock and persisted completion work through the actual UI.');
  await page.getByRole('button', { name: 'New mission', exact: true }).click();
  await cmd('MISSION_PLAN', { goal: 'Build a React login form', minutes: 25 });
  state = await get(); await work.goto(base + '/changed');
  await assert.rejects(cmd('MISSION_START', { draftId: state.missions.draft!.id, groupTabs: true }), /TABS_CHANGED/);
  assert.equal((await get()).tasks.length, 2); assert.equal((await get()).missions.current, null);
  await cmd('MISSION_EDIT'); delay = true;
  const late = cmd('MISSION_PLAN', { goal: 'Build a React login form', minutes: 25 }).catch(e => String(e));
  await expect.poll(() => !!release).toBe(true); await cmd('SETTINGS', { settings: { consent: false } }); release!(); await late; delay = false; release = undefined;
  state = await get(); assert.equal(state.missions.draft, null); assert.equal(state.missions.pending, undefined); assert.equal(state.tasks.length, 2);
  pass('Changed tabs reject Start before any mutation; revoked consent cancels planning and rejects late model output.');
  await cmd('SETTINGS', { settings: { consent: true } }); await work.goto(base + '/react');
  await cmd('MISSION_PLAN', { goal: 'Build a React login form', minutes: 25 });
  const worker = browser.serviceWorkers()[0];
  await worker.evaluate(() => { chrome.tabGroups.update = (async () => { throw new Error('Explicit group styling failure fixture'); }) as typeof chrome.tabGroups.update; });
  const retryId = (await get()).missions.draft!.id;
  await cmd('MISSION_START', { draftId: retryId, groupTabs: true }); await cmd('PAUSE');
  state = await get(); assert.equal(state.missions.current!.grouping, 'failed'); assert.equal(state.tasks.length, 4);
  assert.ok(state.missions.activity.some(a => a.title === 'Tab grouping could not be completed' && a.state === 'failed'));
  const groupId = state.missions.current!.groupId;
  const cdp = await browser.newCDPSession(page); const versions: any[] = [];
  cdp.on('ServiceWorker.workerVersionUpdated', ({ versions: next }) => versions.push(...next)); await cdp.send('ServiceWorker.enable');
  await expect.poll(() => versions.some(v => v.scriptURL === TABBY_EXTENSION_ORIGIN + '/worker.js' && v.runningStatus === 'running')).toBe(true);
  const version = [...versions].reverse().find(v => v.scriptURL === TABBY_EXTENSION_ORIGIN + '/worker.js' && v.runningStatus === 'running');
  await cdp.send('ServiceWorker.stopWorker', { versionId: version.versionId }); await cmd('GET');
  await cmd('MISSION_START', { draftId: retryId, groupTabs: true }); state = await get();
  assert.equal(state.tasks.length, 4); assert.equal(state.missions.current!.grouping, 'failed'); assert.equal(state.missions.current!.groupId, groupId);
  assert.equal(state.session!.phase, 'paused');
  pass('Partial group failure is truthful; actual service worker termination preserves the mission and durable Start retry guard.');
  assert.deepEqual(errors, []); await writeFile('artifacts/tabby-mission-browser.json', JSON.stringify({ model: 'explicit fixtures, not live', checks }, null, 2));
} finally { release?.(); await browser.close(); server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); await rm(temp, { recursive: true, force: true }); }
