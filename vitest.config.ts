import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@domain': resolve(__dirname, 'packages/domain/src'),
      '@db': resolve(__dirname, 'packages/db/src')
    }
  },
  test: {
    environment: 'node',
    include: ['packages/**/*.test.ts']
  }
});
