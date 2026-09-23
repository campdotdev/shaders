import { describe, expect, it } from 'vitest';

import { deriveStroke } from './stroke.js';

// The stroke is the segment the pointer swept since the last frame, handed
// to the wave field with the presence that gates it. The field turns the
// segment's length over the frame's delta into speed, so this only decides
// whether there is a segment worth pushing at all.
describe('deriveStroke', () => {
  it('returns nothing before the pointer has a previous position', () => {
    expect(deriveStroke(null, [0.5, 0.5], 1)).toBeUndefined();
  });

  it('returns nothing while the pointer is still', () => {
    expect(deriveStroke([0.4, 0.4], [0.4, 0.4], 1)).toBeUndefined();
  });

  it('returns nothing while presence is 0, whatever the pointer did', () => {
    expect(deriveStroke([0.1, 0.1], [0.9, 0.9], 0)).toBeUndefined();
  });

  it('returns the segment and the presence once the pointer has moved', () => {
    expect(deriveStroke([0.2, 0.3], [0.4, 0.5], 0.6)).toEqual({
      from: [0.2, 0.3],
      to: [0.4, 0.5],
      presence: 0.6,
    });
  });

  // A finger lifted at one point and put down at another sends its first
  // move from the new point, and a mouse can leave the window and come back
  // elsewhere. Either would read as one segment across the canvas and stamp
  // a streak of water along it, so a jump no hand makes in a frame is not a
  // stroke.
  it('returns nothing for a jump longer than a quarter of the canvas in one frame', () => {
    expect(deriveStroke([0.1, 0.5], [0.9, 0.5], 1)).toBeUndefined();
    expect(deriveStroke([0.5, 0.1], [0.5, 0.6], 1)).toBeUndefined();
  });

  it('keeps a brisk stroke just under the jump limit', () => {
    expect(deriveStroke([0.4, 0.5], [0.6, 0.5], 1)).toBeDefined();
  });

  it('keeps a segment that runs past the canvas edge, so a ring near the edge keeps spreading', () => {
    expect(deriveStroke([0.95, 0.5], [1.1, 0.5], 0.4)).toEqual({
      from: [0.95, 0.5],
      to: [1.1, 0.5],
      presence: 0.4,
    });
  });
});
