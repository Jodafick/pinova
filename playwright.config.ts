import { defineConfig, devices } from '@playwright/test'

const apiBase = process.env.PLAYWRIGHT_API_BASE_URL || 'http://127.0.0.1:8000'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: 0,
  timeout: 120_000,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5175',
    trace: 'on-first-retry',
    serviceWorkers: 'block',
  },
  webServer: process.env.CI
    ? undefined
    : [
        {
          command: 'powershell -NoProfile -ExecutionPolicy Bypass -File ./scripts/e2e-backend.ps1',
          url: `${apiBase}/api/health/`,
          reuseExistingServer: true,
          timeout: 180_000,
        },
        {
          command: 'npx vite --port 5175 --mode e2e',
          url: 'http://localhost:5175',
          reuseExistingServer: true,
          timeout: 120_000,
          env: {
            ...process.env,
            VITE_E2E_LOCAL_API: 'true',
            VITE_API_BASE_URL: apiBase,
            VITE_POSTHOG_KEY: process.env.VITE_POSTHOG_KEY || 'phc_e2e_analytics_test',
            VITE_POSTHOG_HOST: process.env.VITE_POSTHOG_HOST || 'https://eu.i.posthog.com',
            VITE_FEATURE_ONBOARDING_V2: 'true',
          },
        },
      ],
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
