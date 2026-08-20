// Part of the render-on-demand system (see frame-scheduler.ts): a tiny
// pub/sub wrapper around IntersectionObserver, so the scene can stop
// rendering while its canvas is scrolled out of the viewport.

export interface IntersectionWatcher {
  isInView(): boolean;
  /** Subscribe to changes. Receives the new in-view state. Returns unsubscribe. */
  subscribe(cb: (inView: boolean) => void): () => void;
  dispose(): void;
}

/**
 * Watch a canvas's viewport intersection. Pauses tied to this watcher should
 * be resumed when the canvas is *any* fraction visible. Strict-mode-safe.
 *
 * SSR: if `IntersectionObserver` is unavailable, returns a no-op watcher whose
 * `isInView()` always returns `true` and whose `subscribe` does nothing.
 */
export function createIntersectionWatcher(canvas: HTMLCanvasElement): IntersectionWatcher {
  if (typeof IntersectionObserver === 'undefined') {
    return {
      isInView: () => true,
      subscribe: () => () => {
        // SSR no-op unsubscribe
      },
      dispose: () => {
        // SSR no-op dispose
      },
    };
  }

  const subscriptions = new Set<(inView: boolean) => void>();
  let inView = true;
  const observer = new IntersectionObserver(
    (entries) => {
      const next = entries.some((entry) => entry.isIntersecting);

      if (next === inView) return;
      inView = next;
      for (const listener of subscriptions) listener(inView);
    },
    { threshold: 0 },
  );

  observer.observe(canvas);

  return {
    isInView: () => inView,
    subscribe(listener) {
      subscriptions.add(listener);

      return () => subscriptions.delete(listener);
    },
    dispose() {
      observer.disconnect();
      subscriptions.clear();
    },
  };
}
