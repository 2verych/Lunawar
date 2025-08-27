import assert from 'node:assert';
import { test } from 'vitest';
import { parseCookies, requireSession } from './session.js';
import redis from './redis.js';

test('parseCookies parses and decodes cookies', () => {
  const req: any = { headers: { cookie: 'foo=bar; baz=qux%20quux' } };
  assert.deepStrictEqual(parseCookies(req), { foo: 'bar', baz: 'qux quux' });
});

function mockRes() {
  return {
    statusCode: undefined as number | undefined,
    body: undefined as any,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    },
  };
}

test('requireSession rejects missing sessionId', async () => {
  const req: any = { headers: {}, requestId: '1' };
  const res = mockRes();
  await requireSession(req, res as any, () => {});
  assert.strictEqual(res.statusCode, 401);
  assert.deepStrictEqual(res.body, {
    error: { code: 'UNAUTHORIZED', message: 'Missing session' },
    requestId: '1',
  });
});

test('requireSession rejects absent session record', async () => {
  const req: any = { headers: { cookie: 'sessionId=abc' }, requestId: '2' };
  const res = mockRes();
  const originalGet = redis.get;
  (redis as any).get = async () => null;
  await requireSession(req, res as any, () => {});
  assert.strictEqual(res.statusCode, 401);
  assert.deepStrictEqual(res.body, {
    error: { code: 'UNAUTHORIZED', message: 'Invalid session' },
    requestId: '2',
  });
  (redis as any).get = originalGet;
});

test('requireSession rejects mismatched session', async () => {
  const req: any = { headers: { cookie: 'sessionId=abc' }, requestId: '3' };
  const res = mockRes();
  const originalGet = redis.get;
  (redis as any).get = async (key: string) => {
    if (key === 'session:abc') return JSON.stringify({ uid: 'u', name: 'n' });
    if (key === 'user:u:session') return 'other';
    return null;
  };
  await requireSession(req, res as any, () => {});
  assert.strictEqual(res.statusCode, 401);
  assert.deepStrictEqual(res.body, {
    error: { code: 'UNAUTHORIZED', message: 'Session expired' },
    requestId: '3',
  });
  (redis as any).get = originalGet;
});

test('requireSession passes with valid session', async () => {
  const req: any = { headers: { cookie: 'sessionId=abc' }, requestId: '4' };
  const res = mockRes();
  const originalGet = redis.get;
  (redis as any).get = async (key: string) => {
    if (key === 'session:abc') return JSON.stringify({ uid: 'u', name: 'n' });
    if (key === 'user:u:session') return 'abc';
    return null;
  };
  let nextCalled = false;
  await requireSession(req, res as any, () => {
    nextCalled = true;
  });
  assert.ok(nextCalled);
  assert.deepStrictEqual(req.user, { uid: 'u', name: 'n' });
  assert.strictEqual(res.statusCode, undefined);
  (redis as any).get = originalGet;
});
