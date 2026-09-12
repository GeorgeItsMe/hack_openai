import { copyFile, mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const source = resolve('dist/extension');
const allowed = ['manifest.json', 'worker.js', 'content.js', 'panel.js', 'panel.css', 'sidepanel.html', 'icons'];
const iconNames = [16, 32, 48, 128].map(size => `icon${size}.png`);
for (const name of allowed) await stat(join(source, name));
const extras = (await readdir(source)).filter(name => !allowed.includes(name));
if (extras.length) throw new Error(`Unexpected files in extension build: ${extras.join(', ')}`);
const icons = await readdir(join(source, 'icons'));
if (icons.length !== iconNames.length || icons.some(name => !iconNames.includes(name))) throw new Error('Unexpected extension icons');
const manifest = JSON.parse(await readFile(join(source, 'manifest.json'), 'utf8'));
if (manifest.name !== 'Tabby' || manifest.action?.default_title !== 'Tabby') throw new Error('Download must be branded Tabby');

const temp = await mkdtemp(join(tmpdir(), 'tabby-package-'));
try {
  const contents = join(temp, 'contents');
  await mkdir(join(contents, 'icons'), { recursive: true });
  for (const name of allowed.filter(name => name !== 'icons')) await copyFile(join(source, name), join(contents, name));
  for (const name of iconNames) await copyFile(join(source, 'icons', name), join(contents, 'icons', name));
  await copyFile(resolve('scripts/extension-install.txt'), join(contents, 'INSTALL-TABBY.txt'));
  const archive = join(temp, 'Tabby.zip');
  await run('zip', ['-q', '-X', '-r', archive, ...allowed, 'INSTALL-TABBY.txt'], { cwd: contents });
  await run('unzip', ['-t', archive]);
  await copyFile(archive, resolve('dist/Tabby.zip'));
  // Keep the existing developer command's output path working.
  await copyFile(archive, resolve('dist/tabby-extension.zip'));
  if (process.argv.includes('--landing')) {
    await mkdir('public/downloads', { recursive: true });
    await copyFile(archive, resolve('public/downloads/Tabby.zip'));
    const bytes = await readFile(archive);
    await writeFile('public/downloads/Tabby.json', JSON.stringify({ name: 'Tabby', version: manifest.version, filename: 'Tabby.zip', bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), builtAt: new Date().toISOString() }, null, 2) + '\n');
    console.log(`Landing download ready: public/downloads/Tabby.zip (${bytes.length} bytes)`);
  }
  console.log(`Tabby ${manifest.version}: dist/Tabby.zip. Unzip, then load the Tabby folder in Chrome.`);
} finally { await rm(temp, { recursive: true, force: true }); }
