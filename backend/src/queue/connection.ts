import { getEnv } from '../config/env';

export const BATCH_QUEUE_NAME = 'csv-import-batches';

export function getRedisConnection() {
  const env = getEnv();

  const shared = {
    maxRetriesPerRequest: null,
    connectTimeout: 30_000,
    commandTimeout: 30_000,
    family: 4,
    retryStrategy: (times: number) => Math.min(times * 500, 5_000),
    reconnectOnError: (err: Error) => err.message.includes('READONLY'),
  };

  if (env.QUEUE_REDIS_HOST) {
    return {
      ...shared,
      host: env.QUEUE_REDIS_HOST,
      port: env.QUEUE_REDIS_PORT ?? 6379,
      username: env.QUEUE_REDIS_USERNAME || undefined,
      password: env.QUEUE_REDIS_PASSWORD || undefined,
      ...(env.REDIS_TLS
        ? { tls: { rejectUnauthorized: false } }
        : {}),
    };
  }

  const url = new URL(env.REDIS_URL!);
  const useTls = url.protocol === 'rediss:' || env.REDIS_TLS;

  return {
    ...shared,
    host: url.hostname,
    port: Number(url.port) || 6379,
    username: url.username ? decodeURIComponent(url.username) : undefined,
    password: url.password ? decodeURIComponent(url.password) : undefined,
    ...(useTls ? { tls: { rejectUnauthorized: false } } : {}),
  };
}
