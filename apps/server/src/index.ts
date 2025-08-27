import express, { Request, Response, NextFunction } from 'express';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import redis from './redis.js';
import { errorHandler } from './errorHandler.js';
import { requireSession } from './session.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

config({ path: path.resolve(__dirname, '../../../.env') });

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use((req, _res, next) => {
  req.requestId = randomUUID();
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
    if (!idToken) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'id_token required' }, requestId: req.requestId });
    }
    const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`);
    if (!response.ok) {
      return res.status(401).json({ error: { code: 'INVALID_TOKEN', message: 'Unable to verify token' }, requestId: req.requestId });
    }
    const tokenInfo = await response.json();
    if (tokenInfo.aud !== process.env.GOOGLE_CLIENT_ID) {
      return res.status(401).json({ error: { code: 'INVALID_TOKEN', message: 'Invalid audience' }, requestId: req.requestId });
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

app.get('/me', requireSession, (req: Request, res: Response) => {
  res.json({ user: req.user });
});

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
