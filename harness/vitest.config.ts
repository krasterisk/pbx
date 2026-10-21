import { defineConfig } from 'vitest/config';
import { outputPath } from '../tools/artifacts/paths.cjs';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['scenarios/**/*.test.ts', 'llm-stub/**/*.test.ts'],
    fileParallelism: false,
    reporters: ['default', ['junit', { outputFile: outputPath('legacy', 'harness', 'reports', 'junit-api.xml') }]],
  },
});
