import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import fs from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CERTS_DIR = resolve(__dirname, '../server/certs');
const certFile = resolve(CERTS_DIR, 'localhost.pem');
const keyFile  = resolve(CERTS_DIR, 'localhost-key.pem');
const hasCerts = fs.existsSync(certFile) && fs.existsSync(keyFile);

const baseURL = hasCerts ? 'https://localhost:5173' : 'http://localhost:5173';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL,
    trace: 'on-first-retry',
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Descomentar para probar otros navegadores
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],
  // Ejecutar el frontend antes de los tests
  webServer: {
    command: 'npm run dev',
    url: baseURL,
    ignoreHTTPSErrors: true,
    reuseExistingServer: !process.env.CI,
  },
});
