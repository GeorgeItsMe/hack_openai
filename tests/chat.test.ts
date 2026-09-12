import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialState } from '../src/shared/types';
import { chatSchema, type ChatProposal } from '../src/shared/workspace';
import { applyProposal } from '../src/shared/workspace-actions';
import { Provider, parseOutput } from '../src/server/provider';
import type { AIRequest } from '../src/shared/schemas';

test('chat actions are strictly validated, applied once, and reject stale or unknown tasks', () => {
  const state = initialState(); const now = Date.now();
  const proposal: ChatProposal = { id: 'p1', createdAt: now, state: 'pending', action: { type: 'create_task', title: 'Prepare review', steps: ['Read notes'], due: '' } };
  assert.equal(applyProposal(state, proposal, now), true); assert.equal(applyProposal(state, proposal, now), false); assert.equal(state.tasks.length, 1);
  const task = state.tasks[0];
  const complete: ChatProposal = { id: 'p2', state: 'pending', createdAt: now, action: { type: 'complete_task', taskId: task.id }, taskSnapshot: JSON.stringify(task) };
  task.title = 'Changed'; assert.throws(() => applyProposal(state, complete, now), /TASK_CHANGED/); assert.equal(task.status, 'planned');
  assert.equal(chatSchema.safeParse({ reply: 'Run this', actions: [{ type: 'execute_js', code: 'alert(1)' }] }).success, false);
  assert.equal(chatSchema.safeParse({ reply: 'Invalid date', actions: [{ type: 'create_task', title: 'Task', steps: [], due: '2026-02-31' }] }).success, false);
  assert.throws(() => applyProposal(state, { ...proposal, state: 'pending', createdAt: now - 31 * 60000 }, now), /PROPOSAL_EXPIRED/);
  const focus: ChatProposal = { id: 'p3', state: 'pending', createdAt: now, action: { type: 'start_focus', goal: 'Review', minutes: 25, taskId: '' } };
  applyProposal(state, focus, now); assert.throws(() => applyProposal(state, { ...focus, state: 'pending' }, now), /SESSION_ALREADY_RUNNING/);
});

test('chat provider retains DeepSeek, rejects invented task IDs and does not export secrets', async () => {
  const context: AIRequest['context'] = { language: 'en', goal: '', task: '', chat: { messages: [{ role: 'user', content: 'Помоги разбить задачу' }], tasks: [{ id: 'task-1', title: 'Review', due: '', status: 'planned' }], events: [], now: new Date().toISOString(), timeZone: 'Asia/Dubai' } };
  const result = { reply: 'Предлагаю начать с заметок.', actions: [{ type: 'create_task', title: 'Read notes', steps: [], due: '' }] };
  const p = new Provider({ key: 'fixture-provider-key', baseUrl: 'https://fixture.invalid/v1', model: '' }, async (url, options) => {
    if (String(url).endsWith('/models')) return Response.json({ data: [{ id: 'deepseek-v3.2' }] });
    const body = JSON.parse(String(options?.body)); assert.equal(body.model, 'deepseek-v3.2'); assert.equal(body.max_tokens, 2200);
    assert.match(body.messages[0].content, /language of the latest user message/); assert.ok(!String(options?.body).includes('fixture-provider-key'));
    return Response.json({ model: 'deepseek-v3.2', choices: [{ message: { content: JSON.stringify(result) } }], usage: { total_tokens: 33 } });
  });
  assert.deepEqual((await p.run({ kind: 'chat', context })).result, result);
  assert.throws(() => parseOutput('chat', JSON.stringify({ reply: 'Done', actions: [{ type: 'complete_task', taskId: 'invented' }] }), context), /INVALID_AI_TASK/);
  await assert.rejects(p.run({ kind: 'chat', context: { language: 'en' } }), /INVALID_REQUEST/);
});
