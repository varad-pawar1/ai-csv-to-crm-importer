import { getEnv } from '../config/env';

export function chunkRows<T>(rows: T[], size?: number): T[][] {
  const batchSize = size ?? getEnv().BATCH_SIZE;
  const batches: T[][] = [];
  for (let i = 0; i < rows.length; i += batchSize) {
    batches.push(rows.slice(i, i + batchSize));
  }
  return batches;
}
