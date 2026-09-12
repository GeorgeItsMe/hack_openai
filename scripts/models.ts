import { Provider, AppError } from '../src/server/provider';
try { process.loadEnvFile('.env'); } catch {}
const provider = new Provider({ key: process.env.GPTUNNEL_API_KEY || '', baseUrl: process.env.GPTUNNEL_BASE_URL || 'https://gptunnel.ru/v1', model: process.env.GPTUNNEL_MODEL || '' });
try {
  const models = await provider.models(true);
  console.log(JSON.stringify(models.map(m => ({ id: m.id, title: m.title, deprecated: m.deprecated, deprecated_at: m.deprecated_at })), null, 2));
  try { console.log('Selected:', (await provider.status()).model); } catch (e) { console.log('Model selection:', e instanceof AppError ? e.code : 'ERROR'); process.exitCode = 1; }
} catch (e) { console.error(e instanceof AppError ? e.code : 'CATALOG_ERROR'); process.exitCode = 1; }
