// @vitest-environment node
/**
 * Imports the registry in plain Node, where three/webgpu throws at module
 * load because it reads `self`. The import succeeding is the check that no
 * document reaches three, so server code can read every composition. The
 * rest covers what the document's types can't: uniqueness across entries,
 * and titles that make a component name.
 */
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { pascalCase } from './generate';
import { COMPOSITIONS } from './index';
import { compositionPoster } from './posters';

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

  // The copied file exports a component named after the title, so a title
  // such as "3D Haze" would print `function 3DHaze`, which doesn't compile.
  it('gives every composition a title that makes a component name', () => {
    for (const composition of COMPOSITIONS) {
      expect(pascalCase(composition.title), composition.slug).toMatch(/^[A-Z][A-Za-z0-9]*$/);
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

  // The composition page and the Gallery card show it before a frame.
  // scripts/build-posters.sh writes it, and a composition missing its entry
  // there would ship a broken image.
  it('has a poster for every composition', () => {
    const missing = COMPOSITIONS.map(({ slug }) => compositionPoster(slug)).filter(
      (url) => !existsSync(`${PUBLIC_DIR}${url}`),
    );

    expect(missing).toEqual([]);
  });
});
