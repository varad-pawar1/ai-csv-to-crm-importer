import { Response } from 'express';
import { QueueEvents } from 'bullmq';
import { Types } from 'mongoose';
import { ImportJob, BatchLog } from '../models';
import { getRedisConnection, BATCH_QUEUE_NAME } from '../queue/connection';
import { ImportProgress } from '../types/crm.types';
import { AppError } from '../middleware/errorHandler';

const activeStreams = new Map<string, Set<Response>>();
const POLL_INTERVAL_MS = 2000;

export async function buildProgressSnapshot(jobId: string): Promise<ImportProgress> {
  const job = await ImportJob.findById(jobId);
  if (!job) throw new AppError(404, 'Import job not found');

  const failedBatches = await BatchLog.find({
    importJobId: new Types.ObjectId(jobId),
    status: 'failed',
  }).select('batchIndex error');

  const activeBatch = await BatchLog.findOne({
    importJobId: new Types.ObjectId(jobId),
    status: 'active',
  }).select('batchIndex');

  const progress: ImportProgress = {
    jobId: job._id.toString(),
    status: job.status,
    batchesTotal: job.batchesTotal,
    batchesDone: job.batchesDone,
    importedCount: job.importedCount,
    skippedCount: job.skippedCount,
    totalRows: job.totalRows,
    failedBatches: failedBatches.map((b) => ({
      batchIndex: b.batchIndex,
      error: b.error ?? 'Unknown error',
    })),
  };

  if (activeBatch) {
    progress.activeBatchIndex = activeBatch.batchIndex;
  }

  return progress;
}

function sendSseEvent(res: Response, event: string, data: unknown): void {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
  if (typeof (res as Response & { flush?: () => void }).flush === 'function') {
    (res as Response & { flush: () => void }).flush();
  }
}

function progressFingerprint(p: ImportProgress): string {
  return `${p.status}|${p.batchesDone}|${p.batchesTotal}|${p.importedCount}|${p.skippedCount}|${p.failedBatches.length}|${p.activeBatchIndex ?? ''}`;
}

export async function streamImportProgress(jobId: string, res: Response): Promise<void> {
  const job = await ImportJob.findById(jobId);
  if (!job) throw new AppError(404, 'Import job not found');

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  if (!activeStreams.has(jobId)) {
    activeStreams.set(jobId, new Set());
  }
  activeStreams.get(jobId)!.add(res);

  let lastFingerprint = '';

  const pushSnapshot = async (eventName = 'progress') => {
    const snapshot = await buildProgressSnapshot(jobId);
    const fp = progressFingerprint(snapshot);
    if (fp !== lastFingerprint || eventName === 'done') {
      lastFingerprint = fp;
      sendSseEvent(res, eventName, snapshot);
    }
    return snapshot;
  };

  const snapshot = await pushSnapshot();
  if (snapshot.status === 'done' || snapshot.status === 'failed') {
    sendSseEvent(res, 'done', snapshot);
    cleanupStream(jobId, res);
    return;
  }

  const queueEvents = new QueueEvents(BATCH_QUEUE_NAME, {
    connection: getRedisConnection(),
  });

  const onQueueEvent = async () => {
    const progress = await pushSnapshot();
    if (progress.status === 'done' || progress.status === 'failed') {
      sendSseEvent(res, 'done', progress);
    }
  };

  const onFailed = async ({ jobId: bullJobId, failedReason }: { jobId: string; failedReason: string }) => {
    if (!bullJobId.startsWith(jobId)) return;
    const batchIndex = parseInt(bullJobId.split('-').pop() ?? '0', 10);
    broadcastToJob(jobId, 'batch-failed', { batchIndex, error: failedReason });
    await onQueueEvent();
  };

  queueEvents.on('progress', onQueueEvent);
  queueEvents.on('failed', onFailed);
  queueEvents.on('completed', onQueueEvent);
  queueEvents.on('active', onQueueEvent);

  const pollInterval = setInterval(() => {
    void pushSnapshot();
  }, POLL_INTERVAL_MS);

  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 15000);

  res.on('close', () => {
    clearInterval(pollInterval);
    clearInterval(heartbeat);
    queueEvents.off('progress', onQueueEvent);
    queueEvents.off('failed', onFailed);
    queueEvents.off('completed', onQueueEvent);
    queueEvents.off('active', onQueueEvent);
    void queueEvents.close();
    cleanupStream(jobId, res);
  });
}

function broadcastToJob(jobId: string, event: string, data: unknown): void {
  const streams = activeStreams.get(jobId);
  if (!streams) return;
  for (const stream of streams) {
    sendSseEvent(stream, event, data);
  }
}

function cleanupStream(jobId: string, res: Response): void {
  const streams = activeStreams.get(jobId);
  if (streams) {
    streams.delete(res);
    if (streams.size === 0) activeStreams.delete(jobId);
  }
  res.end();
}
