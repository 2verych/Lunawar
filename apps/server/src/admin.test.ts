import assert from 'node:assert';
import { test } from 'vitest';
// @ts-ignore
import request from 'supertest';
import { createApp } from './app.js';
import redis from './redis.js';
import { CONFIG_ROOM_SIZE, CONFIG_AUTO_MATCH } from '@lunawar/shared/src/redisKeys.js';

process.env.ADMIN_EMAILS = 'admin@example.com';

test('POST /admin/config.set updates config', async () => {
  const app = createApp();
  await redis.flushall();
  await redis.set('user:admin@example.com:session', 'abc');
  await redis.set('session:abc', JSON.stringify({ uid: 'admin@example.com', name: 'Admin' }));

  const res = await request(app)
    .post('/admin/config.set')
    .set('Cookie', 'sessionId=abc')
    .send({ roomSize: 4, autoMatch: true });

  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(res.body, { ok: true });

  const rs = await redis.get(CONFIG_ROOM_SIZE);
  const am = await redis.get(CONFIG_AUTO_MATCH);
  assert.strictEqual(rs, '4');
  assert.strictEqual(am, 'true');
});

test('POST /admin/config.set rejects non-admin', async () => {
  const app = createApp();
  await redis.flushall();
  await redis.set('user:user@example.com:session', 'abc');
  await redis.set('session:abc', JSON.stringify({ uid: 'user@example.com', name: 'User' }));

  const res = await request(app)
    .post('/admin/config.set')
    .set('Cookie', 'sessionId=abc')
    .send({ roomSize: 4, autoMatch: true });

  assert.strictEqual(res.status, 403);
});
