import { createCloudHandler } from '../src/server/cloud.js';
import { Provider } from '../src/server/provider.js';

const provider = new Provider({
  key: process.env.TABBY_CLOUD_GPTUNNEL_KEY || '',
  baseUrl: 'https://gptunnel.ru/v1',
  model: 'deepseek-v3.2',
  timeoutMs: 25000,
});
export default { fetch: createCloudHandler(provider, () => !!process.env.TABBY_CLOUD_GPTUNNEL_KEY && process.env.TABBY_CLOUD_ENABLED !== '0') };
