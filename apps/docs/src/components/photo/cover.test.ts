// @vitest-environment node
/**
 * PhotoSource's fit: the share of the photo the canvas shows along each axis.
 * Without a frame the photo covers the canvas. With one it covers the frame
 * too, so it keeps one scale in every box smaller than the frame.
 */
import { describe, expect, it } from 'vitest';

import { coverShare } from './cover';

describe('coverShare', () => {
  describe('without a frame', () => {
    it('shows the whole photo on a canvas of its own aspect', () => {
      expect(coverShare(1.5, [600, 400])).toEqual([1, 1]);
    });

    it('crops the sides of a photo wider than the canvas', () => {
      // A 2:1 photo on a square canvas: the photo is 800 wide to reach the
      // canvas's 400 height, so the canvas shows half its width.
      expect(coverShare(2, [400, 400])).toEqual([0.5, 1]);
    });

    it('crops the top and bottom of a photo taller than the canvas', () => {
      expect(coverShare(1, [800, 400])).toEqual([1, 0.5]);
    });

    it('depends only on the canvas aspect, so a resize keeps the fit', () => {
      expect(coverShare(1.5, [300, 300])).toEqual(coverShare(1.5, [900, 900]));
    });
  });

  describe('with a frame', () => {
    it('is a plain cover fit when the canvas is the frame', () => {
      expect(coverShare(2, [400, 400], [400, 400])).toEqual(coverShare(2, [400, 400]));
    });

    it('shows the middle of the frame on a smaller canvas', () => {
      // A 2:1 photo covers the 800x400 frame exactly. A 400x200 canvas shows
      // the middle half of it along each axis.
      expect(coverShare(2, [400, 200], [800, 400])).toEqual([0.5, 0.5]);
    });

    it('grows past the frame for a canvas bigger than it', () => {
      expect(coverShare(2, [1600, 800], [800, 400])).toEqual([1, 1]);
    });
  });
});
