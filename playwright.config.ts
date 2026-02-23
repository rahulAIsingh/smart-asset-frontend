import { defineConfig, devices } from '@playwright/test'

const CI = !!process.env.CI

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 2 : 0,
  workers: CI ? 2 : undefined,
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
  ],
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'dotnet run --no-launch-profile --project ../backend/SmartAssetManager.Api --urls http://localhost:5000',
      cwd: '.',
      env: {
        ASPNETCORE_ENVIRONMENT: 'Testing',
        DOTNET_ENVIRONMENT: 'Testing',
      },
      url: 'http://localhost:5000/health',
      timeout: 120_000,
      reuseExistingServer: false,
    },
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 3000',
      cwd: '.',
      url: 'http://127.0.0.1:3000/login',
      timeout: 120_000,
      reuseExistingServer: !CI,
    },
  ],
})
