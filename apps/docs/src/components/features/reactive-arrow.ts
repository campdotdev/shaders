/**
 * The Reactive card's arrow (SHA-216): its pose in the still frame, its
 * pose while it follows the pointer, pointing the way the pointer moves,
 * and where its tip is in any pose. Lengths are mock pixels in the 312 by
 * 309 illustration, angles are degrees clockwise, as CSS turns them, and
 * reactive-illustration.module.css draws the arrow from a pose.
 */

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

// Where the tip sits from the box's center once the box turns by `angle`.
function tipFromCenter(angle: number): [number, number] {
  const fromCenterX = TIP[0] - BOX[0] / 2;
  const fromCenterY = TIP[1] - BOX[1] / 2;
  const turn = toRadians(angle);

  return [
    fromCenterX * Math.cos(turn) - fromCenterY * Math.sin(turn),
    fromCenterX * Math.sin(turn) + fromCenterY * Math.cos(turn),
  ];
}

/** The pose that turns the arrow by `angle` with its tip on `pointer`. */
export function arrowAtPointer(
  [pointerX, pointerY]: readonly [number, number],
  angle: number,
): ArrowPose {
  const [tipX, tipY] = tipFromCenter(angle);

  return { x: pointerX - BOX[0] / 2 - tipX, y: pointerY - BOX[1] / 2 - tipY, angle };
}

/** Where the tip is in `pose`. */
export function arrowTip({ x, y, angle }: ArrowPose): [number, number] {
  const [tipX, tipY] = tipFromCenter(angle);

  return [x + BOX[0] / 2 + tipX, y + BOX[1] / 2 + tipY];
}

/**
 * The heading of a move by (`dx`, `dy`), counted on from `current` so the
 * turn to it is never more than half a turn. A heading can run past 180,
 * so a spring that follows it always turns the short way round.
 */
export function headingToward(current: number, dx: number, dy: number): number {
  const target = (Math.atan2(dy, dx) * 180) / Math.PI;
  const turn = ((((target - current) % 360) + 540) % 360) - 180;

  return current + turn;
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
