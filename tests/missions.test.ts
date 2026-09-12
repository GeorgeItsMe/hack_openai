import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialState, normalizeLanguage } from '../src/shared/types';
import { acceptMission, currentMissionStep, syncMissionProgress, startMissionSession, type MissionDraft } from '../src/shared/missions';
import { missionInputSchema, validateMissionPlan } from '../src/shared/mission-schema';
import { createSession, transition } from '../src/shared/engine';
import { saveTask } from '../src/shared/projects';
import { parseOutput, Provider } from '../src/server/provider';
import { requestSchema } from '../src/shared/schemas';

const draft = (now = 1000): MissionDraft => ({ id: crypto.randomUUID(), createdAt: now, goal: 'Build a login form', minutes: 25, scannedTabs: 1,
  resources: [{ tabId: 7, title: 'React', url: 'https://react.dev/', key: 'snapshot', windowId: 1 }],
  plan: { title: 'A working login form', outcome: 'A form that handles one login attempt.', steps: [
    { title: 'Build the fields', instruction: 'Add email, password and a submit button.', doneWhen: 'Both fields can be typed into.', minutes: 10, tabIds: [7], searchQuery: '' },
    { title: 'Verify a submission', instruction: 'Submit test values and inspect the result.', doneWhen: 'One success and one failure have been checked.', minutes: 15, tabIds: [], searchQuery: 'React form submit example' },
  ] },
});
test('missions validate their time budget and restrict resources to the reviewed tab context', () => {
  const input = draft(); assert.deepEqual(validateMissionPlan(input.plan, 25, [7]), input.plan);
  assert.throws(() => validateMissionPlan(input.plan, 15, [7]), /MISSION_TIME_BUDGET/);
  assert.throws(() => validateMissionPlan(input.plan, 25, []), /INVALID_AI_TAB/);
  input.plan.steps[0].tabIds = [7, 7]; assert.throws(() => validateMissionPlan(input.plan, 25, [7]), /INVALID_AI_TAB/);
  assert.equal(missionInputSchema.safeParse({ goal: 'Hi', minutes: 0 }).success, false);
  assert.equal(requestSchema.safeParse({ kind: 'mission', context: { language: 'en', goal: 'A goal', task: '' } }).success, false);
});
test('a reviewed mission creates linked tasks once; rejected starts preserve the entire workspace', () => {
  const state = initialState(); const input = draft(); state.missions.draft = input;
  assert.equal(Boolean(state.session), false); assert.equal(state.tasks.length, 0);
  const mission = acceptMission(state, input, true, 2000);
  assert.equal(state.tasks.length, 2); assert.equal(state.session?.missionId, mission.id);
  assert.equal(state.session?.taskId, mission.steps[0].taskId); assert.equal(state.tasks[0].status, 'doing');
  assert.equal(mission.grouping, 'pending'); assert.equal(state.missions.draft, null);
  assert.equal(acceptMission(state, input, true, 3000), mission); assert.equal(state.tasks.length, 2);
  const snapshot = structuredClone(state); assert.throws(() => acceptMission(state, draft(), true, 3000), /MISSION_ALREADY_RUNNING/); assert.deepEqual(state, snapshot);
  const conflict = initialState(); conflict.session = createSession('Existing focus', '', 15, 1000);
  const before = structuredClone(conflict); assert.throws(() => acceptMission(conflict, draft(), false, 2000), /SESSION_ALREADY_RUNNING/); assert.deepEqual(conflict, before);
  const stale = initialState(); assert.throws(() => acceptMission(stale, draft(), false, 20 * 60000), /MISSION_PLAN_EXPIRED/); assert.equal(stale.tasks.length, 0);
});
test('only confirmed task completion advances focus, accounts old context and preserves the session clock', () => {
  const state = initialState(); const mission = acceptMission(state, draft(), false, 1000); const session = state.session!;
  session.category = 'aligned'; syncMissionProgress(state, 2000);
  assert.equal(currentMissionStep(mission)?.id, mission.steps[0].id); assert.equal(mission.status, 'active');
  assert.equal(session.remainingMs, 25 * 60000 - 1000);
  const oldId = session.id; saveTask(state, { ...state.tasks[0], status: 'done' }, 3000, state.tasks[0].updatedAt);
  assert.equal(syncMissionProgress(state, 4000), true);
  assert.equal(session.id, oldId); assert.equal(session.taskId, mission.steps[1].taskId); assert.equal(session.revision, 1);
  assert.match(session.goal, /Current step: Verify a submission/); assert.equal(session.totals.aligned, 3000); assert.equal(session.remainingMs, 25 * 60000 - 3000);
  assert.equal(state.tasks[1].status, 'doing'); assert.equal(mission.steps[0].completedAt, 3000);
  saveTask(state, { ...state.tasks[1], status: 'done' }, 5000, state.tasks[1].updatedAt); syncMissionProgress(state, 5000);
  assert.equal(mission.status, 'completed'); assert.equal(session.phase, 'finished'); assert.equal(mission.endedAt, 5000);
  assert.equal(state.missions.activity.filter(a => a.title === 'Step confirmed complete').length, 2);
  assert.equal(syncMissionProgress(state, 10000), false);
});
test('timer expiry keeps incomplete steps; continuing preserves progress and completion does not finish an unrelated focus', () => {
  const state = initialState(); const mission = acceptMission(state, draft(), false, 1000);
  syncMissionProgress(state, 30 * 60000); assert.equal(state.session?.phase, 'finished'); assert.equal(mission.status, 'active');
  startMissionSession(state, mission, 15, 31 * 60000); assert.equal(state.history.length, 1); assert.equal(state.session?.remainingMs, 15 * 60000);
  transition(state.session!, 'finished', 32 * 60000); state.session = createSession('Unrelated focus', '', 25, 32 * 60000);
  state.tasks.forEach(task => { task.status = 'done'; }); syncMissionProgress(state, 33 * 60000);
  assert.equal(mission.status, 'completed'); assert.equal(state.session.phase, 'running'); assert.equal(state.session.goal, 'Unrelated focus');
});
test('stopped missions reconcile external confirmations and old installs gain an empty mission state', () => {
  const state = initialState(); const mission = acceptMission(state, draft(), false, 1000);
  mission.status = 'stopped'; transition(state.session!, 'finished', 2000);
  state.tasks[0].status = 'done'; syncMissionProgress(state, 3000); assert.equal(currentMissionStep(mission)?.id, mission.steps[1].id);
  startMissionSession(state, mission, 15, 4000); mission.status = 'active'; assert.equal(state.session?.taskId, mission.steps[1].taskId);
  const legacy = initialState(); delete (legacy as any).missions; normalizeLanguage(legacy); assert.deepEqual(legacy.missions, initialState().missions);
});
test('mission provider uses DeepSeek, bounded output and rejects invented tabs after parsing', async () => {
  const input = draft(); const context = { language: 'en' as const, goal: input.goal, task: '', mission: { minutes: 25 }, tabs: [{ tabId: 7, title: 'React', url: 'https://react.dev/' }] };
  assert.throws(() => parseOutput('mission', JSON.stringify(input.plan), { ...context, tabs: [] }), /INVALID_AI_TAB/);
  const provider = new Provider({ key: 'test-fixture-only', baseUrl: 'https://fixture.invalid', model: '' }, async (url, options) => {
    if (String(url).endsWith('/models')) return Response.json({ data: [{ id: 'deepseek-v3.2' }] });
    const body = JSON.parse(String(options?.body)); assert.equal(body.model, 'deepseek-v3.2'); assert.equal(body.max_tokens, 1800);
    assert.match(body.messages[0].content, /NOT searched the web/); assert.match(body.messages[0].content, /Always respond in English/);
    return Response.json({ model: 'deepseek-v3.2', choices: [{ message: { content: JSON.stringify(input.plan) } }] });
  });
  assert.deepEqual((await provider.run({ kind: 'mission', context })).result, input.plan);
});
