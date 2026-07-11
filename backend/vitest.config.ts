import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    env: {
      MONGODB_URI: 'mongodb://localhost:27017/groweasy-test',
      REDIS_URL: 'redis://localhost:6379',
      CORS_ORIGIN: 'http://localhost:3000',
    },
  },
});
