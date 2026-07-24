// Part of the render-on-demand system (see frame-scheduler.ts): a tiny
// pub/sub wrapper around the browser's "is this tab visible" signal, so the
// scene can stop rendering entirely while the user is on another tab.

export interface VisibilityWatcher {
  isVisible(): boolean;
  /** Subscribe to changes. Receives the new visibility state. Returns unsubscribe. */
  subscribe(cb: (visible: boolean) => void): () => void;
  dispose(): void;
}

/**
 * Watch `document.visibilityState`. Strict-mode-safe — callers create+dispose
 * one per mount cycle.
 *
 * SSR: if `document` is unavailable, returns a no-op watcher whose
 * `isVisible()` always returns `true` and whose `subscribe` does nothing.
 */
export function createVisibilityWatcher(): VisibilityWatcher {
  if (typeof document === 'undefined') {
    return {
      isVisible: () => true,
      subscribe: () => () => {
        // SSR no-op unsubscribe
      },
      dispose: () => {
        // SSR no-op dispose
      },
    };
  }

  const subscriptions = new Set<(visible: boolean) => void>();
  const onChange = () => {
    const isVisible = document.visibilityState === 'visible';

    for (const listener of subscriptions) listener(isVisible);
  };

  document.addEventListener('visibilitychange', onChange);

  return {
    isVisible: () => document.visibilityState === 'visible',
    subscribe(listener) {
      subscriptions.add(listener);

      return () => subscriptions.delete(listener);
    },
    dispose() {
      document.removeEventListener('visibilitychange', onChange);
      subscriptions.clear();
    },
  };
}
