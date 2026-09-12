import { z } from 'zod';
import type { AppState, Task, Project, Note, PinnedTab } from './types';
import { dueSchema } from './projects';
import { cleanUrl } from './privacy';
const metadata = { id: z.string().min(1).max(100), createdAt: z.number().nonnegative(), updatedAt: z.number().nonnegative() };
const project = z.object({ ...metadata, title: z.string().max(100), description: z.string().max(2000), archived: z.boolean() }).strict();
const task = z.object({ ...metadata, title: z.string().max(180), steps: z.array(z.string().max(600)).max(8), due: dueSchema, status: z.enum(['planned', 'doing', 'done']), source: z.string().max(1600), projectId: z.string().max(100).optional(), completedAt: z.number().optional() }).strict();
const note = z.object({ ...metadata, projectId: z.string().max(100), title: z.string().max(180), body: z.string().max(4000), deletedAt: z.number().optional() }).strict();
const pin = z.object({ ...metadata, projectId: z.string().max(100), title: z.string().max(300), url: z.string().max(1600), deletedAt: z.number().optional() }).strict();
const schemas = { project, task, note, pin };
type Kind = keyof typeof schemas;
type RecordValue = Project | Task | Note | PinnedTab;
export const SYNC_PREFIX = 'tabby:v1:';
// Canonical tie-breaking converges even when two devices edit within one millisecond.
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => JSON.stringify(k) + ':' + canonical(v)).join(',') + '}';
  return JSON.stringify(value);
}
function lists(state: AppState): Record<Kind, RecordValue[]> { return { project: state.projects, task: state.tasks, note: state.notes, pin: state.pinnedTabs }; }
export function syncRecords(state: AppState): Record<string, unknown> {
  const records: Record<string, unknown> = {};
  for (const [kind, items] of Object.entries(lists(state)) as [Kind, RecordValue[]][]) for (const item of items) {
    // Pick only declared fields. Credentials, live tabs, sessions and external account IDs never sync.
    const value = Object.fromEntries(Object.keys(schemas[kind].shape).map(key => [key, (item as any)[key]]).filter(([, v]) => v !== undefined));
    value.updatedAt ??= item.createdAt;
    if (kind === 'task') value.source = cleanUrl(String(value.source || ''));
    if (kind === 'pin') value.url = cleanUrl(String(value.url || ''));
    const parsed = schemas[kind].safeParse(value); if (!parsed.success) throw new Error('SYNC_INVALID_LOCAL_DATA');
    records[`${SYNC_PREFIX}${kind}:${item.id}`] = parsed.data;
  }
  return records;
}
export function mergeSync(state: AppState, remote: Record<string, unknown>): boolean {
  const local = syncRecords(state); const arrays = lists(state); let changed = false;
  for (const [key, raw] of Object.entries(remote)) {
    if (!key.startsWith(SYNC_PREFIX)) continue;
    const kind = key.slice(SYNC_PREFIX.length).split(':')[0] as Kind;
    if (!Object.hasOwn(schemas, kind)) continue;
    const parsed = schemas[kind].safeParse(raw);
    if (!parsed.success || key !== `${SYNC_PREFIX}${kind}:${parsed.data.id}` || parsed.data.updatedAt > Date.now() + 300000) throw new Error('SYNC_INVALID_REMOTE_DATA');
    const incoming = parsed.data;
    if ('source' in incoming) incoming.source = cleanUrl(incoming.source);
    if ('url' in incoming) { incoming.url = cleanUrl(incoming.url); if (!incoming.url && !incoming.deletedAt) throw new Error('SYNC_INVALID_REMOTE_DATA'); }
    const previous = local[key] as { updatedAt: number } | undefined;
    if (!previous || incoming.updatedAt > previous.updatedAt || (incoming.updatedAt === previous.updatedAt && canonical(incoming) > canonical(previous))) {
      const index = arrays[kind].findIndex(x => x.id === incoming.id);
      if (index >= 0) arrays[kind][index] = { ...incoming, ...(kind === 'task' && (arrays[kind][index] as Task).external ? { external: (arrays[kind][index] as Task).external } : {}), ...(kind === 'task' && (arrays[kind][index] as Task).ambiguous ? { ambiguous: (arrays[kind][index] as Task).ambiguous } : {}) };
      else arrays[kind].push(incoming);
      changed = true;
    }
  }
  return changed;
}
export function checkSyncQuota(records: Record<string, unknown>) {
  const encoder = new TextEncoder(); let total = 0;
  for (const [key, value] of Object.entries(records)) {
    const size = encoder.encode(key + JSON.stringify(value)).length;
    if (size > 8000) throw new Error('SYNC_ITEM_TOO_LARGE'); total += size;
  }
  if (total > 95000 || Object.keys(records).length > 500) throw new Error('SYNC_QUOTA_EXCEEDED');
}
