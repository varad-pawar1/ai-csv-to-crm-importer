import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  MONGODB_URI: z.string().min(1),
  REDIS_URL: z.string().optional(),
  QUEUE_REDIS_HOST: z.string().optional(),
  QUEUE_REDIS_PORT: z.coerce.number().optional(),
  QUEUE_REDIS_USERNAME: z.string().optional(),
  QUEUE_REDIS_PASSWORD: z.string().optional(),
  REDIS_TLS: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  AI_PROVIDER: z.enum(['openai', 'anthropic', 'gemini']).default('openai'),
  AI_FALLBACK_PROVIDER: z.enum(['openai', 'anthropic', 'gemini']).optional(),
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  ANTHROPIC_MODEL: z.string().default('claude-3-5-haiku-latest'),
  GEMINI_MODEL: z.string().default('gemini-2.0-flash'),
  BATCH_SIZE: z.coerce.number().min(5).max(50).default(20),
  MAX_FILE_SIZE_MB: z.coerce.number().default(10),
  MAX_CSV_ROWS: z.coerce.number().default(50000),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (!cached) {
    const parsed = envSchema.parse(process.env);
    if (!parsed.REDIS_URL && !parsed.QUEUE_REDIS_HOST) {
      throw new Error('Either REDIS_URL or QUEUE_REDIS_HOST must be set');
    }
    cached = parsed;
  }
  return cached;
}
