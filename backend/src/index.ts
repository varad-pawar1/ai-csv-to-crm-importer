import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { getEnv } from './config/env';
import { connectMongo } from './db/mongo';
import importRoutes from './routes/import.routes';
import { requestIdMiddleware, errorHandler } from './middleware/errorHandler';
import { startBatchWorker } from './queue/batch.worker';
import { logger } from './utils/logger';

async function main(): Promise<void> {
  const env = getEnv();
  await connectMongo();

  const app = express();

  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(express.json());
  app.use(requestIdMiddleware);

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.use('/api/import', importRoutes);
  app.use(errorHandler);

  startBatchWorker();

  app.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, 'GrowEasy CSV Importer API running');
  });
}

main().catch((err) => {
  logger.fatal({ err }, 'Failed to start server');
  process.exit(1);
});
