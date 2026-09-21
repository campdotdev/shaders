'use client';

// Page scroll as an animatable signal: [scrollY in pixels, progress 0..1
// through the whole document]. Scroll events are coalesced to at most one
// notification per animation frame — scroll can fire far faster than the
// display refreshes, and shaders can't use the extra samples anyway.
//
// This hook needs none of the idle-and-wake plumbing useCursor carries. The
// signal emits from its own requestAnimationFrame, queued by the scroll
// event, so it never waits on the scene's frame loop to notice a change,
// and the consumer's uniform hook follows every write with
// scheduler.requestRender(), which wakes a parked scene for the one frame
// that draws the new value. A cursor input only changed inside the scene's
// tick, which is why it needed an onMove hook to break out of a parked
// loop. Scroll has no smoothing to settle either: each notification is the
// final value.
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
      const scrollYPosition = window.scrollY;

      const max = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
      const progress = Math.max(0, Math.min(1, scrollYPosition / max));

      return [scrollYPosition, progress];
    };

    let value: ScrollValue = compute();
    const { signal: newSignal, listeners } = createSignal<ScrollValue>(() => value);

    setSignal(newSignal);

    let rafPending = false;
    const onScroll = () => {
      if (rafPending) return;
      rafPending = true;
      requestAnimationFrame(() => {
        rafPending = false;
        const next = compute();

        if (next[0] === value[0] && next[1] === value[1]) return;
        value = next;
        for (const listener of listeners) listener(next);
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
