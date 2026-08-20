import { beforeEach, describe, expect, it } from 'vitest';

import {
  resetReducedMotionForTests,
  setReducedMotionPolicy,
} from '../../runtime/reduced-motion/reduced-motion.js';
import { elapsedTime } from './time.js';

describe('gated time', () => {
  beforeEach(() => {
    resetReducedMotionForTests();
    setReducedMotionPolicy('auto');
  });

  it('is a TSL node', () => {
    expect(elapsedTime).toBeDefined();
    expect((elapsedTime as unknown as { isNode?: boolean }).isNode).toBe(true);
  });

  // Note: We can't assert the actual scaled value without running on the GPU.
  // The gating is verified end-to-end via the docs-site demo in Task 5 and the
  // Playwright reduced-motion test in Phase 5.10.
});
