import { mkdir, writeFile } from 'node:fs/promises';
import { Provider, AppError } from '../src/server/provider';
try { process.loadEnvFile('.env'); } catch {}
// Real, potentially billed calls. Invoked explicitly with npm run test:live.
const provider = new Provider({ key: process.env.GPTUNNEL_API_KEY || '', baseUrl: process.env.GPTUNNEL_BASE_URL || 'https://gptunnel.ru/v1', model: process.env.GPTUNNEL_MODEL || '' });
const report: Record<string, unknown> = { at: new Date().toISOString(), live: false, checks: [] };
try {
  const status = await provider.status(); report.model = status.model;
  const pages = [
    { title: 'React authentication tutorial: implement a login form', url: 'https://www.youtube.com/watch?v=ReactAuth01', text: 'A tutorial about React authentication, login forms and session handling.' },
    { title: 'Funny cats compilation', url: 'https://www.youtube.com/watch?v=FunnyCats01', text: 'Funny pet moments and cats playing with toys.' },
    { title: 'Untitled', url: 'https://example.com/', text: '' },
  ];
  for (const page of pages) {
    const result = await provider.run({ kind: 'classify', context: { language: 'en', goal: 'Learn React authentication and build an example', task: '', page: { ...page, seconds: 9 } } });
    (report.checks as unknown[]).push({ input: page, ...result });
  }
  report.live = true;
  console.log('Received 3 genuine responses from the exact catalog model. Review .local/live-report.json for classifications and returned usage.');
} catch (e) {
  report.error = e instanceof AppError ? e.code : 'LIVE_CHECK_FAILED'; report.available = e instanceof AppError ? e.available : undefined;
  console.error(`Live check NOT completed: ${report.error}`); process.exitCode = 1;
} finally { await mkdir('.local', { recursive: true }); await writeFile('.local/live-report.json', JSON.stringify(report, null, 2)); }
