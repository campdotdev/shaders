// @vitest-environment node
/**
 * Imports the registry in plain Node, where three/webgpu throws at module
 * load because it reads `self`. The import succeeding is the check that no
 * document reaches three, so server code can read every composition. The
 * rest covers what the document's types can't: uniqueness across entries.
 */
import { describe, expect, it } from 'vitest';

import { COMPOSITIONS } from './index';

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
});
