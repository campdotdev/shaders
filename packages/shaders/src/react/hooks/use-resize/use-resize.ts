'use client';

// Canvas size as an animatable signal: [width, height, devicePixelRatio],
// updating on element resize AND on pixel-density changes (browser zoom, or
// the window dragged to a monitor with different scaling). Components use it
// to keep pixel-valued props and aspect corrections honest.
import { useEffect, useState } from 'react';

import { createSignal } from '../../internal/create-signal.js';
import { useShaderContext } from '../use-shader-context/use-shader-context.js';

export type ResizeValue = readonly [width: number, height: number, dpr: number];

export interface ResizeSignal {
  get(): ResizeValue;
  on(event: 'change', cb: (value: ResizeValue) => void): () => void;
}

const STUB_SIGNAL: ResizeSignal = {
  get: () => [0, 0, 1] as const,
  on: () => () => undefined,
};

export function useResize(): ResizeSignal {
  const shaderContext = useShaderContext();
  const [signal, setSignal] = useState<ResizeSignal | null>(null);

  useEffect(() => {
    if (!shaderContext) return undefined;

    const canvas = shaderContext.renderer.three.domElement;

    if (!(canvas instanceof HTMLCanvasElement)) return undefined;

    let value: ResizeValue = [
      canvas.clientWidth,
      canvas.clientHeight,
      typeof window !== 'undefined' ? window.devicePixelRatio : 1,
    ];
    const { signal: newSignal, listeners } = createSignal<ResizeValue>(() => value);

    setSignal(newSignal);

    // Re-measure and notify, deduping so listeners only hear real changes.
    const emit = () => {
      const next: ResizeValue = [
        canvas.clientWidth,
        canvas.clientHeight,
        typeof window !== 'undefined' ? window.devicePixelRatio : 1,
      ];

      if (next[0] === value[0] && next[1] === value[1] && next[2] === value[2]) return;
      value = next;
      for (const listener of listeners) listener(next);
    };

    const observer = new ResizeObserver(emit);

    observer.observe(canvas);

    // Watching devicePixelRatio is the awkward part: there's no DPR-change
    // event, only matchMedia against a query pinned to the CURRENT value —
    // `(resolution: 2dppx)` fires once when the density stops being 2, and
    // never again. So each firing re-arms a fresh query pinned to the NEW
    // density (tearing down the spent one), and the watch keeps working
    // across any number of zoom levels or monitor moves.
    let mediaQueryList: MediaQueryList | null = null;
    let mediaQueryListener: (() => void) | null = null;
    const setupDprWatch = () => {
      if (typeof window === 'undefined') return;
      const dpr = window.devicePixelRatio;
      const nextMediaQueryList = window.matchMedia(`(resolution: ${dpr}dppx)`);
      const nextMediaQueryListener = () => {
        emit();
        if (mediaQueryList && mediaQueryListener)
          mediaQueryList.removeEventListener('change', mediaQueryListener);
        setupDprWatch();
      };

      nextMediaQueryList.addEventListener('change', nextMediaQueryListener);
      mediaQueryList = nextMediaQueryList;
      mediaQueryListener = nextMediaQueryListener;
    };

    setupDprWatch();

    return () => {
      observer.disconnect();
      if (mediaQueryList && mediaQueryListener)
        mediaQueryList.removeEventListener('change', mediaQueryListener);
      mediaQueryList = null;
      mediaQueryListener = null;
      listeners.clear();
      setSignal(null);
    };
  }, [shaderContext]);

  return signal ?? STUB_SIGNAL;
}
