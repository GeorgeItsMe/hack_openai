import { z } from 'zod';
import type { AppState, Task } from './types';
import { cleanUrl, excluded, redact } from './privacy';
import { dueSchema } from './projects';
export const mcpInputs = {
  tabby_get_session: z.object({}).strict(),
  tabby_list_tasks: z.object({ status: z.enum(['planned', 'doing', 'done']).optional(), projectId: z.string().max(100).optional() }).strict(),
  tabby_list_tabs: z.object({}).strict(),
  tabby_create_task: z.object({ requestId: z.uuid(), title: z.string().trim().min(1).max(180), steps: z.array(z.string().trim().min(1).max(600)).max(8).default([]), due: dueSchema.default(''), projectId: z.string().max(100).optional() }).strict(),
  tabby_complete_task: z.object({ requestId: z.uuid(), taskId: z.string().min(1).max(100) }).strict(),
};
export type McpTool = keyof typeof mcpInputs;
export const mcpRequestSchema = z.object({ id: z.uuid(), tool: z.enum(Object.keys(mcpInputs) as [McpTool, ...McpTool[]]), args: z.record(z.string(), z.unknown()), expiresAt: z.number() }).strict();
export type McpRequest = z.infer<typeof mcpRequestSchema>;
const safeTaskSchema = z.object({ id: z.string().max(100), title: z.string().max(180), steps: z.array(z.string().max(600)).max(8), due: dueSchema, status: z.enum(['planned', 'doing', 'done']), source: z.string().max(1600), projectId: z.string().max(100).optional(), createdAt: z.number(), completedAt: z.number().optional() }).strict();
const stamp = { capturedAt: z.number() };
export const mcpOutputs = {
  tabby_get_session: z.object({ ...stamp, session: z.object({ id: z.string(), goal: z.string().max(1000), taskId: z.string(), projectId: z.string().optional(), phase: z.enum(['running', 'paused', 'break', 'ready', 'finished']), remainingMs: z.number().nonnegative(), durationMs: z.number(), startedAt: z.number(), away: z.boolean() }).strict().nullable() }).strict(),
  tabby_list_tasks: z.object({ ...stamp, tasks: z.array(safeTaskSchema).max(500) }).strict(),
  tabby_list_tabs: z.object({ ...stamp, tabs: z.array(z.object({ id: z.number().int(), windowId: z.number().int(), title: z.string().max(300), url: z.string().max(1600), active: z.boolean(), pinned: z.boolean() }).strict()).max(500), truncated: z.boolean() }).strict(),
  tabby_create_task: z.object({ ...stamp, task: safeTaskSchema, replayed: z.boolean() }).strict(),
  tabby_complete_task: z.object({ ...stamp, task: safeTaskSchema, replayed: z.boolean() }).strict(),
};
export function exportTask(t: Task, state: AppState) {
  return { id: t.id, title: redact(t.title, 180), steps: t.steps.map(s => redact(s, 600)), due: t.due, status: t.status,
    source: t.source && !excluded(t.source, state.settings.excludedSites) ? cleanUrl(t.source) : '',
    ...(t.projectId ? { projectId: t.projectId } : {}), createdAt: t.createdAt, ...(t.completedAt ? { completedAt: t.completedAt } : {}) };
}
