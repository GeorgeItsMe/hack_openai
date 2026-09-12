import { z } from 'zod';

export const missionInputSchema = z.object({ goal: z.string().trim().min(5).max(1000), minutes: z.number().int().min(5).max(180) }).strict();
export const missionContextSchema = z.object({ minutes: z.number().int().min(5).max(180) }).strict();
export const missionPlanSchema = z.object({
  title: z.string().trim().min(1).max(80),
  outcome: z.string().trim().min(1).max(350),
  steps: z.array(z.object({
    title: z.string().trim().min(1).max(180),
    instruction: z.string().trim().min(1).max(600),
    doneWhen: z.string().trim().min(1).max(300),
    minutes: z.number().int().min(1).max(180),
    tabIds: z.array(z.number().int().nonnegative()).max(8),
    searchQuery: z.string().trim().max(180),
  }).strict()).min(1).max(5),
}).strict();
export type MissionPlan = z.infer<typeof missionPlanSchema>;

export function validateMissionPlan(input: unknown, minutes: number, allowedTabIds: number[]): MissionPlan {
  const parsed = missionPlanSchema.safeParse(input);
  if (!parsed.success) throw new Error('INVALID_MISSION_PLAN');
  const plan = parsed.data;
  if (plan.steps.reduce((sum, step) => sum + step.minutes, 0) > minutes) throw new Error('MISSION_TIME_BUDGET');
  const allowed = new Set(allowedTabIds);
  for (const step of plan.steps) {
    if (new Set(step.tabIds).size !== step.tabIds.length || step.tabIds.some(id => !allowed.has(id))) throw new Error('INVALID_AI_TAB');
  }
  return plan;
}
