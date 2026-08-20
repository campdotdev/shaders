'use client';

// The tiny pub/sub every input signal is built on (useResize, useScroll).
// Returns the consumer-facing signal (get + on('change'), the
// AnimatableSignal protocol) alongside the raw listener set, which stays
// PRIVATE to the creating hook — the hook emits by iterating the set, so
// only it can publish while any consumer can subscribe.

export function createSignal<T>(getValue: () => T): {
  signal: { get(): T; on(event: string, listener: (v: T) => void): () => void };
  listeners: Set<(v: T) => void>;
} {
  const listeners = new Set<(v: T) => void>();

  return {
    listeners,
    signal: {
      get: getValue,
      on: (_event, listener) => {
        listeners.add(listener);

        return () => {
          listeners.delete(listener);
        };
      },
    },
  };
}
