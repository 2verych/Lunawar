import assert from 'node:assert';
import { test } from 'vitest';
import { errorHandler } from './errorHandler.js';

function mockRes() {
  return {
    statusCode: 0 as number | undefined,
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

test('errorHandler formats response', () => {
  const req: any = { requestId: 'req1' };
  const res = mockRes();
  const err = { status: 418, code: 'TEAPOT', message: 'short and stout' };
  errorHandler(err, req, res as any, () => {});
  assert.strictEqual(res.statusCode, 418);
  assert.deepStrictEqual(res.body, {
    error: { code: 'TEAPOT', message: 'short and stout' },
    requestId: 'req1',
  });
});
