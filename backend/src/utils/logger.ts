import pino from 'pino';
import { getEnv } from '../config/env';

export const logger = pino({
  level: getEnv().NODE_ENV === 'production' ? 'info' : 'debug',
  transport:
    getEnv().NODE_ENV !== 'production'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
});

export function childLogger(bindings: Record<string, unknown>) {
  return logger.child(bindings);
}
