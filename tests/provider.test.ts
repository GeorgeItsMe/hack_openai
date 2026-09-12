import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Provider, chooseModel, parseOutput, verifiedDeadline } from '../src/server/provider';
import type { AIRequest } from '../src/shared/schemas';
// These are protocol fixtures, not live model outputs.
const model = { id: 'test-gpt-6-astra', title: 'GPT-6 Astra fixture', deprecated: false };
const context: AIRequest['context'] = { language: 'en', goal: 'React auth', task: '', page: { title: 'React authentication', url: 'https://example.com', seconds: 8 } };
const assessment = { category: 'aligned', reason: 'Fixture: matches React goal', nextStep: 'Build a login form.' };
const config = { key: 'fixture-provider-secret-do-not-bundle', baseUrl: 'https://fixture.invalid/v1', model: '' };
test('discovers exact Astra catalog ID and refuses missing/ambiguous/deprecated models', () => {
  assert.equal(chooseModel([model], '').id, model.id);
  assert.throws(() => chooseModel([{ id: 'gpt-other' }], ''), /ASTRA_NOT_FOUND/);
  assert.throws(() => chooseModel([model, { ...model, id: 'another-gpt-6-astra' }], ''), /ASTRA_NOT_FOUND/);
  assert.throws(() => chooseModel([{ ...model, deprecated: true }], ''), /MODEL_DEPRECATED/);
  assert.throws(() => chooseModel([model], 'missing'), /MODEL_UNAVAILABLE/);
});
test('raw Authorization, only documented chat parameters, valid structured JSON and actual returned usage', async () => {
  const calls: { url: string; options?: RequestInit }[] = [];
  const fetcher: typeof fetch = async (url, options) => { calls.push({ url: String(url), options }); return String(url).endsWith('/models') ? Response.json({ data: [model] }) : Response.json({ model: model.id, choices: [{ message: { content: '```json\n' + JSON.stringify(assessment) + '\n```' }, finish_reason: 'stop' }], usage: { total_tokens: 72, total_cost: 0.05 } }); };
  const result = await new Provider(config, fetcher).run({ kind: 'classify', context });
  assert.deepEqual(result.result, assessment); assert.equal(result.usage.total_cost, 0.05);
  assert.equal((calls[1].options?.headers as Record<string, string>).Authorization, config.key);
  assert.deepEqual(Object.keys(JSON.parse(String(calls[1].options?.body))).sort(), ['messages', 'model']);
});
test('no key is an explicit offline state, with no requests', async () => {
  let calls = 0; const p = new Provider({ ...config, key: '' }, async () => { calls++; return Response.json({}); });
  await assert.rejects(p.status(), /AI_NOT_CONNECTED/); assert.equal(calls, 0);
});
for (const [status, error] of [[401, 'API_KEY_INVALID'], [403, 'MODEL_FORBIDDEN'], [429, 'API_RATE_LIMIT'], [410, 'MODEL_DEPRECATED'], [402, 'API_BALANCE'], [503, 'API_UNAVAILABLE']] as const) {
  test(`provider HTTP ${status} reports ${error} without upstream secrets`, async () => {
    const p = new Provider(config, async () => new Response('do not leak key: secret', { status }));
    await assert.rejects(p.status(), new RegExp(error));
  });
}
test('timeout and transport failure are explicit', async () => {
  const p = new Provider({ ...config, timeoutMs: 5 }, async (_u, options) => new Promise((_resolve, reject) => { options?.signal?.addEventListener('abort', () => reject(new Error('timeout'))); }));
  const keepAlive = setTimeout(() => {}, 100); await assert.rejects(p.status(), /API_TIMEOUT/); clearTimeout(keepAlive);
  await assert.rejects(new Provider(config, async () => { throw new Error('network'); }).status(), /API_UNREACHABLE/);
});
test('rejects provider substitution even when body.model retains requested model', async () => {
  const fetcher: typeof fetch = async url => String(url).endsWith('/models') ? Response.json({ data: [model] }) : Response.json({ model: model.id, choices: [{ message: { content: JSON.stringify(assessment) } }], warnings: [{ code: 'DEPRECATED_MODEL' }] }, { headers: { 'x-model-served': 'some-other-model' } });
  await assert.rejects(new Provider(config, fetcher).run({ kind: 'classify', context }), /MODEL_SUBSTITUTED/);
});
test('malformed or dangerous output cannot trigger an action', () => {
  assert.throws(() => parseOutput('classify', 'not json', context), /INVALID_AI_JSON/);
  assert.throws(() => parseOutput('classify', JSON.stringify({ ...assessment, category: 'block' }), context), /INVALID_AI_SCHEMA/);
  assert.throws(() => parseOutput('classify', JSON.stringify({ ...assessment, javascript: 'alert(1)' }), context), /INVALID_AI_SCHEMA/);
  assert.throws(() => parseOutput('groups', JSON.stringify({ groups: [{ title: 'Work', color: 'green', tabIds: [55] }] }), { ...context, tabs: [{ tabId: 1, title: 'a', url: 'https://example.com/' }] }), /INVALID_AI_TAB/);
});
test('deadline requires actual source evidence; duplicate group IDs rejected', () => {
  const result = parseOutput('task', JSON.stringify({ title: 'Learn auth', steps: [], due: '2026-10-01', dueEvidence: 'October 1' }), context);
  assert.ok('due' in result && result.due === '');
  assert.throws(() => parseOutput('groups', JSON.stringify({ groups: [{ title: 'Work', color: 'green', tabIds: [1, 1] }] }), { ...context, tabs: [{ tabId: 1, title: 'a', url: 'https://example.com/' }] }), /INVALID_AI_TAB/);
});
test('deadline matches an absolute date in source, never an unrelated number or invalid day', () => {
  assert.equal(verifiedDeadline('2026-10-01', 'Do 3 things', 'Do 3 things'), false);
  assert.equal(verifiedDeadline('2026-10-01', 'by October 1, 2026', 'Finish by October 1, 2026'), true);
  assert.equal(verifiedDeadline('2026-10-01', 'до 1 октября 2026', 'Сдать до 1 октября 2026'), true);
  assert.equal(verifiedDeadline('2026-02-31', '2026-02-31', '2026-02-31'), false);
});
