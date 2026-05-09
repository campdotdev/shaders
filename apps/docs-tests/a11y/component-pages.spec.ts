import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const routes = [
  '/',
  '/components/linear-gradient',
  '/components/mesh-gradient',
  '/components/aurora',
  '/components/dot-field',
  '/components/noise-field',
  '/components/waves',
  '/recipes',
]

for (const route of routes) {
  test(`@a11y axe-clean on ${route}`, async ({ page }) => {
    await page.goto(route)
    // Give shaders a beat to mount; axe doesn't care about pixels.
    await page.waitForLoadState('networkidle')
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .disableRules(['color-contrast']) // shader bg colors yield false positives — handled separately
      .analyze()

    if (results.violations.length > 0) {
      console.log('axe violations:', JSON.stringify(results.violations, null, 2))
    }
    expect(results.violations).toEqual([])
  })
}
