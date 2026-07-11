import mongoose from 'mongoose';
import { getEnv } from '../config/env';
import { logger } from '../utils/logger';

export async function connectMongo(): Promise<void> {
  const uri = getEnv().MONGODB_URI;
  await mongoose.connect(uri);
  logger.info({ uri: uri.replace(/\/\/.*@/, '//***@') }, 'Connected to MongoDB');
}

export async function disconnectMongo(): Promise<void> {
  await mongoose.disconnect();
}
