import { readFile, writeFile, chmod, mkdir } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
let env;
try { env = await readFile('.env', 'utf8'); } catch { env = await readFile('.env.example', 'utf8'); }
if (!/^TABBY_PAIR_TOKEN=.{32,}$/m.test(env)) {
  const line = `TABBY_PAIR_TOKEN=${randomBytes(32).toString('hex')}`;
  env = /^TABBY_PAIR_TOKEN=.*$/m.test(env) ? env.replace(/^TABBY_PAIR_TOKEN=.*$/m, line) : env + '\n' + line + '\n';
}
await writeFile('.env', env, { mode: 0o600 }); await chmod('.env', 0o600);
await mkdir('.local', { recursive: true });
const token = env.match(/^TABBY_PAIR_TOKEN=(.*)$/m)[1].trim();
await writeFile('.local/pairing.txt', token + '\n', { mode: 0o600 });
console.log('Local .env ready. Add GPTUNNEL_API_KEY there. Paste the local token from .local/pairing.txt into extension Settings → Connection token. Never paste your provider API key into the extension.');
