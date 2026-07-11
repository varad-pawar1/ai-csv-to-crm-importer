import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import cors from 'cors';
import importRoutes from '../src/routes/import.routes';
import { errorHandler, requestIdMiddleware } from '../src/middleware/errorHandler';
import { setMockExtractor } from '../src/services/aiExtractor.service';
import { connectMongo, disconnectMongo } from '../src/db/mongo';
import { startBatchWorker, stopBatchWorker } from '../src/queue/batch.worker';

// Integration test requires MongoDB + Redis running
const SKIP_INTEGRATION = !process.env.RUN_INTEGRATION_TESTS;

describe.skipIf(SKIP_INTEGRATION)('import API integration', () => {
  let app: express.Application;

  beforeAll(async () => {
    process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/groweasy-test';
    process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
    process.env.BATCH_SIZE = '5';

    await connectMongo();

    setMockExtractor(async (_headers, rows) => ({
      rows: rows.map((row) => ({
        name: row.name || row['Full Name'] || null,
        email: row.email || row.Email || null,
        mobile_without_country_code: row.phone || row.Phone || null,
        city: row.city || null,
        _confidence: { name: 'high' as const, email: 'high' as const },
      })),
    }));

    app = express();
    app.use(cors());
    app.use(express.json());
    app.use(requestIdMiddleware);
    app.use('/api/import', importRoutes);
    app.use(errorHandler);

    startBatchWorker();
  });

  afterAll(async () => {
    await stopBatchWorker();
    setMockExtractor(null);
    await disconnectMongo();
  });

  it('creates import job and returns jobId', async () => {
    const csv = 'name,email,phone\nJohn Doe,john@test.com,9876543210\nJane,jane@test.com,1234567890';

    const res = await request(app)
      .post('/api/import')
      .attach('file', Buffer.from(csv), 'test.csv');

    expect(res.status).toBe(201);
    expect(res.body.jobId).toBeDefined();
    expect(res.body.totalRows).toBe(2);
  });

  it('rejects non-CSV files', async () => {
    const res = await request(app)
      .post('/api/import')
      .attach('file', Buffer.from('not csv'), 'test.txt');

    expect(res.status).toBe(400);
  });
});
