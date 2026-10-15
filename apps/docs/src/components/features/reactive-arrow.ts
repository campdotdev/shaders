/**
 * The Reactive card's arrow (SHA-216): its pose in the still frame, its
 * pose while it follows the pointer, pointing the way the pointer moves,
 * its flights off and back on the window, its swoop back along the J, and
 * where its tip is in any pose. Lengths are mock pixels in the 312 by 309
 * illustration, angles are degrees clockwise, as CSS turns them, and
 * reactive-illustration.module.css draws the arrow from a pose.
 */
import { headingOnJ, pointOnJ } from './reactive-smudge';

/** The illustration's size in mock pixels, which everything here measures in. */
export const MOCK_WIDTH = 312;
export const MOCK_HEIGHT = 309;

// How far past the window's edge the arrow starts its flight back in: far
// enough that none of it shows.
const ENTRY_MARGIN = 90;

/** Where the arrow is: the top-left of its box before it turns, and how far it turns, in degrees. */
export interface ArrowPose {
  x: number;
  y: number;
  angle: number;
}

// The arrow's box: its halo's full size in the mock. CSS turns the box
// about its center.
const BOX = [71.595, 87.924] as const;

// The tip, a cursor's hotspot, in the unturned box: the body's top corner,
// inset by the halo's padding.
const TIP = [8.6, 8.09] as const;

// The notch at the arrow's tail, in the unturned box. The arrow points
// along the line from the notch to the tip.
const NOTCH = [35.38, 62.16] as const;

// The heading the unturned arrow points along, in degrees with y down:
// up and a little to the left.
const UNTURNED_HEADING = (Math.atan2(TIP[1] - NOTCH[1], TIP[0] - NOTCH[0]) * 180) / Math.PI;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

/** The mock's pose: at the upper right, turned to point up and to the right. */
export const STILL_FRAME_ARROW: ArrowPose = { x: 208.44, y: 65.7, angle: 76.89 };

/** How far to turn the arrow so it points along `heading`. */
export function angleForHeading(heading: number): number {
  return heading - UNTURNED_HEADING;
}

/** The still frame's heading: up and to the right, as the mock draws it. */
export const STILL_FRAME_HEADING = STILL_FRAME_ARROW.angle + UNTURNED_HEADING;

/** The way an arrow turned by `angle` points. */
export function headingForAngle(angle: number): number {
  return angle + UNTURNED_HEADING;
}

// Where a point of the unturned box sits from the box's center once the
// box turns by `angle`.
function fromCenter([pointX, pointY]: readonly [number, number], angle: number): [number, number] {
  const offsetX = pointX - BOX[0] / 2;
  const offsetY = pointY - BOX[1] / 2;
  const turn = toRadians(angle);

  return [
    offsetX * Math.cos(turn) - offsetY * Math.sin(turn),
    offsetX * Math.sin(turn) + offsetY * Math.cos(turn),
  ];
}

// The pose that turns the arrow by `angle` with its point `local`, in the
// unturned box, on `at`.
function arrowWithPointAt(
  local: readonly [number, number],
  [atX, atY]: readonly [number, number],
  angle: number,
): ArrowPose {
  const [offsetX, offsetY] = fromCenter(local, angle);

  return { x: atX - BOX[0] / 2 - offsetX, y: atY - BOX[1] / 2 - offsetY, angle };
}

/** The pose that turns the arrow by `angle` with its tip on `pointer`. */
export function arrowAtPointer(pointer: readonly [number, number], angle: number): ArrowPose {
  return arrowWithPointAt(TIP, pointer, angle);
}

/** Where the tip is in `pose`. */
export function arrowTip({ x, y, angle }: ArrowPose): [number, number] {
  const [tipX, tipY] = fromCenter(TIP, angle);

  return [x + BOX[0] / 2 + tipX, y + BOX[1] / 2 + tipY];
}

/**
 * The heading of a move by (`dx`, `dy`), counted on from `current` so the
 * turn to it is never more than half a turn. A heading can run past 180,
 * so a spring that follows it always turns the short way round.
 */
export function headingToward(current: number, dx: number, dy: number): number {
  return current + shortestTurn(current, (Math.atan2(dy, dx) * 180) / Math.PI);
}

/**
 * Where the arrow starts its flight back in to `pointer`: past the edge of
 * the window nearest to it, out of sight. A pointer outside the window is
 * nearest the edge it came in over, and one past a corner slides along the
 * edge to the corner.
 */
export function entryPoint([x, y]: readonly [number, number]): [number, number] {
  const alongX = Math.min(Math.max(x, 0), MOCK_WIDTH);
  const alongY = Math.min(Math.max(y, 0), MOCK_HEIGHT);
  // How far inside each edge the pointer is, negative past it.
  const edges = [
    { inside: x, point: [-ENTRY_MARGIN, alongY] },
    { inside: MOCK_WIDTH - x, point: [MOCK_WIDTH + ENTRY_MARGIN, alongY] },
    { inside: y, point: [alongX, -ENTRY_MARGIN] },
    { inside: MOCK_HEIGHT - y, point: [alongX, MOCK_HEIGHT + ENTRY_MARGIN] },
  ] as const;
  const nearest = edges.reduce((best, edge) => (edge.inside < best.inside ? edge : best));

  return [nearest.point[0], nearest.point[1]];
}

/**
 * How far along `heading` the arrow flies from `point` to leave the window
 * and ENTRY_MARGIN past it, out of sight, or 0 from there already.
 */
export function exitDistance([x, y]: readonly [number, number], heading: number): number {
  const turn = toRadians(heading);
  const across = (from: number, step: number, size: number) => {
    if (step > 1e-9) return (size + ENTRY_MARGIN - from) / step;
    if (step < -1e-9) return (-ENTRY_MARGIN - from) / step;

    return Infinity;
  };

  return Math.max(
    0,
    Math.min(across(x, Math.cos(turn), MOCK_WIDTH), across(y, Math.sin(turn), MOCK_HEIGHT)),
  );
}

/** The point `distance` on from `from` along `heading`. */
export function pointAlong(
  [x, y]: readonly [number, number],
  heading: number,
  distance: number,
): [number, number] {
  const turn = toRadians(heading);

  return [x + Math.cos(turn) * distance, y + Math.sin(turn) * distance];
}

/** Where the tip sits in the still frame. */
export const STILL_FRAME_TIP = arrowTip(STILL_FRAME_ARROW);

/** The turn from `from` to `to`, in degrees, the short way round. */
export function shortestTurn(from: number, to: number): number {
  return ((((to - from) % 360) + 540) % 360) - 180;
}

// The J's end, in mock pixels: where the still frame's smudge meets the
// arrow.
const J_END: readonly [number, number] = [
  pointOnJ(1)[0] * MOCK_WIDTH,
  pointOnJ(1)[1] * MOCK_HEIGHT,
];

// The point of the unturned box the J's end meets in the still frame, so
// the swoop can carry that point along the J and land on the still frame.
const TRAIL = (() => {
  const { x, y, angle } = STILL_FRAME_ARROW;
  const turn = toRadians(-angle);
  const offsetX = J_END[0] - (x + BOX[0] / 2);
  const offsetY = J_END[1] - (y + BOX[1] / 2);

  return [
    BOX[0] / 2 + offsetX * Math.cos(turn) - offsetY * Math.sin(turn),
    BOX[1] / 2 + offsetX * Math.sin(turn) + offsetY * Math.cos(turn),
  ] as const;
})();

/**
 * The arrow `t` of the way along its swoop back in along the J: from below
 * the window's bottom-left, pointing the way the J runs, easing round to
 * the still frame's heading as it lands on the still frame.
 */
export function swoopPose(t: number): ArrowPose {
  const [x, y] = pointOnJ(t);
  const pathHeading = headingOnJ(t);
  // Smoothstep from 0.55 to 1, so the turn to the still frame's heading
  // starts past halfway and settles as the arrow lands.
  const settle = Math.min(Math.max((t - 0.55) / 0.45, 0), 1);
  const blend = settle * settle * (3 - 2 * settle);
  const heading = pathHeading + shortestTurn(pathHeading, STILL_FRAME_HEADING) * blend;

  return arrowWithPointAt(TRAIL, [x * MOCK_WIDTH, y * MOCK_HEIGHT], angleForHeading(heading));
}
