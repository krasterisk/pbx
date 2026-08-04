import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['scenarios/**/*.test.ts'],
    fileParallelism: false,
    reporters: ['default', ['junit', { outputFile: 'reports/junit-api.xml' }]],
  },
});
