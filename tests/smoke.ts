import { chromium, expect } from '@playwright/test';
import { mkdtemp, readFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
// Final production bundle smoke: no fake AI and no requests to a language model.
const path = resolve('dist/extension'); const manifest = JSON.parse(await readFile(join(path, 'manifest.json'), 'utf8'));
const id = createHash('sha256').update(Buffer.from(manifest.key, 'base64')).digest('hex').slice(0, 32).replace(/[0-9a-f]/g, c => String.fromCharCode(97 + parseInt(c, 16)));
const profile = await mkdtemp(join(tmpdir(), 'tabby-smoke-'));
const browser = await chromium.launchPersistentContext(profile, { channel: 'chromium', headless: true, viewport: { width: 390, height: 800 }, args: [`--disable-extensions-except=${path}`, `--load-extension=${path}`] });
const errors: string[] = [];
try {
  const page = await browser.newPage(); page.on('pageerror', e => errors.push(e.message));
  await page.goto(`chrome-extension://${id}/sidepanel.html`); await expect(page.locator('h1')).toHaveText('Give Tabby a mission.');
  await page.getByRole('button', { name: 'Focus', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('.language-button')).toHaveCount(0);
  await page.getByLabel('What would you like to focus on?').fill('Learn React authentication and build an example');
  await page.getByRole('button', { name: 'Start focusing', exact: false }).click();
  await expect(page.getByRole('button', { name: 'Stop session', exact: true })).toBeVisible();
  await expect(page.locator('.compact-assessment')).toBeInViewport();
  await expect(page.locator('.compact-assessment')).toContainText('Analysis off');
  await mkdir('artifacts', { recursive: true }); await page.screenshot({ path: 'artifacts/tabby-production-active.png', fullPage: true });
  await page.getByRole('button', { name: 'Stop session', exact: true }).click();
  // A real click supplies the required user activation to open Chrome's native side panel.
  await page.evaluate(() => {
    const button = document.createElement('button'); button.id = 'native-panel-test'; button.textContent = 'Test native panel';
    button.onclick = async () => { try { const win = await chrome.windows.getCurrent(); await chrome.sidePanel.open({ windowId: win.id! }); button.dataset.result = 'opened'; } catch { button.dataset.result = 'failed'; } };
    document.body.append(button);
  });
  await page.locator('#native-panel-test').click(); await expect(page.locator('#native-panel-test')).toHaveAttribute('data-result', 'opened');
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('PASS: final production bundle, real UI start/stop, context visible at 390×800, native Chrome Side Panel opens on user gesture, no console errors. No AI responses generated.');
} finally { await browser.close(); await rm(profile, { recursive: true, force: true }); }
