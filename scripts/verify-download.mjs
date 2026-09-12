import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const run = promisify(execFile);
const archive = 'public/downloads/Tabby.zip';
const meta = JSON.parse(await readFile('public/downloads/Tabby.json', 'utf8'));
const bytes = await readFile(archive);
assert.equal(meta.name, 'Tabby'); assert.equal(meta.filename, 'Tabby.zip');
assert.equal(bytes.length, meta.bytes, 'Download size differs from metadata');
assert.equal(createHash('sha256').update(bytes).digest('hex'), meta.sha256, 'Download hash differs from metadata');
const files = ['manifest.json', 'worker.js', 'content.js', 'panel.js', 'panel.css', 'sidepanel.html', ...[16, 32, 48, 128].map(size => `icons/icon${size}.png`)];
const names = (await run('unzip', ['-Z1', archive])).stdout.trim().split('\n');
assert.deepEqual(names.sort(), [...files, 'icons/', 'INSTALL-TABBY.txt'].sort(), 'Unexpected download contents');
for (const file of [...files, 'INSTALL-TABBY.txt']) {
  const expected = await readFile(file === 'INSTALL-TABBY.txt' ? 'scripts/extension-install.txt' : `dist/extension/${file}`);
  const { stdout } = await run('unzip', ['-p', archive, file], { encoding: 'buffer', maxBuffer: 10_000_000 });
  assert.ok(expected.equals(stdout), `Download is out of date: ${file}. Rebuild and run node scripts/package-extension.mjs --landing.`);
}
const manifest = JSON.parse(await readFile('dist/extension/manifest.json', 'utf8'));
assert.equal(meta.version, manifest.version);
console.log(`PASS: Tabby ${meta.version} download matches every freshly built extension file, installation instructions, version and integrity metadata.`);
