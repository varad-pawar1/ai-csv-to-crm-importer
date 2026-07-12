import 'dotenv/config';
import { Queue } from 'bullmq';
import mongoose from 'mongoose';
import { getRedisConnection, BATCH_QUEUE_NAME } from '../src/queue/connection';
import { ImportJob, BatchLog } from '../src/models';

async function main() {
  const jobIdArg = process.argv[2];

  console.log('Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGODB_URI!);

  const queue = new Queue(BATCH_QUEUE_NAME, { connection: getRedisConnection() });

  const waiting = await queue.getWaitingCount();
  const active = await queue.getActiveCount();
  const delayed = await queue.getDelayedCount();
  console.log(`Queue before purge: waiting=${waiting}, active=${active}, delayed=${delayed}`);

  console.log('Obliterating BullMQ queue (removes all pending/active jobs)...');
  await queue.obliterate({ force: true });
  console.log('Queue purged.');

  if (jobIdArg) {
    const result = await ImportJob.findByIdAndUpdate(jobIdArg, {
      $set: { status: 'failed' },
    });
    if (result) {
      await BatchLog.updateMany(
        { importJobId: jobIdArg, status: { $in: ['pending', 'active'] } },
        { $set: { status: 'failed', error: 'Cancelled by user' } }
      );
      console.log(`Import job ${jobIdArg} marked as failed/cancelled.`);
    } else {
      console.log(`Import job ${jobIdArg} not found in MongoDB.`);
    }
  } else {
    const processing = await ImportJob.updateMany(
      { status: { $in: ['queued', 'processing'] } },
      { $set: { status: 'failed' } }
    );
    console.log(`Marked ${processing.modifiedCount} in-progress import job(s) as failed.`);
  }

  await queue.close();
  await mongoose.disconnect();
  console.log('Done. Safe to restart backend with: npm run dev');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


// npx tsx scripts/purge-queue.ts YOUR_JOB_ID

// npm run purge-queue