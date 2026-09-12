import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSession, settle, transition, requestCurrent } from '../src/shared/engine';
import { cleanUrl, contextKey, excluded, redact } from '../src/shared/privacy';

test('timestamp accounting survives a worker restart without accumulating timer ticks', () => {
  let s = createSession('Build authentication', '', 25, 1000); s.category = 'aligned';
  settle(s, 16000); s = JSON.parse(JSON.stringify(s)); settle(s, 61000);
  assert.equal(s.remainingMs, 1440000); assert.equal(s.totals.aligned, 60000);
  settle(s, 61000); assert.equal(s.totals.aligned, 60000);
});
test('pause, absence and break are distinct; a finished break waits for an explicit resume', () => {
  const s = createSession('Build', '', 25, 0); settle(s, 10000);
  transition(s, 'paused', 10000); settle(s, 20000); transition(s, 'running', 20000);
  s.away = true; settle(s, 30000); s.away = false;
  transition(s, 'break', 30000, 5); settle(s, 390000);
  assert.equal(s.phase, 'ready'); assert.equal(s.totals.break, 300000); assert.equal(s.totals.paused, 70000); assert.equal(s.totals.away, 10000); assert.equal(s.totals.unknown, 10000); assert.equal(s.remainingMs, 1490000);
  transition(s, 'running', 390000); settle(s, 400000); assert.equal(s.remainingMs, 1480000);
});
test('late alarm caps session duration and persists true end timestamp', () => {
  const s = createSession('Build', '', 1, 1000); settle(s, 900000);
  assert.equal(s.phase, 'finished'); assert.equal(s.endedAt, 61000); assert.equal(s.totals.unknown, 60000);
  settle(s, 1000000); assert.equal(s.totals.unknown, 60000);
});
test('stop during break stops counting and backwards clock does not add time', () => {
  const s = createSession('Build', '', 5, 1000); settle(s, 500); assert.equal(s.remainingMs, 300000);
  transition(s, 'break', 2000, 5); transition(s, 'finished', 12000); settle(s, 800000);
  assert.equal(s.totals.break, 10000); assert.equal(s.totals.unknown, 1000);
});
test('stale responses are rejected after goal/tab changes, pause and break', () => {
  const s = createSession('React auth', '', 25); assert.equal(requestCurrent(s, s.id, 0, 'page-a', 'page-a'), true);
  assert.equal(requestCurrent(s, s.id, 0, 'page-a', 'page-b'), false); s.revision++;
  assert.equal(requestCurrent(s, s.id, 0, 'page-a', 'page-a'), false);
  transition(s, 'break'); assert.equal(requestCurrent(s, s.id, s.revision, 'page-a', 'page-a'), false);
});
test('a correction cannot authorize the whole video domain or another query-based context', () => {
  const a = contextKey('https://youtube.com/watch?v=ReactAuth01', 'React auth');
  const b = contextKey('https://youtube.com/watch?v=FunnyCats01', 'Cats');
  const c = contextKey('https://example.com/page?id=1', 'Same title');
  const d = contextKey('https://example.com/page?id=2', 'Same title');
  assert.notEqual(a, b); assert.notEqual(c, d);
});
test('URLs and text are scrubbed; content identifier survives for YouTube', () => {
  assert.equal(cleanUrl('https://user:pass@youtube.com/watch?v=ReactAuth01&token=secret&utm_source=a#code=x'), 'https://youtube.com/watch?v=ReactAuth01');
  assert.equal(cleanUrl('https://example.com/path?q=private&session=secret#email=abc'), 'https://example.com/path');
  assert.equal(cleanUrl('javascript:alert(1)'), '');
  assert.equal(excluded('https://mail.example.com/a', ['example.com']), true);
  assert.equal(excluded('https://evilexample.com', ['example.com']), false);
  const cleaned = redact('email: me@example.com password=secret 4111 1111 1111 1111');
  assert.ok(!cleaned.includes('me@example.com')); assert.ok(!cleaned.includes('secret')); assert.ok(!cleaned.includes('4111'));
});
