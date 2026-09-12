import { mkdir, writeFile } from 'node:fs/promises';
import { Provider } from '../src/server/provider';
import { chatSchema } from '../src/shared/workspace';
try { process.loadEnvFile('.env'); } catch { /* Provider reports missing configuration. */ }
const provider = new Provider({ key: process.env.GPTUNNEL_API_KEY || '', baseUrl: process.env.GPTUNNEL_BASE_URL || 'https://gptunnel.ru/v1', model: process.env.GPTUNNEL_MODEL || 'deepseek-v3.2' });
try {
  const response = await provider.run({ kind: 'chat', context: { language: 'en', goal: '', task: '', chat: {
    messages: [{ role: 'user', content: 'Создай задачу «Подготовить демо Tabby» с двумя короткими шагами. Без срока. Ответь кратко по-русски.' }],
    tasks: [], events: [], now: new Date().toISOString(), timeZone: 'Asia/Dubai',
  } } });
  const result = chatSchema.parse(response.result);
  if (!result.actions.some(a => a.type === 'create_task')) throw new Error('LIVE_CHAT_MISSING_PROPOSAL');
  const report = { at: new Date().toISOString(), live: true, input: 'Synthetic task request; no personal Google data', model: response.model, actionTypes: result.actions.map(a => a.type), russianReply: /[А-Яа-я]/.test(result.reply), usage: response.usage };
  await mkdir('.local', { recursive: true }); await writeFile('.local/live-chat-report.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} catch (e) { console.error('Live chat check failed: ' + ((e as { code?: string }).code || ((e as Error).message === 'LIVE_CHAT_MISSING_PROPOSAL' ? 'LIVE_CHAT_MISSING_PROPOSAL' : 'INVALID_RESPONSE'))); process.exitCode = 1; }
