import { z } from 'zod';

export const googleServiceSchema = z.enum(['calendar', 'gmail']);
export type GoogleService = z.infer<typeof googleServiceSchema>;
const date = z.union([z.literal(''), z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => {
  const d = new Date(v + 'T00:00:00Z'); return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === v;
})]);
export const calendarEventSchema = z.object({
  id: z.string().min(1).max(1024), title: z.string().max(300), start: z.string().max(80), end: z.string().max(80),
  allDay: z.boolean(), location: z.string().max(300), url: z.string().max(2000),
}).strict();
export const mailSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]{1,256}$/), title: z.string().max(300), from: z.string().max(300),
  snippet: z.string().max(1000), receivedAt: z.number().nonnegative(), url: z.string().max(2000),
}).strict();
export const googleStatusSchema = z.object({
  configured: z.boolean(), calendar: z.boolean(), gmail: z.boolean(),
  pending: googleServiceSchema.nullable(), error: z.string().max(80).optional(),
}).strict();
export const calendarSnapshotSchema = z.object({ events: z.array(calendarEventSchema).max(250), syncedAt: z.number(), truncated: z.boolean() }).strict();
export const mailSnapshotSchema = z.object({ messages: z.array(mailSchema).max(20), syncedAt: z.number() }).strict();
export type CalendarEvent = z.infer<typeof calendarEventSchema>;
export type MailItem = z.infer<typeof mailSchema>;
export interface GoogleState {
  status: z.infer<typeof googleStatusSchema>; events: CalendarEvent[]; messages: MailItem[];
  calendarSyncedAt?: number; gmailSyncedAt?: number; calendarTruncated?: boolean;
  errors: Partial<Record<GoogleService, string>>;
}
export const initialGoogleState = (): GoogleState => ({ status: { configured: false, calendar: false, gmail: false, pending: null }, events: [], messages: [], errors: {} });

export const chatActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('create_task'), title: z.string().trim().min(1).max(180), steps: z.array(z.string().trim().min(1).max(600)).max(8), due: date }).strict(),
  z.object({ type: z.literal('complete_task'), taskId: z.string().min(1).max(100) }).strict(),
  z.object({ type: z.literal('start_focus'), goal: z.string().trim().min(1).max(1000), minutes: z.number().int().min(1).max(480), taskId: z.string().max(100) }).strict(),
]);
export type ChatAction = z.infer<typeof chatActionSchema>;
export const chatSchema = z.object({ reply: z.string().trim().min(1).max(6000), actions: z.array(chatActionSchema).max(6) }).strict();
export const chatInputSchema = z.object({ text: z.string().trim().min(1).max(3000), includeCalendar: z.boolean().default(false) }).strict();
export const chatContextSchema = z.object({
  messages: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(6000) }).strict()).max(16),
  tasks: z.array(z.object({ id: z.string().max(100), title: z.string().max(180), status: z.enum(['planned', 'doing', 'done']), due: date }).strict()).max(100),
  events: z.array(calendarEventSchema).max(50), calendarSyncedAt: z.number().optional(), now: z.string().max(80), timeZone: z.string().max(100),
}).strict();
export interface ChatProposal { id: string; action: ChatAction; state: 'pending' | 'applied' | 'dismissed'; taskSnapshot?: string; createdAt: number }
export interface ChatMessage { id: string; role: 'user' | 'assistant'; content: string; at: number; proposals?: ChatProposal[]; error?: string }
export interface ChatState { messages: ChatMessage[]; pendingId?: string }
export interface TaskExternal { service: GoogleService; id: string }

// Google links are data, never arbitrary redirects or executable URLs.
export function googleLink(raw: string, service: GoogleService): string {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return '';
    if (service === 'gmail' && url.hostname === 'mail.google.com' && /^\/mail\/u\/\d+\/$/.test(url.pathname) && /^#inbox\/[a-zA-Z0-9_-]+$/.test(url.hash)) return url.origin + url.pathname + url.hash;
    if (service === 'calendar' && (url.hostname === 'calendar.google.com' || (url.hostname === 'www.google.com' && url.pathname.startsWith('/calendar/')))) {
      const eid = url.searchParams.get('eid'); url.search = ''; url.hash = ''; if (eid) url.searchParams.set('eid', eid); return url.href;
    }
  } catch { /* Invalid source. */ }
  return '';
}
