import { describe, expect, it } from 'vitest';

import { parseTap, tapSlug } from './tap';

describe('parseTap', () => {
  it('splits the group path from the node and its output', () => {
    expect(parseTap('Group/Inner/Wave Texture:Fac')).toEqual({
      groupPath: ['Group', 'Inner'],
      node: 'Wave Texture',
      output: 'Fac',
    });
  });

  it('rejects a path with no output socket', () => {
    expect(() => parseTap('Group/Wave Texture')).toThrow('Group/Node:Output');
  });
});

describe('tapSlug', () => {
  // export_material.py named its tap renders with these slugs.
  it('matches the file names the export script writes', () => {
    expect(tapSlug('Group/Wave Texture:Fac')).toBe('group-wave-texture-fac');
    expect(tapSlug('Group/Mix.002:Result_Color')).toBe('group-mix-002-result-color');
  });
});
