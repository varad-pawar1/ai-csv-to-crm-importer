import mongoose, { Schema, Document, Types } from 'mongoose';

export type ImportJobStatus = 'queued' | 'processing' | 'done' | 'failed';
export type BatchLogStatus = 'pending' | 'active' | 'done' | 'failed';
export type DedupPolicy = 'keep_both' | 'merge';

export interface IImportJob extends Document {
  filename: string;
  status: ImportJobStatus;
  totalRows: number;
  importedCount: number;
  skippedCount: number;
  batchesTotal: number;
  batchesDone: number;
  dedupPolicy: DedupPolicy;
  headers: string[];
  rawRows: Record<string, string>[];
  createdAt: Date;
}

const ImportJobSchema = new Schema<IImportJob>({
  filename: { type: String, required: true },
  status: {
    type: String,
    enum: ['queued', 'processing', 'done', 'failed'],
    default: 'queued',
  },
  totalRows: { type: Number, required: true },
  importedCount: { type: Number, default: 0 },
  skippedCount: { type: Number, default: 0 },
  batchesTotal: { type: Number, default: 0 },
  batchesDone: { type: Number, default: 0 },
  dedupPolicy: { type: String, enum: ['keep_both', 'merge'], default: 'keep_both' },
  headers: { type: [String], default: [] },
  rawRows: { type: Schema.Types.Mixed, default: [] },
  createdAt: { type: Date, default: Date.now },
});

export const ImportJob = mongoose.model<IImportJob>('ImportJob', ImportJobSchema);

export interface ILeadRecord extends Document {
  importJobId: Types.ObjectId;
  mappedData: Record<string, unknown>;
  skipped: boolean;
  skipReason: string | null;
  rowIndex: number;
}

const LeadRecordSchema = new Schema<ILeadRecord>({
  importJobId: { type: Schema.Types.ObjectId, ref: 'ImportJob', required: true, index: true },
  mappedData: { type: Schema.Types.Mixed, required: true },
  skipped: { type: Boolean, required: true },
  skipReason: { type: String, default: null },
  rowIndex: { type: Number, required: true },
});

LeadRecordSchema.index({ importJobId: 1, rowIndex: 1 });

export const LeadRecord = mongoose.model<ILeadRecord>('LeadRecord', LeadRecordSchema);

export interface IBatchLog extends Document {
  importJobId: Types.ObjectId;
  batchIndex: number;
  status: BatchLogStatus;
  retryCount: number;
  error: string | null;
}

const BatchLogSchema = new Schema<IBatchLog>({
  importJobId: { type: Schema.Types.ObjectId, ref: 'ImportJob', required: true, index: true },
  batchIndex: { type: Number, required: true },
  status: {
    type: String,
    enum: ['pending', 'active', 'done', 'failed'],
    default: 'pending',
  },
  retryCount: { type: Number, default: 0 },
  error: { type: String, default: null },
});

BatchLogSchema.index({ importJobId: 1, batchIndex: 1 }, { unique: true });

export const BatchLog = mongoose.model<IBatchLog>('BatchLog', BatchLogSchema);
