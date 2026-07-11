import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

export interface RequestWithId extends Request {
  requestId?: string;
}

export function requestIdMiddleware(req: RequestWithId, _res: Response, next: NextFunction): void {
  req.requestId = (req.headers['x-request-id'] as string) || uuidv4();
  next();
}

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(
  err: Error,
  req: RequestWithId,
  res: Response,
  _next: NextFunction
): void {
  const requestId = req.requestId ?? 'unknown';

  if (err instanceof AppError) {
    logger.warn({ requestId, err: err.message, code: err.code }, 'App error');
    res.status(err.statusCode).json({ error: err.message, code: err.code, requestId });
    return;
  }

  logger.error({ requestId, err: err.message, stack: err.stack }, 'Unhandled error');
  res.status(500).json({
    error: 'Internal server error',
    requestId,
  });
}
