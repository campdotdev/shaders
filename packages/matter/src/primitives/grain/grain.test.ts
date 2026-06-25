import { uniform, uv } from 'three/tsl';
import { describe, expect, it } from 'vitest';

import { grain } from './grain.js';

describe('grain', () => {
  it('returns a TSL node with a number intensity (static grain)', () => {
    const grainValue = grain(0.1);

    expect(grainValue).toBeDefined();
  });

  it('accepts a node intensity (for animated intensity)', () => {
    const grainValue = grain(uv().x);

    expect(grainValue).toBeDefined();
  });

  it('accepts a uniform intensity (for animatable React props)', () => {
    const grainValue = grain(uniform(0.1));

    expect(grainValue).toBeDefined();
  });

  it('accepts an optional time-offset node (for twinkling grain)', () => {
    const grainValue = grain(0.1, uv().x);

    expect(grainValue).toBeDefined();
  });
});
