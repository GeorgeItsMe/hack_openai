import type { AppState, Session } from './types';
import { settle } from './engine';
export function analytics(state: AppState, days: number, projectId = '', now = Date.now()) {
  const since = now - days * 86400000;
  const sessions = [...new Map([...state.history, ...(state.session ? [state.session] : [])].map(s => [s.id, s])).values()]
    .map(s => settle(structuredClone(s), now)).filter(s => s.startedAt >= since && (!projectId || s.projectId === projectId));
  const totals = sessions.reduce((a, s) => ({ observed: a.observed + s.totals.aligned + s.totals.distracting + s.totals.unknown, aligned: a.aligned + s.totals.aligned, classified: a.classified + s.totals.aligned + s.totals.distracting, reminders: a.reminders + s.reminders, returns: a.returns + s.returns }), { observed: 0, aligned: 0, classified: 0, reminders: 0, returns: 0 });
  const completed = state.tasks.filter(t => t.status === 'done' && t.completedAt && t.completedAt >= since && (!projectId || t.projectId === projectId)).length;
  const daily = new Map<string, { date: string; observed: number; aligned: number; sessions: number }>();
  for (const s of sessions) {
    const date = new Date(s.startedAt).toLocaleDateString('en-CA'); const row = daily.get(date) || { date, observed: 0, aligned: 0, sessions: 0 };
    row.observed += s.totals.aligned + s.totals.distracting + s.totals.unknown; row.aligned += s.totals.aligned; row.sessions++; daily.set(date, row);
  }
  return { ...totals, completed, sessions: sessions.length, coverage: totals.observed ? totals.classified / totals.observed : null, alignment: totals.classified ? totals.aligned / totals.classified : null,
    daily: [...daily.values()].sort((a, b) => a.date.localeCompare(b.date)), longest: Math.max(0, ...sessions.map((s: Session) => s.totals.aligned + s.totals.distracting + s.totals.unknown)) };
}
