import assert from 'node:assert';
import { test, vi } from 'vitest';
import redis from './redis.js';
import * as ws from './ws.js';
import { joinLobby, leaveLobby } from './lobby.js';
import { createRoom, getRooms, leaveRoom } from './rooms.js';
import {
  LOBBY_QUEUE,
  CONFIG_AUTO_MATCH,
  CONFIG_ROOM_SIZE,
  roomUsersKey,
} from '@lunawar/shared/src/redisKeys.js';

function mockPublish() {
  const events: any[] = [];
  vi.spyOn(ws, 'publish').mockImplementation(async (_ch: string, _type: string, payload: any) => {
    events.push(payload);
    return undefined;
  });
  return events;
}

test('join and leave lobby', async () => {
  await redis.flushall();
  mockPublish();
  await joinLobby('a');
  let q = await redis.lrange(LOBBY_QUEUE, 0, -1);
  assert.deepStrictEqual(q, ['a']);
  await leaveLobby('a');
  q = await redis.lrange(LOBBY_QUEUE, 0, -1);
  assert.deepStrictEqual(q, []);
});

test('auto room creation from lobby', async () => {
  await redis.flushall();
  mockPublish();
  await redis.set(CONFIG_AUTO_MATCH, 'true');
  await redis.set(CONFIG_ROOM_SIZE, '2');
  await joinLobby('a');
  await joinLobby('b');
  const rooms = await getRooms();
  assert.strictEqual(rooms.length, 1);
  const users = rooms[0].users.map((u: any) => u.uid).sort();
  assert.deepStrictEqual(users, ['a', 'b']);
  const q = await redis.lrange(LOBBY_QUEUE, 0, -1);
  assert.deepStrictEqual(q, []);
});

test('manual room creation', async () => {
  await redis.flushall();
  mockPublish();
  const roomId = await createRoom(['x', 'y']);
  const rooms = await getRooms();
  assert.strictEqual(rooms.length, 1);
  assert.strictEqual(rooms[0].meta.id, roomId);
  const users = rooms[0].users.map((u: any) => u.uid).sort();
  assert.deepStrictEqual(users, ['x', 'y']);
});

test('leave room removes empty room', async () => {
  await redis.flushall();
  mockPublish();
  const roomId = await createRoom(['p', 'q']);
  await leaveRoom(roomId, 'p');
  let members = await redis.smembers(roomUsersKey(roomId));
  assert.deepStrictEqual(members.sort(), ['q']);
  await leaveRoom(roomId, 'q');
  const exists = await redis.exists(roomUsersKey(roomId));
  assert.strictEqual(exists, 0);
});
