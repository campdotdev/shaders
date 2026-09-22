// The pointer as a framework-free Input. It listens on the window for
// pointermove, normalizes each move to an element's rect, and records the
// raw target and whether the pointer is inside. It also carries its own
// smoothed position, so it stands alone as an animation signal outside
// React, and a ShaderScene owns one that every useCursor call reads raw.
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

type ChangeListener = (value: Vector2) => void;
type MoveListener = () => void;

/**
 * Gap below which the smoothed position snaps onto its target, per axis, in
 * canvas units where 1 is the canvas width on x and the canvas height on y.
 * 1e-4 is under one device pixel on any canvas smaller than 10,000 pixels on
 * both sides, so the snap is not visible there. Raising it settles sooner
 * but can be seen as a final hop on a large canvas; lowering it draws more
 * invisible frames before idling.
 */
export const POSITION_SETTLE_THRESHOLD = 1e-4;

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
  private readonly listeners = new Set<ChangeListener>();
  private readonly moveListeners = new Set<MoveListener>();
  private readonly eventTarget: EventTarget;
  private readonly element: CursorInputOptions['element'];
  private readonly handlePointerMove: (e: Event) => void;
  private disposed = false;

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

  /** Subscribe to change events. Returns an unsubscribe function. */
  on(_eventType: 'change', changeListener: ChangeListener): () => void {
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
  onMove(moveListener: MoveListener): () => void {
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
    this.disposed = true;
    this.eventTarget.removeEventListener('pointermove', this.handlePointerMove);
    this.listeners.clear();
    this.moveListeners.clear();
  }
}
