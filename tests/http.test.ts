import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/server/http';
import { request as httpRequest } from 'node:http';
test('loopback proxy rejects websites, missing token, spoofed Host, bad bodies and unknown routes', async () => {
  const port = 44319; const id = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'; const token = 'test-pair-token-'.repeat(4); let calls = 0;
  const app = createApp({ port, extensionId: id, pairToken: token }, { status: async () => ({ connected: true, code: 'READY', model: 'fixture', available: [] }), run: async () => { calls++; return { result: {}, model: 'fixture', usage: {} }; } } as any);
  await new Promise<void>(resolve => app.listen(port, '127.0.0.1', resolve));
  const request = (headers: Record<string, string>, path = '/ai', body = '{}') => fetch(`http://127.0.0.1:${port}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body });
  const valid = { Origin: `chrome-extension://${id}`, 'X-Tabby-Token': token };
  try {
    assert.equal((await request({ ...valid, Origin: 'https://evil.example' })).status, 403);
    assert.equal((await request({ Origin: valid.Origin })).status, 401);
    const hostStatus = await new Promise<number>(resolve => { const r = httpRequest({ hostname: '127.0.0.1', port, path: '/ai', method: 'POST', headers: { ...valid, Host: 'evil.example', 'Content-Type': 'application/json' } }, res => { res.resume(); resolve(res.statusCode!); }); r.end('{}'); });
    assert.equal(hostStatus, 403);
    assert.equal((await request(valid, '/arbitrary-proxy')).status, 404);
    assert.equal((await request(valid, '/ai', '{bad')).status, 400);
    assert.equal((await request(valid, '/ai', 'a'.repeat(121000))).status, 413);
    assert.equal((await request(valid, '/status')).status, 200);
    assert.equal((await request(valid)).status, 200); assert.equal(calls, 1);
    for (let n = 0; n < 22; n++) await request(valid, '/status');
    assert.equal((await request(valid, '/status')).status, 429);
  } finally { await new Promise<void>(resolve => app.close(() => resolve())); }
});
