import { z } from 'zod';
import type { AppState, Session } from './types';
import { redact } from './privacy';
export const AMBIGUOUS_ORIGIN = 'https://app.ambiguous.ai';
export const AMBIGUOUS_MCP = AMBIGUOUS_ORIGIN + '/mcp';
export const ambiguousSourceSchema = z.object({ channelId: z.uuid(), channelName: z.string().max(200), messageId: z.uuid(), threadId: z.uuid() }).strict();
export type AmbiguousSource = z.infer<typeof ambiguousSourceSchema>;
export const ambiguousChannelSchema = z.object({ id: z.uuid(), name: z.string().max(200), type: z.enum(['public', 'private', 'dm']) }).strict();
export const ambiguousMessageSchema = z.object({ id: z.uuid(), channelId: z.uuid(), threadId: z.uuid().nullable(), content: z.string().max(6000), author: z.string().max(200), createdAt: z.string().nullable() }).strict();
export const ambiguousStatusSchema = z.object({ configured: z.boolean(), pending: z.boolean(), transport: z.enum(['mcp', 'rest']), error: z.string().max(80).optional() }).strict();
export const ambiguousChannelsSchema = z.object({ channels: z.array(ambiguousChannelSchema).max(500), truncated: z.boolean() }).strict();
export const ambiguousMessagesSchema = z.object({ messages: z.array(ambiguousMessageSchema).max(50), hasMore: z.boolean(), nextCursor: z.string().max(2000).optional(), capturedAt: z.number() }).strict();
export const ambiguousSendSchema = z.object({ requestId: z.uuid(), channelId: z.uuid(), threadId: z.uuid(), content: z.string().trim().min(1).max(6000) }).strict();
export const ambiguousSentSchema = z.object({ messageId: z.uuid(), replayed: z.boolean() }).strict();
export interface AmbiguousReport { id: string; sessionId: string; source: AmbiguousSource; content: string; createdAt: number; state: 'draft' | 'sending' | 'sent' | 'unknown'; messageId?: string }
export interface AmbiguousState {
  enabled: boolean; status: z.infer<typeof ambiguousStatusSchema>; channels: z.infer<typeof ambiguousChannelSchema>[];
  channelId: string; messages: z.infer<typeof ambiguousMessageSchema>[]; capturedAt?: number; hasMore: boolean; nextCursor?: string;
  error?: string; channelsTruncated?: boolean; report?: AmbiguousReport;
}
export const initialAmbiguous = (): AmbiguousState => ({ enabled: false, status: { configured: false, pending: false, transport: 'mcp' }, channels: [], channelId: '', messages: [], hasMore: false });
export function focusReport(state: AppState, session: Session) {
  const minutes = (ms: number) => (ms / 60000).toFixed(1);
  const observed = session.totals.aligned + session.totals.distracting + session.totals.unknown;
  const task = state.tasks.find(t => t.id === session.taskId);
  return [
    '**Tabby focus session completed**', '',
    `Goal: ${redact(session.goal, 1000)}`, `Observed focus time: ${minutes(observed)} min`,
    ...(session.events.some(e => e.type === 'goal-changed') ? ['The goal changed during this session. Timings cover the whole session.'] : []),
    `On track: ${minutes(session.totals.aligned)} min · Possible distraction: ${minutes(session.totals.distracting)} min · Unclassified: ${minutes(session.totals.unknown)} min`,
    `Breaks: ${minutes(session.totals.break)} min · Paused: ${minutes(session.totals.paused)} min · Away: ${minutes(session.totals.away)} min`,
    `Reminders: ${session.reminders} · Returns: ${session.returns}`,
    ...(session.lastConfirmedStep ? [`Confirmed step: ${redact(session.lastConfirmedStep, 600)}`] : []),
    ...(task?.completedAt && task.status === 'done' && task.completedAt >= session.startedAt && task.completedAt <= (session.endedAt ?? 0) ? ['The focus task was marked done during this session.'] : []),
    '', 'Recorded intervals are observations, not a productivity score.',
  ].join('\n');
}
