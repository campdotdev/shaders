// The pointer as a framework-free Input: it normalizes window pointer moves
// to an element's rect and keeps the raw target, presence, and its own
// smoothed position. A ShaderScene owns one that every useCursor call reads.
// With scroll push on, it also turns a touch that scrolls the page over the
// element into one push stroke per tick, which every reader shares.
import {
  type CanvasRect,
  createPushTracker,
  type PushStroke,
  type PushTracker,
  type TouchPoint,
} from '../scroll-push/scroll-push.js';
import { Smoother } from './smoother.js';

// ----------------------------------------------------------------------------
// Options and constants
// ----------------------------------------------------------------------------

export type Vector2 = readonly [number, number];

export interface CursorInputOptions {
  /**
   * Smoothing factor: 0 = no smoothing (snap to target instantly).
   * 1 = max smoothing (essentially never reaches target).
   * Sensible default: 0.1.
   *
   * Implementation: per-frame, value moves toward target by `(1 - smoothing) * delta * 60`,
   * roughly meaning "at smoothing=0.1, ~90% of the gap is closed in 1 second at 60fps."
   */
  smoothing?: number;
  /** Starting position. Default: [0.5, 0.5] (center). */
  initial?: Vector2;
  /** Listen on this target. Default: window. */
  target?: EventTarget;
  /**
   * Element to normalize cursor coordinates against. Default: window viewport.
   *
   * When set, cursor x/y are in [0,1] across the element's bounding rect, with
   * extrapolation outside (negative when left/above, >1 when right/below). This
   * matches what shader UV space expects: a cursor at the canvas's top-left
   * corner reads as (0, 0); at bottom-right as (1, 1); regardless of where the
   * canvas sits in the viewport. Without this, components inside a partial-
   * viewport scene (e.g. a 70vh hero section) see a cursor offset that scales
   * with the canvas's vertical position on the page.
   */
  element?: {
    getBoundingClientRect(): { left: number; top: number; width: number; height: number };
  };
}

/**
 * Gap below which the smoothed position snaps onto its target, per axis, in
 * canvas units where 1 is the canvas width on x and the canvas height on y.
 * 1e-4 is under one device pixel on any canvas smaller than 10,000 pixels on
 * both sides, so the snap is not visible there. Raising it settles sooner
 * but can be seen as a final hop on a large canvas; lowering it draws more
 * invisible frames before idling.
 */
export const POSITION_SETTLE_THRESHOLD = 1e-4;

/**
 * A point code moves to draw a scripted stroke, in the same 0..1 frame as
 * `getTarget()` and unclamped. Anything with `get` and `on('change')`
 * qualifies, such as Motion's MotionValue.
 */
export interface StrokeSource {
  get(): Vector2;
  on(event: 'change', listener: (value: Vector2) => void): () => void;
}

// ----------------------------------------------------------------------------
// Touch events into scroll push
// ----------------------------------------------------------------------------

// Desktop Safari and Firefox define no TouchEvent global, so the handlers
// read the lists off the event instead of checking its class.
interface TouchListLike {
  readonly length: number;
  [index: number]: { identifier: number; clientX: number; clientY: number };
}

interface TouchEventLike extends Event {
  touches: TouchListLike;
  changedTouches: TouchListLike;
}

const isTouchEvent = (event: Event): event is TouchEventLike => 'touches' in event;

const isEventTarget = (value: unknown): value is EventTarget =>
  typeof value === 'object' &&
  value !== null &&
  'addEventListener' in value &&
  typeof value.addEventListener === 'function';

const toPoints = (list: TouchListLike): TouchPoint[] =>
  Array.from({ length: list.length }, (_, index) => {
    const touch = list[index];

    return { id: touch?.identifier ?? -1, x: touch?.clientX ?? 0, y: touch?.clientY ?? 0 };
  });

const toSnapshot = (event: TouchEventLike) => ({
  touches: toPoints(event.touches),
  changed: toPoints(event.changedTouches),
});

// A source may hand back one array it mutates, so keep a copy of each point.
const copy = ([x, y]: Vector2): Vector2 => [x, y];

// Passive, so the page scrolls and zooms without waiting on the scene.
// Scroll push never cancels a touch.
const PASSIVE = { passive: true } as const;

// ----------------------------------------------------------------------------
// The input: listen, normalize, smooth, dispose
// ----------------------------------------------------------------------------

/**
 * Smoothed pointer tracker emitting a normalized (0..1) Vec2 position.
 * Implements the AnimatableSignal protocol (`get()` + `on('change', cb)`)
 * so it composes with Motion's `useTransform` and similar tools.
 */
export class CursorInput {
  private readonly position: Smoother;
  private target: Vector2 | null = null;
  private targetDirty = false;
  private inside = false;
  private readonly listeners = new Set<(value: Vector2) => void>();
  private readonly moveListeners = new Set<() => void>();
  private readonly eventTarget: EventTarget;
  private readonly element: CursorInputOptions['element'];
  private readonly handlePointerMove: (e: Event) => void;
  private disposed = false;
  // Scroll push: the tracker exists while it is on, and the stroke is the
  // one the last tick worked out.
  private pushTracker: PushTracker | null = null;
  private framePush: PushStroke | null = null;
  private readonly pushStartListeners = new Set<() => void>();
  // Scripted stroke: the attached source, where its stroke goes on from,
  // and the stroke the last tick worked out.
  private strokeSource: StrokeSource | null = null;
  private strokeFrom: Vector2 | null = null;
  private frameScripted: PushStroke | null = null;
  private readonly handleTouchStart = (event: Event) => {
    if (isTouchEvent(event)) this.pushTracker?.touchStart(toSnapshot(event), this.readRect());
  };
  private readonly handleTouchMove = (event: Event) => {
    if (isTouchEvent(event)) this.pushTracker?.touchMove(toSnapshot(event), this.readRect());
  };
  private readonly handleTouchEnd = (event: Event) => {
    if (isTouchEvent(event)) this.pushTracker?.touchEnd(toSnapshot(event));
  };
  // A finger that lands off the element sends the element no touchstart,
  // but every touchstart bubbles to the listen target, after the element's
  // own handler has seen one that landed on it. The tracker needs it for a
  // second finger that holds still, and for a finger that ends a fling.
  private readonly handleAnyTouchStart = (event: Event) => {
    if (isTouchEvent(event)) this.pushTracker?.touchStartAnywhere(toSnapshot(event));
  };

  constructor(opts: CursorInputOptions = {}) {
    const { smoothing = 0.1, initial = [0.5, 0.5], target, element } = opts;

    this.position = new Smoother(initial, {
      smoothing,
      settleThreshold: POSITION_SETTLE_THRESHOLD,
    });
    this.eventTarget = target ?? (typeof window !== 'undefined' ? window : new EventTarget());
    this.element = element;

    this.handlePointerMove = (e: Event) => {
      if (!(e instanceof MouseEvent)) return;
      const pointerEvent = e;

      if (this.isPushedTouch(pointerEvent)) return;

      if (this.element) {
        // Normalize to 0..1 across the element's bounding rect. Reading the
        // rect on every move is fine — `getBoundingClientRect` is cheap and
        // pointermove is already throttled to ~60Hz by the browser. The
        // benefit is tracking the element's position even if it moved or
        // scrolled since the last frame.
        const elementRect = this.element.getBoundingClientRect();
        const elementWidth = elementRect.width || 1;
        const elementHeight = elementRect.height || 1;

        this.target = [
          (pointerEvent.clientX - elementRect.left) / elementWidth,
          (pointerEvent.clientY - elementRect.top) / elementHeight,
        ];
      } else {
        // Fallback: viewport-normalized. Used when no element is supplied —
        // mostly the standalone-API case for users not consuming through
        // <ShaderScene>'s context.
        const viewportWidth = (typeof window !== 'undefined' && window.innerWidth) || 1;
        const viewportHeight = (typeof window !== 'undefined' && window.innerHeight) || 1;

        this.target = [pointerEvent.clientX / viewportWidth, pointerEvent.clientY / viewportHeight];
      }
      // Inside means within the 0..1 frame on both axes: the near edges
      // count, the far edges do not, the way a 0..1 canvas coordinate does.
      const [targetX, targetY] = this.target;

      this.inside = targetX >= 0 && targetX < 1 && targetY >= 0 && targetY < 1;
      this.position.setTarget(this.target);
      this.targetDirty = true;
      for (const moveListener of this.moveListeners) moveListener();
    };

    // pointermove rather than mousemove: it fires for mouse, touch, and pen
    // alike, and every PointerEvent is a MouseEvent, so the normalization
    // above reads the same clientX and clientY.
    this.eventTarget.addEventListener('pointermove', this.handlePointerMove);
  }

  /** Current smoothed position. Implements AnimatableSignal protocol. */
  get(): Vector2 {
    const [x, y] = this.position.get();

    return [x ?? 0, y ?? 0];
  }

  /**
   * The raw pointer position from the last move, before any smoothing, in
   * the same 0..1 frame as `get()`. Null until the first move, because no
   * pointer position is known yet. Consumers that run their own smoothing
   * read this, and it keeps extrapolating past the edges once the pointer
   * has left the element.
   */
  getTarget(): Vector2 | null {
    return this.target;
  }

  /**
   * Whether the last pointer move landed inside the element rect, or the
   * viewport when there is no element. False until the first move, so an
   * effect that multiplies by presence stays invisible on a fresh page.
   */
  isInside(): boolean {
    return this.inside;
  }

  /**
   * Turns scroll push on or off. While on, a finger that lands on the
   * element and scrolls the page pushes once per tick at the finger, a
   * fling keeps pushing until the element stops, and `getPush` reads the
   * stroke. Touch pointer moves stop moving the target. Needs an element
   * that takes event listeners, such as the scene's canvas, and does
   * nothing without one.
   */
  setScrollPush(enabled: boolean): void {
    const element = this.element;

    if (this.disposed || enabled === (this.pushTracker !== null)) return;
    // Checked by shape rather than class, so an element from another
    // realm, such as an iframe, still counts.
    if (!isEventTarget(element)) return;
    if (!enabled) {
      element.removeEventListener('touchstart', this.handleTouchStart);
      element.removeEventListener('touchmove', this.handleTouchMove);
      element.removeEventListener('touchend', this.handleTouchEnd);
      element.removeEventListener('touchcancel', this.handleTouchEnd);
      this.eventTarget.removeEventListener('touchstart', this.handleAnyTouchStart);
      this.pushTracker = null;
      this.framePush = null;

      return;
    }
    this.pushTracker = createPushTracker(() => {
      for (const listener of this.pushStartListeners) listener();
    });
    element.addEventListener('touchstart', this.handleTouchStart, PASSIVE);
    element.addEventListener('touchmove', this.handleTouchMove, PASSIVE);
    element.addEventListener('touchend', this.handleTouchEnd, PASSIVE);
    element.addEventListener('touchcancel', this.handleTouchEnd, PASSIVE);
    this.eventTarget.addEventListener('touchstart', this.handleAnyTouchStart, PASSIVE);
  }

  /**
   * Attaches the point a scripted stroke follows, or detaches it with null.
   * Attaching reads the point where it is now as the stroke's start and
   * draws nothing, so a point that jumped while detached starts afresh.
   * After that, each tick strokes from the last point to the current one.
   * Works with or without scroll push.
   */
  setStrokeSource(source: StrokeSource | null): void {
    if (this.disposed) return;
    this.strokeSource = source;
    this.strokeFrom = source ? copy(source.get()) : null;
    this.frameScripted = null;
  }

  /**
   * The scripted stroke from the last tick, or null when the source did not
   * move or none is attached. A reader that strokes takes it first: while a
   * source is attached (`isScripting`), the reader ignores the mouse and the
   * scroll push, and takes the mouse before the push otherwise.
   */
  getScriptedStroke(): PushStroke | null {
    return this.frameScripted;
  }

  /** Whether a scripted stroke's source is attached, moving or not. */
  isScripting(): boolean {
    return this.strokeSource !== null;
  }

  /**
   * The push stroke from the last tick, or null when nothing pushed. Every
   * reader in a frame gets the same stroke, because only `tick` changes it.
   */
  getPush(): PushStroke | null {
    return this.framePush;
  }

  /**
   * Whether a touch is pushing or may push on the next tick: a finger down
   * on the element, or a fling still running. A host that draws on demand
   * keeps drawing while this is true, so the push keeps arriving.
   */
  isPushing(): boolean {
    const phase = this.pushTracker?.getPhase();

    return phase === 'down' || phase === 'fling';
  }

  /**
   * Subscribe to the start of each scroll-push contact, when a lone finger
   * lands on the element. A parked host uses it to start drawing again, as
   * it uses `onMove` for the pointer. Returns an unsubscribe function.
   */
  onPushStart(listener: () => void): () => void {
    this.pushStartListeners.add(listener);

    return () => {
      this.pushStartListeners.delete(listener);
    };
  }

  /** Subscribe to change events. Returns an unsubscribe function. */
  on(_eventType: 'change', changeListener: (value: Vector2) => void): () => void {
    this.listeners.add(changeListener);

    return () => this.listeners.delete(changeListener);
  }

  /**
   * Subscribe to raw pointer moves. The listener runs as the new target
   * lands, before any tick smooths toward it. The input itself only changes
   * its position in `tick`, so a host that stops ticking while nothing moves
   * needs this to know when to start again: `useCursor` uses it to wake an
   * idle scene. Returns an unsubscribe function.
   */
  onMove(moveListener: () => void): () => void {
    this.moveListeners.add(moveListener);

    return () => {
      this.moveListeners.delete(moveListener);
    };
  }

  /**
   * Advance the smoothing one tick. Called by the host scheduler; not
   * typically called directly except in tests. Returns true when it notified
   * listeners this tick, because the position moved or a pointer move landed
   * a new target, so the host knows to draw another frame. Returns false
   * once the smoothing has settled on the target and nothing new arrived.
   * Set `afterIdle` only for the first tick after the host resumes from idle.
   */
  tick(delta: number, afterIdle = false): boolean {
    if (this.disposed) return false;
    // One push per tick, read from where the element sits now, so a host
    // that ticks once per frame gives every reader the same stroke.
    this.framePush = this.pushTracker?.frame(this.readRect()) ?? null;
    this.frameScripted = this.readScriptedStroke();
    const moved = this.position.tick(delta, afterIdle);

    if (!moved && !this.targetDirty) return false;

    this.targetDirty = false;
    const snapshot = this.get();

    for (const listener of this.listeners) listener(snapshot);

    return true;
  }

  /** Tear down listeners. */
  dispose(): void {
    if (this.disposed) return;
    this.setScrollPush(false);
    this.pushStartListeners.clear();
    this.disposed = true;
    this.strokeSource = null;
    this.strokeFrom = null;
    this.frameScripted = null;
    this.eventTarget.removeEventListener('pointermove', this.handlePointerMove);
    this.listeners.clear();
    this.moveListeners.clear();
  }

  // The segment from where the scripted stroke left off to where its source
  // is now. A source that has not moved strokes nothing.
  private readScriptedStroke(): PushStroke | null {
    const from = this.strokeFrom;

    if (!this.strokeSource || !from) return null;
    const to = copy(this.strokeSource.get());

    if (to[0] === from[0] && to[1] === from[1]) return null;
    this.strokeFrom = to;

    return { from, to, presence: 1 };
  }

  // Under scroll push, touch reaches cursor effects only as push strokes. A
  // finger's own pointer moves would also drag the cursor until the browser
  // took the scroll.
  private isPushedTouch(event: MouseEvent): boolean {
    return this.pushTracker !== null && 'pointerType' in event && event.pointerType === 'touch';
  }

  // The element's rect, with a zero size read as 1 so a collapsed element
  // never divides by zero. Without an element there is nothing to push on.
  private readRect(): CanvasRect {
    const rect = this.element?.getBoundingClientRect() ?? { left: 0, top: 0, width: 1, height: 1 };

    return { left: rect.left, top: rect.top, width: rect.width || 1, height: rect.height || 1 };
  }
}
