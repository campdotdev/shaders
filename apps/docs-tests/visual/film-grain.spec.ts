import { expect, test } from '@playwright/test'

import { waitForShader } from './helpers'

test('FilmGrain — default story', async ({ page }) => {
  await page.goto('/components/film-grain?visualTest=1')
  await waitForShader(page)
  await expect(page.locator('canvas').first()).toHaveScreenshot('film-grain-default.png')
})
