// @vitest-environment node
//
// The subpath's contract is that it never reaches three, and this is where that
// gets enforced rather than assumed. With no DOM environment `self` is
// undefined, and three/webgpu reads `self` at module load — so if anything in
// the import graph below ./color.js drags three back in, this file throws while
// importing and the suite fails here, instead of in someone's server render
// months from now.
import { describe, expect, it } from 'vitest';

import { linearSrgbToOklch, parseColorString, srgbChannelToLinear } from './color.js';

describe('@lovo/matter/color', () => {
  it('runs with no DOM globals present', () => {
    // Guards the guard. If the environment docblock above is ever removed or
    // changed, this fails loudly rather than the file quietly becoming
    // decorative while still passing.
    expect(typeof self).toBe('undefined');
  });

  it('exposes the CPU color math through the subpath entry', () => {
    expect(parseColorString('#000000')).toEqual([0, 0, 0]);
    expect(srgbChannelToLinear(0)).toBe(0);
    expect(linearSrgbToOklch(1, 1, 1)[0]).toBeCloseTo(1, 3);
  });
});
