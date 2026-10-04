import { describe, expect, it } from 'vitest';

import { edgeRevealMask } from './edge-reveal';

describe('edgeRevealMask', () => {
  it('is clear at the edge while the box still has a whole fade to travel', () => {
    const mask = edgeRevealMask({
      direction: 'to right',
      edge: 100,
      size: 288,
      fade: 160,
      remaining: 400,
    });

    expect(mask).toBe(
      'linear-gradient(to right, #000 -60px, rgb(0 0 0 / 0.2) 37.6px, rgb(0 0 0 / 0) 100px)',
    );
  });

  it('weakens as the box nears rest, so the edge is half clear with half a fade to go', () => {
    expect(
      edgeRevealMask({ direction: 'to bottom', edge: 100, size: 288, fade: 160, remaining: 80 }),
    ).toMatch(/rgb\(0 0 0 \/ 0\.5\) 100px\)$/);
  });

  it('is gone once the box is at rest', () => {
    expect(
      edgeRevealMask({ direction: 'to right', edge: 100, size: 288, fade: 160, remaining: 0 }),
    ).toBe('none');
  });

  it('is gone once the fade starts past the far side of the box', () => {
    expect(
      edgeRevealMask({ direction: 'to right', edge: 460, size: 288, fade: 160, remaining: 50 }),
    ).toBe('none');
  });
});
