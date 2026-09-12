import { initialState, type AppState, type Task } from '../shared/types';
import { createSession, settle, transition, event } from '../shared/engine';
import { cleanUrl } from '../shared/privacy';
export const isExtension = typeof chrome !== 'undefined' && !!chrome.runtime?.id;
let preview: AppState;
function readPreview() { if (!preview) { try { preview = JSON.parse(localStorage.getItem('focustab-preview') || 'null') || initialState(); } catch { preview = initialState(); } } return preview; }
function publish() { localStorage.setItem('focustab-preview', JSON.stringify(preview)); window.dispatchEvent(new Event('focus-update')); }
export async function send(type: string, payload: Record<string, unknown> = {}): Promise<any> {
  if (isExtension) { const r = await chrome.runtime.sendMessage({ type, ...payload }); if (!r?.ok) throw new Error(r?.error || 'CONNECTION_LOST'); return r.data; }
  const state = readPreview(); const s = state.session; if (s) settle(s);
  switch (type) {
    case 'GET': return structuredClone(state);
    case 'START': if (s && s.phase !== 'finished') throw new Error('SESSION_ALREADY_RUNNING'); if (s) state.history.unshift(s); state.session = createSession(String(payload.goal), String(payload.taskId || ''), Number(payload.minutes)); break;
    case 'GOAL': if (s) { s.goal = String(payload.goal); s.taskId = String(payload.taskId || ''); s.revision++; } break;
    case 'PAUSE': if (s) transition(s, 'paused'); break;
    case 'RESUME': if (s) transition(s, 'running'); break;
    case 'BREAK': if (s) transition(s, 'break', Date.now(), Number(payload.minutes) || state.settings.breakMinutes); break;
    case 'STOP': if (s) transition(s, 'finished'); break;
    case 'SETTINGS': state.settings = { ...state.settings, ...(payload.settings as object) }; break;
    case 'CONFIRM_STEP': if (s) { s.lastConfirmedStep = String(payload.step); event(s, 'confirmed-step', s.lastConfirmedStep); } break;
    case 'SAVE_TASK': {
      const t = payload.task as Task; const old = state.tasks.find(x => x.id === t.id);
      const task: Task = { ...t, id: old?.id || crypto.randomUUID(), source: cleanUrl(t.source), createdAt: old?.createdAt || Date.now(), completedAt: t.status === 'done' ? old?.completedAt || Date.now() : undefined };
      state.tasks = [task, ...state.tasks.filter(x => x.id !== task.id)]; state.taskDraft = undefined; break;
    }
    case 'LIST_TABS': return [];
    case 'CLEAR_DRAFT': state.taskDraft = undefined; break;
    case 'CLEAR_DATA': preview = initialState(); break;
    default: throw new Error('EXTENSION_REQUIRED');
  }
  publish(); return structuredClone(preview);
}
export function subscribe(listener: () => void) {
  if (isExtension) { const fn = (changes: { [key: string]: chrome.storage.StorageChange }) => { if (changes.app) listener(); }; chrome.storage.onChanged.addListener(fn); return () => chrome.storage.onChanged.removeListener(fn); }
  window.addEventListener('focus-update', listener); return () => window.removeEventListener('focus-update', listener);
}
export async function grantCurrentSite() {
  if (!isExtension) throw new Error('EXTENSION_REQUIRED');
  const tab = (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
  if (!tab?.url || !/^https?:/.test(tab.url)) throw new Error('PAGE_UNAVAILABLE');
  const allowed = await chrome.permissions.request({ origins: [new URL(tab.url).origin + '/*'] });
  if (!allowed) throw new Error('PERMISSION_DENIED');
  return new URL(tab.url).hostname;
}
