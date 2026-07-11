import { Worker, Job } from 'bullmq';
import { Types } from 'mongoose';
import { getRedisConnection, BATCH_QUEUE_NAME } from './connection';
import { BatchJobData } from '../types/crm.types';
import { ImportJob, LeadRecord, BatchLog } from '../models';
import { extractCrmRecordsWithMock } from '../services/aiExtractor.service';
import { mapToCrmRecord } from '../services/crmMapper.service';
import { childLogger } from '../utils/logger';
import { getEnv } from '../config/env';

let worker: Worker<BatchJobData> | null = null;

async function processBatch(job: Job<BatchJobData>): Promise<void> {
  const { importJobId, batchIndex, headers, rows, dedupPolicy } = job.data;
  const log = childLogger({ importJobId, batchIndex, jobId: job.id });

  await BatchLog.updateOne(
    { importJobId: new Types.ObjectId(importJobId), batchIndex },
    { $set: { status: 'active', retryCount: job.attemptsMade } }
  );

  await ImportJob.updateOne(
    { _id: importJobId },
    { $set: { status: 'processing' } }
  );

  log.info({ rowCount: rows.length }, 'Processing batch');

  await job.updateProgress({
    phase: 'llm_processing',
    batchIndex,
    rowCount: rows.length,
    message: `AI mapping ${rows.length} rows...`,
  });

  const { rows: llmRows } = await extractCrmRecordsWithMock(headers, rows);

  let imported = 0;
  let skipped = 0;
  const startRowIndex = batchIndex * getEnv().BATCH_SIZE;

  const leadDocs = llmRows.map((raw, i) => {
    const mapped = mapToCrmRecord(raw);
    if (mapped._skipped) skipped++;
    else imported++;

    return {
      importJobId: new Types.ObjectId(importJobId),
      mappedData: mapped,
      skipped: mapped._skipped,
      skipReason: mapped._skip_reason,
      rowIndex: startRowIndex + i,
    };
  });

  if (dedupPolicy === 'merge') {
    const seen = new Map<string, number>();
    for (let i = 0; i < leadDocs.length; i++) {
      const data = leadDocs[i].mappedData as { email?: string | null; mobile_without_country_code?: string | null };
      const key = data.email || data.mobile_without_country_code || '';
      if (key && seen.has(key)) {
        const prevIdx = seen.get(key)!;
        const prev = leadDocs[prevIdx]!.mappedData as unknown as Record<string, unknown>;
        const curr = leadDocs[i]!.mappedData as unknown as Record<string, unknown>;
        for (const [k, v] of Object.entries(curr)) {
          if (v && !prev[k] && k !== '_skipped' && k !== '_skip_reason') {
            prev[k] = v;
          }
        }
        leadDocs[i].skipped = true;
        leadDocs[i].skipReason = 'Merged duplicate into earlier row';
        leadDocs[i].mappedData = { ...leadDocs[i].mappedData, _skipped: true, _skip_reason: 'Merged duplicate' };
        if (!leadDocs[prevIdx].skipped) {
          skipped++;
          imported--;
        }
      } else if (key) {
        seen.set(key, i);
      }
    }
  }

  await LeadRecord.insertMany(leadDocs);

  await BatchLog.updateOne(
    { importJobId: new Types.ObjectId(importJobId), batchIndex },
    { $set: { status: 'done', error: null } }
  );

  const jobDoc = await ImportJob.findByIdAndUpdate(
    importJobId,
    {
      $inc: {
        importedCount: imported,
        skippedCount: skipped,
        batchesDone: 1,
      },
    },
    { new: true }
  );

  if (!jobDoc) throw new Error('Import job not found');

  const allBatchesDone = jobDoc.batchesDone >= jobDoc.batchesTotal;
  if (allBatchesDone) {
    const failedCount = await BatchLog.countDocuments({
      importJobId: new Types.ObjectId(importJobId),
      status: 'failed',
    });
    await ImportJob.updateOne(
      { _id: importJobId },
      { $set: { status: failedCount > 0 && jobDoc.importedCount === 0 ? 'failed' : 'done' } }
    );
  }

  await job.updateProgress({
    batchesDone: jobDoc.batchesDone,
    batchesTotal: jobDoc.batchesTotal,
    importedCount: jobDoc.importedCount,
    skippedCount: jobDoc.skippedCount,
  });

  log.info({ imported, skipped }, 'Batch complete');
}

export function startBatchWorker(): Worker<BatchJobData> {
  if (worker) return worker;

  worker = new Worker<BatchJobData>(
    BATCH_QUEUE_NAME,
    async (job) => processBatch(job),
    {
      connection: getRedisConnection(),
      concurrency: 5,
    }
  );

  worker.on('error', (err) => {
    childLogger({ component: 'batch-worker' }).error({ err: err.message }, 'Worker Redis error');
  });

  worker.on('failed', async (job, err) => {
    if (!job) return;
    const { importJobId, batchIndex } = job.data;
    const maxAttempts = typeof job.opts.attempts === 'number' ? job.opts.attempts : 3;
    const isFinalFailure = job.attemptsMade >= maxAttempts;

    if (isFinalFailure) {
      await BatchLog.updateOne(
        { importJobId: new Types.ObjectId(importJobId), batchIndex },
        { $set: { status: 'failed', error: err.message, retryCount: job.attemptsMade } }
      );

      const jobDoc = await ImportJob.findByIdAndUpdate(
        importJobId,
        { $inc: { batchesDone: 1 } },
        { new: true }
      );

      if (jobDoc && jobDoc.batchesDone >= jobDoc.batchesTotal) {
        await ImportJob.updateOne({ _id: importJobId }, { $set: { status: 'done' } });
      }
    }
  });

  return worker;
}

export async function stopBatchWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
  }
}
