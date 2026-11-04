// Records the pointer's recent path for CursorTrail, so the trail is drawn
// as one shape that follows it. The head sits at the pointer, and the shape
// tapers from the head to the end of the path behind it, so when the
// pointer stops, the tail shortens along the path into the head instead of
// thinning in place. Plain numbers, no GPU: field.ts draws what pack()
// returns. Lives beside the component.
//
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

export function createTrailPath(): TrailPath {
  let pieces: Piece[] = [];
  let now = 0;
  let aspect = 1;
  let decay = 0;
  let radius = 0;

  const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.hypot((a.x - b.x) * aspect, a.y - b.y);
  const point = ([x, y]: Vector2 | readonly [number, number]): Point => ({ x, y });
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
  const continues = (
    piece: Piece | undefined,
    from: Vector2 | readonly [number, number],
    delta: number,
  ): piece is Piece => {
    const head = piece?.points.at(-1);

    return (
      piece !== undefined &&
      head !== undefined &&
      now - delta - piece.heldAt <= RESUME_SECONDS &&
      distance(head, { x: from[0], y: from[1] }) < MIN_SPACING
    );
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

        points.splice(0, at + 1, {
          x: newer.x + (older.x - newer.x) * share,
          y: newer.y + (older.y - newer.y) * share,
        });

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
      aspect: nextAspect,
      disabled,
    }) {
      const elapsed = Math.max(0, delta);

      now += elapsed;
      aspect = nextAspect;
      decay = Math.max(0, nextDecay);
      radius = Math.max(0, nextRadius);
      if (disabled) {
        // A resting head, held where the pointer is, and no path behind it.
        pieces = rest ? [newPiece([point(rest)], 0)] : [];

        return;
      }
      const live = pieces.at(-1);
      let moved: Piece | null = null;

      if (stroke && stroke.presence > 0) {
        const head = live?.points.at(-1);
        const to = point(stroke.to);

        if (live && head && continues(live, stroke.from, elapsed)) {
          live.length += distance(head, to);
          extend(live, to);
          moved = live;
        } else {
          const from = point(stroke.from);

          moved = newPiece([from, to], distance(from, to));
          pieces.push(moved);
        }
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
      for (let index = pieces.length - 1; index >= 0; index -= 1) {
        const piece = pieces[index];

        if (!piece || count + 4 > capacity) break;
        const { points } = piece;
        const head = points.at(-1);

        if (!head) continue;
        // Distance back along the path from the head to each point.
        const along = new Array<number>(points.length).fill(0);

        for (let at = points.length - 2; at >= 0; at -= 1) {
          const here = points[at];
          const next = points[at + 1];

          if (here && next) along[at] = (along[at + 1] ?? 0) + distance(here, next);
        }
        const length = along[0] ?? 0;
        const strength = fade(piece);
        const shape = (at: number) => {
          const ahead = length > 0 ? 1 - (along[at] ?? 0) / length : 1;
          const source = points[at];

          if (source)
            write(source, radius * ahead ** WIDTH_TAPER * strength, ahead * strength);
        };

        // A zero point at the head first, so the segment from the last
        // piece's tail draws nothing.
        write(head, 0, 0);
        // The head twice: the zero-length segment between the copies draws
        // the head as a whole disc, whatever the path behind it does. A
        // tail only a little longer than nothing tapers all the way to 0
        // inside the disc, and without this would cut off its back half.
        shape(points.length - 1);
        shape(points.length - 1);
        // Thin a path longer than the budget left, keeping both ends.
        const room = capacity - count;
        const stride = Math.max(1, Math.ceil(points.length / Math.max(1, room - 1)));

        for (let at = points.length - 1 - stride; at > 0; at -= stride) shape(at);
        if (points.length > 1) shape(0);
      }

      return count;
    },
  };
}
