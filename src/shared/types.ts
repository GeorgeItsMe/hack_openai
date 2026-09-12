import { initialGoogleState, type ChatState, type GoogleState, type TaskExternal } from './workspace';
export type Category = 'aligned' | 'distracting' | 'unknown';
export type Phase = 'running' | 'paused' | 'break' | 'ready' | 'finished';
export type Language = 'en';

// Upgrade saved installs without changing user-authored tasks, goals or history.
export function normalizeLanguage(state: AppState): AppState {
  const previousLanguage = state.settings.language;
  state.settings = { ...initialState().settings, ...state.settings, language: 'en' };
  state.projects ??= []; state.notes ??= []; state.pinnedTabs ??= [];
  state.mcpReceipts ??= []; state.sync ??= { code: 'SYNC_OFF' };
  state.google ??= initialGoogleState();
  state.chat ??= { messages: [] };
  if (previousLanguage !== 'en') state.assessment = null;
  return state;
}
export interface Task { id: string; title: string; steps: string[]; source: string; due: string; status: 'planned' | 'doing' | 'done'; createdAt: number; completedAt?: number; external?: TaskExternal; projectId?: string; updatedAt?: number }
export interface Project { id: string; title: string; description: string; archived: boolean; createdAt: number; updatedAt: number }
export interface Note { id: string; projectId: string; title: string; body: string; createdAt: number; updatedAt: number; deletedAt?: number }
export interface PinnedTab { id: string; projectId: string; title: string; url: string; createdAt: number; updatedAt: number; deletedAt?: number }
export interface PageContext { tabId: number; windowId: number; title: string; url: string; text?: string; key: string; enteredAt: number }
export interface Assessment { category: Category; reason: string; nextStep: string; source: 'ai' | 'user'; at: number; key: string }
export interface Totals { aligned: number; distracting: number; unknown: number; break: number; away: number; paused: number }
export interface Session {
  id: string; goal: string; taskId: string; projectId?: string; phase: Phase; revision: number;
  startedAt: number; endedAt?: number; accountedAt: number; remainingMs: number; durationMs: number;
  breakUntil?: number; away: boolean; category: Category; totals: Totals;
  reminders: number; returns: number; corrections: Record<string, { reason: string; at: number }>;
  workTabs: Array<{ tabId: number; title: string; url: string; key: string }>;
  lastConfirmedStep: string; events: Array<{ at: number; type: string; detail?: string }>;
  summary?: { facts: string[]; suggestions: string[] }; resumeCard: boolean;
}
export interface Settings { language: Language; mode: 'soft' | 'strict'; readText: boolean; consent: boolean; excludedSites: string[]; breakMinutes: number; pairToken: string; mcpEnabled: boolean; mcpWriteEnabled: boolean; mcpToken: string; syncEnabled: boolean }
export interface Usage { total_tokens?: number; prompt_tokens?: number; completion_tokens?: number; total_cost?: number }
export interface AppState {
  version: 1; settings: Settings; tasks: Task[]; session: Session | null; history: Session[];
  projects: Project[]; notes: Note[]; pinnedTabs: PinnedTab[];
  mcpReceipts: Array<{ requestId: string; fingerprint: string; taskId: string; at: number }>;
  sync: { code: string; at?: number };
  page: PageContext | null; assessment: Assessment | null; pendingAt?: number;
  ai: { connected: boolean; code: string; model?: string; at?: number; available?: string[] };
  usage: Usage; taskDraft?: { title: string; steps: string[]; due: string; source: string; selectedText?: string };
  google: GoogleState; chat: ChatState;
  groupDraft?: Array<{ title: string; color: string; tabIds: number[] }>;
  groupSnapshot?: Record<number, string>;
}
export const initialState = (): AppState => ({ version: 1,
  settings: { language: 'en', mode: 'soft', readText: false, consent: false, excludedSites: [], breakMinutes: 5, pairToken: '', mcpEnabled: false, mcpWriteEnabled: false, mcpToken: '', syncEnabled: false },
  projects: [], notes: [], pinnedTabs: [], mcpReceipts: [], sync: { code: 'SYNC_OFF' },
  tasks: [], session: null, history: [], page: null, assessment: null,
  ai: { connected: false, code: 'AI_NOT_CONNECTED' }, usage: {}, google: initialGoogleState(), chat: { messages: [] } });
export const emptyTotals = (): Totals => ({ aligned: 0, distracting: 0, unknown: 0, break: 0, away: 0, paused: 0 });
