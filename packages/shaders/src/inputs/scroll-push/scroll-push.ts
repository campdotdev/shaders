// Scroll push (SHA-225) as a state machine with no DOM in it: a touch that
// scrolls the page pushes at the finger, once per frame, on through the
// fling. CursorInput feeds it touches from passive listeners, so it never
// decides anything about scrolling. Only the PushStroke type is on the
// engine barrel; the tracker itself is internal.

// ----------------------------------------------------------------------------
// Tuning
// ----------------------------------------------------------------------------

/**
 * Frames the canvas must hold still before a fling counts as over. A fling
 * decays smoothly, so a still frame or two can be a frame the browser
 * skipped rather than the end. Raise it and the push lingers after the page
 * stops; lower it and a slow fling's tail may end early.
 */
export const FLING_SETTLE_FRAMES = 3;

/**
 * How far a finger may wander from where it landed before the brush starts
 * following it, in CSS pixels. A resting finger wobbles a pixel or two, and
 * without this the wobble would push. Raise it and a slow sideways drag
 * starts later; lower it and a resting finger stirs the effect.
 */
export const RESTING_WOBBLE_PX = 4;

// ----------------------------------------------------------------------------
// Snapshots in, strokes out
// ----------------------------------------------------------------------------

/** One finger: the browser's touch identifier and its client position, in CSS pixels. */
export interface TouchPoint {
  id: number;
  x: number;
  y: number;
}

export interface TouchSnapshot {
  /** Every finger on the screen after this event, wherever it landed. */
  touches: readonly TouchPoint[];
  /** The fingers this event is about. */
  changed: readonly TouchPoint[];
}

/** The canvas's client rect, in CSS pixels. */
export interface CanvasRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * One frame's stroke, from a push or a scripted stroke: the segment the
 * brush swept, in 0..1 canvas units with [0, 0] at the top-left and the
 * segment ending at the brush, plus the presence that gates it. The shape
 * the wave field's stroke already has.
 */
export interface PushStroke {
  from: readonly [number, number];
  to: readonly [number, number];
  /** 1 while the brush is on the canvas, 0 once it is off it. */
  presence: number;
}

/**
 * - `idle`: no contact.
 * - `down`: one finger down on the canvas.
 * - `fling`: the finger lifted and the page may still be moving.
 * - `pinch`: a second finger came down, so nothing pushes until every
 *   finger lifts.
 */
export type PushPhase = 'idle' | 'down' | 'fling' | 'pinch';

export interface PushTracker {
  getPhase: () => PushPhase;
  touchStart: (snapshot: TouchSnapshot, rect: CanvasRect) => void;
  touchMove: (snapshot: TouchSnapshot, rect: CanvasRect) => void;
  /**
   * For every touchstart on the page, wherever the finger landed, after
   * `touchStart` has seen one that landed on the canvas. A second finger
   * makes a pinch, and a finger off the canvas ends a fling.
   */
  touchStartAnywhere: (snapshot: TouchSnapshot) => void;
  /** For both touchend and touchcancel. */
  touchEnd: (snapshot: TouchSnapshot) => void;
  /**
   * For every touchend and touchcancel on the page, wherever the finger
   * lifted. A pinch's last finger may have landed off the canvas, so only
   * this sees it lift.
   */
  touchEndAnywhere: (snapshot: TouchSnapshot) => void;
  /** Once per rendered frame: this frame's stroke, or nothing to push. */
  frame: (rect: CanvasRect) => PushStroke | undefined;
  /** Ends the contact now, for a host that stops tracking mid-push. */
  cancel: () => void;
}

interface Point {
  x: number;
  y: number;
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

const toCanvas = (touch: TouchPoint, rect: CanvasRect): Point => ({
  x: touch.x - rect.left,
  y: touch.y - rect.top,
});

/**
 * The stroke for one frame's push: it ends at the brush and starts one
 * push behind it, in canvas units, so the effect moves the way the finger
 * did. A brush off the canvas pushes with no presence.
 */
function toStroke(brush: Point, push: Point, rect: CanvasRect): PushStroke {
  const to = [brush.x / rect.width, brush.y / rect.height] as const;
  const from = [to[0] - push.x / rect.width, to[1] - push.y / rect.height] as const;
  const onCanvas = to[0] >= 0 && to[0] < 1 && to[1] >= 0 && to[1] < 1;

  return { from, to, presence: onCanvas ? 1 : 0 };
}

// ----------------------------------------------------------------------------
// The tracker
// ----------------------------------------------------------------------------

/**
 * `onContactStart` runs when a lone finger lands, so a host that draws on
 * demand can start drawing again. `onContactEnd` runs once for each start,
 * when that contact is over and nothing more will push.
 */
export function createPushTracker(
  onContactStart?: () => void,
  onContactEnd?: () => void,
): PushTracker {
  let phase: PushPhase = 'idle';
  // Whether a contact that `onContactStart` announced is still going.
  let inContact = false;
  let fingerId: number | null = null;
  // The brush, in CSS pixels from the canvas's top-left corner, and where
  // the brush and the canvas were on the last frame.
  let brush: Point | null = null;
  let previousBrush: Point | null = null;
  let previousRect: CanvasRect | null = null;
  let stillFrames = 0;
  // Where the finger landed, in client pixels, until it wanders far enough
  // to count as moving. Null once the brush follows it.
  let restingAt: TouchPoint | null = null;

  const reset = () => {
    phase = 'idle';
    fingerId = null;
    brush = null;
    previousBrush = null;
    previousRect = null;
    restingAt = null;
    if (!inContact) return;
    inContact = false;
    onContactEnd?.();
  };

  // A second finger, anywhere on the screen, makes this a pinch or some
  // other gesture the browser owns. A finger that lands off the canvas
  // sends the canvas no touchstart, so moves check for it too.
  const startPinch = () => {
    fingerId = null;
    brush = null;
    phase = 'pinch';
  };

  // Whether the finger has wandered far enough from where it landed to move
  // the brush. Once it has, it stays moving for the rest of the contact.
  const isMoving = (touch: TouchPoint): boolean => {
    if (restingAt && Math.hypot(touch.x - restingAt.x, touch.y - restingAt.y) <= RESTING_WOBBLE_PX)
      return false;
    restingAt = null;

    return true;
  };

  // A pinch ends once every finger has lifted, whichever lifted last.
  const endPinchOnLastLift = (snapshot: TouchSnapshot) => {
    if (phase === 'pinch' && snapshot.touches.length === 0) reset();
  };

  const findTracked = (points: readonly TouchPoint[]) =>
    points.find((point) => point.id === fingerId);

  // Counts the frames the canvas has held still during a fling, and ends
  // the contact once there are enough. Returns whether the fling is over.
  const flingSettled = (canvasMoved: boolean): boolean => {
    stillFrames = canvasMoved ? 0 : stillFrames + 1;
    if (stillFrames < FLING_SETTLE_FRAMES) return false;
    reset();

    return true;
  };

  return {
    getPhase: () => phase,

    touchStart(snapshot, rect) {
      if (snapshot.touches.length > 1) {
        startPinch();

        return;
      }
      const [touch] = snapshot.changed;

      if (!touch) return;
      // A lone finger ends whatever came before, including a fling: the
      // touch stops the page, and its brush must not join the old one. The
      // rect is read as the event arrives, so the brush lands where the
      // finger is on the canvas even mid-scroll.
      reset();
      fingerId = touch.id;
      restingAt = touch;
      brush = toCanvas(touch, rect);
      previousBrush = brush;
      previousRect = rect;
      stillFrames = 0;
      phase = 'down';
      inContact = true;
      onContactStart?.();
    },

    touchMove(snapshot, rect) {
      if (phase === 'down' && snapshot.touches.length > 1) startPinch();
      const touch = phase === 'down' ? findTracked(snapshot.changed) : undefined;

      if (touch && isMoving(touch)) brush = toCanvas(touch, rect);
    },

    touchStartAnywhere(snapshot) {
      // A finger on the canvas has already turned a fling into a new
      // contact, so a fling still running means this one landed off the
      // canvas. It stops the page, and the scroll it starts is not a push.
      if (phase === 'fling') reset();
      // A second finger off the canvas reaches no canvas listener, so while
      // the first finger holds still and sends no move, only this sees it.
      if (phase === 'down' && snapshot.touches.length > 1) startPinch();
    },

    touchEnd(snapshot) {
      endPinchOnLastLift(snapshot);
      if (phase !== 'down' || !findTracked(snapshot.changed)) return;
      // A finger still on the screen landed off the canvas and has not
      // moved since, so no move saw it. That makes this a pinch, not a fling.
      if (snapshot.touches.length > 0) {
        startPinch();

        return;
      }
      stillFrames = 0;
      phase = 'fling';
    },

    touchEndAnywhere: endPinchOnLastLift,

    frame(rect) {
      if (!brush || !previousBrush || !previousRect) return undefined;

      // How far the finger moved on screen since the last frame: the
      // canvas's movement plus the brush's movement across the canvas.
      // During a plain scroll the finger is pinned to the canvas, so it is
      // all canvas. During a fling it is all canvas, because the brush
      // rests where the finger lifted.
      const canvas = { x: rect.left - previousRect.left, y: rect.top - previousRect.top };
      const push = {
        x: canvas.x + brush.x - previousBrush.x,
        y: canvas.y + brush.y - previousBrush.y,
      };
      const pushingBrush = brush;

      previousRect = rect;
      previousBrush = brush;
      if (phase === 'fling' && flingSettled(canvas.x !== 0 || canvas.y !== 0)) return undefined;
      if (push.x === 0 && push.y === 0) return undefined;

      return toStroke(pushingBrush, push, rect);
    },

    cancel: reset,
  };
}
