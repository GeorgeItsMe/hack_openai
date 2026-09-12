import type { AppState, Assessment, Usage } from '../shared/types';
import type { AIRequest } from '../shared/schemas';
import { nextSchema } from '../shared/schemas';
import { missionInputSchema, validateMissionPlan } from '../shared/mission-schema';
import { acceptMission, currentMissionStep, missionLog, startMissionSession, type MissionResource } from '../shared/missions';
import { cleanUrl, contextKey, excluded, redact } from '../shared/privacy';
import { saveTask } from '../shared/projects';
import { settle, transition } from '../shared/engine';

interface Host {
  state(): AppState; serial<T>(fn: () => Promise<T> | T): Promise<T>; save(): Promise<void>;
  api(path: string, payload: unknown, signal?: AbortSignal): Promise<any>; addUsage(usage: Usage): void; changed(): Promise<void>;
}
export function missionCommands(host: Host) {
  let epoch = 0; let controller: AbortController | undefined;
  const allowed = (url: string) => !!cleanUrl(url) && !excluded(url, host.state().settings.excludedSites);
  function invalidate() {
    epoch++; controller?.abort(); controller = undefined;
    const state = host.state();
    if (state.missions.pending) { delete state.missions.pending; missionLog(state, 'AI request cancelled', undefined, 'notice'); }
  }
  function resetPending() {
    const state = host.state();
    if (state.missions.pending) { delete state.missions.pending; state.missions.error = 'REQUEST_CANCELLED'; missionLog(state, 'Interrupted request stopped', 'Your saved mission was kept.', 'notice'); }
    if (state.missions.current?.grouping === 'pending') {
      state.missions.current.grouping = 'unknown';
      missionLog(state, 'Grouping result could not be confirmed', 'No automatic retry was made. Your tasks and focus session were kept.', 'notice');
    }
  }
  async function plan(input: unknown) {
    const parsed = missionInputSchema.safeParse(input); if (!parsed.success) throw new Error('INVALID_MISSION_GOAL');
    const prepared = await host.serial(async () => {
      const state = host.state();
      if (!state.settings.consent) throw new Error('CONSENT_REQUIRED');
      if (state.missions.current?.status === 'active') throw new Error('MISSION_ALREADY_RUNNING');
      if (state.missions.pending) throw new Error('MISSION_BUSY');
      const tabs = await chrome.tabs.query({ currentWindow: true });
      const resources: MissionResource[] = tabs.filter(t => t.id !== undefined && !t.incognito && !t.pinned && allowed(t.url || '')).slice(0, 60).map(t => ({ tabId: t.id!, windowId: t.windowId, title: redact(t.title || 'Untitled', 300), url: cleanUrl(t.url || ''), key: contextKey(t.url || '', t.title || '') }));
      const id = crypto.randomUUID(); controller = new AbortController();
      state.missions.activity = []; state.missions.draft = null; delete state.missions.error;
      state.missions.pending = { id, kind: 'plan' };
      missionLog(state, `Checked ${resources.length} open tab${resources.length === 1 ? '' : 's'}`, 'Read titles and cleaned URLs. Private, pinned and excluded tabs were omitted.');
      await host.save();
      const context: AIRequest['context'] = { language: 'en', goal: redact(parsed.data.goal, 1000), task: '', mission: { minutes: parsed.data.minutes }, tabs: resources.map(({ tabId, title, url }) => ({ tabId, title, url })) };
      return { id, context, resources, minutes: parsed.data.minutes, epoch, signal: controller.signal };
    });
    try {
      const data = await host.api('ai', { kind: 'mission', context: prepared.context }, prepared.signal);
      return await host.serial(async () => {
        const state = host.state(); host.addUsage(data.usage);
        if (epoch !== prepared.epoch || !state.settings.consent || state.missions.pending?.id !== prepared.id) throw new Error('STALE_RESPONSE');
        const result = validateMissionPlan(data.result, prepared.minutes, prepared.resources.map(t => t.tabId));
        const ids = new Set(result.steps.flatMap(step => step.tabIds));
        state.missions.draft = { id: prepared.id, goal: prepared.context.goal, minutes: prepared.minutes, plan: result, resources: prepared.resources.filter(r => ids.has(r.tabId)), scannedTabs: prepared.resources.length, createdAt: Date.now() };
        delete state.missions.pending;
        state.ai = { connected: true, code: 'READY', model: data.model, at: Date.now() };
        missionLog(state, `Prepared ${result.steps.length} steps`, 'Waiting for your approval. No tasks, tabs or timers have been changed.');
        await host.save(); return {};
      });
    } catch (error) {
      await host.serial(async () => {
        const state = host.state(); if (epoch !== prepared.epoch) return;
        delete state.missions.pending; state.missions.error = (error as Error).message;
        missionLog(state, 'Plan could not be prepared', 'No tasks, tabs or timers were changed.', 'failed'); await host.save();
      }); throw error;
    }
  }
  async function coach() {
    const prepared = await host.serial(async () => {
      const state = host.state(); const mission = state.missions.current; const step = mission && currentMissionStep(mission);
      if (!state.settings.consent) throw new Error('CONSENT_REQUIRED');
      if (!mission || mission.status !== 'active' || !step) throw new Error('MISSION_NOT_ACTIVE');
      if (state.missions.pending) throw new Error('MISSION_BUSY');
      const id = crypto.randomUUID(); controller = new AbortController();
      state.missions.pending = { id, kind: 'coach' }; delete state.missions.error;
      const context: AIRequest['context'] = { language: 'en', goal: redact(mission.goal, 1000), task: redact(`The user is stuck on this step: ${step.title}. Plan: ${step.instruction}. Done when: ${step.doneWhen}. Suggest a smaller action they can do in the next two minutes. Do not claim anything is complete.`, 2000), session: JSON.stringify({ confirmedSteps: mission.steps.filter(s => s.completedAt).map(s => s.title) }) };
      await host.save(); return { id, missionId: mission.id, stepId: step.id, context, epoch, signal: controller.signal };
    });
    try {
      const data = await host.api('ai', { kind: 'next', context: prepared.context }, prepared.signal);
      return await host.serial(async () => {
        const state = host.state(); const mission = state.missions.current; host.addUsage(data.usage);
        if (epoch !== prepared.epoch || !state.settings.consent || state.missions.pending?.id !== prepared.id || mission?.id !== prepared.missionId || currentMissionStep(mission)?.id !== prepared.stepId) throw new Error('STALE_RESPONSE');
        const parsed = nextSchema.safeParse(data.result); if (!parsed.success) throw new Error('INVALID_AI_SCHEMA');
        mission.coach = { stepId: prepared.stepId, text: parsed.data.nextStep }; delete state.missions.pending;
        missionLog(state, 'Suggested a smaller next action', parsed.data.nextStep);
        state.ai = { connected: true, code: 'READY', model: data.model, at: Date.now() }; await host.save(); return {};
      });
    } catch (error) {
      await host.serial(async () => {
        if (epoch !== prepared.epoch) return;
        delete host.state().missions.pending; host.state().missions.error = (error as Error).message; await host.save();
      }); throw error;
    }
  }
  async function openResource(resource: MissionResource) {
    if (!allowed(resource.url)) throw new Error('PAGE_UNAVAILABLE');
    const tab = await chrome.tabs.get(resource.currentTabId || resource.tabId).catch(() => undefined);
    let actual: chrome.tabs.Tab | undefined;
    if (tab && !tab.incognito && cleanUrl(tab.url || '') === resource.url) {
      await chrome.windows.update(tab.windowId, { focused: true }); actual = await chrome.tabs.update(tab.id!, { active: true });
    } else actual = await chrome.tabs.create({ url: resource.url });
    if (!actual?.id) throw new Error('PAGE_UNAVAILABLE');
    resource.currentTabId = actual.id;
    missionLog(host.state(), 'Opened a mission resource', resource.title); await host.save();
  }
  async function handle(message: any): Promise<unknown> {
    if (message.type === 'MISSION_PLAN') return plan({ goal: message.goal, minutes: message.minutes });
    if (message.type === 'MISSION_COACH') return coach();
    return host.serial(async () => {
      const state = host.state(); const mission = state.missions.current;
      if (state.session) settle(state.session);
      switch (message.type) {
        case 'MISSION_CANCEL': invalidate(); break;
        case 'MISSION_EDIT': invalidate(); state.missions.draft = null; delete state.missions.error; break;
        case 'MISSION_START': {
          if (mission?.id === message.draftId) return {}; // Durable retry guard.
          const draft = state.missions.draft;
          if (!draft || draft.id !== message.draftId) throw new Error('MISSION_PLAN_EXPIRED');
          if (!state.settings.consent) throw new Error('CONSENT_REQUIRED');
          if (typeof message.groupTabs !== 'boolean') throw new Error('INVALID_REQUEST');
          // Finish preflight before any workspace mutation.
          for (const resource of draft.resources) {
            const tab = await chrome.tabs.get(resource.tabId).catch(() => undefined);
            if (!tab || tab.incognito || tab.pinned || tab.windowId !== resource.windowId || !allowed(tab.url || '') || contextKey(tab.url || '', tab.title || '') !== resource.key) throw new Error('TABS_CHANGED');
          }
          const accepted = acceptMission(state, draft, message.groupTabs);
          await host.changed(); await host.save();
          if (accepted.grouping === 'pending') {
            try {
              const ids = accepted.resources.map(r => r.tabId);
              const groupId = await chrome.tabs.group({ tabIds: ids as [number, ...number[]], createProperties: { windowId: accepted.resources[0].windowId } });
              accepted.groupId = groupId; await host.save();
              await chrome.tabGroups.update(groupId, { title: accepted.title.slice(0, 50), color: 'orange', collapsed: false });
              accepted.grouping = 'done'; missionLog(state, `Grouped ${ids.length} relevant tab${ids.length === 1 ? '' : 's'}`, accepted.title);
            } catch { accepted.grouping = 'failed'; missionLog(state, 'Tab grouping could not be completed', 'Your tasks and focus session are ready. No automatic retry will move tabs again.', 'failed'); }
            await host.save();
          }
          const first = accepted.resources.find(r => r.tabId === accepted.steps[0].tabIds[0]);
          if (first) { try { await openResource(first); } catch { missionLog(state, 'Resource could not be opened', 'Use the resource button to try again.', 'failed'); } }
          await host.changed(); break;
        }
        case 'MISSION_COMPLETE_STEP': {
          if (!mission || mission.status !== 'active') throw new Error('MISSION_NOT_ACTIVE');
          const step = mission.steps.find(s => s.id === message.stepId);
          if (step?.completedAt) return {};
          if (!step || currentMissionStep(mission)?.id !== step.id) throw new Error('MISSION_STEP_CHANGED');
          const task = state.tasks.find(t => t.id === step.taskId); if (!task) throw new Error('TASK_NOT_FOUND');
          invalidate(); saveTask(state, { ...task, status: 'done' }, Date.now(), message.expectedUpdatedAt);
          break;
        }
        case 'MISSION_STOP':
          if (!mission || mission.status !== 'active') return {};
          invalidate(); mission.status = 'stopped'; mission.endedAt = Date.now();
          if (state.session?.missionId === mission.id && state.session.phase !== 'finished') transition(state.session, 'finished');
          missionLog(state, 'Mission stopped', 'Completed steps and remaining work were saved.', 'notice'); await host.changed(); break;
        case 'MISSION_RESUME': {
          if (!mission || mission.status === 'completed') throw new Error('MISSION_NOT_ACTIVE');
          if (!Number.isInteger(message.minutes) || message.minutes < 5 || message.minutes > 180) throw new Error('INVALID_MISSION_GOAL');
          startMissionSession(state, mission, message.minutes); mission.status = 'active'; delete mission.endedAt;
          missionLog(state, 'Continued the mission', `Started another ${message.minutes}-minute focus session.`); await host.changed(); break;
        }
        case 'MISSION_NEW':
          if (mission?.status === 'active') throw new Error('MISSION_ALREADY_RUNNING');
          invalidate(); if (mission) state.missions.history = [mission, ...state.missions.history].slice(0, 10);
          state.missions.current = null; state.missions.draft = null; state.missions.activity = []; delete state.missions.error; break;
        case 'MISSION_OPEN_RESOURCE': {
          if (!mission) throw new Error('MISSION_NOT_ACTIVE');
          const resource = mission.resources.find(r => r.tabId === message.tabId); if (!resource) throw new Error('PAGE_UNAVAILABLE');
          await openResource(resource); break;
        }
        case 'MISSION_SEARCH': {
          const step = mission?.steps.find(s => s.id === message.stepId);
          if (!step?.searchQuery) throw new Error('PAGE_UNAVAILABLE');
          const url = new URL('https://www.google.com/search'); url.searchParams.set('q', step.searchQuery);
          if (!allowed(url.href)) throw new Error('PAGE_UNAVAILABLE');
          await chrome.tabs.create({ url: url.href }); missionLog(state, 'Opened a resource search', step.searchQuery); break;
        }
        default: throw new Error('UNKNOWN_COMMAND');
      }
      await host.save(); return {};
    });
  }
  function recordAssessment(assessment: Assessment) {
    const state = host.state(); const mission = state.missions.current;
    if (mission?.status === 'active' && state.session?.missionId === mission.id && assessment.category === 'distracting') missionLog(state, 'Noticed a possible detour', assessment.reason, 'notice');
  }
  return { handle, invalidate, resetPending, recordAssessment };
}
