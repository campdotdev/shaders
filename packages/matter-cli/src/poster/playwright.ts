import { access } from 'node:fs/promises'
import { writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

import type * as Playwright from 'playwright'

/**
 * Walk up the directory tree from `startDir` looking for
 * `node_modules/playwright/index.js`, the same search Node's module
 * resolution uses — but explicitly, so NODE_PATH (set by Vitest/pnpm at
 * process start) does not leak packages from outside the project tree.
 */
async function findPlaywrightPath(startDir: string): Promise<string | null> {
  let dir = startDir
  while (true) {
    const candidate = join(dir, 'node_modules', 'playwright', 'index.js')
    try {
      await access(candidate)
      return candidate
    } catch {
      // not here; keep walking up
    }
    const parent = dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

export async function resolvePlaywright(projectRoot: string): Promise<typeof Playwright> {
  const pwPath = await findPlaywrightPath(projectRoot)
  if (pwPath === null) {
    throw new Error(
      `Install playwright to use this command: pnpm add -D playwright && pnpm exec playwright install chromium`,
    )
  }
  // Import via the resolved absolute path so we get the project's own copy.
  const mod = (await import(pwPath)) as typeof Playwright
  return mod
}

export interface ScreenshotOpts {
  url: string
  width: number
  height: number
  timeSeconds: number
  readyTimeoutMs: number
  outPath: string
  projectRoot: string
}

export async function launchAndScreenshot(opts: ScreenshotOpts): Promise<{ bytes: number }> {
  const pw = await resolvePlaywright(opts.projectRoot)
  const browser = await pw.chromium.launch({ headless: true })
  try {
    const ctx = await browser.newContext({
      viewport: { width: opts.width, height: opts.height },
      deviceScaleFactor: 1,
    })
    const page = await ctx.newPage()
    const consoleErrors: string[] = []
    page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`))
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(`console: ${msg.text()}`)
    })
    await page.goto(opts.url, { waitUntil: 'load' })
    try {
      await page.waitForFunction(
        () => (globalThis as unknown as { __matterReady?: boolean }).__matterReady === true,
        { timeout: opts.readyTimeoutMs },
      )
    } catch {
      if (consoleErrors.length > 0) {
        throw new Error(
          `Poster render failed before producing a frame:\n  ${consoleErrors.join('\n  ')}`,
        )
      }
      throw new Error(
        `no canvas content detected within ${opts.readyTimeoutMs / 1000}s; does your component render a ShaderScene with a visible base layer?`,
      )
    }
    if (opts.timeSeconds > 0) {
      await page.waitForTimeout(opts.timeSeconds * 1000)
    }
    const canvas = page.locator('canvas').first()
    const buf = await canvas.screenshot({ type: 'png' })
    await writeFile(opts.outPath, buf)
    return { bytes: buf.length }
  } finally {
    await browser.close()
  }
}
