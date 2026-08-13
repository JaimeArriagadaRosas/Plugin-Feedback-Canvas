import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import path from 'node:path';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
export default defineConfig({
  root: __dirname,
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src')
    }
  },
  esbuild: {
    target: 'es2022'
  },
  test: {
    workspace: [{
      extends: true,
      test: {
        environment: 'jsdom',
        setupFiles: ['./src/test/setup.js'],
        globals: true,
        exclude: ['**/tests/e2e/**', '**/node_modules/**']
      }
    }, {
      extends: true,
      plugins: [
      // The plugin will run tests for the stories defined in your Storybook config
      // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
      storybookTest({
        configDir: path.join(__dirname, '.storybook')
      })],
      test: {
        name: 'storybook',
        exclude: ['**/tests/e2e/**', '**/node_modules/**'],
        browser: {
          enabled: true,
          headless: true,
          provider: 'playwright',
          instances: [{
            browser: 'chromium'
          }]
        }
      }
    }]
  }
});