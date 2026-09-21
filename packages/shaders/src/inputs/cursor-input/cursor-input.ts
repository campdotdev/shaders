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
  /**
   * Called on every pointer move, as the new target lands and before any
   * tick smooths toward it. The input itself only changes its position in
   * `tick`, so a host that stops ticking while nothing moves needs this to
   * know when to start again. `useCursor` uses it to wake an idle scene.
   */
  onMove?: () => void;
}

type ChangeListener = (value: Vector2) => void;

/**
 * Gap below which the smoothed position snaps onto its target, per axis, in
 * canvas units where 1 is the canvas width on x and the canvas height on y.
 * 1e-4 is under one device pixel on any canvas smaller than 10,000 pixels on
 * both sides, so the snap is not visible there. Raising it settles sooner
 * but can be seen as a final hop on a large canvas; lowering it draws more
 * invisible frames before idling.
 */
const SETTLE_THRESHOLD = 1e-4;

/**
 * Longest stretch of time a wake tick may smooth across, in seconds. The
 * host reports the whole gap since its last frame after a parked scene
 * wakes. Smoothing across that gap would snap the cursor to the pointer.
 * Capping the marked wake tick at one 30fps frame preserves the glide while
 * ordinary slow frames still use their full delta.
 */
const MAX_WAKE_TICK_DELTA = 1 / 30;

/**
 * Smoothed pointer tracker emitting a normalized (0..1) Vec2 position.
 * Implements the AnimatableSignal protocol (`get()` + `on('change', cb)`)
 * so it composes with Motion's `useTransform` and similar tools.
 */
export class CursorInput {
  private value: [number, number];
  private target: [number, number];
  private targetDirty = false;
  private readonly smoothing: number;
  private readonly listeners = new Set<ChangeListener>();
  private readonly eventTarget: EventTarget;
  private readonly element: CursorInputOptions['element'];
  private readonly handleMouseMove: (e: Event) => void;
  private disposed = false;

  constructor(opts: CursorInputOptions = {}) {
    const { smoothing = 0.1, initial = [0.5, 0.5], target, element, onMove } = opts;

    this.smoothing = clamp01(smoothing);
    this.value = [initial[0], initial[1]];
    this.target = [initial[0], initial[1]];
    this.eventTarget = target ?? (typeof window !== 'undefined' ? window : new EventTarget());
    this.element = element;

    this.handleMouseMove = (e: Event) => {
      if (!(e instanceof MouseEvent)) return;
      const mouseEvent = e;

      if (this.element) {
        // Normalize to 0..1 across the element's bounding rect. Reading the
        // rect on every move is fine — `getBoundingClientRect` is cheap and
        // mousemove is already throttled to ~60Hz by the browser. The benefit
        // is tracking the element's position even if it moved/scrolled since
        // the last frame.
        const elementRect = this.element.getBoundingClientRect();
        const elementWidth = elementRect.width || 1;
        const elementHeight = elementRect.height || 1;

        this.target = [
          (mouseEvent.clientX - elementRect.left) / elementWidth,
          (mouseEvent.clientY - elementRect.top) / elementHeight,
        ];
      } else {
        // Fallback: viewport-normalized. Used when no element is supplied —
        // mostly the standalone-API case for users not consuming through
        // <ShaderScene>'s context.
        const viewportWidth = (typeof window !== 'undefined' && window.innerWidth) || 1;
        const viewportHeight = (typeof window !== 'undefined' && window.innerHeight) || 1;

        this.target = [mouseEvent.clientX / viewportWidth, mouseEvent.clientY / viewportHeight];
      }
      this.targetDirty = true;
      onMove?.();
    };

    this.eventTarget.addEventListener('mousemove', this.handleMouseMove);
  }

  /** Current smoothed position. Implements AnimatableSignal protocol. */
  get(): Vector2 {
    return this.value;
  }

  /** Subscribe to change events. Returns an unsubscribe function. */
  on(_eventType: 'change', changeListener: ChangeListener): () => void {
    this.listeners.add(changeListener);

    return () => this.listeners.delete(changeListener);
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
    // Frame-rate-independent smoothing: raising `smoothing` to the power of
    // elapsed frames-worth-of-time means the same fraction of the remaining
    // gap closes per real second whether the display runs 30, 60, or 144 fps
    // — a plain `lerp(value, target, 0.1)` per frame would chase faster on
    // faster screens.
    const smoothingDelta = afterIdle ? Math.min(delta, MAX_WAKE_TICK_DELTA) : delta;
    const frames = smoothingDelta * 60;
    const factor = this.smoothing === 0 ? 1 : 1 - Math.pow(this.smoothing, frames);
    const prev0 = this.value[0];
    const prev1 = this.value[1];
    const [target0, target1] = this.target;
    let next0 = lerp(prev0, target0, factor);
    let next1 = lerp(prev1, target1, factor);

    // The lerp only ever closes a fraction of the gap, so on its own it
    // reaches the target when the gap drops below float precision: quick at
    // smoothing 0.1, but many seconds of invisible sub-pixel steps at 0.9.
    // Once the gap is under a device pixel, land on the target exactly so
    // the next tick reports settled and the host can stop drawing.
    if (
      Math.abs(target0 - next0) < SETTLE_THRESHOLD &&
      Math.abs(target1 - next1) < SETTLE_THRESHOLD
    ) {
      next0 = target0;
      next1 = target1;
    }
    const moved = next0 !== prev0 || next1 !== prev1;

    if (!moved && !this.targetDirty) return false;

    this.value = [next0, next1];
    this.targetDirty = false;
    const snapshot: Vector2 = [next0, next1];

    for (const listener of this.listeners) listener(snapshot);

    return true;
  }

  /** Tear down listeners. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.eventTarget.removeEventListener('mousemove', this.handleMouseMove);
    this.listeners.clear();
  }
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const lerp = (startValue: number, endValue: number, blendFactor: number) =>
  startValue + (endValue - startValue) * blendFactor;
