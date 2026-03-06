import { defineConfig } from '@playwright/test'
import { existsSync } from 'node:fs'

const port = Number(process.env.PW_PORT ?? 4173)
const baseURL = `http://127.0.0.1:${port}`
const configuredChromiumPath = process.env.PLAYWRIGHT_CHROMIUM_PATH || '/snap/bin/chromium'
const executablePath = existsSync(configuredChromiumPath) ? configuredChromiumPath : undefined

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL,
    browserName: 'chromium',
    headless: true,
    launchOptions: {
      ...(executablePath ? { executablePath } : {}),
      args: [
        '--enable-unsafe-webgpu',
        '--ignore-gpu-blocklist',
        '--use-angle=vulkan',
      ],
    },
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'webgpu',
    },
  ],
  webServer: {
    command: `bun run dev --host 127.0.0.1 --port ${port} --strictPort`,
    url: baseURL,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
  },
})
