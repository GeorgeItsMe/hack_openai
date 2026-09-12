import type { AppState } from '../shared/types';
import { AMBIGUOUS_ORIGIN, ambiguousChannelsSchema, ambiguousMessagesSchema, ambiguousSentSchema, ambiguousStatusSchema, focusReport, initialAmbiguous } from '../shared/ambiguous';
import { excluded, redact } from '../shared/privacy';
interface Host { state: () => AppState; serial: <T>(fn: () => T | Promise<T>) => Promise<T>; save: () => Promise<void>; api: (path: string, body: unknown) => Promise<any> }
export function ambiguousCommands(host: Host) {
  let epoch = 0; let loading = false;
  function allowed() {
    const state = host.state();
    if (!state.ambiguous.enabled) throw new Error('AMBIGUOUS_DISABLED');
    if (excluded(AMBIGUOUS_ORIGIN, state.settings.excludedSites)) throw new Error('PAGE_UNAVAILABLE');
  }
  function invalidate() {
    epoch++; const state = host.state(); const a = state.ambiguous;
    if (a.report?.state === 'sending') { const session = [state.session, ...state.history].find(s => s?.id === a.report?.sessionId); if (session) session.ambiguousReport = { state: 'unknown' }; }
    if (state.taskDraft?.ambiguous) state.taskDraft = undefined;
    a.channels = []; a.channelsTruncated = false; a.messages = []; a.channelId = ''; a.capturedAt = undefined; a.hasMore = false; a.nextCursor = undefined; a.report = undefined;
  }
  async function handle(message: any) {
    if (message.type === 'AMBIGUOUS_DISCONNECT') {
      invalidate(); await host.serial(async () => { host.state().ambiguous = initialAmbiguous(); await host.save(); });
      await host.api('ambiguous/disconnect', {}); return {};
    }
    if (message.type === 'AMBIGUOUS_STATUS') {
      const version = epoch; const data = ambiguousStatusSchema.parse(await host.api('ambiguous/status', {}));
      return host.serial(async () => { if (version !== epoch) throw new Error('STALE_RESPONSE'); host.state().ambiguous.status = data; await host.save(); return data; });
    }
    if (message.type === 'AMBIGUOUS_CONNECT') {
      if (excluded(AMBIGUOUS_ORIGIN, host.state().settings.excludedSites)) throw new Error('PAGE_UNAVAILABLE');
      const version = ++epoch;
      const data = await host.api('ambiguous/connect', {});
      if (version !== epoch) throw new Error('STALE_RESPONSE');
      if (data.authorizationUrl) {
        const url = new URL(data.authorizationUrl);
        if (url.origin !== AMBIGUOUS_ORIGIN || url.pathname !== '/oauth/authorize') throw new Error('AMBIGUOUS_AUTH_FAILED');
        await chrome.tabs.create({ url: url.href });
      }
      return host.serial(async () => { if (version !== epoch) throw new Error('STALE_RESPONSE'); const a = host.state().ambiguous; a.enabled = true; a.error = undefined; a.status = ambiguousStatusSchema.parse({ configured: data.configured, pending: data.pending, transport: data.transport, ...(data.error ? { error: data.error } : {}) }); await host.save(); return {}; });
    }
    allowed();
    if (message.type === 'AMBIGUOUS_CHANNELS' || message.type === 'AMBIGUOUS_MESSAGES') {
      if (loading) throw new Error('AMBIGUOUS_LOADING'); loading = true; const version = epoch;
      try {
        const state = host.state();
        if (message.type === 'AMBIGUOUS_MESSAGES' && !state.ambiguous.channels.some(c => c.id === message.channelId)) throw new Error('AMBIGUOUS_CHANNEL_REQUIRED');
        const response = await host.api(message.type === 'AMBIGUOUS_CHANNELS' ? 'ambiguous/channels' : 'ambiguous/messages', message.type === 'AMBIGUOUS_CHANNELS' ? {} : { channelId: message.channelId, ...(message.cursor ? { cursor: message.cursor } : {}) });
        return await host.serial(async () => {
          if (version !== epoch) throw new Error('STALE_RESPONSE'); allowed(); const a = host.state().ambiguous;
          if (message.type === 'AMBIGUOUS_CHANNELS') { const data = ambiguousChannelsSchema.parse(response); a.channels = data.channels; a.channelsTruncated = data.truncated; }
          else { const data = ambiguousMessagesSchema.parse(response); a.channelId = message.channelId; a.messages = data.messages; a.capturedAt = data.capturedAt; a.hasMore = data.hasMore; a.nextCursor = data.nextCursor; }
          a.error = undefined; await host.save(); return {};
        });
      } catch (e) { await host.serial(async () => { if (version === epoch) { host.state().ambiguous.error = (e as Error).message; await host.save(); } }); throw e; }
      finally { loading = false; }
    }
    if (message.type === 'AMBIGUOUS_SEND_REPORT') {
      const prepared = await host.serial(async () => {
        allowed(); const state = host.state(); const report = state.ambiguous.report;
        if (!report || report.id !== message.reportId || message.confirm !== true) throw new Error('CONFIRM_REQUIRED');
        if (report.state === 'sent') return { sent: true as const };
        if (report.state === 'sending') throw new Error('AMBIGUOUS_SENDING');
        if (report.state === 'unknown') throw new Error('AMBIGUOUS_DELIVERY_UNKNOWN');
        if (typeof message.content !== 'string' || !message.content.trim() || message.content.length > 6000) throw new Error('INVALID_REQUEST');
        if (Date.now() - report.createdAt > 15 * 60000) throw new Error('AMBIGUOUS_REPORT_EXPIRED');
        report.content = message.content.trim(); report.state = 'sending'; await host.save();
        return { sent: false as const, version: epoch, input: { requestId: report.id, channelId: report.source.channelId, threadId: report.source.threadId, content: report.content } };
      });
      if (prepared.sent) return {};
      try {
        const sent = ambiguousSentSchema.parse(await host.api('ambiguous/send', prepared.input));
        return await host.serial(async () => {
          if (prepared.version !== epoch) return {};
          const state = host.state(); const report = state.ambiguous.report;
          if (report?.id === prepared.input.requestId) { report.state = 'sent'; report.messageId = sent.messageId; const session = [state.session, ...state.history].find(s => s?.id === report.sessionId); if (session) session.ambiguousReport = { state: 'sent', messageId: sent.messageId }; }
          await host.save(); return sent;
        });
      } catch (e) {
        await host.serial(async () => {
          if (prepared.version !== epoch) return; const state = host.state(); const report = state.ambiguous.report;
          if (report?.id === prepared.input.requestId) { report.state = 'unknown'; state.ambiguous.error = 'AMBIGUOUS_DELIVERY_UNKNOWN'; const session = [state.session, ...state.history].find(s => s?.id === report.sessionId); if (session) session.ambiguousReport = { state: 'unknown' }; await host.save(); }
        }); throw e;
      }
    }
    return host.serial(async () => {
      allowed(); const state = host.state(); const a = state.ambiguous;
      if (message.type === 'AMBIGUOUS_DRAFT') {
        const source = a.messages.find(m => m.id === message.messageId); const channel = a.channels.find(c => c.id === source?.channelId);
        if (!source || !channel || !a.capturedAt || Date.now() - a.capturedAt > 5 * 60000) throw new Error('AMBIGUOUS_MESSAGES_STALE');
        if (state.tasks.some(t => t.ambiguous?.messageId === source.id && t.ambiguous.channelId === source.channelId)) throw new Error('AMBIGUOUS_ALREADY_IMPORTED');
        const title = redact(source.content.split('\n').find(line => line.trim()) || '', 180); if (!title) throw new Error('INVALID_TASK');
        state.taskDraft = { title, steps: source.content.split('\n').slice(1).filter(line => line.trim()).slice(0, 8).map(line => redact(line, 600)), selectedText: redact(source.content, 4000), source: AMBIGUOUS_ORIGIN + '/', due: '', ambiguous: { channelId: source.channelId, channelName: channel.name, messageId: source.id, threadId: source.threadId || source.id } };
      } else if (message.type === 'AMBIGUOUS_PREPARE_REPORT') {
        const session = [state.session, ...state.history].find(s => s?.id === message.sessionId);
        if (!session || session.phase !== 'finished' || !session.ambiguous) throw new Error('AMBIGUOUS_SESSION_REQUIRED');
        if (session.ambiguousReport) throw new Error(session.ambiguousReport.state === 'sent' ? 'AMBIGUOUS_ALREADY_SENT' : 'AMBIGUOUS_DELIVERY_UNKNOWN');
        if (a.report?.state === 'sending') throw new Error('AMBIGUOUS_SENDING');
        a.report = { id: session.id, sessionId: session.id, source: { ...session.ambiguous }, content: focusReport(state, session), createdAt: Date.now(), state: 'draft' };
      } else if (message.type === 'AMBIGUOUS_CANCEL_REPORT') {
        if (a.report?.state === 'sending') throw new Error('AMBIGUOUS_SENDING'); a.report = undefined;
      } else throw new Error('UNKNOWN_COMMAND');
      await host.save(); return {};
    });
  }
  return { handle, invalidate };
}
