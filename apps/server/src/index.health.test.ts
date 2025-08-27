import assert from 'node:assert';
import { test } from 'vitest';
// @ts-ignore
import request from 'supertest';
import { createApp } from './app.js';
import redis from './redis.js';

test('GET /health returns ok', async () => {
  const app = createApp();
  const originalPing = redis.ping;
  (redis as any).ping = async () => 'PONG';
  const res = await request(app).get('/health');
  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(res.body, { status: 'ok' });
  (redis as any).ping = originalPing;
});

test('GET /health handles redis failure', async () => {
  const app = createApp();
  const originalPing = redis.ping;
  (redis as any).ping = async () => { throw new Error('fail'); };
  const res = await request(app).get('/health');
  assert.strictEqual(res.status, 500);
  (redis as any).ping = originalPing;
});
