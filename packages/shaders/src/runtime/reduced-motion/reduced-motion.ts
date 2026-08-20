// Accessibility: honors the OS "prefers reduced motion" setting. The whole
// mechanism is one shared uniform — a time-scale factor (1 = full speed,
// 0.3 = slowed, 0 = frozen) that the engine's elapsedTime is multiplied by
// (see primitives/time). When the OS setting or the app-level policy
// override changes, the uniform's value changes and every animation built
// on elapsedTime slows or freezes together, with no per-component work.
import { uniform } from 'three/tsl';

export type ReducedMotionPolicy = 'auto' | 'off' | 'slow' | 'paused';

/**
 * Public surface exposed to package consumers. `recompute` is intentionally
 * absent — it is engine-internal and should not be callable from outside.
 */
export interface ReducedMotionWatcher {
  /** Current time scale: 0, 0.3, or 1. */
  scale(): number;
  /** Subscribe to scale changes. Returns unsubscribe. */
  subscribe(cb: (scale: number) => void): () => void;
  /** Tear down media-query listener. */
  dispose(): void;
}

/**
 * Engine-internal extension of the public watcher. Only `setReducedMotionPolicy`
 * calls `recompute`; it is never part of the consumer-visible type.
 */
interface InternalWatcher extends ReducedMotionWatcher {
  recompute(): void;
}

interface PolicyState {
  policy: ReducedMotionPolicy;
  watchers: Set<InternalWatcher>;
}

const state: PolicyState = {
  policy: 'auto',
  watchers: new Set(),
};

/**
 * Override Shaders' default behavior of honoring `prefers-reduced-motion`.
 * - 'auto'   — follow the OS media query (default)
 * - 'off'    — full speed regardless of OS setting
 * - 'slow'   — 30% speed regardless of OS setting
 * - 'paused' — 0 (animation effectively frozen) regardless of OS setting
 */
export function setReducedMotionPolicy(policy: ReducedMotionPolicy): void {
  if (state.policy === policy) return;
  state.policy = policy;
  for (const watcher of state.watchers) watcher.recompute();
}

export function getReducedMotionPolicy(): ReducedMotionPolicy {
  return state.policy;
}

const computeScale = (mqlMatches: boolean): number => {
  switch (state.policy) {
    case 'off':
      return 1;
    case 'slow':
      return 0.3;
    case 'paused':
      return 0;
    case 'auto':
      return mqlMatches ? 0.3 : 1;
  }
};

/**
 * Create a watcher that tracks `prefers-reduced-motion: reduce` and the
 * global Shaders policy override. Strict-mode-safe — callers create+dispose
 * one per mount cycle.
 */
export function createReducedMotionWatcher(): ReducedMotionWatcher {
  // SSR safety: bail to the no-op watcher if matchMedia is missing.
  // SSR watcher: scale() respects policy override but does not emit
  // subscription events (the engine has no way to notify SSR-created
  // watchers because they are not added to state.watchers — but in
  // practice the AGENTS.md gotcha on three/webgpu referencing `self` at
  // module load requires `ssr: false` for any component that touches the
  // Shaders engine).
  if (typeof matchMedia !== 'function') {
    return {
      scale: () => computeScale(false),
      subscribe: (listener) => {
        // No-op: SSR watchers are not in state.watchers and will never
        // receive policy-change notifications.
        void listener;

        return () => {
          // SSR no-op unsubscribe
        };
      },
      /** SSR watcher does not emit policy-change notifications. */
      dispose: () => {
        // SSR no-op dispose
      },
    };
  }

  const mediaQueryList = matchMedia('(prefers-reduced-motion: reduce)');
  const subscriptions = new Set<(scale: number) => void>();
  let lastComputedScale = computeScale(mediaQueryList.matches);

  const onChange = () => {
    const next = computeScale(mediaQueryList.matches);

    if (next !== lastComputedScale) {
      lastComputedScale = next;
      for (const listener of subscriptions) listener(next);
    }
  };

  mediaQueryList.addEventListener('change', onChange);

  const watcher: InternalWatcher = {
    scale: () => lastComputedScale,
    subscribe(listener) {
      subscriptions.add(listener);

      return () => subscriptions.delete(listener);
    },
    recompute() {
      const next = computeScale(mediaQueryList.matches);

      if (next !== lastComputedScale) {
        lastComputedScale = next;
        for (const listener of subscriptions) listener(next);
      }
    },
    dispose() {
      mediaQueryList.removeEventListener('change', onChange);
      subscriptions.clear();
      state.watchers.delete(watcher);
    },
  };

  state.watchers.add(watcher);

  return watcher;
}

let globalScaleUniform: ReturnType<typeof uniform<number>> | null = null;
let globalWatcher: ReducedMotionWatcher | null = null;

/**
 * Returns the engine-shared TSL uniform that `time` is multiplied by. Lazily
 * initialized on first read; reused across all materials. Mutating `.value`
 * imperatively when policy changes is safe — TSL re-reads the uniform every
 * frame.
 */
export function getReducedMotionTimeScale(): ReturnType<typeof uniform<number>> {
  if (globalScaleUniform === null) {
    globalWatcher = createReducedMotionWatcher();
    globalScaleUniform = uniform(globalWatcher.scale());
    globalWatcher.subscribe((s) => {
      if (globalScaleUniform === null) return;
      globalScaleUniform.value = s;
    });
  }

  return globalScaleUniform;
}

// Keep a typed reference for tests that may want to re-init between tests.
export const resetReducedMotionForTests = () => {
  globalWatcher?.dispose();
  globalWatcher = null;
  globalScaleUniform = null;
};
