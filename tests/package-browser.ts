import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

// Test the exact distributed ZIP, not dist/extension. No server or AI account needed.
const run = promisify(execFile);
const temp = await mkdtemp(join(tmpdir(), 'tabby-download-test-'));
const extension = join(temp, 'Tabby');
const metadata = JSON.parse(await readFile('public/downloads/Tabby.json', 'utf8'));
const source = process.argv[2];
let browser: Awaited<ReturnType<typeof chromium.launchPersistentContext>> | undefined;
try {
  let bytes: Buffer;
  if (source?.startsWith('https://')) {
    const response = await fetch(source);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type') || '', /application\/zip/);
    assert.match(response.headers.get('content-disposition') || '', /attachment; filename="Tabby.zip"/);
    bytes = Buffer.from(await response.arrayBuffer());
  } else bytes = await readFile(resolve(source || 'public/downloads/Tabby.zip'));
  assert.equal(bytes.length, metadata.bytes);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), metadata.sha256);
  const archive = join(temp, 'Tabby.zip'); await writeFile(archive, bytes);
  const entries = (await run('unzip', ['-Z1', archive])).stdout.trim().split('\n');
  const allowed = ['manifest.json', 'worker.js', 'content.js', 'panel.js', 'panel.css', 'sidepanel.html', 'icons/', ...[16,32,48,128].map(size => `icons/icon${size}.png`), 'INSTALL-TABBY.txt'];
  assert.deepEqual([...entries].sort(), [...allowed].sort());
  await mkdir(extension); await run('unzip', ['-q', archive, '-d', extension]);
  const manifest = JSON.parse(await readFile(join(extension, 'manifest.json'), 'utf8'));
  assert.equal(manifest.name, 'Tabby'); assert.equal(manifest.action.default_title, 'Tabby'); assert.equal(manifest.version, metadata.version);
  assert.match(await readFile(join(extension, 'INSTALL-TABBY.txt'), 'utf8'), /chrome:\/\/extensions/);
  console.log(`PASS: Tabby.zip integrity, exact file allowlist, Tabby branding, version ${manifest.version} and included instructions.`);

  const id = createHash('sha256').update(Buffer.from(manifest.key, 'base64')).digest('hex').slice(0, 32).replace(/[0-9a-f]/g, c => String.fromCharCode(97 + parseInt(c, 16)));
  browser = await chromium.launchPersistentContext(join(temp, 'chrome'), { channel: 'chromium', headless: true, viewport: { width: 390, height: 844 }, args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`] });
  browser.setDefaultTimeout(10000);
  console.log('Chrome started from extracted ZIP.');
  let apiCalls = 0; const errors: string[] = [];
  browser.on('request', req => { if (/^https?:/.test(req.url())) apiCalls++; });
  const page = await browser.newPage(); page.on('pageerror', error => errors.push(error.message));
  await page.goto(`chrome-extension://${id}/sidepanel.html`);
  await expect(page.locator('h1')).toHaveText('What matters today?');
  console.log('Tabby panel loaded with a clean profile.');
  assert.equal(await page.evaluate(() => chrome.runtime.getManifest().name), 'Tabby');
  const initial = await page.evaluate(async () => (await chrome.runtime.sendMessage({type:'GET'})).data);
  assert.equal(initial.settings.consent, false); assert.ok(!initial.settings.pairToken); assert.ok(!initial.settings.mcpToken); assert.equal(initial.tasks.length, 0);
  await page.getByRole('button', {name:/^Tasks(?:\s*\d+)?$/}).click();
  await page.getByRole('button', {name:'New task',exact:true}).click();
  await page.getByLabel('Title',{exact:true}).fill('My first task in downloaded Tabby');
  await page.getByRole('button', {name:'Save task',exact:true}).click();
  await expect(page.getByRole('heading',{name:'My first task in downloaded Tabby',exact:true})).toBeVisible();
  await page.reload(); await page.getByRole('button',{name:/^Tasks(?:\s*\d+)?$/}).click();
  await expect(page.getByRole('heading',{name:'My first task in downloaded Tabby',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Focus on this',exact:true}).click();
  await page.getByRole('button',{name:'Start focusing',exact:false}).click();
  await expect(page.getByRole('button',{name:'Stop session',exact:true})).toBeVisible();
  await expect(page.locator('.compact-assessment')).toContainText('Analysis off');
  await page.getByRole('button',{name:'Stop session',exact:true}).click();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  // Verify Chrome's native Side Panel API on a real user gesture.
  await page.evaluate(() => {
    const button = document.createElement('button'); button.id = 'package-sidepanel-check'; button.textContent = 'Open native panel';
    button.onclick = async () => { const win = await chrome.windows.getCurrent(); await chrome.sidePanel.open({windowId:win.id!}); button.dataset.opened = 'yes'; };
    document.body.append(button);
  });
  await page.locator('#package-sidepanel-check').click();
  await expect(page.locator('#package-sidepanel-check')).toHaveAttribute('data-opened','yes');
  assert.equal(apiCalls, 0); assert.deepEqual(errors, []);
  console.log('PASS: clean install from the unzipped Tabby folder; task creation/persistence, task-based focus, native Side Panel, 390px layout. No server, credentials or network calls.');
} finally { await browser?.close(); await rm(temp,{recursive:true,force:true}); }
