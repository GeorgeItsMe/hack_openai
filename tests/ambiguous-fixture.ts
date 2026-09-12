import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { AMBIGUOUS_ORIGIN } from '../src/shared/ambiguous';

export const channelId = '11111111-1111-4111-8111-111111111111';
export const messageId = '22222222-2222-4222-8222-222222222222';
export const sentId = '33333333-3333-4333-8333-333333333333';
export const fixtureMessage = { id: messageId, channel_id: channelId, thread_id: null, content: 'Prepare three design options · fixture\nReview the brief\nSketch three approaches', author: { display_name: 'Alex · fixture', email: 'private@example.test' }, created_at: '2026-09-12T08:00:00Z', deleted_at: null };

// A real HTTP MCP transport and REST contract fixture. Never contacts an Ambiguous account.
export async function ambiguousFixture() {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  let mode: 'ok' | 'timeout' | 'wrong-destination' | 'missing-tool' = 'ok';
  const execute = (name: string, args: Record<string, unknown>) => {
    calls.push({ name, args });
    if (name === 'list_channels') return { data: [{ id: channelId, name: 'design-fixture', type: 'private', archived_at: null, private_extra: 'OMIT_ME' }], has_more: false, total: 1 };
    assert.equal(args.channel_id, channelId);
    if (name === 'get_channel_messages') { assert.equal(args.limit, '50'); return { data: [fixtureMessage], has_more: false, total: 1 }; }
    assert.equal(name, 'send_message'); assert.equal(args.thread_id, messageId);
    if (mode === 'timeout') throw new Error('fixture delivery response lost');
    return { ...fixtureMessage, id: sentId, content: args.content, thread_id: mode === 'wrong-destination' ? sentId : messageId };
  };
  const http = createServer(async (req, res) => {
    assert.equal(req.headers.authorization, 'Bearer fixture-ambiguous-key');
    if (req.method !== 'POST') { res.writeHead(405).end(); return; }
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString());
    const server = new Server({ name: 'ambiguous-contract-fixture', version: '1.0.0' }, { capabilities: { tools: {} } });
    server.setRequestHandler(ListToolsRequestSchema, async request => {
      // Force the client to discover the chat tools on a later page.
      if (!request.params?.cursor) return { tools: [], nextCursor: 'chat-tools' };
      assert.equal(request.params.cursor, 'chat-tools');
      return { tools: (mode === 'missing-tool' ? [] : ['list_channels', 'get_channel_messages', 'send_message']).map(name => ({ name, inputSchema: { type: 'object' as const, properties: { channel_id: { type: 'string' }, thread_id: { type: 'string' }, content: { type: 'string' }, limit: { type: 'string' }, cursor: { type: 'string' } } } })) };
    });
    server.setRequestHandler(CallToolRequestSchema, async request => {
      try { const data = execute(request.params.name, request.params.arguments || {}); return { content: [{ type: 'text', text: JSON.stringify(data) }], structuredContent: data }; }
      catch { return { isError: true, content: [{ type: 'text', text: 'private fixture upstream error' }] }; }
    });
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.once('close', () => { void transport.close(); void server.close(); });
    await server.connect(transport); await transport.handleRequest(req, res, body);
  });
  await new Promise<void>(resolve => http.listen(0, '127.0.0.1', resolve));
  const port = (http.address() as { port: number }).port;
  const fetcher: typeof fetch = async (raw, init) => {
    const url = new URL(typeof raw === 'string' ? raw : raw instanceof URL ? raw.href : raw.url);
    assert.equal(url.origin, AMBIGUOUS_ORIGIN);
    assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer fixture-ambiguous-key');
    assert.equal(init?.redirect, 'error');
    if (url.pathname === '/mcp') return fetch(`http://127.0.0.1:${port}/mcp`, init);
    assert.equal(new Headers(init?.headers).get('API-Version'), '1');
    let args: Record<string, unknown> = {};
    const name = url.pathname === '/api/channels' ? 'list_channels' : init?.method === 'POST' ? 'send_message' : 'get_channel_messages';
    if (name !== 'list_channels') { assert.equal(url.pathname, `/api/channels/${channelId}/messages`); args = { channel_id: channelId, ...(init?.method === 'POST' ? JSON.parse(String(init.body)) : { limit: url.searchParams.get('limit'), ...(url.searchParams.has('cursor') ? { cursor: url.searchParams.get('cursor') } : {}) }) }; }
    return Response.json(execute(name, args));
  };
  return { calls, fetcher, setMode(value: typeof mode) { mode = value; }, close: () => new Promise<void>(resolve => { http.closeAllConnections(); http.close(() => resolve()); }) };
}
