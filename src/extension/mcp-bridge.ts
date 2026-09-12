import { mcpRequestSchema, type McpRequest } from '../shared/mcp';
export function createMcpBridge(handle: (request: McpRequest) => Promise<unknown>) {
  let token = ''; let running = false; let abort: AbortController | undefined; let profileId = ''; let revision = 0;
  const endpoint = 'http://127.0.0.1:4319/bridge/';
  async function post(path: string, body: unknown, key: string, signal?: AbortSignal) {
    const response = await fetch(endpoint + path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Tabby-MCP-Token': key }, body: JSON.stringify(body), signal: AbortSignal.any([AbortSignal.timeout(25000), ...(signal ? [signal] : [])]) });
    if (!response.ok) throw new Error('MCP_BRIDGE_UNAVAILABLE');
    return response.json();
  }
  async function wake() {
    if (running || !token) return;
    running = true; const key = token; const generation = revision; abort = new AbortController();
    try {
      if (!profileId) {
        const saved = (await chrome.storage.local.get('mcpProfileId')).mcpProfileId;
        profileId = typeof saved === 'string' ? saved : crypto.randomUUID();
        await chrome.storage.local.set({ mcpProfileId: profileId });
      }
      while (token === key && generation === revision) {
        const data = await post('poll', { profileId }, key, abort.signal);
        if (!data.request) continue;
        const request = mcpRequestSchema.parse(data.request);
        if (generation !== revision) break;
        let reply: { data?: unknown; error?: string };
        try { if (request.expiresAt <= Date.now()) throw new Error('STALE_REQUEST'); reply = { data: await handle(request) }; }
        catch (e) { reply = { error: e instanceof Error && /^[A-Z_]+$/.test(e.message) ? e.message : 'MCP_COMMAND_FAILED' }; }
        await post('reply', { profileId, id: request.id, ...reply }, key, abort.signal);
      }
    } catch { /* Alarm retries; no cached snapshots or provider calls. */ }
    finally { running = false; abort = undefined; if (generation !== revision && token) void wake(); }
  }
  return {
    configure(enabled: boolean, key: string) {
      const next = enabled && key.length >= 32 ? key : '';
      if (next !== token) {
        const previous = token; token = next; revision++; abort?.abort();
        if (previous && profileId) void post('disconnect', { profileId }, previous).catch(() => {});
      }
      if (token) { void chrome.alarms.create('mcp-reconnect', { periodInMinutes: 0.5 }); void wake(); }
      else void chrome.alarms.clear('mcp-reconnect');
    }, wake,
  };
}
