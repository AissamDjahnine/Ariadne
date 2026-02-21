import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 90000,
  workers: process.env.CI ? 2 : 1,
  retries: process.env.CI ? 2 : 1,
  expect: {
    timeout: 15000
  },
  use: {
    baseURL: 'http://127.0.0.1:4174',
    headless: true,
    trace: process.env.CI ? 'on-first-retry' : 'off',
    screenshot: 'only-on-failure',
    video: process.env.CI ? 'retain-on-failure' : 'off'
  },
  webServer: {
    command: 'VITE_API_BASE_URL=http://127.0.0.1:4174/api npm run dev -- --host 127.0.0.1 --port 4174',
    url: 'http://127.0.0.1:4174',
    reuseExistingServer: !process.env.CI
  }
});
