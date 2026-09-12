import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialState, normalizeLanguage } from '../src/shared/types';
import { projectCommand, saveTask } from '../src/shared/projects';
import { canonical, checkSyncQuota, mergeSync, syncRecords } from '../src/shared/sync';
import { analytics } from '../src/shared/analytics';
import { createSession } from '../src/shared/engine';
import { exportTask, mcpInputs } from '../src/shared/mcp';

test('migration preserves user data and initializes opt-in workspace capabilities', () => {
  const state = initialState(); const task = saveTask(state, { title: 'Keep this', steps: [], status: 'planned' });
  delete (state as any).projects; delete (state.settings as any).mcpEnabled;
  normalizeLanguage(state); assert.equal(state.tasks[0].id, task.id); assert.deepEqual(state.projects, []); assert.equal(state.settings.mcpEnabled, false); assert.equal(state.settings.syncEnabled, false);
});
test('projects and notes validate identity, archive policy and retain deletion tombstones', () => {
  const state = initialState(); projectCommand(state, 'SAVE_PROJECT', { project: { title: 'Research' } }); const project = state.projects[0];
  const task = saveTask(state, { title: 'Read paper', steps: [], status: 'planned', projectId: project.id });
  projectCommand(state, 'SAVE_NOTE', { note: { projectId: project.id, title: 'Thoughts', body: 'Keep line one\nline two' } });
  const note = state.notes[0]; projectCommand(state, 'DELETE_NOTE', { id: note.id }); assert.ok(state.notes[0].deletedAt); assert.equal(state.notes[0].body, '');
  projectCommand(state, 'SAVE_PROJECT', { project: { id: project.id, title: project.title, archived: true } });
  assert.throws(() => saveTask(state, { title: 'New', steps: [], status: 'planned', projectId: project.id }), /PROJECT_UNAVAILABLE/);
  saveTask(state, { ...task, status: 'done' }); assert.equal(state.tasks[0].status, 'done');
  assert.throws(() => saveTask(state, { ...task, id: 'missing' }), /TASK_NOT_FOUND/);
  assert.throws(() => saveTask(state, { ...task, due: '2026-02-30' }), /INVALID_TASK/);
});
test('task completion timestamps are stable, edits are monotonic and capacity never drops old tasks', () => {
  const state = initialState(); const task = saveTask(state, { title: 'Task', steps: [], status: 'planned' }, 10);
  const done = saveTask(state, { ...task, status: 'done' }, 20); const replay = saveTask(state, done, 15);
  assert.equal(replay.completedAt, 20); assert.ok(replay.updatedAt! > done.updatedAt!);
  const reopened = saveTask(state, { ...replay, status: 'planned' }, 30); assert.equal(reopened.completedAt, undefined);
  for (let i = 1; i < 500; i++) saveTask(state, { title: String(i), steps: [], status: 'planned' });
  assert.throws(() => saveTask(state, { title: 'Overflow', steps: [], status: 'planned' }), /TASK_LIMIT/); assert.ok(state.tasks.find(t => t.id === task.id));
});
test('stale task, project and note editors cannot overwrite newer local or synced changes', () => {
  const state = initialState(); const task = saveTask(state, { title: 'Original', steps: [], status: 'planned' }, 10);
  saveTask(state, { ...task, title: 'Newer title' }, 20, task.updatedAt);
  assert.throws(() => saveTask(state, { ...task, title: 'Stale title' }, 30, task.updatedAt), /ITEM_CHANGED/); assert.equal(state.tasks[0].title, 'Newer title');
  projectCommand(state, 'SAVE_PROJECT', { project: { title: 'Project' } }, 10); const project = state.projects[0];
  projectCommand(state, 'SAVE_PROJECT', { project: { id: project.id, title: 'Updated' }, expectedUpdatedAt: project.updatedAt }, 20);
  assert.throws(() => projectCommand(state, 'SAVE_PROJECT', { project: { id: project.id, title: 'Project', archived: true }, expectedUpdatedAt: project.updatedAt }, 30), /ITEM_CHANGED/);
  projectCommand(state, 'SAVE_NOTE', { note: { projectId: project.id, title: 'Note', body: 'Original' } }, 10); const note = state.notes[0];
  projectCommand(state, 'SAVE_NOTE', { note: { id: note.id, projectId: project.id, title: note.title, body: 'Newer note' }, expectedUpdatedAt: note.updatedAt }, 20);
  assert.throws(() => projectCommand(state, 'DELETE_NOTE', { id: note.id, expectedUpdatedAt: note.updatedAt }, 30), /ITEM_CHANGED/); assert.equal(state.notes[0].body, 'Newer note');
});
test('sync allowlist excludes secrets, live state and external account identifiers', () => {
  const state = initialState(); state.settings.pairToken = 'PAIR_SECRET'; state.settings.mcpToken = 'MCP_SECRET';
  const task = saveTask(state, { title: 'Task', steps: [], status: 'planned', source: 'https://example.com/a?token=PRIVATE#secret' }); task.external = { service: 'gmail', id: 'ACCOUNT_PRIVATE' };
  const value = JSON.stringify(syncRecords(state)); for (const marker of ['PAIR_SECRET', 'MCP_SECRET', 'ACCOUNT_PRIVATE', 'PRIVATE']) assert.ok(!value.includes(marker));
  assert.ok(value.includes('https://example.com/a'));
});
test('sync merges independent records and converges simultaneous edits and deletions', () => {
  const first = initialState(); projectCommand(first, 'SAVE_PROJECT', { project: { title: 'Project' } }, 100);
  projectCommand(first, 'SAVE_NOTE', { note: { projectId: first.projects[0].id, title: 'Note', body: 'v1' } }, 100);
  const second = structuredClone(first); first.notes[0].body = 'A'; second.notes[0].body = 'B'; first.notes[0].updatedAt = second.notes[0].updatedAt = 200;
  const a = syncRecords(first), b = syncRecords(second); mergeSync(first, b); mergeSync(second, a); assert.equal(canonical(syncRecords(first)), canonical(syncRecords(second)));
  projectCommand(first, 'DELETE_NOTE', { id: first.notes[0].id }, 300); mergeSync(second, syncRecords(first)); assert.equal(second.notes[0].deletedAt, 300);
  mergeSync(first, b); assert.equal(first.notes[0].deletedAt, 300);
});
test('invalid remote records and sync capacity are explicit errors', () => {
  const state = initialState(); const task = saveTask(state, { title: 'Task', steps: [], status: 'planned' }); const records = syncRecords(state); const key = Object.keys(records)[0];
  assert.throws(() => mergeSync(state, { [key]: { ...(records[key] as object), pairToken: 'NO' } }), /SYNC_INVALID_REMOTE_DATA/);
  task.steps = ['猫'.repeat(600), '猫'.repeat(600), '猫'.repeat(600), '猫'.repeat(600), '猫'.repeat(600)];
  assert.throws(() => checkSyncQuota(syncRecords(state)), /SYNC_ITEM_TOO_LARGE/);
  assert.throws(() => checkSyncQuota(Object.fromEntries(Array.from({ length: 501 }, (_, i) => [String(i), {}]))), /SYNC_QUOTA_EXCEEDED/);
});
test('analytics deduplicates history, filters projects and separates coverage from alignment', () => {
  const now = Date.now(); const state = initialState(); const session = createSession('Focus', '', 25, now - 10000); session.projectId = 'p1'; session.phase = 'finished'; session.totals.aligned = 60000; session.totals.distracting = 60000; session.totals.unknown = 120000;
  state.session = session; state.history = [session];
  const result = analytics(state, 7, 'p1', now); assert.equal(result.sessions, 1); assert.equal(result.coverage, 0.5); assert.equal(result.alignment, 0.5);
  assert.equal(analytics(state, 7, 'other', now).sessions, 0); assert.equal(analytics(initialState(), 7).alignment, null);
});
test('MCP rejects unknown arguments and exports only safe task fields', () => {
  assert.equal(mcpInputs.tabby_create_task.safeParse({ requestId: crypto.randomUUID(), title: 'Task', pairToken: 'NO' }).success, false);
  const state = initialState(); state.settings.excludedSites = ['private.example'];
  const task = saveTask(state, { title: 'Task', steps: [], status: 'planned', source: 'https://private.example/account' });
  assert.equal(exportTask(task, state).source, ''); assert.ok(!('external' in exportTask(task, state)));
});
