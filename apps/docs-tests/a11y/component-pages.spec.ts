import AxeBuilder from '@axe-core/playwright'
import { test, expect } from '@playwright/test'

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
      // Tweakpane mounts its own unlabeled controls (sliders, color pickers,
      // etc.) into the host div. The host is marked `aria-hidden` because
      // the pane is dev-only; excluding the entire `[data-tweakpane-host]`
      // subtree from axe analysis avoids the aria-hidden-focus violation
      // the rule would otherwise raise on the focusable Tweakpane children.
      .exclude('[data-tweakpane-host]')
      .analyze()

    if (results.violations.length > 0) {
      console.log('axe violations:', JSON.stringify(results.violations, null, 2))
    }
    expect(results.violations).toEqual([])
  })
}
