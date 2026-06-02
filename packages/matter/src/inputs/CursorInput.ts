export type Vec2 = readonly [number, number]

export interface CursorInputOptions {
  /**
   * Smoothing factor: 0 = no smoothing (snap to target instantly).
   * 1 = max smoothing (essentially never reaches target).
   * Sensible default: 0.1.
   *
   * Implementation: per-frame, value moves toward target by `(1 - smoothing) * delta * 60`,
   * roughly meaning "at smoothing=0.1, ~90% of the gap is closed in 1 second at 60fps."
   */
  smoothing?: number
  /** Starting position. Default: [0.5, 0.5] (center). */
  initial?: Vec2
  /** Listen on this target. Default: window. */
  target?: EventTarget
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
    getBoundingClientRect(): { left: number; top: number; width: number; height: number }
  }
}

type ChangeListener = (value: Vec2) => void

/**
 * Smoothed pointer tracker emitting a normalized (0..1) Vec2 position.
 * Implements the AnimatableSignal protocol (`get()` + `on('change', cb)`)
 * so it composes with Motion's `useTransform` and similar tools.
 */
export class CursorInput {
  private value: [number, number]
  private target: [number, number]
  private targetDirty = false
  private readonly smoothing: number
  private readonly listeners = new Set<ChangeListener>()
  private readonly eventTarget: EventTarget
  private readonly element: CursorInputOptions['element']
  private readonly handleMouseMove: (e: Event) => void
  private disposed = false

  constructor(opts: CursorInputOptions = {}) {
    const { smoothing = 0.1, initial = [0.5, 0.5], target, element } = opts

    this.smoothing = clamp01(smoothing)
    this.value = [initial[0], initial[1]]
    this.target = [initial[0], initial[1]]
    this.eventTarget = target ?? (typeof window !== 'undefined' ? window : new EventTarget())
    this.element = element

    this.handleMouseMove = (e: Event) => {
      if (!(e instanceof MouseEvent)) return
      const me = e

      if (this.element) {
        // Normalize to 0..1 across the element's bounding rect. Reading the
        // rect on every move is fine — `getBoundingClientRect` is cheap and
        // mousemove is already throttled to ~60Hz by the browser. The benefit
        // is tracking the element's position even if it moved/scrolled since
        // the last frame.
        const r = this.element.getBoundingClientRect()
        const w = r.width || 1
        const h = r.height || 1

        this.target = [(me.clientX - r.left) / w, (me.clientY - r.top) / h]
      } else {
        // Fallback: viewport-normalized. Used when no element is supplied —
        // mostly the standalone-API case for users not consuming through
        // <ShaderScene>'s context.
        const w = (typeof window !== 'undefined' && window.innerWidth) || 1
        const h = (typeof window !== 'undefined' && window.innerHeight) || 1

        this.target = [me.clientX / w, me.clientY / h]
      }
      this.targetDirty = true
    }

    this.eventTarget.addEventListener('mousemove', this.handleMouseMove)
  }

  /** Current smoothed position. Implements AnimatableSignal protocol. */
  get(): Vec2 {
    return this.value
  }

  /** Subscribe to change events. Returns an unsubscribe function. */
  on(_event: 'change', cb: ChangeListener): () => void {
    this.listeners.add(cb)

    return () => this.listeners.delete(cb)
  }

  /**
   * Advance the smoothing one tick. Called by the host scheduler; not
   * typically called directly except in tests.
   */
  tick(delta: number): void {
    if (this.disposed) return
    const factor = this.smoothing === 0 ? 1 : 1 - Math.pow(this.smoothing, delta * 60)
    const prev0 = this.value[0]
    const prev1 = this.value[1]
    const next0 = lerp(prev0, this.target[0], factor)
    const next1 = lerp(prev1, this.target[1], factor)
    const moved = next0 !== prev0 || next1 !== prev1

    if (moved || this.targetDirty) {
      this.value = [next0, next1]
      this.targetDirty = false
      const snapshot: Vec2 = [next0, next1]

      for (const listener of this.listeners) listener(snapshot)
    }
  }

  /** Tear down listeners. */
  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.eventTarget.removeEventListener('mousemove', this.handleMouseMove)
    this.listeners.clear()
  }
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
