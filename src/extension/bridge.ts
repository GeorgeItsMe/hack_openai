import { initialState, normalizeLanguage, type AppState } from '../shared/types';
import { createSession, settle, transition, event } from '../shared/engine';
import { projectCommand, saveTask } from '../shared/projects';
export const isExtension = typeof chrome !== 'undefined' && !!chrome.runtime?.id;
let preview: AppState;
function readPreview() { if (!preview) { try { preview = JSON.parse(localStorage.getItem('tabby-preview') || localStorage.getItem('focustab-preview') || 'null') || initialState(); } catch { preview = initialState(); } normalizeLanguage(preview); } return preview; }
function publish() { localStorage.setItem('tabby-preview', JSON.stringify(preview)); window.dispatchEvent(new Event('focus-update')); }
export async function send(type: string, payload: Record<string, unknown> = {}): Promise<any> {
  if (isExtension) { const r = await chrome.runtime.sendMessage({ type, ...payload }); if (!r?.ok) throw new Error(r?.error || 'CONNECTION_LOST'); return r.data; }
  const state = readPreview(); const s = state.session; if (s) settle(s);
  switch (type) {
    case 'GET': return structuredClone(state);
    case 'START': if (s && s.phase !== 'finished') throw new Error('SESSION_ALREADY_RUNNING'); if (s) state.history.unshift(s); state.session = createSession(String(payload.goal), String(payload.taskId || ''), Number(payload.minutes)); state.session.projectId = state.tasks.find(t => t.id === payload.taskId)?.projectId; break;
    case 'GOAL': if (s) { s.goal = String(payload.goal); s.taskId = String(payload.taskId || ''); s.projectId = state.tasks.find(t => t.id === s.taskId)?.projectId; s.revision++; } break;
    case 'PAUSE': if (s) transition(s, 'paused'); break;
    case 'RESUME': if (s) transition(s, 'running'); break;
    case 'BREAK': if (s) transition(s, 'break', Date.now(), Number(payload.minutes) || state.settings.breakMinutes); break;
    case 'STOP': if (s) transition(s, 'finished'); break;
    case 'SETTINGS': state.settings = { ...state.settings, ...(payload.settings as object), language: 'en' }; break;
    case 'CONFIRM_STEP': if (s) { s.lastConfirmedStep = String(payload.step); event(s, 'confirmed-step', s.lastConfirmedStep); } break;
    case 'SAVE_TASK': saveTask(state, payload.task, Date.now(), payload.expectedUpdatedAt); break;
    case 'SAVE_PROJECT': case 'SAVE_NOTE': case 'DELETE_NOTE': case 'UNPIN_TAB': projectCommand(state, type, payload); break;
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
