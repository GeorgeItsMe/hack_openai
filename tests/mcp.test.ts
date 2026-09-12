import { test } from 'node:test';
import assert from 'node:assert/strict';
import { request as httpRequest } from 'node:http';
import { McpBroker } from '../src/mcp/broker';
const id = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'; const token = 'mcp-test-'.repeat(8);
test('MCP bridge authenticates separately, returns fresh data and handles disconnect, expiry and profile conflicts', async () => {
  const port = 44329; const broker = new McpBroker(120); const server = broker.createHttp(port, id, token);
  await new Promise<void>(resolve => server.listen(port, '127.0.0.1', resolve));
  const headers = { 'Content-Type': 'application/json', Origin: `chrome-extension://${id}`, 'X-Tabby-MCP-Token': token };
  const profileId = crypto.randomUUID();
  const post = (path: string, body: unknown, override: Record<string, string> = {}) => fetch(`http://127.0.0.1:${port}/bridge/${path}`, { method: 'POST', headers: { ...headers, ...override }, body: JSON.stringify(body) });
  try {
    await assert.rejects(broker.call('tabby_get_session', {}), /BROWSER_DISCONNECTED/);
    assert.equal((await post('poll', { profileId }, { Origin: 'https://evil.example' })).status, 403);
    assert.equal((await post('poll', { profileId }, { 'X-Tabby-MCP-Token': 'wrong' })).status, 401);
    const spoof = await new Promise<number>(resolve => { const req = httpRequest({ hostname: '127.0.0.1', port, path: '/bridge/poll', method: 'POST', headers: { ...headers, Host: 'evil.example' } }, res => { res.resume(); resolve(res.statusCode!); }); req.end(JSON.stringify({ profileId })); }); assert.equal(spoof, 403);
    const poll = post('poll', { profileId }); await new Promise(resolve => setTimeout(resolve, 20));
    assert.equal((await post('poll', { profileId: crypto.randomUUID() })).status, 409);
    const call = broker.call('tabby_get_session', {}); const request = (await (await poll).json()).request;
    await post('reply', { profileId, id: request.id, data: { capturedAt: Date.now(), session: null } }); assert.equal((await call).session, null);
    const timeout = broker.call('tabby_list_tasks', {}); await assert.rejects(timeout, /BROWSER_TIMEOUT/);
    const stale = await post('reply', { profileId, id: request.id, data: { capturedAt: Date.now(), session: null } }); assert.equal(stale.status, 409);
    const bad = broker.call('tabby_get_session', {}); const failed = assert.rejects(bad, /INVALID_BRIDGE_RESPONSE/);
    const next = (await (await post('poll', { profileId })).json()).request;
    await post('reply', { profileId, id: next.id, data: { capturedAt: Date.now() - 10000, session: null } }); await failed;
    await post('disconnect', { profileId }); await assert.rejects(broker.call('tabby_get_session', {}), /BROWSER_DISCONNECTED/);
  } finally { broker.close(); server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
});
