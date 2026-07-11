import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { getEnv } from '../config/env';

const maxBytes = () => getEnv().MAX_FILE_SIZE_MB * 1024 * 1024;

const storage = multer.memoryStorage();

export const uploadMiddleware = multer({
  storage,
  limits: { fileSize: maxBytes() },
  fileFilter: (_req, file, cb) => {
    const allowed = ['text/csv', 'application/vnd.ms-excel', 'text/plain', 'application/csv'];
    const isCsv =
      allowed.includes(file.mimetype) ||
      file.originalname.toLowerCase().endsWith('.csv');
    if (!isCsv) {
      cb(new Error('Only CSV files are allowed'));
      return;
    }
    cb(null, true);
  },
}).single('file');

export function handleMulterError(
  err: Error,
  _req: Request,
  res: Response,
  next: NextFunction
): void {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({
        error: `File too large. Maximum size is ${getEnv().MAX_FILE_SIZE_MB}MB`,
      });
      return;
    }
    res.status(400).json({ error: err.message });
    return;
  }
  if (err) {
    res.status(400).json({ error: err.message });
    return;
  }
  next();
}
