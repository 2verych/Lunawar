import redis from './redis.js';
import {
  LOBBY_QUEUE,
  CONFIG_AUTO_MATCH,
  CONFIG_ROOM_SIZE,
} from '@lunawar/shared/src/redisKeys.js';
import {
  CHANNEL_LOBBY,
  LOBBY_JOINED,
} from '@lunawar/shared/src/events.js';
import { publish } from './ws.js';
import { createRoom } from './rooms.js';

async function fetchUser(uid: string) {
  const sessionId = await redis.get(`user:${uid}:session`);
  if (!sessionId) return { uid, name: uid };
  const sessionData = await redis.get(`session:${sessionId}`);
  if (!sessionData) return { uid, name: uid };
  return JSON.parse(sessionData);
}

export async function getConfig() {
  const roomSizeRaw = await redis.get(CONFIG_ROOM_SIZE);
  const autoMatchRaw = await redis.get(CONFIG_AUTO_MATCH);
  const defaultRoomSize = process.env.CONFIG_ROOM_SIZE_DEFAULT || '0';
  const defaultAutoMatch = process.env.CONFIG_AUTO_MATCH_DEFAULT === 'true';
  const roomSize = parseInt(roomSizeRaw ?? defaultRoomSize);
  const autoMatch = autoMatchRaw === null ? defaultAutoMatch : autoMatchRaw === 'true';
  return { roomSize, autoMatch };
}

export async function getLobbySnapshot() {
  const uids = await redis.lrange(LOBBY_QUEUE, 0, -1);
  const users = [];
  for (const uid of uids) {
    users.push(await fetchUser(uid));
  }
  const { roomSize, autoMatch } = await getConfig();
  return { users, config: { roomSize, autoMatch } };
}

export async function joinLobby(uid: string) {
  await redis.lrem(LOBBY_QUEUE, 0, uid);
  await redis.rpush(LOBBY_QUEUE, uid);

  const { autoMatch, roomSize } = await getConfig();
  if (autoMatch && roomSize > 0) {
    const len = await redis.llen(LOBBY_QUEUE);
    if (len >= roomSize) {
      const users = await redis.lrange(LOBBY_QUEUE, 0, roomSize - 1);
      await redis.ltrim(LOBBY_QUEUE, roomSize, -1);
      await createRoom(users);
    }
  }

  await publish(CHANNEL_LOBBY, LOBBY_JOINED, { snapshot: await getLobbySnapshot() });
}

export async function leaveLobby(uid: string) {
  await redis.lrem(LOBBY_QUEUE, 0, uid);
  await publish(CHANNEL_LOBBY, LOBBY_JOINED, { snapshot: await getLobbySnapshot() });
}
