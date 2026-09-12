import { mkdir, open, chmod } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
await mkdir('.local', { recursive: true, mode: 0o700 });
try { const file = await open('.local/mcp-token.txt', 'wx', 0o600); try { await file.writeFile(randomBytes(32).toString('hex') + '\n'); } finally { await file.close(); } }
catch (error) { if (error.code !== 'EEXIST') throw error; }
await chmod('.local/mcp-token.txt', 0o600);
console.log('MCP token is ready in .local/mcp-token.txt. Enter it in Tabby Settings → MCP access. Existing credentials were preserved.');
