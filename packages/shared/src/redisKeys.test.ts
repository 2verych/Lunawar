import assert from 'node:assert';
import { test } from 'vitest';
import {
  userKey,
  roomKey,
  roomMessagesKey,
  roomUsersKey,
  roomMetaKey,
  LOBBY_QUEUE,
  CONFIG_AUTO_MATCH,
  CONFIG_ROOM_SIZE,
} from './redisKeys.js';

test('userKey formats id', () => {
  assert.strictEqual(userKey('42'), 'user:42');
});

test('roomKey formats id', () => {
  assert.strictEqual(roomKey('77'), 'room:77');
});

test('roomMessagesKey formats id', () => {
  assert.strictEqual(roomMessagesKey('5'), 'room:5:messages');
});

test('roomUsersKey formats id', () => {
  assert.strictEqual(roomUsersKey('5'), 'room:5:users');
});

test('roomMetaKey formats id', () => {
  assert.strictEqual(roomMetaKey('5'), 'room:5:meta');
});

test('constants are correct', () => {
  assert.strictEqual(LOBBY_QUEUE, 'lobby:queue');
  assert.strictEqual(CONFIG_ROOM_SIZE, 'config:roomSize');
  assert.strictEqual(CONFIG_AUTO_MATCH, 'config:autoMatch');
});
