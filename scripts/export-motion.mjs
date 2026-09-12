import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile, cp, readdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';

// Read-only render fixtures: no extension profile, user data or AI requests.
const out = resolve('artifacts/tabby-motion-kit');
const now = Date.UTC(2026, 8, 12, 10, 0);
const catalog = [];
const iconMap = new Map();
const frame = { width: 390, height: 1800 };
await mkdir(out, { recursive: true });
await cp('public/brand/tabby', `${out}/01-brand`, { recursive: true });
const server = createServer(async (req, res) => {
  const route = new URL(req.url, 'http://localhost').pathname;
  const file = { '/panel.js': 'dist/extension/panel.js', '/panel.css': 'dist/extension/panel.css' }[route];
  if (file) { res.setHeader('Content-Type', route.endsWith('.js') ? 'text/javascript' : 'text/css'); res.end(await readFile(file)); return; }
  if (route.startsWith('/exports/')) {
    const path = resolve(out, decodeURIComponent(route.slice(9)));
    if (!path.startsWith(out + '/')) { res.writeHead(404).end(); return; }
    try { res.setHeader('Content-Type', path.endsWith('.svg') ? 'image/svg+xml' : 'image/png'); res.end(await readFile(path)); } catch { res.writeHead(404).end(); }
    return;
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end('<!doctype html><html lang="en"><head><meta charset="utf-8"><link rel="stylesheet" href="/panel.css"><title>Tabby motion export</title></head><body><div id="root"></div><script src="/panel.js"></script></body></html>');
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ channel: 'chromium', headless: true });
const context = await browser.newContext({ viewport: frame, deviceScaleFactor: 4, reducedMotion: 'reduce' });
const page = await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.route('**/*', route => route.request().url().startsWith(url) || route.request().url().startsWith('data:') ? route.continue() : route.abort());
await page.addInitScript(({ now }) => {
  Date.now = () => now;
  let fixture = JSON.parse(localStorage.getItem('motion-fixture') || 'null');
  const listeners = [];
  globalThis.chrome = {
    runtime: { id: 'tabby-motion-render', async sendMessage(message) {
      if (!fixture) return { ok: false, error: 'MOTION_FIXTURE_NOT_READY' };
      if (message.type === 'GET') return { ok: true, data: fixture.state };
      if (message.type === 'LIST_TABS') return { ok: true, data: fixture.tabs };
      if (message.type === 'SETTINGS') { Object.assign(fixture.state.settings, message.settings); listeners.forEach(fn => fn({ app: {} })); return { ok: true, data: fixture.state }; }
      return { ok: false, error: 'READ_ONLY_MOTION_EXPORT' };
    } },
    storage: { onChanged: { addListener(fn) { listeners.push(fn); }, removeListener() {} } }
  };
}, { now });
await page.goto(url);

function fixture(lang, variant) {
  const goal = 'Build a React login form';
  const task = (id, title, status) => ({ id, title, status, steps: [], source: '', due: '', createdAt: now - 3600000, ...(status === 'done' ? { completedAt: now - 60000 } : {}) });
  const tasks = [task('1', goal, 'doing'), task('2', 'Check error handling', 'planned'), task('3', 'Create the form component', 'done')];
  const tabs = [
    { id: 101, title: 'React · Managing State', url: 'https://react.dev/learn/managing-state', active: true, pinned: false, groupId: -1 },
    { id: 102, title: 'React · Your First Component', url: 'https://react.dev/learn/your-first-component', active: false, pinned: false, groupId: -1 },
    { id: 103, title: 'MDN · HTML form', url: 'https://developer.mozilla.org/en-US/docs/Web/HTML/Element/form', active: false, pinned: false, groupId: -1 },
  ];
  const state = { version: 1, settings: { language: lang, mode: 'soft', readText: true, consent: true, excludedSites: [], breakMinutes: 5, pairToken: '' }, tasks, session: null, history: [], page: null, assessment: null, ai: { connected: true, code: 'READY', model: 'deepseek-v3.2', at: now }, usage: {} };
  if (variant !== 'start') {
    const phase = variant === 'paused' ? 'paused' : variant === 'break' ? 'break' : variant === 'resume' ? 'ready' : 'running';
    state.session = { id: 'motion-demo', goal, taskId: '1', phase, revision: 1, startedAt: now - 5 * 60000, accountedAt: now, remainingMs: 20 * 60000, durationMs: 25 * 60000, away: false, category: 'aligned', totals: { aligned: 240000, distracting: 30000, unknown: 30000, break: 0, away: 0, paused: 0 }, reminders: 1, returns: 1, corrections: {}, workTabs: [{ tabId: 101, title: tabs[0].title, url: tabs[0].url, key: 'react' }], lastConfirmedStep: 'Created the form component', events: [], resumeCard: variant === 'resume', ...(phase === 'break' ? { breakUntil: now + 5 * 60000 } : {}) };
    state.page = { tabId: 101, windowId: 1, title: tabs[0].title, url: tabs[0].url, key: 'react', enteredAt: now - 60000 };
    if (['active', 'distraction', 'tasks', 'tabs', 'stats'].includes(variant)) {
      const distracting = variant === 'distraction';
      state.assessment = { category: distracting ? 'distracting' : 'aligned', reason: (distracting ? 'This entertainment video does not relate to your current goal.' : 'Component state is relevant to building your login form.'), nextStep: (distracting ? 'Return to the login form and add a submit handler.' : 'Add a submit handler to the form.'), source: 'ai', at: now, key: 'react' };
      if (distracting) { state.session.category = 'distracting'; state.page.title = 'Funny cats compilation'; state.page.url = 'https://example.com/cats'; }
    }
    if (variant === 'tabs') state.groupDraft = [{ title: 'Login form', color: 'orange', tabIds: [101, 102, 103] }];
  }
  return { state, tabs };
}

const words = { en: { focus: 'Focus', tasks: 'Tasks', tabs: 'Tabs', stats: 'Insights', settings: 'Settings' } };
async function load(lang, variant, section = 'focus', viewport = frame) {
  await page.setViewportSize(viewport);
  await page.evaluate(data => localStorage.setItem('motion-fixture', JSON.stringify(data)), fixture(lang, variant));
  await page.reload();
  await page.locator('h1').waitFor();
  await page.addStyleTag({ content: '*{animation:none!important;transition:none!important;caret-color:transparent!important}html{scroll-behavior:auto!important}' });
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(i => i.decode().catch(() => {}))); });
  if (variant === 'start') await page.getByLabel('What would you like to focus on?').fill('Build a React login form');
  if (section !== 'focus') await page.locator(`.nav-item[title="${words[lang][section]}"]`).click();
  await collectIcons();
}
async function collectIcons() {
  const icons = await page.locator('svg.lucide').evaluateAll(nodes => nodes.map(node => ({ name: [...node.classList].find(c => c.startsWith('lucide-')), svg: node.outerHTML })));
  for (const icon of icons) if (icon.name && !iconMap.has(icon.name)) iconMap.set(icon.name, icon.svg);
}
async function capture(target, relative, options = {}) {
  const locator = typeof target === 'string' ? page.locator(target).first() : target;
  await locator.scrollIntoViewIfNeeded();
  await page.mouse.move(0, 0);
  if (options.hover) await locator.hover();
  const originalDisabled = await locator.evaluate(el => el.disabled);
  if (options.disabled) await locator.evaluate(el => { el.disabled = true; });
  const box = await locator.boundingBox();
  if (!box || box.width < 1 || box.height < 1) throw new Error(`Missing export: ${relative}`);
  const pad = 8;
  const dimensions = await page.evaluate(() => ({ w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight, y: scrollY }));
  const clip = { x: Math.max(0, Math.floor(box.x - pad)), y: Math.max(0, Math.floor(box.y + dimensions.y - pad)), width: Math.ceil(box.width + 2 * pad), height: Math.ceil(box.height + 2 * pad) };
  await locator.evaluate(el => el.setAttribute('data-motion-root', ''));
  const isolate = await page.addStyleTag({ content: 'html,body{background:transparent!important}body *{visibility:hidden!important}[data-motion-root],[data-motion-root] *{visibility:visible!important}' });
  await mkdir(dirname(`${out}/${relative}`), { recursive: true });
  await page.screenshot({ path: `${out}/${relative}`, clip, omitBackground: true, animations: 'disabled' });
  await isolate.evaluate(el => el.remove());
  await locator.evaluate((el, disabled) => { el.removeAttribute('data-motion-root'); if (disabled !== undefined) el.disabled = disabled; }, originalDisabled);
  const label = (await locator.innerText()).replace(/\s+/g, ' ').trim();
  catalog.push({ path: relative, category: relative.split('/')[0], scale: 4, logicalWidth: clip.width, logicalHeight: clip.height, padding: pad, label });
  return clip;
}
async function button(lang, name, target, states = false) {
  const locator = typeof target === 'string' ? page.locator(target).first() : target;
  await capture(locator, `02-buttons/${lang}/${name}__default@4x.png`);
  if (states) {
    await capture(locator, `02-buttons/${lang}/${name}__hover@4x.png`, { hover: true });
    await capture(locator, `02-buttons/${lang}/${name}__disabled@4x.png`, { disabled: true });
  }
}
async function screen(lang, variant, section = 'focus') {
  await load(lang, variant, section, {width:390,height:900});
  const filename = `05-screens/${lang}/${variant}__side-panel@4x.png`;
  await mkdir(dirname(`${out}/${filename}`), { recursive: true });
  await page.screenshot({ path: `${out}/${filename}`, fullPage: false, animations: 'disabled' });
  catalog.push({ path: filename, category: '05-screens', scale: 4, logicalWidth: 390, logicalHeight: 900, label: `${lang} ${variant} · illustrative state` });
}
async function layers(lang) {
  await load(lang, 'active');
  const root = page.locator('.timer-card'); await root.scrollIntoViewIfNeeded();
  const b = await root.boundingBox(); const sy = await page.evaluate(() => scrollY);
  const clip = { x: Math.floor(b.x - 8), y: Math.floor(b.y + sy - 8), width: Math.ceil(b.width + 16), height: Math.ceil(b.height + 16) };
  const folder = `06-layers/${lang}/focus-card`;
  await mkdir(`${out}/${folder}`, { recursive: true });
  const definitions = [
    ['01-background', '.timer-card', false],
    ['02-orbits-and-cat', '.timer-card .orbit,.timer-card .orbit-leaf,.timer-card .orbit-star', true],
    ['03-timer', '.timer-card .timer-center', true],
    ['04-heading', '.timer-card .card-top', true],
    ['05-goal', '.timer-card .active-goal', true],
    ['06-assessment', '.timer-card .compact-assessment', true],
    ['07-pause-button', '.timer-card .active-controls .button-row>.primary', true],
    ['08-break-button', '.timer-card .active-controls .button-row>.secondary', true],
    ['09-footer', '.timer-card .timer-footer', true],
  ];
  for (const [name, selector, children] of definitions) {
    const nodes = page.locator(selector); if (!await nodes.count()) throw new Error(`Missing layer ${name}`);
    await nodes.evaluateAll(els => els.forEach(el => el.setAttribute('data-motion-layer', '')));
    const style = await page.addStyleTag({ content: `html,body{background:transparent!important}body *{visibility:hidden!important}[data-motion-layer]${children ? ',[data-motion-layer] *' : ''}{visibility:visible!important}` });
    const file = `${folder}/${name}@4x.png`;
    await page.screenshot({ path: `${out}/${file}`, clip, omitBackground: true, animations: 'disabled' });
    await style.evaluate(el => el.remove()); await nodes.evaluateAll(els => els.forEach(el => el.removeAttribute('data-motion-layer')));
    catalog.push({ path: file, category: '06-layers', scale: 4, logicalWidth: clip.width, logicalHeight: clip.height, label: name });
  }
  await capture(root, `${folder}/reference__flattened@4x.png`);
  await writeFile(`${out}/${folder}/layout.json`, JSON.stringify({ width: clip.width * 4, height: clip.height * 4, scale: 4, stackBottomToTop: definitions.map(([name]) => `${name}@4x.png`), alignment: 'All PNG layers share one canvas. Center every layer at the same position.', text: 'Raster text; separate timer/title/button layers can be replaced with editable AE text.' }, null, 2));
}

try {
for (const lang of ['en']) {
  await load(lang, 'start');
  await button(lang, 'start-focus', '.goal-form .primary', true);
  await capture('.timer-card', `03-cards/${lang}/focus-start@4x.png`);
  for (const section of Object.keys(words[lang])) {
    if (section !== 'focus') await page.locator(`.nav-item[title="${words[lang][section]}"]`).click();
    await capture(page.locator(`.nav-item[title="${words[lang][section]}"]`),`04-controls/${lang}/nav-${section}__selected@4x.png`);
  }
  await capture('.mode-option.chosen', `04-controls/${lang}/mode-soft@4x.png`);
  await capture('.mode-option:not(.chosen)', `04-controls/${lang}/mode-strict@4x.png`);
  await capture('.toggle-row', `04-controls/${lang}/toggle-analysis-on@4x.png`);
  await load(lang, 'active');
  await button(lang, 'pause', '.active-controls .primary', true);
  await button(lang, 'break-five-minutes', '.active-controls .secondary');
  await button(lang, 'help-continue', '.context-actions>.text-button');
  await button(lang, 'this-is-relevant', '.context-actions .button-row>.btn:first-child');
  await button(lang, 'stop-session', '.session-dock button');
  await capture('.context-card', `03-cards/${lang}/context-aligned@4x.png`);
  await capture('.context-card .page-source', `04-controls/${lang}/page-source@4x.png`);
  await capture('.compact-assessment .pill', `04-controls/${lang}/status-aligned@4x.png`);
  await load(lang, 'paused');
  await button(lang, 'resume', '.active-controls .primary', true);
  await capture('.compact-assessment .pill', `04-controls/${lang}/status-paused@4x.png`);
  await load(lang, 'distraction');
  await button(lang, 'back-to-work', '.context-actions>.primary', true);
  await capture('.context-card', `03-cards/${lang}/context-distraction@4x.png`);
  await capture('.compact-assessment .pill', `04-controls/${lang}/status-distraction@4x.png`);
  await load(lang, 'break'); await capture('.timer-card', `03-cards/${lang}/break-timer@4x.png`);
  await load(lang, 'resume'); await capture('.resume-card', `03-cards/${lang}/resume-context@4x.png`);
  await load(lang, 'tasks', 'tasks');
  await button(lang, 'new-task', '.section-toolbar .primary');
  await button(lang, 'extract-from-page', '.section-toolbar .secondary');
  for (let n=0;n<3;n++) await capture(page.locator('.task-row').nth(n), `03-cards/${lang}/task-${['doing','planned','done'][n]}@4x.png`);
  await page.locator('.section-toolbar .primary').click();
  await page.getByLabel('Title',{exact:true}).fill('Build the login form');
  await button(lang, 'save-task', '.task-editor .primary');
  await capture('.task-editor', `03-cards/${lang}/task-editor@4x.png`);
  await collectIcons();
  await load(lang, 'tabs', 'tabs');
  await button(lang, 'suggest-groups', '.tab-tools .primary');
  await button(lang, 'confirm-groups', '.group-review>.primary');
  await capture('.group-review', `03-cards/${lang}/tab-group-preview@4x.png`);
  await capture('.tab-row', `03-cards/${lang}/tab-row@4x.png`);
  await load(lang, 'stats', 'stats'); await capture('.session-report', `03-cards/${lang}/session-statistics@4x.png`);
  for (const variant of ['start','active','paused','distraction','break','resume','tasks','tabs','stats']) await screen(lang, variant, ['tasks','tabs','stats'].includes(variant) ? variant : 'focus');
  await load(lang, 'active', 'focus', {width:1440,height:1150});
  await page.screenshot({path:`${out}/05-screens/${lang}/active__desktop@4x.png`,fullPage:true,animations:'disabled'});
  catalog.push({path:`05-screens/${lang}/active__desktop@4x.png`,category:'05-screens',scale:4,logicalWidth:1440,logicalHeight:await page.evaluate(()=>document.documentElement.scrollHeight),label:`${lang} active desktop · illustrative state`});
  await layers(lang);
  console.log(`Exported ${lang.toUpperCase()} buttons, cards, screens and aligned animation layers.`);
}
// Exact Lucide vectors used by the current UI, plus high-resolution PNG versions.
await mkdir(`${out}/07-icons`, {recursive:true});
const iconPage = await context.newPage(); await iconPage.setViewportSize({width:64,height:64});
for (const [name, original] of iconMap) {
  let svg = original.replace(/width="[^"]*"/, 'width="64"').replace(/height="[^"]*"/,'height="64"').replace(/currentColor/g,'#272923');
  if (!svg.includes('xmlns=')) svg = svg.replace('<svg','<svg xmlns="http://www.w3.org/2000/svg"');
  await writeFile(`${out}/07-icons/${name}.svg`,svg);
  await iconPage.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block}</style>${svg}`);
  await iconPage.screenshot({path:`${out}/07-icons/${name}@4x.png`,omitBackground:true});
}
await writeFile(`${out}/manifest.json`, JSON.stringify({brand:'Tabby',generatedAt:new Date().toISOString(),data:'Illustrative motion design states, not a live AI recording',assets:catalog},null,2));
const csv = '\ufefffile,label,scale,width_px,height_px\n'+catalog.map(a=>[a.path,a.label,a.scale,a.logicalWidth*a.scale,a.logicalHeight*a.scale].map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\n');
await writeFile(`${out}/labels-and-sizes.csv`, csv);
const tiles = catalog.filter(a=>!a.path.startsWith('06-layers/')&&!a.path.includes('__hover')&&!a.path.includes('__disabled')).map(a=>`<article><div class="image"><img loading="lazy" src="${a.path}" alt=""></div><small>${a.path}</small></article>`).join('');
await writeFile(`${out}/START-HERE.html`, `<!doctype html><html lang="en"><meta charset="utf-8"><title>Tabby · Motion kit</title><style>*{box-sizing:border-box}body{margin:0;background:#f6f5f0;color:#272923;font:15px/1.6 system-ui;padding:50px}header{max-width:950px;margin-bottom:35px}header img{width:190px}h1{font-size:40px;line-height:1.15;letter-spacing:-1px}p{color:#77796f}.tag{display:inline-block;background:#ffe2d3;padding:6px 12px;border-radius:8px;margin:0 7px 7px 0}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(265px,1fr));gap:20px}.grid{grid-template-columns:repeat(auto-fill,minmax(265px,1fr))}article{border:1px solid #dedfd5;border-radius:14px;padding:16px;background:#fffefb;overflow:hidden}.image{display:flex;align-items:center;justify-content:center;min-height:130px;height:220px;background:repeating-conic-gradient(#efeee9 0% 25%,#fffefb 0% 50%) 0 0/18px 18px;border-radius:8px;padding:12px}.image img{max-width:100%;max-height:100%;object-fit:contain}small{font-size:10px;display:block;margin-top:12px;overflow-wrap:anywhere}</style><header><img src="01-brand/tabby-logo.svg"><h1>Ready for your video.<br>Every element, separate.</h1><p>Assets from the current English Tabby interface. Transparent PNGs and original SVGs. Screen content uses illustrative states for motion design.</p><span class="tag">PNG · 4×</span><span class="tag">English</span><span class="tag">9 card layers</span><span class="tag">Orange #FF7745</span><p>Open README.txt before editing. All assets are in the folders beside this page.</p></header><div class="grid">${tiles}</div></html>`);
await cp('docs/MOTION_KIT.txt', `${out}/README.txt`);
await cp('node_modules/lucide-react/LICENSE', `${out}/07-icons/LUCIDE-LICENSE.txt`);
if(errors.length) throw new Error(errors.join('\n'));
console.log(`Motion kit ready: ${catalog.length} UI exports, ${iconMap.size} SVG/PNG icons, original brand pack. No external requests.`);
} finally {await browser.close();await new Promise(r=>server.close(r));}
