// @vitest-environment node
/**
 * Commits the file Copy React hands out for every composition and every
 * preset, as `<slug>/generated/<preset>.tsx`. The default preset's file is
 * always `default.tsx`, whatever its name, because scripts/build-posters.sh
 * captures the poster from it. Each file
 * comes from a store built with the page's seeds, as the Customize panel
 * builds it. Those files sit under the repo's typecheck, lint, and format
 * check, so CI compiles the exact code a visitor copies, and every PR shows
 * the output's diff. After a change to a composition or the generator,
 * rewrite them with `pnpm --filter @shaders/docs test -u`.
 */
import { describe, expect, it } from 'vitest';

import { generateFromStore, kebabCase } from './generate';
import { COMPOSITIONS } from './index';
import { readCompositionDefaults } from './read-defaults';
import { seedFields } from './seed-fields';
import { createCompositionStore, presetNames } from './store';

describe.each(COMPOSITIONS.map((composition) => [composition.slug, composition] as const))(
  '%s',
  (slug, composition) => {
    it.each(presetNames(composition))('matches the golden file for %s', async (preset) => {
      const fileName = preset === composition.defaultPresetName ? 'default' : kebabCase(preset);
      const defaults = await readCompositionDefaults(composition);
      const store = createCompositionStore(composition, defaults, seedFields);

      store.loadPreset(preset);

      await expect(generateFromStore(composition, defaults, store)).toMatchFileSnapshot(
        `./${slug}/generated/${fileName}.tsx`,
      );
    });
  },
);
