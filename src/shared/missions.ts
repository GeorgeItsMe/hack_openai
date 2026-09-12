import type { AppState } from './types';
import type { MissionPlan } from './mission-schema';
import { createSession, event, settle, transition } from './engine';

export interface MissionResource { tabId: number; currentTabId?: number; windowId: number; title: string; url: string; key: string }
export interface MissionDraft { id: string; createdAt: number; goal: string; minutes: number; plan: MissionPlan; resources: MissionResource[]; scannedTabs: number }
export type MissionStep = MissionPlan['steps'][number] & { id: string; taskId: string; completedAt?: number };
export interface Mission extends Omit<MissionDraft, 'plan'> {
  title: string; outcome: string; steps: MissionStep[]; status: 'active' | 'stopped' | 'completed'; startedAt: number; endedAt?: number;
  groupId?: number; grouping: 'none' | 'pending' | 'done' | 'failed' | 'unknown'; coach?: { stepId: string; text: string };
}
export interface MissionActivity { id: string; at: number; title: string; detail?: string; state: 'done' | 'notice' | 'failed' }
export interface MissionState { current: Mission | null; draft: MissionDraft | null; history: Mission[]; activity: MissionActivity[]; pending?: { id: string; kind: 'plan' | 'coach' }; error?: string }
export const initialMissions = (): MissionState => ({ current: null, draft: null, history: [], activity: [] });
export function missionLog(state: AppState, title: string, detail?: string, status: MissionActivity['state'] = 'done', now = Date.now()) {
  state.missions.activity = [...state.missions.activity, { id: crypto.randomUUID(), at: now, title, ...(detail ? { detail: detail.slice(0, 600) } : {}), state: status }].slice(-60);
}
export function currentMissionStep(mission: Mission) { return mission.steps.find(step => !step.completedAt); }
export function missionFocusGoal(mission: Mission, step: MissionStep) { return `${mission.goal.slice(0, 750)}\nCurrent step: ${step.title}`.slice(0, 1000); }
export function startMissionSession(state: AppState, mission: Mission, minutes: number, now = Date.now()) {
  const step = currentMissionStep(mission); if (!step) throw new Error('MISSION_FINISHED');
  if (state.session && state.session.phase !== 'finished') throw new Error('SESSION_ALREADY_RUNNING');
  if (state.session) state.history = [state.session, ...state.history.filter(s => s.id !== state.session!.id)].slice(0, 100);
  state.session = createSession(missionFocusGoal(mission, step), step.taskId, minutes, now);
  state.session.missionId = mission.id;
  const task = state.tasks.find(t => t.id === step.taskId);
  if (task && task.status !== 'done') { task.status = 'doing'; task.updatedAt = Math.max(now, (task.updatedAt || 0) + 1); }
  state.page = null; state.assessment = null; state.pendingAt = undefined;
}
export function acceptMission(state: AppState, draft: MissionDraft, groupTabs: boolean, now = Date.now()): Mission {
  if (state.missions.current?.id === draft.id) return state.missions.current;
  if (state.missions.current?.status === 'active') throw new Error('MISSION_ALREADY_RUNNING');
  if (state.session && state.session.phase !== 'finished') throw new Error('SESSION_ALREADY_RUNNING');
  if (state.tasks.length + draft.plan.steps.length > 500) throw new Error('TASK_LIMIT');
  if (now - draft.createdAt > 15 * 60000) throw new Error('MISSION_PLAN_EXPIRED');
  const { plan, ...snapshot } = draft;
  const mission: Mission = {
    ...snapshot, title: plan.title, outcome: plan.outcome, status: 'active', startedAt: now,
    grouping: groupTabs && draft.resources.length ? 'pending' : 'none',
    steps: draft.plan.steps.map(step => ({ ...step, id: crypto.randomUUID(), taskId: crypto.randomUUID() })),
  };
  if (state.missions.current) state.missions.history = [state.missions.current, ...state.missions.history].slice(0, 10);
  state.missions.current = mission; state.missions.draft = null;
  const tasks = mission.steps.map(step => ({ id: step.taskId, title: step.title, steps: [step.instruction, `Done when: ${step.doneWhen}`], source: mission.resources.find(r => r.tabId === step.tabIds[0])?.url || '', due: '', status: 'planned' as const, createdAt: now, updatedAt: now }));
  state.tasks.unshift(...tasks);
  startMissionSession(state, mission, draft.minutes, now);
  missionLog(state, `Created ${tasks.length} linked tasks`, 'Plan approved by you.', 'done', now);
  missionLog(state, `Started a ${draft.minutes}-minute focus session`, mission.steps[0].title, 'done', now);
  return mission;
}
// Task confirmations can come from Mission, Tasks, chat or an authorized MCP tool.
// Browsing time and classifier output never mark a mission step complete.
export function syncMissionProgress(state: AppState, now = Date.now()): boolean {
  const mission = state.missions.current; if (!mission || mission.status === 'completed') return false;
  if (state.session?.missionId === mission.id) settle(state.session, now);
  let changed = false;
  for (const step of mission.steps) {
    const task = state.tasks.find(t => t.id === step.taskId);
    if (task?.status === 'done' && !step.completedAt) {
      step.completedAt = task.completedAt || now; changed = true;
      missionLog(state, 'Step confirmed complete', step.title, 'done', now);
      if (state.session?.missionId === mission.id) { state.session.lastConfirmedStep = step.title; event(state.session, 'confirmed-step', step.title, now); }
    } else if (task && task.status !== 'done' && step.completedAt) {
      delete step.completedAt; changed = true; missionLog(state, 'Step reopened', step.title, 'notice', now);
    }
  }
  const step = currentMissionStep(mission); const session = state.session;
  if (!step) {
    mission.status = 'completed'; mission.endedAt = now; delete mission.coach;
    if (session?.missionId === mission.id && session.phase !== 'finished') transition(session, 'finished', now);
    if (session?.missionId === mission.id) { state.assessment = null; state.pendingAt = undefined; }
    missionLog(state, 'Mission complete', 'Every step was confirmed complete. Time on a page was not used as evidence.', 'done', now);
    return true;
  }
  if (mission.coach?.stepId !== step.id) delete mission.coach;
  if (session?.missionId === mission.id && session.taskId !== step.taskId && session.phase !== 'finished') {
    session.taskId = step.taskId; session.goal = missionFocusGoal(mission, step); session.revision++; session.category = 'unknown'; session.corrections = {}; session.workTabs = [];
    const task = state.tasks.find(t => t.id === step.taskId); if (task) { task.status = 'doing'; task.updatedAt = Math.max(now, (task.updatedAt || 0) + 1); }
    state.assessment = null; state.page = null; state.pendingAt = undefined;
    missionLog(state, 'Moved focus to the next step', step.title, 'done', now); changed = true;
  }
  return changed;
}
