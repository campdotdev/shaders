/**
 * The Reactive card's held smudge (SHA-216): the J path its scripted stroke
 * follows, and CursorSmudge's settings. The stroke drags the gradient's
 * bright lower left up along the J to the arrow, and decay 0 holds it as the
 * still frame.
 */

export interface ReactiveSmudge {
  /** CursorSmudge's strength: the furthest the stroke pulls, in canvas heights. */
  strength: number;
  /** CursorSmudge's radius: how wide the stroke pulls, in canvas heights. */
  radius: number;
  /** How long the stroke takes to run the J, in seconds. */
  laySeconds: number;
}

// Assumed until the author tunes them at phase 1b on /dev/reactive-card.
// 0.85 s is the ending's swoop, which lays the same smudge.
export const REACTIVE_SMUDGE: ReactiveSmudge = {
  strength: 0.12,
  radius: 0.18,
  laySeconds: 0.85,
};

// The J, as a cubic Bézier in 0..1 canvas units from the top-left: up from
// below the bottom edge near the left corner, bending over to the arrow at
// (240, 101) of the mock's 312 by 309.
const J_PATH = [
  [0.12, 1.15],
  [0.15, 0.55],
  [0.45, 0.35],
  [240 / 312, 101 / 309],
] as const;

/** The point `t` of the way along the J, from 0 at its foot to 1 at the arrow. */
export function pointOnJ(t: number): [number, number] {
  const [p0, p1, p2, p3] = J_PATH;
  const u = 1 - t;
  const weights = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t] as const;

  return [
    weights[0] * p0[0] + weights[1] * p1[0] + weights[2] * p2[0] + weights[3] * p3[0],
    weights[0] * p0[1] + weights[1] * p1[1] + weights[2] * p2[1] + weights[3] * p3[1],
  ];
}
