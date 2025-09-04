import express, { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import redis from './redis.js';
import { errorHandler } from './errorHandler.js';
import { requireSession } from './session.js';
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
} from './rooms.js';
import {
  LOBBY_QUEUE,
} from '@lunawar/shared/src/redisKeys.js';

export function createApp() {
  const app = express();

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

      await redis.set(`user:${email}:session`, sessionId);
      await redis.set(`session:${sessionId}`, JSON.stringify({ uid: email, name }));

      res.cookie('sessionId', sessionId, { httpOnly: true, sameSite: 'lax' });
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
      await redis.lrem(LOBBY_QUEUE, 0, uid);
      const roomKeys = await redis.keys('room:*:users');
      for (const key of roomKeys) {
        await redis.srem(key, uid);
        await redis.lrem(key, 0, uid);
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

  app.post('/admin/room.create', requireSession, async (req: Request, res: Response, next: NextFunction) => {
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
