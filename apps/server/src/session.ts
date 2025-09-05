import { Request, Response, NextFunction } from 'express';
import redis from './redis.js';

export function isAdmin(uid: string): boolean {
  const list = process.env.ADMIN_EMAILS || '';
  return list.split(',').map(s => s.trim()).filter(Boolean).includes(uid);
}

export function parseCookies(req: Request): Record<string, string> {
  const header = req.headers.cookie;
  const cookies: Record<string, string> = {};
  if (!header) return cookies;
  for (const part of header.split(';')) {
    const [key, ...v] = part.trim().split('=');
    cookies[key] = decodeURIComponent(v.join('='));
  }
  return cookies;
}

export async function requireSession(req: Request, res: Response, next: NextFunction) {
  try {
    const cookies = parseCookies(req);
    const sessionId = cookies['sessionId'];
    if (!sessionId) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Missing session' }, requestId: req.requestId });
    }
    const sessionData = await redis.get(`session:${sessionId}`);
    if (!sessionData) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid session' }, requestId: req.requestId });
    }
    const user = JSON.parse(sessionData) as { uid: string; name: string };
    const currentSession = await redis.get(`user:${user.uid}:session`);
    if (currentSession !== sessionId) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Session expired' }, requestId: req.requestId });
    }
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user || !isAdmin(req.user.uid)) {
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Admin only' }, requestId: req.requestId });
  }
  next();
}
