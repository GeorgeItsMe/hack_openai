import { z } from 'zod';
import { chatContextSchema, chatSchema } from './workspace.js';
import { missionContextSchema, missionPlanSchema } from './mission-schema.js';
const short = z.string().trim().min(1).max(600);
export const assessmentSchema = z.object({ category: z.enum(['aligned', 'distracting', 'unknown']), reason: short, nextStep: short }).strict();
export const taskSchema = z.object({ title: z.string().trim().min(1).max(180), steps: z.array(short).max(8), due: z.union([z.literal(''), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]), dueEvidence: z.string().max(500) }).strict();
export const groupSchema = z.object({ groups: z.array(z.object({ title: z.string().trim().min(1).max(50), color: z.enum(['grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange']), tabIds: z.array(z.number().int().nonnegative()).min(1).max(100) }).strict()).max(20) }).strict();
export const nextSchema = z.object({ nextStep: short }).strict();
export const summarySchema = z.object({ facts: z.array(short).max(8), suggestions: z.array(short).max(4) }).strict();
const tab = z.object({ tabId: z.number().int().nonnegative(), title: z.string().max(300), url: z.string().max(1600) }).strict();
export const contextSchema = z.object({
  language: z.literal('en'), goal: z.string().max(1000).default(''), task: z.string().max(2000).default(''),
  page: z.object({ title: z.string().max(300), url: z.string().max(1600), text: z.string().max(4000).optional(), seconds: z.number().nonnegative().max(1e8) }).strict().optional(),
  session: z.string().max(5000).optional(), corrections: z.array(z.object({ context: z.string().max(100), reason: z.string().max(600) }).strict()).max(40).optional(),
  selection: z.string().max(4000).optional(), tabs: z.array(tab).max(100).optional(), tasks: z.array(z.string().max(180)).max(100).optional(),
  chat: chatContextSchema.optional(),
  mission: missionContextSchema.optional(),
}).strict();
export const requestSchema = z.object({ kind: z.enum(['classify', 'task', 'groups', 'next', 'summary', 'chat', 'mission']), context: contextSchema }).strict().refine(v => v.kind !== 'chat' || !!v.context.chat, { message: 'Chat context is required' }).refine(v => v.kind !== 'mission' || !!v.context.mission, { message: 'Mission context is required' });
export type AIRequest = z.infer<typeof requestSchema>;
export const outputSchemas = { classify: assessmentSchema, task: taskSchema, groups: groupSchema, next: nextSchema, summary: summarySchema, chat: chatSchema, mission: missionPlanSchema };
