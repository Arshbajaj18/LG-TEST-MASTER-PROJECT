import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './src/tests',
  outputDir: './test-results/artifacts',
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  timeout: 60_000,
  use: {
    baseURL: 'http://localhost:8430',
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:8430',
    reuseExistingServer: true,
    timeout: 60_000,
  },
})
