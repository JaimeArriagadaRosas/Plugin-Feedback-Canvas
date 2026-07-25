import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    passWithNoTests: true,
    fileParallelism: false,
    hookTimeout: 30000,
    poolOptions: {
      threads: {
        singleThread: true
      }
    }
  }
});
