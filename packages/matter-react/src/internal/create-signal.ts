'use client';

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
