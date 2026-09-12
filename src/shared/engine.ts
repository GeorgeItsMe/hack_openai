import { emptyTotals, type Session, type Phase } from './types';
export function createSession(goal: string, taskId: string, minutes: number, now = Date.now()): Session {
  if (!goal.trim() || goal.length > 1000 || !Number.isFinite(minutes) || minutes < 1 || minutes > 480) throw new Error('INVALID_SESSION');
  return { id: crypto.randomUUID(), goal: goal.trim(), taskId, phase: 'running', revision: 0, startedAt: now, accountedAt: now,
    durationMs: minutes * 60000, remainingMs: minutes * 60000, away: false, category: 'unknown', totals: emptyTotals(), reminders: 0, returns: 0,
    corrections: {}, workTabs: [], lastConfirmedStep: '', events: [{ at: now, type: 'started' }], resumeCard: false };
}
export function event(s: Session, type: string, detail?: string, at = Date.now()) {
  s.events.push({ at, type, ...(detail ? { detail: detail.slice(0, 500) } : {}) });
  if (s.events.length > 1000) s.events.splice(0, s.events.length - 1000);
}
// Integrate intervals by timestamps; no dependence on timer tick frequency. Pause/away do not consume focus time.
export function settle(s: Session, now = Date.now()): Session {
  if (now <= s.accountedAt || s.phase === 'finished') return s;
  let dt = now - s.accountedAt;
  if (s.phase === 'break') {
    const end = Math.max(s.accountedAt, Math.min(now, s.breakUntil ?? now));
    s.totals.break += end - s.accountedAt; dt = now - end;
    if (now >= (s.breakUntil ?? now)) { s.phase = 'ready'; s.resumeCard = true; event(s, 'break-ended', undefined, end); }
    else dt = 0;
  }
  if (s.phase === 'running') {
    if (s.away) s.totals.away += dt;
    else {
      const elapsed = Math.min(dt, s.remainingMs);
      s.totals[s.category] += elapsed; s.remainingMs -= elapsed;
      if (s.remainingMs <= 0) { s.phase = 'finished'; s.endedAt = now - dt + elapsed; event(s, 'finished', undefined, s.endedAt); }
    }
  } else if (s.phase === 'paused' || s.phase === 'ready') { if (s.away) s.totals.away += dt; else s.totals.paused += dt; }
  s.accountedAt = now;
  return s;
}
export function transition(s: Session, phase: Phase, now = Date.now(), breakMinutes = 5) {
  settle(s, now);
  if (s.phase === 'finished') return;
  s.phase = phase; s.category = 'unknown'; s.revision++;
  if (phase === 'break') { s.breakUntil = now + Math.max(1, Math.min(120, breakMinutes)) * 60000; s.resumeCard = false; }
  if (phase === 'finished') s.endedAt = now;
  if (phase === 'running') s.resumeCard = false;
  event(s, phase, undefined, now);
}
export function cacheKey(s: Session, key: string) { return `${s.id}:${s.revision}:${key}`; }
export function requestCurrent(s: Session | null, id: string, revision: number, pageKey: string, currentKey: string | undefined) {
  return !!s && s.id === id && s.revision === revision && s.phase === 'running' && !s.away && currentKey === pageKey;
}
