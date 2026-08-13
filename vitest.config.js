import { defineConfig, configDefaults } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, '**/tests/e2e/**', '**/tests/integration/**'],
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
