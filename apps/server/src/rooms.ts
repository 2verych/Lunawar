import { randomUUID } from 'crypto';
import redis from './redis.js';
import {
  ROOMS_SET,
  roomUsersKey,
  roomMetaKey,
  roomMessagesKey,
} from '@lunawar/shared/src/redisKeys.js';
import {
  CHANNEL_ROOM,
  ROOM_CREATED,
  ROOM_USER_JOINED,
  ROOM_USER_LEFT,
  CHAT_MESSAGE,
} from '@lunawar/shared/src/events.js';
import { publish } from './ws.js';

async function fetchUser(uid: string) {
  const sessionId = await redis.get(`user:${uid}:session`);
  if (!sessionId) return { uid, name: uid };
  const sessionData = await redis.get(`session:${sessionId}`);
  if (!sessionData) return { uid, name: uid };
  return JSON.parse(sessionData);
}

export interface RoomMeta {
  id: string;
  size: number;
  createdAt: number;
  ttlSec: number;
}

export async function createRoom(users: string[]) {
  const id = randomUUID();
  const meta: RoomMeta = { id, size: users.length, createdAt: Date.now(), ttlSec: 1800 };
  await redis.sadd(ROOMS_SET, id);
  await redis.hmset(roomMetaKey(id), {
    size: String(meta.size),
    createdAt: String(meta.createdAt),
    ttlSec: String(meta.ttlSec),
  });
  if (users.length) await redis.sadd(roomUsersKey(id), ...users);
  await publish(CHANNEL_ROOM, ROOM_CREATED, { roomId: id });
  for (const uid of users) {
    await publish(CHANNEL_ROOM, ROOM_USER_JOINED, { roomId: id, uid });
  }
  return id;
}

export async function getRooms() {
  const ids = await redis.smembers(ROOMS_SET);
  const rooms: any[] = [];
  for (const id of ids) {
    const metaRaw = await redis.hgetall(roomMetaKey(id));
    const meta: RoomMeta = {
      id,
      size: Number(metaRaw.size || 0),
      createdAt: Number(metaRaw.createdAt || 0),
      ttlSec: Number(metaRaw.ttlSec || 0),
    };
    const uids = await redis.smembers(roomUsersKey(id));
    const users = [];
    for (const uid of uids) {
      users.push(await fetchUser(uid));
    }
    rooms.push({ meta, users });
  }
  return rooms;
}

export async function getRoom(id: string) {
  const metaRaw = await redis.hgetall(roomMetaKey(id));
  if (!metaRaw || Object.keys(metaRaw).length === 0) return null;
  const meta: RoomMeta = {
    id,
    size: Number(metaRaw.size || 0),
    createdAt: Number(metaRaw.createdAt || 0),
    ttlSec: Number(metaRaw.ttlSec || 0),
  };
  const uids = await redis.smembers(roomUsersKey(id));
  const users = [];
  for (const uid of uids) {
    users.push(await fetchUser(uid));
  }
  const messagesRaw = await redis.lrange(roomMessagesKey(id), -50, -1);
  const lastMessages = messagesRaw.map((m) => JSON.parse(m));
  return { meta, users, lastMessages };
}

export async function leaveRoom(id: string, uid: string) {
  await redis.srem(roomUsersKey(id), uid);
  await publish(CHANNEL_ROOM, ROOM_USER_LEFT, { roomId: id, uid });
  const remaining = await redis.scard(roomUsersKey(id));
  if (remaining === 0) {
    await redis.del(roomUsersKey(id));
    await redis.del(roomMessagesKey(id));
    await redis.del(roomMetaKey(id));
    await redis.srem(ROOMS_SET, id);
  }
}

export async function sendMessage(
  roomId: string,
  user: { uid: string; name: string },
  messageId: string,
  text: string,
) {
  const isMember = await redis.sismember(roomUsersKey(roomId), user.uid);
  if (!isMember) {
    throw new Error('USER_NOT_IN_ROOM');
  }
  const cleaned = text.slice(0, 500);
  const msg = {
    messageId,
    eventId: 0,
    ts: Date.now(),
    roomId,
    from: user,
    text: cleaned,
  };
  const event = await publish(CHANNEL_ROOM, CHAT_MESSAGE, { message: { ...msg } });
  msg.eventId = event.eventId;
  await redis.rpush(roomMessagesKey(roomId), JSON.stringify(msg));
  await redis.ltrim(roomMessagesKey(roomId), -50, -1);
}
