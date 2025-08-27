import assert from 'node:assert';
import { test } from 'vitest';
// @ts-ignore
import request from 'supertest';
import { createApp } from './app.js';

test('POST /auth/google without id_token', async () => {
  const app = createApp();
  const res = await request(app).post('/auth/google').send({});
  assert.strictEqual(res.status, 400);
  assert.strictEqual(res.body.error.code, 'BAD_REQUEST');
});
