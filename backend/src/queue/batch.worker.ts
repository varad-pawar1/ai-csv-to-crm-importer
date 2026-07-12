import { Worker, Job } from 'bullmq';
import { Types } from 'mongoose';
import { getRedisConnection, BATCH_QUEUE_NAME } from './connection';
import { BatchJobData } from '../types/crm.types';
import { ImportJob, LeadRecord, BatchLog } from '../models';
import { extractCrmRecordsWithMock } from '../services/aiExtractor.service';
import {
  mapToCrmRecord,
  deduplicateBatchLeads,
  MappedLeadDoc,
} from '../services/crmMapper.service';
import { childLogger } from '../utils/logger';

let worker: Worker<BatchJobData> | null = null;

async function clearPreviousBatchRecords(
  importJobId: string,
  startRowIndex: number,
  rowCount: number
): Promise<{ prevImported: number; prevSkipped: number }> {
  const endRowIndex = startRowIndex + rowCount - 1;
  const existing = await LeadRecord.find({
    importJobId: new Types.ObjectId(importJobId),
    rowIndex: { $gte: startRowIndex, $lte: endRowIndex },
  });

  if (existing.length === 0) {
    return { prevImported: 0, prevSkipped: 0 };
  }

  const prevImported = existing.filter((r) => !r.skipped).length;
  const prevSkipped = existing.filter((r) => r.skipped).length;

  await LeadRecord.deleteMany({
    importJobId: new Types.ObjectId(importJobId),
    rowIndex: { $gte: startRowIndex, $lte: endRowIndex },
  });

  if (prevImported > 0 || prevSkipped > 0) {
    await ImportJob.updateOne(
      { _id: importJobId },
      { $inc: { importedCount: -prevImported, skippedCount: -prevSkipped } }
    );
  }

  return { prevImported, prevSkipped };
}

async function processBatch(job: Job<BatchJobData>): Promise<void> {
  const { importJobId, batchIndex, startRowIndex, headers, rows, dedupPolicy } = job.data;
  const log = childLogger({ importJobId, batchIndex, jobId: job.id });

  await BatchLog.updateOne(
    { importJobId: new Types.ObjectId(importJobId), batchIndex },
    { $set: { status: 'active', retryCount: job.attemptsMade } }
  );

  await ImportJob.updateOne(
    { _id: importJobId },
    { $set: { status: 'processing' } }
  );

  log.info({ rowCount: rows.length, startRowIndex }, 'Processing batch');

  await job.updateProgress({
    phase: 'llm_processing',
    batchIndex,
    rowCount: rows.length,
    message: `AI mapping ${rows.length} rows...`,
  });

  const cleared = await clearPreviousBatchRecords(importJobId, startRowIndex, rows.length);
  if (cleared.prevImported + cleared.prevSkipped > 0) {
    log.info(cleared, 'Cleared previous batch records before retry');
  }

  const { rows: llmRows } = await extractCrmRecordsWithMock(headers, rows);

  if (llmRows.length !== rows.length) {
    throw new Error(`LLM returned ${llmRows.length} records, expected ${rows.length}`);
  }

  let leadDocs: MappedLeadDoc[] = llmRows.map((raw, i) => {
    const mapped = mapToCrmRecord(raw);
    return {
      mappedData: mapped,
      skipped: mapped._skipped,
      skipReason: mapped._skip_reason,
      rowIndex: startRowIndex + i,
    };
  });

  leadDocs = dedupPolicy === 'merge' ? deduplicateBatchLeads(leadDocs, dedupPolicy) : leadDocs;

  let imported = 0;
  let skipped = 0;
  for (const doc of leadDocs) {
    if (doc.skipped) skipped++;
    else imported++;
  }

  await LeadRecord.insertMany(
    leadDocs.map((doc) => ({
      importJobId: new Types.ObjectId(importJobId),
      mappedData: doc.mappedData,
      skipped: doc.skipped,
      skipReason: doc.skipReason,
      rowIndex: doc.rowIndex,
    }))
  );

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
