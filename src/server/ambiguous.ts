import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { AMBIGUOUS_MCP, AMBIGUOUS_ORIGIN, ambiguousSendSchema } from '../shared/ambiguous';
import { AppError } from './provider';
import { AmbiguousAuth, privateJson } from './ambiguous-auth';
const channel = z.object({ id: z.uuid(), name: z.string(), type: z.enum(['public', 'private', 'dm']), archived_at: z.string().nullable().optional() });
const message = z.object({ id: z.uuid(), channel_id: z.uuid(), thread_id: z.uuid().nullable(), content: z.string(), author: z.object({ display_name: z.string() }).nullable(), created_at: z.string().nullable(), deleted_at: z.string().nullable().optional() });
const page = <T extends z.ZodType>(item: T) => z.object({ data: z.array(item), has_more: z.boolean(), next_cursor: z.string().optional() });
const receipt = z.object({ fingerprint: z.string(), state: z.enum(['pending', 'sent']), messageId: z.uuid().optional() });
type Operation = 'list_channels' | 'get_channel_messages' | 'send_message';
export class AmbiguousIntegration {
  readonly auth: AmbiguousAuth;
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private config: { key?: string; transport?: 'mcp' | 'rest'; authFile: string; receiptFile: string }, private fetcher: typeof fetch = fetch) { this.auth = new AmbiguousAuth(config.authFile, config.key, fetcher); }
  async status() { return { ...await this.auth.status(), transport: this.config.transport || 'mcp' }; }
  async connect() { return { ...await this.auth.connect(), ...await this.status() }; }
  cancel() { this.auth.cancel(); }
  async disconnect() { await this.auth.disconnect(); return { disconnected: true }; }
  private async checkedFetch(raw: string | URL | Request, init?: RequestInit) {
    const url = new URL(typeof raw === 'string' ? raw : raw instanceof URL ? raw.href : raw.url);
    if (url.origin !== AMBIGUOUS_ORIGIN) throw new AppError('AMBIGUOUS_INVALID_ENDPOINT');
    const response = await this.fetcher(raw, { ...init, redirect: 'error', signal: AbortSignal.any([AbortSignal.timeout(18000), ...(init?.signal ? [init.signal] : [])]) });
    if (response.status === 401) {
      const key = new Headers(init?.headers ?? (raw instanceof Request ? raw.headers : undefined)).get('Authorization')?.replace(/^Bearer /i, '') || '';
      await this.auth.rejectedKey(key); throw new AppError('AMBIGUOUS_AUTH_REQUIRED', 401);
    }
    if (response.status === 403) throw new AppError('AMBIGUOUS_ACCESS_DENIED', 403);
    if (response.status === 429) throw new AppError('AMBIGUOUS_RATE_LIMIT', 429);
    if (!response.ok && !(response.status === 405 && init?.method === 'GET')) throw new AppError('AMBIGUOUS_UNAVAILABLE');
    return response;
  }
  private async operation<T>(name: Operation, args: Record<string, unknown>, fn: (run: () => Promise<unknown>) => Promise<T>, signal?: AbortSignal): Promise<T> {
    const deadline = AbortSignal.any([AbortSignal.timeout(25000), ...(signal ? [signal] : [])]); deadline.throwIfAborted();
    const key = await this.auth.key(); if (!key) throw new AppError('AMBIGUOUS_AUTH_REQUIRED', 401);
    if (this.config.transport === 'rest') {
      const id = args.channel_id ? z.uuid().parse(args.channel_id) : '';
      const path = name === 'list_channels' ? '/api/channels' : `/api/channels/${id}/messages`;
      const url = new URL(path, AMBIGUOUS_ORIGIN);
      if (name === 'get_channel_messages') { url.searchParams.set('limit', '50'); if (args.cursor) url.searchParams.set('cursor', String(args.cursor)); }
      return fn(async () => {
        deadline.throwIfAborted();
        const response = await this.checkedFetch(url, { signal: deadline, method: name === 'send_message' ? 'POST' : 'GET', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'API-Version': '1' }, ...(name === 'send_message' ? { body: JSON.stringify({ content: args.content, thread_id: args.thread_id }) } : {}) });
        return response.json();
      });
    }
    const client = new Client({ name: 'tabby-ambiguous', version: '1.0.0' });
    const transport = new StreamableHTTPClientTransport(new URL(AMBIGUOUS_MCP), { requestInit: { headers: { Authorization: `Bearer ${key}` } }, fetch: (raw, init) => this.checkedFetch(raw, { ...init, signal: AbortSignal.any([deadline, ...(init?.signal ? [init.signal] : [])]) }), reconnectionOptions: { maxRetries: 0, initialReconnectionDelay: 1000, maxReconnectionDelay: 1000, reconnectionDelayGrowFactor: 1 } });
    try {
      await client.connect(transport, { timeout: 18000 });
      let cursor: string | undefined; let tool;
      for (let page = 0; page < 20; page++) {
        const result = await client.listTools(cursor ? { cursor } : {}, { timeout: 18000 });
        tool = result.tools.find(t => t.name === name);
        if (tool || !result.nextCursor || result.nextCursor === cursor) break;
        cursor = result.nextCursor;
      }
      if (!tool) throw new AppError('AMBIGUOUS_TOOL_UNAVAILABLE');
      const properties = tool.inputSchema.properties as Record<string, { type?: string }> | undefined;
      if (name !== 'list_channels' && !properties?.channel_id) throw new AppError('AMBIGUOUS_TOOL_UNAVAILABLE');
      const input = { ...args }; if (name === 'get_channel_messages' && properties?.limit) input.limit = properties.limit.type === 'string' ? '50' : 50;
      return await fn(async () => {
        deadline.throwIfAborted();
        const result = await client.callTool({ name, arguments: input }, undefined, { timeout: 18000 });
        if (result.isError) throw new AppError('AMBIGUOUS_TOOL_FAILED');
        if (result.structuredContent) return result.structuredContent;
        const text = (result.content as Array<{ type: string; text?: string }>).find(c => c.type === 'text')?.text;
        try { return JSON.parse(text || ''); } catch { throw new AppError('AMBIGUOUS_INVALID_RESPONSE'); }
      });
    } catch (e) { if (e instanceof AppError) throw e; throw new AppError('AMBIGUOUS_UNAVAILABLE'); }
    finally { await client.close().catch(() => {}); }
  }
  async channels(signal?: AbortSignal) {
    const data = page(channel).safeParse(await this.operation('list_channels', {}, run => run(), signal));
    if (!data.success) throw new AppError('AMBIGUOUS_INVALID_RESPONSE');
    return { channels: data.data.data.filter(c => !c.archived_at).slice(0, 500).map(c => ({ id: c.id, name: c.name.slice(0, 200), type: c.type })), truncated: data.data.has_more || data.data.data.length > 500 };
  }
  async messages(input: unknown, signal?: AbortSignal) {
    const parsed = z.object({ channelId: z.uuid(), cursor: z.string().max(2000).optional() }).strict().safeParse(input);
    if (!parsed.success) throw new AppError('INVALID_REQUEST', 400);
    const args = { channel_id: parsed.data.channelId, ...(parsed.data.cursor ? { cursor: parsed.data.cursor } : {}) };
    const data = page(message).safeParse(await this.operation('get_channel_messages', args, run => run(), signal));
    if (!data.success || data.data.data.some(m => m.channel_id !== parsed.data.channelId)) throw new AppError('AMBIGUOUS_INVALID_RESPONSE');
    return { messages: data.data.data.filter(m => !m.deleted_at).slice(0, 50).map(m => ({ id: m.id, channelId: m.channel_id, threadId: m.thread_id, content: m.content.slice(0, 6000), author: (m.author?.display_name || 'Unknown author').slice(0, 200), createdAt: m.created_at })), hasMore: data.data.has_more, nextCursor: data.data.next_cursor, capturedAt: Date.now() };
  }
  async send(input: unknown, signal?: AbortSignal) {
    const parsed = ambiguousSendSchema.safeParse(input); if (!parsed.success) throw new AppError('INVALID_REQUEST', 400);
    const data = parsed.data; const fingerprint = createHash('sha256').update(JSON.stringify({ channelId: data.channelId, threadId: data.threadId, content: data.content })).digest('hex');
    const next = this.queue.then(async () => {
      let receipts: Record<string, z.infer<typeof receipt>> = {};
      try { receipts = z.record(z.string(), receipt).parse(JSON.parse(await readFile(this.config.receiptFile, 'utf8'))); }
      catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw new AppError('AMBIGUOUS_RECEIPT_ERROR'); }
      const old = receipts[data.requestId];
      if (old) {
        if (old.fingerprint !== fingerprint) throw new AppError('AMBIGUOUS_REPORT_CHANGED', 409);
        if (old.state === 'sent' && old.messageId) return { messageId: old.messageId, replayed: true };
        throw new AppError('AMBIGUOUS_DELIVERY_UNKNOWN', 409);
      }
      if (Object.keys(receipts).length >= 5000) throw new AppError('AMBIGUOUS_RECEIPT_LIMIT', 409);
      // Resolve MCP capability/auth before persisting an in-flight send. Never retry a write automatically.
      return this.operation('send_message', { channel_id: data.channelId, thread_id: data.threadId, content: data.content }, async run => {
        signal?.throwIfAborted();
        receipts[data.requestId] = { fingerprint, state: 'pending' }; await privateJson(this.config.receiptFile, receipts);
        try {
          const sent = z.object({ id: z.uuid(), channel_id: z.uuid(), thread_id: z.uuid().nullable() }).parse(await run());
          if (sent.channel_id !== data.channelId || sent.thread_id !== data.threadId) throw new Error('WRONG_DESTINATION');
          receipts[data.requestId] = { fingerprint, state: 'sent', messageId: sent.id }; await privateJson(this.config.receiptFile, receipts);
          return { messageId: sent.id, replayed: false };
        } catch { throw new AppError('AMBIGUOUS_DELIVERY_UNKNOWN', 409); }
      }, signal);
    });
    this.queue = next.catch(() => {}); return next;
  }
}
