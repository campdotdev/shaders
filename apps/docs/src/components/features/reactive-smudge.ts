/**
 * The Reactive card's held smudge (SHA-216): the J path its scripted stroke
 * follows, and CursorSmudge's settings. The stroke drags the gradient's
 * bright lower left up along the J to the arrow, and decay 0 holds it as the
 * still frame.
 */

/** The illustration's size in mock pixels, which the arrow and the J measure in. */
export const MOCK_WIDTH = 312;
export const MOCK_HEIGHT = 309;

interface ReactiveSmudge {
  /** CursorSmudge's strength: the furthest the stroke pulls, in canvas heights. */
  strength: number;
  /** CursorSmudge's radius: how wide the stroke pulls, in canvas heights. */
  radius: number;
  /** How long the stroke takes to run the J, in seconds. */
  laySeconds: number;
}

// About twice CursorSmudge's default strength and radius, so the streak
// reads as the mock's trail. 0.85 s is the ending's swoop, which lays the
// same smudge.
export const REACTIVE_SMUDGE: ReactiveSmudge = {
  strength: 0.25,
  radius: 0.24,
  laySeconds: 0.85,
};

// The J, as a cubic Bézier in 0..1 canvas units from the top-left: up from
// below the bottom edge near the left corner, bending over to the arrow at
// (240, 101) in mock pixels.
const J_PATH = [
  [0.12, 1.15],
  [0.15, 0.55],
  [0.45, 0.35],
  [240 / MOCK_WIDTH, 101 / MOCK_HEIGHT],
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

/**
 * The way the J runs at `t`, in degrees with y down, measured in mock
 * pixels: straight up at its foot, and to the right at the arrow.
 */
export function headingOnJ(t: number): number {
  const [p0, p1, p2, p3] = J_PATH;
  const u = 1 - t;
  const weights = [3 * u * u, 6 * u * t, 3 * t * t] as const;
  const dx =
    weights[0] * (p1[0] - p0[0]) + weights[1] * (p2[0] - p1[0]) + weights[2] * (p3[0] - p2[0]);
  const dy =
    weights[0] * (p1[1] - p0[1]) + weights[1] * (p2[1] - p1[1]) + weights[2] * (p3[1] - p2[1]);

  return (Math.atan2(dy * MOCK_HEIGHT, dx * MOCK_WIDTH) * 180) / Math.PI;
}
