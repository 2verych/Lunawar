import assert from 'node:assert';
import { test } from 'vitest';
import redis from './redis.js';
import { createRoom, getRoom, sendMessage } from './rooms.js';

test('send chat message stored and retrievable', async () => {
  await redis.flushall();
  const roomId = await createRoom(['u1']);
  await sendMessage(roomId, { uid: 'u1', name: 'User1' }, 'm1', 'hello');
  const room = await getRoom(roomId);
  assert.ok(room);
  assert.strictEqual(room!.lastMessages.length, 1);
  const msg = room!.lastMessages[0];
  assert.strictEqual(msg.messageId, 'm1');
  assert.strictEqual(msg.text, 'hello');
  assert.strictEqual(msg.from.uid, 'u1');
  assert.strictEqual(typeof msg.eventId, 'number');
});
