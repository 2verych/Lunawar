import assert from 'node:assert';
import { test } from 'vitest';
import { userKey, roomKey, roomMessagesKey } from './redisKeys.js';

test('userKey formats id', () => {
  assert.strictEqual(userKey('42'), 'user:42');
});

test('roomKey formats id', () => {
  assert.strictEqual(roomKey('77'), 'room:77');
});

test('roomMessagesKey formats id', () => {
  assert.strictEqual(roomMessagesKey('5'), 'room:5:messages');
});
