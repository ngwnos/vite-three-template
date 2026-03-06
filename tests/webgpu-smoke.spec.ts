import { expect, test } from '@playwright/test'

const WEBGPU_WARNING_PATTERNS = [
  'wgsl',
  'webgpu',
  'invalid shadermodule',
  'invalid shader',
  'invalid commandbuffer',
  'invalid computepipeline',
  'invalid renderpipeline',
  'createcomputepipeline',
  'createrenderpipeline',
  'running under webgl2 backend',
]

const IGNORED_ERROR_PATTERNS = [
  'instance dropped in poperrorscope',
]

test('scene renders without WebGPU runtime errors', async ({ page }) => {
  const consoleErrors: string[] = []
  const pageErrors: string[] = []
  const webgpuWarnings: string[] = []
  const ignoredErrors: string[] = []

  await page.addInitScript(() => {
    window.addEventListener('unhandledrejection', (event) => {
      const reason = event.reason
      const detail = reason instanceof Error
        ? reason.stack || reason.message
        : String(reason)

      console.error(`[unhandledrejection] ${detail}`)
    })

    if (typeof GPUAdapter === 'undefined') {
      return
    }

    const originalRequestDevice = GPUAdapter.prototype.requestDevice

    GPUAdapter.prototype.requestDevice = async function patchedRequestDevice(...args) {
      const device = await originalRequestDevice.apply(this, args)

      device.addEventListener('uncapturederror', (event) => {
        const detail = event.error instanceof Error
          ? event.error.message
          : String(event.error)

        console.error(`[gpu-uncapturederror] ${detail}`)
      })

      return device
    }
  })

  page.on('console', (message) => {
    const location = message.location()
    const source = location.url
      ? ` @ ${location.url}:${location.lineNumber ?? 0}:${location.columnNumber ?? 0}`
      : ''
    const line = `[console:${message.type()}] ${message.text()}${source}`

    if (message.type() === 'error') {
      const lowered = line.toLowerCase()
      if (IGNORED_ERROR_PATTERNS.some((pattern) => lowered.includes(pattern))) {
        ignoredErrors.push(line)
        return
      }

      consoleErrors.push(line)
      return
    }

    if (message.type() === 'warning') {
      const lowered = line.toLowerCase()
      if (WEBGPU_WARNING_PATTERNS.some((pattern) => lowered.includes(pattern))) {
        webgpuWarnings.push(line)
      }
    }
  })

  page.on('pageerror', (error) => {
    const stack = error.stack?.trim()
    const message = error.message?.trim()
    const fallback = String(error).trim()
    const detail = stack || message || fallback

    if (detail.length === 0) {
      return
    }

    const line = `[pageerror] ${detail}`
    const lowered = line.toLowerCase()

    if (IGNORED_ERROR_PATTERNS.some((pattern) => lowered.includes(pattern))) {
      ignoredErrors.push(line)
      return
    }

    pageErrors.push(line)
  })

  await page.goto('/', { waitUntil: 'domcontentloaded' })

  const runtime = await page.evaluate(async () => {
    const hasGpu = 'gpu' in navigator
    let hasAdapter = false
    let isFallbackAdapter: boolean | null = null
    let adapterError: string | null = null

    if (hasGpu) {
      try {
        const adapter = await navigator.gpu.requestAdapter()
        hasAdapter = !!adapter
        isFallbackAdapter = adapter?.isFallbackAdapter ?? null
      } catch (error) {
        adapterError = error instanceof Error ? error.message : String(error)
      }
    }

    return {
      hasGpu,
      hasAdapter,
      isFallbackAdapter,
      adapterError,
    }
  })

  const canvas = page.locator('canvas[aria-label="Three.js WebGPU scene"]')
  await expect(canvas).toBeVisible()
  expect(runtime.hasGpu, `navigator.gpu unavailable: ${JSON.stringify(runtime)}`).toBeTruthy()
  expect(runtime.hasAdapter, `navigator.gpu.requestAdapter() failed: ${JSON.stringify(runtime)}`).toBeTruthy()

  // Let async shader compilation and renderer warnings surface after startup.
  await page.waitForTimeout(4_000)

  const uniqueConsoleErrors = [...new Set(consoleErrors)]
  const uniquePageErrors = [...new Set(pageErrors)]
  const uniqueWebgpuWarnings = [...new Set(webgpuWarnings)]
  const allErrors = [...uniqueConsoleErrors, ...uniquePageErrors]

  await test.info().attach('webgpu-runtime.json', {
    body: Buffer.from(JSON.stringify({
      runtime,
      consoleErrors: uniqueConsoleErrors,
      pageErrors: uniquePageErrors,
      webgpuWarnings: uniqueWebgpuWarnings,
      ignoredErrors: [...new Set(ignoredErrors)],
    }, null, 2)),
    contentType: 'application/json',
  })

  expect(
    allErrors,
    `Found browser errors:\n${allErrors.join('\n')}\n\nRuntime: ${JSON.stringify(runtime)}`,
  ).toEqual([])

  expect(
    uniqueWebgpuWarnings,
    `Found WebGPU/WGSL warnings:\n${uniqueWebgpuWarnings.join('\n')}\n\nRuntime: ${JSON.stringify(runtime)}`,
  ).toEqual([])
})
