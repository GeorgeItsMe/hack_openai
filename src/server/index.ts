import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { Provider } from './provider';
import { createApp } from './http';
try { process.loadEnvFile('.env'); } catch { /* Explicit unconnected state is supported. */ }
const port = Number(process.env.FOCUSTAB_PORT || 4318);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid FOCUSTAB_PORT');
const baseUrl = process.env.GPTUNNEL_BASE_URL || 'https://gptunnel.ru/v1';
if (new URL(baseUrl).protocol !== 'https:') throw new Error('GPTUNNEL_BASE_URL must use HTTPS');
const manifest = JSON.parse(readFileSync('src/extension/manifest.json', 'utf8'));
const extensionId = createHash('sha256').update(Buffer.from(manifest.key, 'base64')).digest('hex').slice(0, 32).replace(/[0-9a-f]/g, c => String.fromCharCode(97 + parseInt(c, 16)));
const pairToken = process.env.FOCUSTAB_PAIR_TOKEN || '';
if (pairToken.length < 32) { console.error('Run npm run setup first to create local pairing credentials.'); process.exit(1); }
const provider = new Provider({ key: process.env.GPTUNNEL_API_KEY || '', baseUrl, model: process.env.GPTUNNEL_MODEL || '' });
const server = createApp({ port, extensionId, pairToken }, provider);
server.requestTimeout = 30000; server.headersTimeout = 10000;
server.listen(port, '127.0.0.1', () => { console.log(`FocusTab server: http://127.0.0.1:${port}\nAllowed extension: ${extensionId}\nProvider: ${process.env.GPTUNNEL_API_KEY ? 'key configured; use connection check to verify' : 'AI not connected'}`); });
server.on('error', (e: NodeJS.ErrnoException) => { console.error(e.code === 'EADDRINUSE' ? 'Port already in use. Stop the existing FocusTab server.' : 'Server could not start.'); process.exit(1); });
