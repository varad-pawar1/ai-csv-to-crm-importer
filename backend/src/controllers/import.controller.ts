import Papa from 'papaparse';
import { Types } from 'mongoose';
import { Request, Response, NextFunction } from 'express';
import { ImportJob, LeadRecord, BatchLog } from '../models';
import { parseCsvContent, CsvParseError } from '../services/csvParser.service';
import { chunkRows } from '../services/batcher.service';
import { enqueueBatches } from '../queue/batch.queue';
import { streamImportProgress, buildProgressSnapshot } from '../services/sse.service';
import { getExportHeaders, recordToExportRow } from '../services/crmMapper.service';
import { CrmRecord, DedupPolicy } from '../types/crm.types';
import { AppError, RequestWithId } from '../middleware/errorHandler';
import { getEnv } from '../config/env';
import { childLogger } from '../utils/logger';

function getJobIdParam(req: Request): string {
  const id = req.params.jobId;
  return Array.isArray(id) ? id[0] : id;
}

function computeBatchSize(headers: string[]): number {
  const max = getEnv().BATCH_SIZE;
  if (headers.length > 25) return Math.min(5, max);
  if (headers.length > 15) return Math.min(8, max);
  if (headers.length > 10) return Math.min(12, max);
  return max;
}

export async function createImport(req: RequestWithId, res: Response, next: NextFunction): Promise<void> {
  const log = childLogger({ requestId: req.requestId });
  try {
    const file = req.file;
    if (!file) throw new AppError(400, 'No file uploaded');

    const dedupPolicy = (req.body.dedupPolicy as DedupPolicy) || 'keep_both';
    if (!['keep_both', 'merge'].includes(dedupPolicy)) {
      throw new AppError(400, 'Invalid dedupPolicy');
    }

    const content = file.buffer.toString('utf-8');
    const { headers, rows } = parseCsvContent(content);
    const batchSize = computeBatchSize(headers);
    const batches = chunkRows(rows, batchSize);

    const importJob = await ImportJob.create({
      filename: file.originalname,
      status: 'queued',
      totalRows: rows.length,
      batchesTotal: batches.length,
      dedupPolicy,
      headers,
      rawRows: rows,
    });

    const batchLogs = batches.map((_, batchIndex) => ({
      importJobId: importJob._id,
      batchIndex,
      status: 'pending' as const,
    }));
    await BatchLog.insertMany(batchLogs);

    await enqueueBatches(importJob._id.toString(), headers, batches, dedupPolicy);

    log.info({ jobId: importJob._id.toString(), rows: rows.length, batches: batches.length }, 'Import job created');

    res.status(201).json({
      jobId: importJob._id.toString(),
      totalRows: rows.length,
      batchesTotal: batches.length,
    });
  } catch (err) {
    if (err instanceof CsvParseError) {
      next(new AppError(400, err.message));
      return;
    }
    next(err);
  }
}

export async function getImportStream(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const jobId = getJobIdParam(req);
    if (!Types.ObjectId.isValid(jobId)) {
      throw new AppError(400, 'Invalid job ID');
    }
    await streamImportProgress(jobId, res);
  } catch (err) {
    next(err);
  }
}

export async function getImportResults(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const jobId = getJobIdParam(req);
    if (!Types.ObjectId.isValid(jobId)) {
      throw new AppError(400, 'Invalid job ID');
    }

    const job = await ImportJob.findById(jobId);
    if (!job) throw new AppError(404, 'Import job not found');

    const records = await LeadRecord.find({ importJobId: job._id })
      .sort({ rowIndex: 1 })
      .lean();

    const imported = records.filter((r) => !r.skipped);
    const skipped = records.filter((r) => r.skipped);
    const progress = await buildProgressSnapshot(jobId);

    res.json({
      summary: {
        totalRows: job.totalRows,
        importedCount: job.importedCount,
        skippedCount: job.skippedCount,
        status: job.status,
        failedBatches: progress.failedBatches,
      },
      imported: imported.map((r) => r.mappedData as unknown as CrmRecord),
      skipped: skipped.map((r) => ({
        ...(r.mappedData as unknown as CrmRecord),
        _skip_reason: r.skipReason,
      })),
    });
  } catch (err) {
    next(err);
  }
}

export async function exportImportResults(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const jobId = getJobIdParam(req);
    const format = (req.query.format as string) || 'csv';

    if (!Types.ObjectId.isValid(jobId)) {
      throw new AppError(400, 'Invalid job ID');
    }

    const job = await ImportJob.findById(jobId);
    if (!job) throw new AppError(404, 'Import job not found');

    const records = await LeadRecord.find({ importJobId: job._id })
      .sort({ rowIndex: 1 })
      .lean();

    const mappedRecords = records.map((r) => r.mappedData as unknown as CrmRecord);

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="import-${jobId}.json"`);
      res.json(mappedRecords);
      return;
    }

    const headers = getExportHeaders();
    const rows = mappedRecords.map(recordToExportRow);
    const csv = Papa.unparse({ fields: headers, data: rows.map((r) => headers.map((h) => r[h])) });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="import-${jobId}.csv"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
}
