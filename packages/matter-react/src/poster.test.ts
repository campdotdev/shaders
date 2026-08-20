// @vitest-environment node
//
// ./poster has claimed to be three-free in a file-top comment since it was
// added, but nothing checked. This is the same guard ./gamut carries: with no
// DOM environment `self` is undefined, and three/webgpu reads `self` at module
// load, so a three import anywhere below ./poster.js throws here rather than
// surfacing as a crashed server render.
import { describe, expect, it } from 'vitest';

import { ShaderPoster } from './poster.js';

describe('@mattermix/shaders-react/poster', () => {
  it('imports with no DOM globals present', () => {
    expect(typeof self).toBe('undefined');
  });

  it('exposes the poster component through the subpath entry', () => {
    expect(typeof ShaderPoster).toBe('function');
  });
});
