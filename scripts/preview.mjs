import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
const assets = { '/': ['sidepanel.html', 'text/html'], '/focus.html': ['sidepanel.html', 'text/html'], '/panel.js': ['panel.js', 'text/javascript'], '/panel.css': ['panel.css', 'text/css'] };
for (const size of [16, 32, 48, 128]) assets[`/icons/icon${size}.png`] = [`icons/icon${size}.png`, 'image/png'];
const port = Number(process.env.TABBY_PREVIEW_PORT || 4180);
const server = createServer(async (req, res) => {
  const asset = assets[new URL(req.url, 'http://127.0.0.1').pathname];
  if (!asset || req.method !== 'GET') { res.writeHead(404); res.end('Not found'); return; }
  try { const body = await readFile(`dist/extension/${asset[0]}`); res.writeHead(200, { 'Content-Type': asset[1], 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' }); res.end(body); }
  catch { res.writeHead(503); res.end('Run npm run build first.'); }
});
server.on('error', () => { console.error(`Preview port ${port} is unavailable. Set TABBY_PREVIEW_PORT to a free port.`); process.exit(1); });
server.listen(port, '127.0.0.1', () => console.log(`Tabby production web preview: http://127.0.0.1:${port}`));
