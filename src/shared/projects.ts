import { z } from 'zod';
import type { AppState, Task } from './types';
import { cleanUrl } from './privacy';
const id = z.string().min(1).max(100);
export const dueSchema = z.union([z.literal(''), z.iso.date()]);
export const taskInputSchema = z.object({ id: id.optional(), title: z.string().trim().min(1).max(180), steps: z.array(z.string().trim().max(600)).max(8), source: z.string().max(2000).default(''), due: dueSchema.default(''), status: z.enum(['planned', 'doing', 'done']), projectId: id.or(z.literal('')).optional() });
export const projectInputSchema = z.object({ id: id.optional(), title: z.string().trim().min(1).max(100), description: z.string().max(2000).default(''), archived: z.boolean().default(false) }).strict();
export const noteInputSchema = z.object({ id: id.optional(), projectId: id, title: z.string().trim().min(1).max(180), body: z.string().max(4000) }).strict();
export function requireProject(state: AppState, projectId?: string, allowArchived = false) {
  if (projectId && !state.projects.some(p => p.id === projectId && (allowArchived || !p.archived))) throw new Error('PROJECT_UNAVAILABLE');
}
function checkCurrent(item: { updatedAt?: number; createdAt: number } | undefined, expected: unknown) {
  if (expected === undefined) return; // Existing internal callers already run inside the worker queue.
  if (typeof expected !== 'number' || !Number.isSafeInteger(expected) || expected < 0) throw new Error('INVALID_REQUEST');
  if (!item || (item.updatedAt ?? item.createdAt) !== expected) throw new Error('ITEM_CHANGED');
}
export function saveTask(state: AppState, input: unknown, now = Date.now(), expectedUpdatedAt?: unknown): Task {
  const parsed = taskInputSchema.safeParse(input); if (!parsed.success) throw new Error('INVALID_TASK');
  const t = parsed.data; const old = state.tasks.find(x => x.id === t.id);
  if (t.id && !old) throw new Error('TASK_NOT_FOUND');
  checkCurrent(old, expectedUpdatedAt);
  if (!old && state.tasks.length >= 500) throw new Error('TASK_LIMIT');
  const projectId = t.projectId ?? old?.projectId;
  requireProject(state, projectId, projectId === old?.projectId);
  const task: Task = { ...t, id: old?.id || crypto.randomUUID(), projectId: projectId || undefined,
    source: cleanUrl(t.source), createdAt: old?.createdAt ?? now, updatedAt: Math.max(now, (old?.updatedAt ?? 0) + 1),
    ...(old?.external ? { external: old.external } : {}),
    ...(old?.ambiguous ? { ambiguous: old.ambiguous } : {}),
    ...(t.status === 'done' ? { completedAt: old?.completedAt ?? now } : {}) };
  state.tasks = [task, ...state.tasks.filter(x => x.id !== task.id)]; state.taskDraft = undefined;
  return task;
}
export function projectCommand(state: AppState, type: string, input: Record<string, unknown>, now = Date.now()): boolean {
  if (type === 'SAVE_PROJECT') {
    const parsed = projectInputSchema.safeParse(input.project); if (!parsed.success) throw new Error('INVALID_PROJECT');
    const p = parsed.data; const old = state.projects.find(x => x.id === p.id);
    if (p.id && !old) throw new Error('PROJECT_UNAVAILABLE');
    checkCurrent(old, input.expectedUpdatedAt);
    if (!old && state.projects.length >= 100) throw new Error('PROJECT_LIMIT');
    state.projects = [{ ...p, id: old?.id || crypto.randomUUID(), createdAt: old?.createdAt ?? now, updatedAt: Math.max(now, (old?.updatedAt ?? 0) + 1) }, ...state.projects.filter(x => x.id !== p.id)];
  } else if (type === 'SAVE_NOTE') {
    const parsed = noteInputSchema.safeParse(input.note); if (!parsed.success) throw new Error('INVALID_NOTE');
    const n = parsed.data; requireProject(state, n.projectId); const old = state.notes.find(x => x.id === n.id && !x.deletedAt);
    if (n.id && !old) throw new Error('NOTE_NOT_FOUND');
    checkCurrent(old, input.expectedUpdatedAt);
    if (!old && state.notes.length >= 500) throw new Error('NOTE_LIMIT');
    state.notes = [{ ...n, id: old?.id || crypto.randomUUID(), createdAt: old?.createdAt ?? now, updatedAt: Math.max(now, (old?.updatedAt ?? 0) + 1) }, ...state.notes.filter(x => x.id !== n.id)];
  } else if (type === 'DELETE_NOTE' || type === 'UNPIN_TAB') {
    const item = (type === 'DELETE_NOTE' ? state.notes : state.pinnedTabs).find(x => x.id === input.id);
    if (!item) throw new Error('ITEM_NOT_FOUND');
    checkCurrent(item, input.expectedUpdatedAt);
    item.updatedAt = Math.max(now, item.updatedAt + 1); item.deletedAt = item.updatedAt;
    if ('body' in item) { item.body = ''; item.title = 'Deleted note'; }
    else { item.url = ''; item.title = 'Removed tab'; }
  } else return false;
  return true;
}
