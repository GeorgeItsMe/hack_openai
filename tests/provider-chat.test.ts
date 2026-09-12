import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Provider, parseOutput } from '../src/server/provider';
import type { AIRequest } from '../src/shared/schemas';

// Synthetic protocol responses; these tests never call a live model.
const chatContext: AIRequest['context'] = {
  language: 'en', goal: 'Finish the review', task: '',
  chat: {
    messages: [{ role: 'user', content: 'Помоги спланировать работу' }],
    tasks: [{ id: 'review-1', title: 'Review the homepage', status: 'planned', due: '' }],
    events: [], now: '2026-09-12T12:00:00.000Z', timeZone: 'Asia/Dubai',
  },
};
const config = { key: 'synthetic-provider-test-key', baseUrl: 'https://fixture.invalid/v1', model: '' };

test('chat requests have dedicated instructions and return validated proposals', async () => {
  const answer = { reply: 'Начнём с проверки страницы.', actions: [{ type: 'start_focus', goal: 'Review the homepage', minutes: 25, taskId: 'review-1' }] };
  let completions = 0;
  const provider = new Provider(config, async (url, options) => {
    if (String(url).endsWith('/models')) return Response.json({ data: [{ id: 'deepseek-v3.2' }] });
    completions++;
    const body = JSON.parse(String(options?.body));
    assert.equal(body.model, 'deepseek-v3.2');
    assert.equal(body.max_tokens, 2200);
    assert.match(body.messages[0].content, /language of the latest user message/);
    assert.match(body.messages[0].content, /user must confirm each card/);
    assert.doesNotMatch(body.messages[0].content, /Always respond in English|\bundefined\b/);
    assert.deepEqual(JSON.parse(body.messages[1].content).chat.tasks, chatContext.chat!.tasks);
    assert.ok(!String(options?.body).includes(config.key));
    return Response.json({ model: 'deepseek-v3.2', choices: [{ message: { content: JSON.stringify(answer) }, finish_reason: 'stop' }], usage: { total_tokens: 42 } });
  });
  const result = await provider.run({ kind: 'chat', context: chatContext });
  assert.deepEqual(result.result, answer); assert.equal(result.usage.total_tokens, 42); assert.equal(completions, 1);
});

test('chat proposals cannot target invented tasks and missing chat context is rejected before fetching', async () => {
  for (const action of [{ type: 'complete_task', taskId: 'invented' }, { type: 'start_focus', taskId: 'invented', goal: 'Review', minutes: 25 }]) {
    assert.throws(() => parseOutput('chat', JSON.stringify({ reply: 'A proposal', actions: [action] }), chatContext), /INVALID_AI_TASK/);
  }
  const provider = new Provider(config, async () => { assert.fail('Invalid chat must not call the provider'); });
  await assert.rejects(provider.run({ kind: 'chat', context: { language: 'en' } }), /INVALID_REQUEST/);
});
