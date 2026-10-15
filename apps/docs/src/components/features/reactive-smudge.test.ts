// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { headingOnJ } from './reactive-smudge';

describe('the J', () => {
  // Degrees with y down: -90 is straight up and 0 is to the right.
  it('rises from its foot and bends over to run right at the arrow', () => {
    expect(headingOnJ(0)).toBeLessThan(-80);
    expect(headingOnJ(0)).toBeGreaterThan(-95);
    expect(Math.abs(headingOnJ(1))).toBeLessThan(10);
  });
});
