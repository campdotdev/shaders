import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

const routes = [
  '/',
  '/components/linear-gradient',
  '/components/mesh-gradient',
  '/components/aurora',
  '/components/dot-field',
  '/components/simplex-noise',
  '/components/waves',
  '/recipes',
]

for (const route of routes) {
  test(`@a11y axe-clean on ${route}`, async ({ page }) => {
    await page.goto(route)
    await page.waitForLoadState('networkidle')

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .disableRules(['color-contrast'])
      .exclude('[data-tweakpane-host]')
      .analyze()

    if (results.violations.length > 0) {
      console.log('axe violations:', JSON.stringify(results.violations, null, 2))
    }
    expect(results.violations).toEqual([])
  })
}
