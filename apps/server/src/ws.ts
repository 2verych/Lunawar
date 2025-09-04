import WebSocket, { WebSocketServer } from 'ws';
import type { IncomingMessage } from 'http';
import type { Socket } from 'net';
import type { Application } from 'express';
import redis from './redis.js';

const EPOCH = Number(process.env.EPOCH || 1);
const RETAIN_EVENTS = 100;

interface SessionUser {
  uid: string;
  name: string;
}

interface ExtWebSocket extends WebSocket {
  user: SessionUser;
  channels: Set<string>;
  isAlive: boolean;
}

const clients = new Set<ExtWebSocket>();
let wss: WebSocketServer;

function parseCookies(req: IncomingMessage): Record<string, string> {
  const header = req.headers['cookie'];
  const cookies: Record<string, string> = {};
  if (!header) return cookies;
  for (const part of header.split(';')) {
    const [key, ...v] = part.trim().split('=');
    cookies[key] = decodeURIComponent(v.join('='));
  }
  return cookies;
}

async function getUser(req: IncomingMessage): Promise<SessionUser | null> {
  const cookies = parseCookies(req);
  const sessionId = cookies['sessionId'];
  if (!sessionId) return null;
  const sessionData = await redis.get(`session:${sessionId}`);
  if (!sessionData) return null;
  const user = JSON.parse(sessionData) as SessionUser;
  const currentSession = await redis.get(`user:${user.uid}:session`);
  if (currentSession !== sessionId) return null;
  return user;
}

export function setupWebSocket(_app: Application, server: any) {
  wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', async (req: IncomingMessage, socket: Socket, head: Buffer) => {
    if (req.url !== '/ws') {
      socket.destroy();
      return;
    }
    const user = await getUser(req);
    if (!user) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      const ext = ws as ExtWebSocket;
      ext.user = user;
      ext.channels = new Set();
      ext.isAlive = true;
      clients.add(ext);
      wss.emit('connection', ext, req);
    });
  });

  wss.on('connection', (ws: ExtWebSocket) => {
    ws.once('message', async (raw: WebSocket.RawData) => {
      try {
        const { since, channels } = JSON.parse(raw.toString());
        if (!Array.isArray(channels)) {
          ws.close();
          return;
        }
        channels.forEach((c: string) => ws.channels.add(c));
        if (since && typeof since.lastEventId === 'number') {
          for (const ch of ws.channels) {
            const eventsRaw = await redis.lrange(`events:${ch}`, 0, -1);
            const events = eventsRaw.map((e) => JSON.parse(e));
            const idx = events.findIndex((e) => e.eventId === since.lastEventId);
            if (idx === -1) {
              ws.send(JSON.stringify({ type: 'resync.required' }));
            } else {
              for (const e of events.slice(idx + 1)) {
                ws.send(JSON.stringify(e));
              }
            }
          }
        }
        publish('user', 'user.connected', { user: ws.user });
      } catch {
        ws.close();
      }
    });

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('close', () => {
      clients.delete(ws);
      publish('user', 'user.disconnected', { user: ws.user });
    });
  });

  const interval = setInterval(() => {
    for (const ws of clients) {
      if (!ws.isAlive) {
        ws.terminate();
        continue;
      }
      ws.isAlive = false;
      ws.ping();
    }
  }, 30000);

  wss.on('close', () => {
    clearInterval(interval);
  });
}

export async function publish(channel: string, type: string, payload: any) {
  const eventId = await redis.incr('global:eventId');
  const event = { eventId, epoch: EPOCH, ts: Date.now(), type, payload };
  await redis.rpush(`events:${channel}`, JSON.stringify(event));
  await redis.ltrim(`events:${channel}`, -RETAIN_EVENTS, -1);
  for (const client of clients) {
    if (client.channels.has(channel)) {
      client.send(JSON.stringify(event));
    }
  }
  return event;
}

