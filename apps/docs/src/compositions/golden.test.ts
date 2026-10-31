// @vitest-environment node
/**
 * Commits the file Copy React hands out for every composition and every
 * preset, Default included, as `<slug>/generated/<preset>.tsx`. Those files
 * sit under the repo's typecheck, lint, and format check, so CI compiles the
 * exact code a visitor copies, and every PR shows the output's diff. After a
 * change to a composition or the generator, rewrite them with
 * `pnpm --filter @shaders/docs test -u`.
 */
import { describe, expect, it } from 'vitest';

import { generateComposition, kebabCase } from './generate';
import { COMPOSITIONS } from './index';
import { readCompositionDefaults } from './read-defaults';
import { presetNames, presetProps } from './store';

describe.each(COMPOSITIONS.map((composition) => [composition.slug, composition] as const))(
  '%s',
  (slug, composition) => {
    it.each(presetNames(composition))('matches the golden file for %s', async (preset) => {
      const defaults = await readCompositionDefaults(composition);
      const output = generateComposition({
        composition,
        preset,
        state: presetProps(composition, defaults, preset),
        defaults,
      });

      await expect(output).toMatchFileSnapshot(`./${slug}/generated/${kebabCase(preset)}.tsx`);
    });
  },
);
