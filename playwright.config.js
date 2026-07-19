import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './packages/server/src/e2e',
  timeout: 45000,
  expect: {
    timeout: 10000
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    actionTimeout: 0,
    trace: 'on-first-retry',
    ignoreHTTPSErrors: true, // Importante para Canvas local o proxys
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Podrían agregarse Firefox/Webkit luego
  ],
});
