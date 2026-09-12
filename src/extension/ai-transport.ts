import { CLOUD_AI_ENDPOINT } from '../shared/cloud';
import type { Settings } from '../shared/types';

export function apiTarget(settings: Pick<Settings, 'aiMode' | 'pairToken'>, path: string) {
  const cloud = settings.aiMode !== 'local' && (path === 'ai' || path === 'status');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (cloud) return { cloud, url: `${CLOUD_AI_ENDPOINT}?op=${path}`, headers };
  if (!settings.pairToken) throw Object.assign(new Error('PAIRING_REQUIRED'), { code: 'PAIRING_REQUIRED' });
  headers['X-Tabby-Token'] = settings.pairToken;
  return { cloud, url: `http://127.0.0.1:4318/${path}`, headers };
}
