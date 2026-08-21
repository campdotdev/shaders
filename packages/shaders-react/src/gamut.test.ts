// @vitest-environment node
//
// The ./gamut subpath's contract is that it never reaches three, and this is
// where that gets enforced rather than assumed. With no DOM environment `self`
// is undefined, and three/webgpu reads `self` at module load — so if anything
// in the import graph below ./gamut.js drags three back in, this file throws
// while importing and the suite fails here, instead of in someone's server
// render months from now.
import { describe, expect, it } from 'vitest';

import { useDisplayGamut } from './gamut.js';

describe('@camp-dev/shaders-react/gamut', () => {
  it('imports with no DOM globals present', () => {
    // Guards the guard. If the environment docblock above is ever removed, the
    // package's happy-dom default would supply `self` and this file would go on
    // passing while testing nothing.
    expect(typeof self).toBe('undefined');
  });

  it('exposes the hook through the subpath entry', () => {
    expect(typeof useDisplayGamut).toBe('function');
  });
});
