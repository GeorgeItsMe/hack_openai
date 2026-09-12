import type { AppState, Task, Usage } from '../shared/types';
import { calendarSnapshotSchema, chatInputSchema, chatSchema, googleLink, googleServiceSchema, googleStatusSchema, initialGoogleState, mailSnapshotSchema } from '../shared/workspace';
import { applyProposal } from '../shared/workspace-actions';
import { cleanUrl, excluded, redact } from '../shared/privacy';
import type { AIRequest } from '../shared/schemas';

interface Host {
  state: () => AppState; serial: <T>(fn: () => Promise<T> | T) => Promise<T>; save: () => Promise<void>;
  api: (path: string, body: unknown, signal?: AbortSignal) => Promise<any>;
  addUsage: (usage: Usage) => void; changed: () => Promise<void>;
}
export function workspaceCommands(host: Host) {
  let chatController: AbortController | undefined; let epoch = 0; let googleEpoch = 0;
  const syncing = new Set<string>();
  const validSource = (url: string) => !url || !excluded(url, host.state().settings.excludedSites);
  const validService = (service: 'calendar' | 'gmail') => validSource(service === 'calendar' ? 'https://calendar.google.com' : 'https://mail.google.com');
  function cancelChat() { epoch++; chatController?.abort(); chatController = undefined; delete host.state().chat.pendingId; }
  function invalidate() { cancelChat(); googleEpoch++; }
  function resetPending() {
    const state = host.state();
    if (state.chat.pendingId) {
      const message = state.chat.messages.find(m => m.id === state.chat.pendingId); if (message) message.error = 'REQUEST_CANCELLED';
      delete state.chat.pendingId;
    }
  }
  async function status() {
    const version = googleEpoch;
    const status = googleStatusSchema.parse(await host.api('google/status', {}));
    return host.serial(async () => {
      if (version !== googleEpoch) throw new Error('STALE_RESPONSE');
      const state = host.state(); state.google.status = status;
      if (!status.calendar) { state.google.events = []; delete state.google.calendarSyncedAt; }
      if (!status.gmail) { state.google.messages = []; delete state.google.gmailSyncedAt; }
      await host.save(); return status;
    });
  }
  async function sync(service: 'calendar' | 'gmail') {
    if (syncing.has(service)) throw new Error('SYNC_IN_PROGRESS');
    syncing.add(service); const version = googleEpoch;
    try {
      if (excluded(service === 'calendar' ? 'https://calendar.google.com' : 'https://mail.google.com', host.state().settings.excludedSites)) throw new Error('PAGE_UNAVAILABLE');
      const response = await host.api(`google/${service}`, {});
      return await host.serial(async () => {
        if (version !== googleEpoch) throw new Error('STALE_RESPONSE');
        const g = host.state().google;
        if (service === 'calendar') { const data = calendarSnapshotSchema.parse(response); g.events = data.events; g.calendarSyncedAt = data.syncedAt; g.calendarTruncated = data.truncated; }
        else { const data = mailSnapshotSchema.parse(response); g.messages = data.messages; g.gmailSyncedAt = data.syncedAt; }
        g.status[service] = true; delete g.errors[service]; await host.save(); return {};
      });
    } catch (e) {
      await host.serial(async () => {
        if (version !== googleEpoch) return;
        const g = host.state().google; g.errors[service] = (e as Error).message;
        if ((e as Error).message === 'GOOGLE_RECONNECT') {
          g.status[service] = false;
          if (service === 'calendar') { g.events = []; delete g.calendarSyncedAt; }
          else { g.messages = []; delete g.gmailSyncedAt; }
        }
        await host.save();
      }); throw e;
    } finally { syncing.delete(service); }
  }
  async function chat(input: unknown) {
    const parsed = chatInputSchema.parse(input);
    const prepared = await host.serial(async () => {
      const state = host.state();
      if (!state.settings.consent) throw new Error('CONSENT_REQUIRED');
      if (state.chat.pendingId) throw new Error('CHAT_IN_PROGRESS');
      if (parsed.includeCalendar && !validService('calendar')) throw new Error('PAGE_UNAVAILABLE');
      if (parsed.includeCalendar && (!state.google.calendarSyncedAt || Date.now() - state.google.calendarSyncedAt > 15 * 60000 || state.google.errors.calendar)) throw new Error('CALENDAR_STALE');
      const id = crypto.randomUUID(); chatController = new AbortController();
      state.chat.messages = [...state.chat.messages, { id, role: 'user' as const, content: redact(parsed.text, 3000), at: Date.now() }].slice(-60);
      state.chat.pendingId = id;
      const context: AIRequest['context'] = {
        language: 'en', goal: redact(state.session?.goal || '', 1000), task: '',
        chat: {
          messages: state.chat.messages.filter(m => !m.error).slice(-16).map(m => ({ role: m.role, content: (m.content + (m.proposals?.length ? '\nProposal status: ' + m.proposals.map(p => `${p.action.type}: ${p.state}`).join(', ') : '')).slice(0, 6000) })),
          tasks: state.tasks.filter(t => validSource(t.source) && (!t.external || validService(t.external.service))).slice(0, 100).map(t => ({ id: t.id, title: redact(t.title, 180), status: t.status, due: t.due })),
          events: parsed.includeCalendar ? state.google.events.filter(e => validSource(e.url || 'https://calendar.google.com')).slice(0, 50).map(e => ({ ...e, url: '' })) : [],
          ...(parsed.includeCalendar ? { calendarSyncedAt: state.google.calendarSyncedAt } : {}),
          now: new Date().toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      };
      const taskSnapshots = Object.fromEntries(state.tasks.map(t => [t.id, JSON.stringify(t)]));
      await host.save(); return { context, id, epoch, signal: chatController.signal, taskSnapshots };
    });
    try {
      const data = await host.api('ai', { kind: 'chat', context: prepared.context }, prepared.signal);
      return await host.serial(async () => {
        host.addUsage(data.usage);
        const state = host.state();
        if (epoch !== prepared.epoch || !state.settings.consent || state.chat.pendingId !== prepared.id) { await host.save(); throw new Error('STALE_RESPONSE'); }
        const result = chatSchema.parse(data.result);
        for (const action of result.actions) if ('taskId' in action && action.taskId && !prepared.context.chat!.tasks.some(t => t.id === action.taskId)) throw new Error('INVALID_AI_TASK');
        state.chat.messages.push({ id: crypto.randomUUID(), role: 'assistant', content: result.reply, at: Date.now(), proposals: result.actions.map(action => ({ id: crypto.randomUUID(), action, state: 'pending', createdAt: Date.now(), ...('taskId' in action && action.taskId ? { taskSnapshot: prepared.taskSnapshots[action.taskId] } : {}) })) });
        delete state.chat.pendingId; state.ai = { ...state.ai, connected: true, code: 'READY', model: data.model, at: Date.now() }; await host.save(); return {};
      });
    } catch (e) {
      await host.serial(async () => {
        const state = host.state();
        if (epoch !== prepared.epoch) return;
        if ((e as { usage?: Usage }).usage) host.addUsage((e as { usage: Usage }).usage);
        const message = state.chat.messages.find(m => m.id === prepared.id); if (message) message.error = (e as Error).message;
        delete state.chat.pendingId; await host.save();
      }); throw e;
    }
  }
  async function handle(message: any): Promise<unknown> {
    if (message.type === 'CHAT_SEND') return chat({ text: message.text, includeCalendar: !!message.includeCalendar });
    if (message.type === 'GOOGLE_STATUS') return status();
    if (message.type === 'GOOGLE_SYNC') return sync(googleServiceSchema.parse(message.service));
    if (message.type === 'GOOGLE_CONNECT') {
      const service = googleServiceSchema.parse(message.service);
      const data = await host.api('google/connect', { service });
      const url = new URL(data.url); if (url.origin !== 'https://accounts.google.com' || url.pathname !== '/o/oauth2/v2/auth') throw new Error('GOOGLE_AUTH_FAILED');
      await chrome.tabs.create({ url: url.href }); return status();
    }
    if (message.type === 'GOOGLE_CANCEL') { await host.api('google/cancel', {}); return status(); }
    if (message.type === 'GOOGLE_DISCONNECT') {
      // Clear local imported views first, even if the server is currently offline.
      await host.serial(async () => { invalidate(); host.state().google = initialGoogleState(); host.state().chat.messages = []; await host.save(); });
      const result = await host.api('google/disconnect', {}); await status(); return result;
    }
    return host.serial(async () => {
      const state = host.state();
      switch (message.type) {
        case 'CHAT_CANCEL': {
          const pending = state.chat.messages.find(m => m.id === state.chat.pendingId); if (pending) pending.error = 'REQUEST_CANCELLED'; cancelChat(); break;
        }
        case 'CHAT_CLEAR': cancelChat(); state.chat.messages = []; break;
        case 'CHAT_APPLY':
        case 'CHAT_DISMISS': {
          const proposal = state.chat.messages.flatMap(m => m.proposals || []).find(p => p.id === message.proposalId);
          if (!proposal) throw new Error('PROPOSAL_EXPIRED');
          if (message.type === 'CHAT_DISMISS') { if (proposal.state === 'pending') proposal.state = 'dismissed'; }
          else if (applyProposal(state, proposal)) await host.changed();
          break;
        }
        case 'GOOGLE_IMPORT': {
          const service = googleServiceSchema.parse(message.service);
          if (!state.google.status[service]) throw new Error('GOOGLE_RECONNECT');
          if (!validService(service)) throw new Error('PAGE_UNAVAILABLE');
          const items = service === 'calendar' ? state.google.events : state.google.messages;
          const item = items.find(i => i.id === message.id); if (!item || !validSource(item.url)) throw new Error('PAGE_UNAVAILABLE');
          const prior = state.tasks.find(t => t.external?.service === service && t.external.id === item.id);
          if (prior) return { taskId: prior.id, existing: true };
          if (state.tasks.length >= 500) throw new Error('TASK_LIMIT');
          const task: Task = { id: crypto.randomUUID(), title: item.title.slice(0, 180), steps: [], source: googleLink(item.url, service) || cleanUrl(item.url), due: '', status: 'planned', createdAt: Date.now(), external: { service, id: item.id } };
          task.updatedAt = task.createdAt;
          state.tasks.unshift(task); await host.save(); return { taskId: task.id, existing: false };
        }
        case 'GOOGLE_DRAFT': {
          const item = state.google.messages.find(m => m.id === message.id);
          if (!state.settings.consent) throw new Error('CONSENT_REQUIRED');
          if (!item || !validSource(item.url)) throw new Error('PAGE_UNAVAILABLE');
          // Existing task extraction shows a reviewable draft; email text is sent only after this user action.
          state.taskDraft = { title: item.title.slice(0, 180), steps: [], due: '', source: item.url, selectedText: `${item.title}\n${item.snippet}`.slice(0, 4000), external: { service: 'gmail', id: item.id } }; break;
        }
        default: throw new Error('UNKNOWN_COMMAND');
      }
      await host.save(); return {};
    });
  }
  return { handle, invalidate, resetPending };
}
