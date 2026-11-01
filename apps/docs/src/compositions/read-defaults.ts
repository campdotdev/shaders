/**
 * Reads the library defaults for each stack entry's component, keyed by
 * entry id. props.ts reads the component sources from disk, so this runs only
 * at build, in the composition page and in the golden-file test, and the
 * page hands the result to its island.
 */
import { slugForComponentName } from '@/content/catalog';
import { getComponentDefaults } from '@/content/props';

import type { Composition } from './define';
import type { CompositionDefaults } from './store';

export async function readCompositionDefaults(
  composition: Composition,
): Promise<CompositionDefaults> {
  return Object.fromEntries(
    await Promise.all(
      composition.stack.map(async ({ id, component }) => {
        const slug = slugForComponentName(component);

        if (slug === undefined) throw new Error(`No component page for ${component}`);

        return [id, await getComponentDefaults(slug)] as const;
      }),
    ),
  );
}
