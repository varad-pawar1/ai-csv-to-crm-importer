import { Router } from 'express';
import {
  createImport,
  getImportStream,
  getImportResults,
  exportImportResults,
} from '../controllers/import.controller';
import { uploadMiddleware, handleMulterError } from '../middleware/upload.middleware';

const router = Router();

router.post('/', uploadMiddleware, handleMulterError, createImport);
router.get('/:jobId/stream', getImportStream);
router.get('/:jobId/results', getImportResults);
router.get('/:jobId/export', exportImportResults);

export default router;
