import express, { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import redis from './redis.js';
import { LOBBY_QUEUE, CONFIG_ROOM_SIZE, CONFIG_AUTO_MATCH } from '@lunawar/shared/src/redisKeys.js';
import { errorHandler } from './errorHandler.js';
import { requireSession, requireAdmin, isAdmin } from './session.js';
import {
  joinLobby,
  leaveLobby,
  getLobbySnapshot,
  getConfig,
} from './lobby.js';
import {
  createRoom,
  getRooms,
  getRoom,
  leaveRoom,
  sendMessage,
} from './rooms.js';
import { CHANNEL_LOBBY, LOBBY_JOINED } from '@lunawar/shared/src/events.js';
import { publish } from './ws.js';

export function createApp() {
  const app = express();

  const sessionTtlMs = Number(process.env.SESSION_TTL) || 7 * 24 * 60 * 60 * 1000;
  const sessionTtlSec = Math.floor(sessionTtlMs / 1000);

  app.use(express.json());
  app.use((req, _res, next) => {
    req.requestId = randomUUID();
    next();
  });
  app.use((req, res, next) => {
    console.log(`[${req.requestId}] ${req.method} ${req.originalUrl}`);
    res.on('finish', () => {
      console.log(`[${req.requestId}] ${res.statusCode}`);
    });
    next();
  });

  app.get('/health', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      await redis.ping();
      res.json({ status: 'ok' });
    } catch (err) {
      next(err);
    }
  });

  app.post('/auth/google', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id_token: idToken } = req.body || {};
      console.log('[auth/google] received id_token', idToken);
      console.log('[auth/google] expected GOOGLE_CLIENT_ID', process.env.GOOGLE_CLIENT_ID);
      if (!idToken) {
        return res
          .status(400)
          .json({ error: { code: 'BAD_REQUEST', message: 'id_token required' }, requestId: req.requestId });
      }
      const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`);
      console.log('[auth/google] tokeninfo response status', response.status);
      if (!response.ok) {
        return res
          .status(401)
          .json({ error: { code: 'INVALID_TOKEN', message: 'Unable to verify token' }, requestId: req.requestId });
      }
      const tokenInfo = await response.json();
      console.log('[auth/google] tokenInfo', tokenInfo);
      if (tokenInfo.aud !== process.env.GOOGLE_CLIENT_ID) {
        return res
          .status(401)
          .json({ error: { code: 'INVALID_TOKEN', message: 'Invalid audience' }, requestId: req.requestId });
      }
      const email = tokenInfo.email as string;
      const name = (tokenInfo.name as string) || 'Noname';
      const sessionId = randomUUID();

      const existingSession = await redis.get(`user:${email}:session`);
      if (existingSession) {
        await redis.del(`session:${existingSession}`);
        await redis.lrem('lobby:queue', 0, email);
        const roomKeys = await redis.keys('room:*:users');
        for (const key of roomKeys) {
          await redis.srem(key, email);
          await redis.lrem(key, 0, email);
        }
      }

      await redis.set(`user:${email}:session`, sessionId, 'EX', sessionTtlSec);
      await redis.set(`session:${sessionId}`, JSON.stringify({ uid: email, name }), 'EX', sessionTtlSec);

      res.cookie('sessionId', sessionId, {
        maxAge: sessionTtlMs,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        httpOnly: true,
      });
      res.json({ user: { uid: email, name } });
    } catch (err) {
      next(err);
    }
  });

  app.post('/admin/auth/google', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id_token: idToken } = req.body || {};
      if (!idToken) {
        return res
          .status(400)
          .json({ error: { code: 'BAD_REQUEST', message: 'id_token required' }, requestId: req.requestId });
      }
      const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`);
      if (!response.ok) {
        return res
          .status(401)
          .json({ error: { code: 'INVALID_TOKEN', message: 'Unable to verify token' }, requestId: req.requestId });
      }
      const tokenInfo = await response.json();
      if (tokenInfo.aud !== process.env.GOOGLE_CLIENT_ID) {
        return res
          .status(401)
          .json({ error: { code: 'INVALID_TOKEN', message: 'Invalid audience' }, requestId: req.requestId });
      }
      const email = tokenInfo.email as string;
      if (!isAdmin(email)) {
        return res
          .status(403)
          .json({ error: { code: 'FORBIDDEN', message: 'Admin only' }, requestId: req.requestId });
      }
      const name = (tokenInfo.name as string) || 'Noname';
      const sessionId = randomUUID();

      const existingSession = await redis.get(`user:${email}:session`);
      if (existingSession) {
        await redis.del(`session:${existingSession}`);
        await redis.lrem('lobby:queue', 0, email);
        const roomKeys = await redis.keys('room:*:users');
        for (const key of roomKeys) {
          await redis.srem(key, email);
          await redis.lrem(key, 0, email);
        }
      }

      await redis.set(`user:${email}:session`, sessionId, 'EX', sessionTtlSec);
      await redis.set(`session:${sessionId}`, JSON.stringify({ uid: email, name }), 'EX', sessionTtlSec);

      res.cookie('sessionId', sessionId, {
        maxAge: sessionTtlMs,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        httpOnly: true,
      });
      res.json({ user: { uid: email, name } });
    } catch (err) {
      next(err);
    }
  });

  app.post('/auth/logout', requireSession, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const uid = req.user!.uid;
      const sessionId = await redis.get(`user:${uid}:session`);
      if (sessionId) {
        await redis.del(`session:${sessionId}`);
        await redis.del(`user:${uid}:session`);
      }

      await leaveLobby(uid);
      const roomKeys = await redis.keys('room:*:users');
      for (const key of roomKeys) {
        const isMember = await redis.sismember(key, uid);
        if (isMember) {
          const id = key.split(':')[1];
          await leaveRoom(id, uid);
        }
      }

      res.clearCookie('sessionId');
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  app.get('/me', requireSession, (req: Request, res: Response) => {
    res.json({ user: req.user });
  });

  app.get('/lobby', requireSession, async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const snapshot = await getLobbySnapshot();
      res.json({ snapshot });
    } catch (err) {
      next(err);
    }
  });

  app.post('/lobby/join', requireSession, async (req: Request, res: Response, next: NextFunction) => {
    try {
      await joinLobby(req.user!.uid);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  app.post('/lobby/leave', requireSession, async (req: Request, res: Response, next: NextFunction) => {
    try {
      await leaveLobby(req.user!.uid);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  app.get('/rooms', requireSession, async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const rooms = await getRooms();
      res.json({ rooms });
    } catch (err) {
      next(err);
    }
  });

  app.get('/rooms/:roomId', requireSession, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const room = await getRoom(req.params.roomId);
      if (!room) {
        return res
          .status(404)
          .json({ error: { code: 'NOT_FOUND', message: 'Room not found' }, requestId: req.requestId });
      }
      res.json(room);
    } catch (err) {
      next(err);
    }
  });

  app.post('/rooms/:roomId/leave', requireSession, async (req: Request, res: Response, next: NextFunction) => {
    try {
      await leaveRoom(req.params.roomId, req.user!.uid);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  app.post('/rooms/:roomId/chat.send', requireSession, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { messageId, text } = req.body || {};
      if (
        typeof messageId !== 'string' ||
        messageId.length === 0 ||
        messageId.length > 64 ||
        typeof text !== 'string' ||
        text.length === 0 ||
        text.length > 500
      ) {
        return res
          .status(400)
          .json({ error: { code: 'BAD_REQUEST', message: 'Invalid message' }, requestId: req.requestId });
      }
      await sendMessage(req.params.roomId, req.user!, messageId, text);
      res.json({ accepted: true });
    } catch (err) {
      next(err);
    }
  });

  app.get('/admin/me', requireSession, requireAdmin, async (req: Request, res: Response) => {
    res.json({ user: req.user });
  });

  app.get('/admin/lobby', requireSession, requireAdmin, async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const snapshot = await getLobbySnapshot();
      res.json({ snapshot });
    } catch (err) {
      next(err);
    }
  });

  app.get('/admin/rooms', requireSession, requireAdmin, async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const rooms = await getRooms();
      res.json({ rooms });
    } catch (err) {
      next(err);
    }
  });

  app.post('/admin/config.set', requireSession, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { roomSize, autoMatch } = req.body || {};
      if (
        typeof roomSize !== 'number' ||
        !Number.isInteger(roomSize) ||
        roomSize < 0 ||
        typeof autoMatch !== 'boolean'
      ) {
        return res
          .status(400)
          .json({ error: { code: 'BAD_REQUEST', message: 'Invalid config' }, requestId: req.requestId });
      }
      await redis.set(CONFIG_ROOM_SIZE, String(roomSize));
      await redis.set(CONFIG_AUTO_MATCH, autoMatch ? 'true' : 'false');
      await publish(CHANNEL_LOBBY, LOBBY_JOINED, { snapshot: await getLobbySnapshot() });
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  app.post('/admin/room.create', requireSession, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
    try {
      let users: string[] = req.body?.uids;
      if (!Array.isArray(users) || users.length === 0) {
        const { roomSize } = await getConfig();
        users = await redis.lrange(LOBBY_QUEUE, 0, roomSize - 1);
        if (users.length) {
          await redis.ltrim(LOBBY_QUEUE, users.length, -1);
        }
      } else {
        for (const uid of users) {
          await redis.lrem(LOBBY_QUEUE, 0, uid);
        }
      }
      if (users.length === 0) {
        return res
          .status(400)
          .json({ error: { code: 'BAD_REQUEST', message: 'No users for room' }, requestId: req.requestId });
      }
      const roomId = await createRoom(users);
      res.json({ roomId });
    } catch (err) {
      next(err);
    }
  });

  app.use(errorHandler);

  return app;
}
