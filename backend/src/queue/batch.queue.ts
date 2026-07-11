import { Queue } from 'bullmq';
import { getRedisConnection, BATCH_QUEUE_NAME } from './connection';
import { BatchJobData } from '../types/crm.types';

let batchQueue: Queue<BatchJobData> | null = null;

export function getBatchQueue(): Queue<BatchJobData> {
  if (!batchQueue) {
    batchQueue = new Queue<BatchJobData>(BATCH_QUEUE_NAME, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    });
  }
  return batchQueue;
}

export async function enqueueBatches(
  importJobId: string,
  headers: string[],
  batches: Record<string, string>[][],
  dedupPolicy: 'keep_both' | 'merge'
): Promise<void> {
  const queue = getBatchQueue();
  const jobs = batches.map((rows, batchIndex) => ({
    name: `batch-${importJobId}-${batchIndex}`,
    data: { importJobId, batchIndex, headers, rows, dedupPolicy },
    opts: { jobId: `${importJobId}-${batchIndex}` },
  }));
  await queue.addBulk(jobs);
}
