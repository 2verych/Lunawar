import express, { Request, Response, NextFunction } from 'express';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import redis from './redis.js';
import { errorHandler } from './errorHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

config({ path: path.resolve(__dirname, '../../../.env') });

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/health', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    await redis.ping();
    res.json({ status: 'ok' });
  } catch (err) {
    next(err);
  }
});

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
