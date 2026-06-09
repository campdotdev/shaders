'use client';

import { useEffect, useState } from 'react';

import { createSignal } from '../../internal/create-signal.js';

export type ScrollValue = readonly [scrollY: number, progress: number];

export interface ScrollSignal {
  get(): ScrollValue;
  on(event: 'change', cb: (value: ScrollValue) => void): () => void;
}

const STUB_SIGNAL: ScrollSignal = {
  get: () => [0, 0] as const,
  on: () => () => undefined,
};

export function useScroll(): ScrollSignal {
  const [signal, setSignal] = useState<ScrollSignal | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const compute = (): ScrollValue => {
      const y = window.scrollY;

      const max = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
      const progress = Math.max(0, Math.min(1, y / max));

      return [y, progress];
    };

    let value: ScrollValue = compute();
    const { signal: fresh, listeners } = createSignal<ScrollValue>(() => value);

    setSignal(fresh);

    let rafPending = false;
    const onScroll = () => {
      if (rafPending) return;
      rafPending = true;
      requestAnimationFrame(() => {
        rafPending = false;
        const next = compute();

        if (next[0] === value[0] && next[1] === value[1]) return;
        value = next;
        for (const cb of listeners) cb(next);
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', onScroll);
      listeners.clear();
      setSignal(null);
    };
  }, []);

  return signal ?? STUB_SIGNAL;
}
