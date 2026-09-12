import { build } from 'esbuild';
import { mkdir, copyFile, writeFile, readFile } from 'node:fs/promises';
await mkdir('dist/extension/icons', { recursive: true });
await build({ entryPoints: { worker: 'src/extension/worker.ts', content: 'src/extension/content.ts', panel: 'src/extension/panel.tsx' }, outdir: 'dist/extension', bundle: true, minify: true, sourcemap: false, target: 'chrome120', format: 'iife', jsx: 'automatic', loader: { '.svg': 'dataurl' }, define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'info' });
await copyFile('src/extension/manifest.json', 'dist/extension/manifest.json');
await writeFile('dist/extension/sidepanel.html', '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Tabby</title><meta name="theme-color" content="#ff7745"><link rel="icon" href="icons/icon32.png"><link rel="stylesheet" href="panel.css"></head><body><div id="root"></div><script src="panel.js" defer></script></body></html>');
// Chrome-size exports of the supplied Tabby cat favicon.
for (const size of [16, 32, 48, 128]) {
  await copyFile(`public/brand/extension/tabby-${size}.png`, `dist/extension/icons/icon${size}.png`);
}
// Build-time protection: never copy .env or server source into the extension.
let key = ''; try { key = (await readFile('.env', 'utf8')).match(/^GPTUNNEL_API_KEY=(.+)$/m)?.[1]?.trim() || ''; } catch {}
for (const file of ['worker.js', 'content.js', 'panel.js', 'manifest.json']) {
  const body = await readFile(`dist/extension/${file}`, 'utf8');
  if (key && body.includes(key)) throw new Error('SECRET_LEAK_IN_EXTENSION');
}
console.log('Chrome unpacked extension ready: dist/extension');
