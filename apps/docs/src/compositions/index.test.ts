// @vitest-environment node
/**
 * Imports the registry in plain Node, where three/webgpu throws at module
 * load because it reads `self`. The import succeeding is the check that no
 * document reaches three, so server code can read every composition. The
 * rest covers what the document's types can't: uniqueness across entries.
 */
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { defineComposition } from './define';
import { COMPOSITIONS, compositionsUsing } from './index';
import { compositionPoster, compositionThumbnail } from './posters';

const PUBLIC_DIR = fileURLToPath(new URL('../../public', import.meta.url));

describe('COMPOSITIONS', () => {
  it('gives every composition its own slug', () => {
    const slugs = COMPOSITIONS.map(({ slug }) => slug);

    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('gives every stack entry an id of its own within its composition', () => {
    for (const composition of COMPOSITIONS) {
      const ids = composition.stack.map(({ id }) => id);

      expect(new Set(ids).size, composition.slug).toBe(ids.length);
    }
  });

  // The picker lists "Default" ahead of the document's presets, so a
  // preset by that name would show twice.
  it('names every preset once, and never "Default"', () => {
    for (const composition of COMPOSITIONS) {
      const names = composition.presets.map(({ name }) => name.toLowerCase());

      expect(names, composition.slug).not.toContain('default');
      expect(new Set(names).size, composition.slug).toBe(names.length);
    }
  });

  // The composition page, the Gallery card, and the "Used in" strip show
  // these before a frame. scripts/build-posters.sh writes them, and a
  // composition missing its entry there would ship broken images.
  it('has a poster and a thumbnail for every composition', () => {
    const missing = COMPOSITIONS.flatMap(({ slug }) =>
      [compositionPoster(slug), compositionThumbnail(slug)].filter(
        (url) => !existsSync(`${PUBLIC_DIR}${url}`),
      ),
    );

    expect(missing).toEqual([]);
  });
});

describe('compositionsUsing', () => {
  // A list of its own, so the lookup's test outlives any one composition.
  const stackOf = (slug: string, ...components: Array<'Grain' | 'MeshGradient' | 'Vignette'>) =>
    defineComposition({
      slug,
      title: slug,
      description: 'A stack for the lookup test.',
      stack: components.map((component, index) => ({ id: `entry${index}`, component, props: {} })),
      presets: [],
      controls: [],
    });
  const compositions = [
    stackOf('one', 'MeshGradient', 'Grain'),
    stackOf('two', 'MeshGradient', 'Vignette'),
  ];
  const slugsUsing = (componentName: string) =>
    compositionsUsing(componentName, compositions).map(({ slug }) => slug);

  it('finds every composition whose stack holds the component, in order', () => {
    expect(slugsUsing('MeshGradient')).toEqual(['one', 'two']);
    expect(slugsUsing('Vignette')).toEqual(['two']);
  });

  it('finds none for a component no stack holds', () => {
    expect(slugsUsing('Aurora')).toEqual([]);
  });
});
