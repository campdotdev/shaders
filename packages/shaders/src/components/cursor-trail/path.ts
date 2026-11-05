// Records the pointer's recent path for CursorTrail, so the trail is drawn
// as one shape that tapers from the head at the pointer to the end of the
// path behind it. When the pointer stops, the tail shortens along the path
// into the head. Plain numbers, no GPU: field.ts draws what pack() returns.
// Lives beside the component.
import type { PushStroke, Vector2 } from '../../engine.js';

/** Most points pack() writes, and the bound of the shader's loop. */
export const MAX_POINTS = 96;
// Closest two recorded points may sit, in canvas heights. A closer move
// slides the head instead of adding a point, so a slow pointer doesn't
// spend the budget on points a texel apart.
const MIN_SPACING = 0.004;
// Longest the head may go unheld, in seconds, beyond one frame, for a
// stroke to carry on the same piece of path. After a longer rest with hold
// off, a stroke starts a new piece, so the head that was fading away isn't
// pulled back to full strength.
const RESUME_SECONDS = 0.05;
// How the shape narrows toward the tail, as a power of the share of the
// path still ahead of each point. Below 1, the tail stays full for longer
// and comes to a point at the end.
const WIDTH_TAPER = 0.5;
// Straight steps per rounded corner before the curve is laid out evenly.
// Four keeps each step's sag off the true curve well under a pixel.
const CURVE_STEPS = 4;

// A position as the Input hands it over: x, y in top-left canvas coordinates.
type Position = Vector2 | readonly [number, number];

interface Point {
  /** Top-left canvas coordinates, 0..1 on both axes. */
  x: number;
  y: number;
}

/** One unbroken run of path, oldest point first, so the head is last. */
interface Piece {
  points: Point[];
  /** When the pointer last moved this piece or rested on its head with hold on. */
  heldAt: number;
  /** How far the tail reaches back along the path, in canvas heights. */
  length: number;
  /** How fast the tail draws in, in canvas heights per second. */
  pace: number;
}

export interface PathStep {
  /** Seconds since the last step. */
  delta: number;
  /** The stroke the pointer drew this frame, in top-left canvas coordinates, or null. */
  stroke: PushStroke | null;
  /** Where the pointer rests while hold is on, or null to let the head fade. */
  rest: Vector2 | null;
  /** Brush radius, in canvas heights. The whole shape takes it. */
  radius: number;
  /** Seconds the tail takes to draw in, and the head to fade without hold. */
  decay: number;
  /** How far along the path, in canvas heights, each point is averaged with its neighbors. */
  smoothing: number;
  /** Canvas width over height, so lengths are measured in canvas heights. */
  aspect: number;
  /** Keep no path while disabled, only a resting head. */
  disabled: boolean;
}

export interface TrailPath {
  /** Record this frame's stroke or rest, then draw the tail in. */
  step: (step: PathStep) => void;
  /**
   * Write the path into `out` as x, y, width, and heat per point, with y
   * flipped to bottom-left texture coordinates, and return the point count.
   * The shader draws each pair of neighbors as one segment.
   */
  pack: (out: Float32Array) => number;
}

// ---- Curving and spacing the path for the shader
// The recorded points are one frame's move apart, so a fast pointer leaves
// long straight runs with a corner at each. pack() rounds those corners with
// a curve, then lays points evenly along it, so the shader draws a smooth
// stroke and a long trail fits the point budget. `smoothing` then averages
// each of those points with its neighbors, which evens out a shaky hand.
// How far apart two points are, in canvas heights.
type Measure = (a: Point, b: Point) => number;

const between = (from: Point, to: Point, share: number): Point => ({
  x: from.x + (to.x - from.x) * share,
  y: from.y + (to.y - from.y) * share,
});

function lineLength(line: Point[], measure: Measure) {
  return line.reduce((sum, here, at) => {
    const before = line[at - 1];

    return before ? sum + measure(before, here) : sum;
  }, 0);
}

// One rounded corner: a curve from `start` to `end` that bends toward
// `corner`, in CURVE_STEPS straight steps, leaving out `end`.
function bend(start: Point, corner: Point, end: Point): Point[] {
  return Array.from({ length: CURVE_STEPS }, (_, step) => {
    const share = step / CURVE_STEPS;

    return between(between(start, corner, share), between(corner, end, share), share);
  });
}

// Round each corner of the path with a curve: from the middle of the run
// before a point to the middle of the run after it, bending toward the
// point. Each curve leaves in the direction the last one arrived, so the
// path has no corners. Straight runs at the ends reach the tail and the
// head, so both stay where they are.
function round(points: Point[]): Point[] {
  const tail = points[0];
  const head = points.at(-1);

  if (!tail || !head || points.length < 3) return points;
  const middles = points.slice(1).map((after, at) => between(points[at] ?? after, after, 0.5));
  const bends = points
    .slice(1, -1)
    .flatMap((corner, at) => bend(middles[at] ?? corner, corner, middles[at + 1] ?? corner));

  return [tail, ...bends, middles.at(-1) ?? head, head];
}

// Lay points `spacing` apart along the line, head first, ending at the
// tail. A line too long for `room` points gets wider spacing. `along` is
// each point's distance back from the head.
function layOut(line: Point[], spacing: number, room: number, measure: Measure) {
  const length = lineLength(line, measure);
  const step = Math.max(spacing, length / Math.max(1, room - 2));
  const head = line.at(-1);
  const points = head ? [head] : [];
  const along = [0];
  let walked = 0;
  let next = step;

  for (let at = line.length - 1; at > 0; at -= 1) {
    const newer = line[at];
    const older = line[at - 1];

    if (!newer || !older) continue;
    const span = measure(newer, older);

    // Stop short of the tail, which is added at its exact place below.
    while (walked + span >= next && next < length - step * 0.5) {
      points.push(between(newer, older, (next - walked) / span));
      along.push(next);
      next += step;
    }
    walked += span;
  }
  const tail = line[0];

  if (tail && line.length > 1) {
    points.push(tail);
    along.push(length);
  }

  return { points, along, length };
}

// Average each point with its neighbors within `smoothing` along the path,
// weighting nearer ones more. The reach narrows toward both ends, so the
// head stays on the pointer and the tail on the path.
function smooth(points: Point[], along: number[], length: number, smoothing: number): Point[] {
  return points.map((here, at) => {
    const from = along[at] ?? 0;
    const reach = Math.min(smoothing, from, length - from);

    if (reach <= 0) return here;
    let x = 0;
    let y = 0;
    let total = 0;

    points.forEach((neighbor, other) => {
      const weight = 1 - Math.abs((along[other] ?? 0) - from) / reach;

      if (weight <= 0) return;
      x += neighbor.x * weight;
      y += neighbor.y * weight;
      total += weight;
    });

    return { x: x / total, y: y / total };
  });
}

// ---- Recording the pointer's path
// The tail's length is a running total, not a window of time. Each move
// adds its distance, and the tail draws in by its own length over `decay`
// seconds, so a pointer moving at a steady speed trails as far as it
// travels in `decay` seconds. When the pointer stops, the tail keeps the
// last pace it drew in at, so it starts shortening at once and reaches the
// head in `decay` seconds, however long ago the stroke began.
//
// The whole shape takes the brush's current radius, so when `grow` eases the
// brush back after a fast move, the tail thins with the head instead of
// keeping the size it was drawn at until it draws in.
export function createTrailPath(): TrailPath {
  let pieces: Piece[] = [];
  let now = 0;
  let aspect = 1;
  let decay = 0;
  let radius = 0;
  let smoothing = 0;

  const distance: Measure = (a, b) => Math.hypot((a.x - b.x) * aspect, a.y - b.y);
  const point = ([x, y]: Position): Point => ({ x, y });
  const newPiece = (points: Point[], length: number): Piece => ({
    points,
    heldAt: now,
    length,
    pace: 0,
  });

  // A move closer than MIN_SPACING to the point before the head slides the
  // head there. Anything farther adds a point.
  const extend = (piece: Piece, next: Point) => {
    const { points } = piece;
    const before = points.at(-2);

    if (before && distance(before, next) < MIN_SPACING) points[points.length - 1] = next;
    else points.push(next);
  };

  // A piece carries on when the move starts at its head and the head was
  // held until the frame before.
  const continues = (piece: Piece | undefined, from: Position, delta: number): piece is Piece => {
    const head = piece?.points.at(-1);

    return (
      piece !== undefined &&
      head !== undefined &&
      now - delta - piece.heldAt <= RESUME_SECONDS &&
      distance(head, point(from)) < MIN_SPACING
    );
  };

  // Carry the live piece on to the end of the stroke, or start a new piece
  // with it. Returns the piece the stroke moved.
  const record = (live: Piece | undefined, stroke: PushStroke, elapsed: number): Piece => {
    const to = point(stroke.to);

    if (continues(live, stroke.from, elapsed)) {
      live.length += distance(live.points.at(-1) ?? to, to);
      extend(live, to);

      return live;
    }
    const from = point(stroke.from);
    const piece = newPiece([from, to], distance(from, to));

    pieces.push(piece);

    return piece;
  };

  // 1 while the head is held, falling to 0 over `decay` seconds once it isn't.
  const fade = (piece: Piece) => {
    if (piece.heldAt >= now) return 1;

    return decay > 0 ? Math.max(0, 1 - (now - piece.heldAt) / decay) : 0;
  };

  // Cut the path at the tail's length back from the head, keeping a point
  // exactly there, slid along the segment it falls in, so the tail end moves
  // smoothly along the path instead of jumping from point to point.
  const trim = ({ points, length }: Piece) => {
    let reached = 0;

    for (let at = points.length - 2; at >= 0; at -= 1) {
      const older = points[at];
      const newer = points[at + 1];

      if (!older || !newer) return;
      const span = distance(older, newer);

      if (reached + span >= length) {
        const share = span > 0 ? (length - reached) / span : 0;

        points.splice(0, at + 1, between(newer, older, share));

        return;
      }
      reached += span;
    }
  };

  // Draw the tail in. A piece the pointer moved this frame sets its pace
  // from its length, so the tail settles at the distance the pointer covers
  // in `decay` seconds. A piece left alone keeps its last pace, so it draws
  // in at a steady speed and ends at the head in `decay` seconds.
  const drawIn = (target: Piece, moved: boolean, elapsed: number) => {
    if (decay <= 0) {
      target.length = 0;
    } else {
      if (moved) target.pace = target.length / decay;
      target.length = Math.max(0, target.length - target.pace * elapsed);
    }
    trim(target);
  };

  return {
    step({
      delta,
      stroke,
      rest,
      radius: nextRadius,
      decay: nextDecay,
      smoothing: nextSmoothing,
      aspect: nextAspect,
      disabled,
    }) {
      const elapsed = Math.max(0, delta);

      now += elapsed;
      aspect = nextAspect;
      decay = Math.max(0, nextDecay);
      radius = Math.max(0, nextRadius);
      smoothing = Math.max(0, nextSmoothing);
      if (disabled) {
        // A resting head, held where the pointer is, and no path behind it.
        pieces = rest ? [newPiece([point(rest)], 0)] : [];

        return;
      }
      const live = pieces.at(-1);
      let moved: Piece | null = null;

      if (stroke && stroke.presence > 0) {
        moved = record(live, stroke, elapsed);
        moved.heldAt = now;
      } else if (rest) {
        // Resting holds the head without moving it, and the tail draws in
        // behind it.
        if (continues(live, rest, elapsed)) live.heldAt = now;
        else pieces.push(newPiece([point(rest)], 0));
      }
      for (const each of pieces) drawIn(each, each === moved, elapsed);
      pieces = pieces.filter((each) => fade(each) > 0);
    },

    pack(out) {
      const capacity = Math.min(MAX_POINTS, Math.floor(out.length / 4));
      let count = 0;
      const write = (at: Point, width: number, heat: number) => {
        out.set([at.x, 1 - at.y, width, heat], count * 4);
        count += 1;
      };
      // Newest piece first, so a full budget drops the oldest.
      const lines = pieces.map((piece) => ({ piece, line: round(piece.points) })).reverse();
      // Each piece spends three points on its zero point, its doubled head,
      // and its tail. Space the rest evenly over every piece's length.
      const total = lines.reduce((sum, { line }) => sum + lineLength(line, distance), 0);
      const spacing = Math.max(MIN_SPACING, total / Math.max(1, capacity - 3 * lines.length));

      for (const { piece, line } of lines) {
        const room = capacity - count - 2;

        if (room < 2) break;
        const { points, along, length } = layOut(line, spacing, room, distance);
        const smoothed = smooth(points, along, length, smoothing);
        const strength = fade(piece);
        const shape = (at: number) => {
          const ahead = length > 0 ? 1 - (along[at] ?? 0) / length : 1;
          const source = smoothed[at];

          if (source) write(source, radius * ahead ** WIDTH_TAPER * strength, ahead * strength);
        };
        const head = smoothed[0];

        if (!head) continue;
        // A zero point at the head first, so the segment from the last
        // piece's tail draws nothing.
        write(head, 0, 0);
        // The head twice: the zero-length segment between the copies draws
        // the head as a whole disc, whatever the path behind it does. A
        // tail only a little longer than nothing tapers all the way to 0
        // inside the disc, and without this would cut off its back half.
        shape(0);
        for (let at = 0; at < smoothed.length; at += 1) shape(at);
      }

      return count;
    },
  };
}
