import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const source = process.argv[2];
if (!source || source === '--help') {
  console.log('Google setup for this local Tabby build:\n1. Enable Google Calendar API and Gmail API in Google Cloud.\n2. Configure the consent screen and add your account as a test user.\n3. Create an OAuth client of type Desktop app and download its JSON.\n4. Run npm run setup:google -- /absolute/path/to/client.json\n5. Restart the Tabby server, reload the extension, and open Calendar & mail.\nCredentials are saved privately in .local/google-client.json.');
  process.exit(source ? 0 : 1);
}
try {
  const raw = JSON.parse(await readFile(resolve(source), 'utf8'));
  const client = raw.installed;
  if (!client || typeof client.client_id !== 'string' || !client.client_id.endsWith('.apps.googleusercontent.com') || (client.client_secret !== undefined && typeof client.client_secret !== 'string')) throw new Error();
  await mkdir('.local', { recursive: true, mode: 0o700 });
  await writeFile('.local/google-client.json', JSON.stringify({ installed: { client_id: client.client_id, ...(client.client_secret ? { client_secret: client.client_secret } : {}) } }, null, 2) + '\n', { mode: 0o600 });
  await chmod('.local/google-client.json', 0o600);
  console.log('Google Desktop OAuth client saved privately. Restart the Tabby server, then connect Google from Calendar & mail. No credentials were printed.');
} catch { console.error('Could not import Google credentials. Provide a readable Desktop app OAuth JSON from Google Cloud. No existing provider settings were changed.'); process.exitCode = 1; }
