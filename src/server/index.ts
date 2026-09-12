import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { Provider } from './provider';
import { createApp } from './http';
import { AmbiguousIntegration } from './ambiguous';
import { GoogleIntegration } from './google';
try { process.loadEnvFile('.env'); } catch { /* Explicit unconnected state is supported. */ }
const port = Number(process.env.TABBY_PORT || 4318);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid TABBY_PORT');
const baseUrl = process.env.GPTUNNEL_BASE_URL || 'https://gptunnel.ru/v1';
if (new URL(baseUrl).protocol !== 'https:') throw new Error('GPTUNNEL_BASE_URL must use HTTPS');
const manifest = JSON.parse(readFileSync('src/extension/manifest.json', 'utf8'));
const extensionId = createHash('sha256').update(Buffer.from(manifest.key, 'base64')).digest('hex').slice(0, 32).replace(/[0-9a-f]/g, c => String.fromCharCode(97 + parseInt(c, 16)));
const pairToken = process.env.TABBY_PAIR_TOKEN || '';
if (pairToken.length < 32) { console.error('Run npm run setup first to create local pairing credentials.'); process.exit(1); }
const provider = new Provider({ key: process.env.GPTUNNEL_API_KEY || '', baseUrl, model: process.env.GPTUNNEL_MODEL || '' });
// Installed-app OAuth credentials and refresh tokens never enter the extension bundle.
let googleClientId = process.env.GOOGLE_CLIENT_ID || '';
let googleClientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
const googleClientFile = process.env.GOOGLE_OAUTH_CLIENT_FILE || '.local/google-client.json';
try {
  const client = JSON.parse(readFileSync(googleClientFile, 'utf8')).installed;
  if (!client || typeof client.client_id !== 'string') throw new Error();
  googleClientId ||= client.client_id;
  googleClientSecret ||= typeof client.client_secret === 'string' ? client.client_secret : '';
} catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') console.error('Google OAuth client file is invalid. Use a Desktop app client JSON.'); }
const google = new GoogleIntegration({ clientId: googleClientId, clientSecret: googleClientSecret, tokenFile: '.local/google-tokens.json' });
const ambiguous = new AmbiguousIntegration({ key: process.env.AMBIGUOUS_API_KEY || '', transport: process.env.AMBIGUOUS_TRANSPORT === 'rest' ? 'rest' : 'mcp', authFile: '.local/ambiguous-oauth.json', receiptFile: '.local/ambiguous-receipts.json' });
const server = createApp({ port, extensionId, pairToken }, provider, google, ambiguous);
server.on('close', () => ambiguous.cancel());
server.on('close', () => google.cancel());
server.requestTimeout = 30000; server.headersTimeout = 10000;
server.listen(port, '127.0.0.1', () => { console.log(`Tabby server: http://127.0.0.1:${port}\nAllowed extension: ${extensionId}\nProvider: ${process.env.GPTUNNEL_API_KEY ? 'key configured; use connection check to verify' : 'AI not connected'}`); });
server.on('error', (e: NodeJS.ErrnoException) => { console.error(e.code === 'EADDRINUSE' ? 'Port already in use. Stop the existing Tabby server.' : 'Server could not start.'); process.exit(1); });
