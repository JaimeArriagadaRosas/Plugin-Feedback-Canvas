import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globalSetup: ['packages/server/src/validation/setup/globalSetup.js'],
    fileParallelism: false,
    hookTimeout: 30000,
    poolOptions: {
      threads: {
        singleThread: true
      }
    },
    projects: [
      {
        test: {
          name: 'unit',
          include: [
            'packages/server/src/validation/unit/**/*.test.js',
            'packages/server/src/validation/rutas/**/*.test.js',
            'packages/server/src/validation/contratos/**/*.test.js',
            'packages/server/src/validation/servicios/**/*.test.js'
          ],
          exclude: ['packages/server/src/validation/integración/**/*.test.js'],
          setupFiles: ['packages/server/src/validation/setup/env-preload.js']
        }
      },
      {
        test: {
          name: 'integration',
          include: ['packages/server/src/validation/integración/**/*.test.js'],
          setupFiles: ['packages/server/src/validation/setup/env-preload.js']
        }
      }
    ]
  }
});
