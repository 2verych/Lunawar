import assert from 'node:assert';
import { test } from 'vitest';
// @ts-ignore
import request from 'supertest';
import { createApp } from './app.js';
import redis from './redis.js';

test('POST /auth/logout clears session', async () => {
  const app = createApp();
  const uid = 'user@example.com';
  const sessionId = 'sess1';
  await redis.set(`user:${uid}:session`, sessionId);
  await redis.set(`session:${sessionId}`, JSON.stringify({ uid, name: 'User' }));
  const res = await request(app)
    .post('/auth/logout')
    .set('Cookie', [`sessionId=${sessionId}`]);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.ok, true);
  const sess = await redis.get(`session:${sessionId}`);
  assert.strictEqual(sess, null);
});
