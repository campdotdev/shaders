/**
 * The edge fade that brings a moving box in through an edge: the homepage
 * hero's panel through the container's right edge, and the favorites' cards
 * through their own bottom edge. It runs the scroll areas' edge-fade curve
 * (scroll-area.module.css), clear at the edge and 20% at 39% of the way in.
 */

export interface EdgeReveal {
  /** Which way the box travels into view: right for leftward travel, bottom for upward. */
  direction: 'to right' | 'to bottom';
  /** How far the edge sits from the box's leading side, in CSS px. */
  edge: number;
  /** The box's length along `direction`, in CSS px. */
  size: number;
  /** How long the fade runs before the edge, in CSS px. */
  fade: number;
  /** How far the box has left to travel, in CSS px. */
  remaining: number;
}

// Two decimals is finer than a device pixel, and keeps the mask string the
// same from frame to frame wherever the box hasn't really moved.
function round(value: number) {
  return Math.round(value * 100) / 100;
}

/**
 * A CSS mask-image for the box, or 'none'. The mask's strength follows how
 * far the box still has to travel, full while it has a whole fade or more
 * to go and nothing at rest, so the fade is gone by the time the box comes
 * to rest, as a scroll fade goes once the end is reached.
 */
export function edgeRevealMask({ direction, edge, size, fade, remaining }: EdgeReveal) {
  const strength = Math.min(1, remaining / fade);

  if (strength <= 0 || edge - fade >= size) return 'none';

  return `linear-gradient(${direction}, #000 ${round(edge - fade)}px, rgb(0 0 0 / ${round(
    1 - 0.8 * strength,
  )}) ${round(edge - 0.39 * fade)}px, rgb(0 0 0 / ${round(1 - strength)}) ${round(edge)}px)`;
}
