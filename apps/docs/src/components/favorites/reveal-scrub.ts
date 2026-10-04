/**
 * The favorites' reveal while the homepage hero pins, as plain numbers
 * (favorites-reveal.tsx drives it). Each item eases through its own slice
 * of the range in reading order, and a card rises a whole height through
 * its resting bottom edge under the panel's edge fade (lib/edge-reveal.ts).
 */
import { easeOut, PANEL_FADE, PANEL_WIDTH } from '@/components/home-hero/geometry';
import { edgeRevealMask } from '@/lib/edge-reveal';

// Each item's share of the reveal range. The rest of the range is the
// stagger, split evenly between items, so the last one starts as the first
// finishes. Bigger overlaps the items more and reads as one wave; smaller
// spaces them out into separate beats.
const ITEM_SPAN = 0.5;

// The latest hero progress the reveal starts at, however late the grid
// comes into view. On a window just tall enough to glimpse the grid near the
// end of the change, the reveal still spans half of it rather than flicking
// past in its last few pixels. Lower starts it sooner on such windows.
const LATEST_START = 0.5;

// The panel's fade runs 160px against its 288px of travel width. A card is
// smaller, so its fade keeps that proportion of the card's height instead.
const FADE_SHARE = PANEL_FADE / PANEL_WIDTH;

/**
 * The hero progress the reveal starts at, given the progress where the
 * grid first came into view: that point, or LATEST_START if later.
 */
export function revealStartAt(entry: number) {
  return Math.min(entry, LATEST_START);
}

/**
 * How far the reveal as a whole has run, 0 to 1, at hero progress `at`,
 * from its `start` to 1, where the demo lands. A `start` of null means the
 * grid hasn't come into view yet. It stays hidden while the demo is still
 * changing, and rests once the demo lands: on a window too short to show
 * the grid under the pinned demo, the grid is still below the fold then,
 * and scrolls in at rest as the page goes on.
 */
export function revealAt(at: number, start: number | null) {
  if (start === null) return at >= 1 ? 1 : 0;

  return Math.min(1, Math.max(0, (at - start) / (1 - start)));
}

/**
 * How far item `index` of `count` has revealed, 0 to 1, when the reveal as a
 * whole is at `progress`, also 0 to 1. Item 0 starts at 0 and the last item
 * lands at exactly 1.
 */
export function itemRevealAt(progress: number, index: number, count: number) {
  const stagger = count > 1 ? (1 - ITEM_SPAN) / (count - 1) : 0;

  return easeOut((progress - index * stagger) / ITEM_SPAN);
}

/**
 * A card `height` px tall, `reveal` of the way in: how far below its place
 * it sits, and its mask. At 0 it is a whole height down, so its top sits on
 * its resting bottom edge, and the mask, clear at that edge, hides it all.
 * At 1 it is in place with no mask.
 */
export function cardRevealAt(reveal: number, height: number) {
  const y = (1 - reveal) * height;

  return {
    y,
    mask: edgeRevealMask({
      direction: 'to bottom',
      edge: height - y,
      size: height,
      fade: height * FADE_SHARE,
      remaining: y,
    }),
  };
}
