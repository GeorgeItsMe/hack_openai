import { build } from 'esbuild';
import { mkdir, copyFile, writeFile, readFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';
await mkdir('dist/extension/icons', { recursive: true });
await build({ entryPoints: { worker: 'src/extension/worker.ts', content: 'src/extension/content.ts', panel: 'src/extension/panel.tsx' }, outdir: 'dist/extension', bundle: true, minify: true, sourcemap: false, target: 'chrome120', format: 'iife', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'info' });
await copyFile('src/extension/manifest.json', 'dist/extension/manifest.json');
await writeFile('dist/extension/sidepanel.html', '<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>FocusTab AI</title><link rel="stylesheet" href="panel.css"></head><body><div id="root"></div><script src="panel.js" defer></script></body></html>');
// Small code-drawn extension mark; no remote assets or fonts.
function crc32(buf) { let c = -1; for (const b of buf) { c ^= b; for (let i = 0; i < 8; i++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); } return (c ^ -1) >>> 0; }
function chunk(type, data) { const t = Buffer.from(type), n = Buffer.alloc(4), c = Buffer.alloc(4); n.writeUInt32BE(data.length); c.writeUInt32BE(crc32(Buffer.concat([t, data]))); return Buffer.concat([n, t, data, c]); }
for (const size of [16, 32, 48, 128]) {
  const row = size * 4 + 1; const pixels = Buffer.alloc(row * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size; const edge = Math.hypot(Math.max(.19 - u, u - .81, 0), Math.max(.19 - v, v - .81, 0));
    let color = [49, 83, 67, edge > .19 ? 0 : 255];
    const xx = Math.min(u, 1 - u), yy = Math.min(v, 1 - v);
    if (((xx > .22 && xx < .28 && yy > .22 && yy < .41) || (yy > .22 && yy < .28 && xx > .22 && xx < .41))) color = [228, 239, 206, 255];
    if (Math.hypot(u - .5, v - .5) < .115) color = [220, 164, 134, 255];
    pixels.set(color, y * row + 1 + x * 4);
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  const png = Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(pixels)), chunk('IEND', Buffer.alloc(0))]);
  await writeFile(`dist/extension/icons/icon${size}.png`, png);
}
// Build-time protection: never copy .env or server source into the extension.
let key = ''; try { key = (await readFile('.env', 'utf8')).match(/^GPTUNNEL_API_KEY=(.+)$/m)?.[1]?.trim() || ''; } catch {}
for (const file of ['worker.js', 'content.js', 'panel.js', 'manifest.json']) {
  const body = await readFile(`dist/extension/${file}`, 'utf8');
  if (key && body.includes(key)) throw new Error('SECRET_LEAK_IN_EXTENSION');
}
console.log('Chrome unpacked extension ready: dist/extension');
