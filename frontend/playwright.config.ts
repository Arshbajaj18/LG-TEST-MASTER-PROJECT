import { defineConfig, devices } from '@playwright/test'
import {
  TEST_API_PORT,
  TEST_APP_PORT,
  TEST_COLLECTION,
  TEST_DATABASE,
  TEST_MONGO_PORT,
  TEST_MONGODB_URI,
} from './src/tests/fixtures/testEnv.ts'

/**
 * Tests run the real backend against a throwaway local mongod, on ports of their own, so a
 * test run can never reach the production database. Set TEST_MONGODB_URI to use an
 * already-running test MongoDB instead of starting `mongod` from PATH.
 */
const mongo = process.env.TEST_MONGODB_URI
  ? []
  : [
      {
        command: `rm -rf test-results/mongo && mkdir -p test-results/mongo && mongod --dbpath test-results/mongo --port ${TEST_MONGO_PORT} --bind_ip 127.0.0.1 --quiet`,
        port: TEST_MONGO_PORT,
        reuseExistingServer: false,
        timeout: 30_000,
      },
    ]

export default defineConfig({
  testDir: './src/tests',
  outputDir: './test-results/artifacts',
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  timeout: 60_000,
  use: {
    baseURL: `http://localhost:${TEST_APP_PORT}`,
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
  webServer: [
    ...mongo,
    {
      command: 'node ../backend/src/server.js',
      // /health answers 503 until MongoDB is reachable, so this also waits for the database.
      url: `http://localhost:${TEST_API_PORT}/api/health`,
      // Set explicitly so a developer's backend/.env can't point the run at another database.
      env: {
        PORT: String(TEST_API_PORT),
        MONGODB_URI: TEST_MONGODB_URI,
        MONGODB_DATABASE: TEST_DATABASE,
        MONGODB_COLLECTION: TEST_COLLECTION,
        STATIC_DIR: '',
      },
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: `npx vite --port ${TEST_APP_PORT}`,
      url: `http://localhost:${TEST_APP_PORT}`,
      env: { TESTMASTER_API_PROXY: `http://localhost:${TEST_API_PORT}` },
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
})
