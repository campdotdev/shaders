'use client';

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
  const ctx = useShaderContext();
  const [signal, setSignal] = useState<ResizeSignal | null>(null);

  useEffect(() => {
    if (!ctx) return undefined;

    const canvas = ctx.renderer.three.domElement;

    if (!(canvas instanceof HTMLCanvasElement)) return undefined;

    let value: ResizeValue = [
      canvas.clientWidth,
      canvas.clientHeight,
      typeof window !== 'undefined' ? window.devicePixelRatio : 1,
    ];
    const { signal: fresh, listeners } = createSignal<ResizeValue>(() => value);

    setSignal(fresh);

    const emit = () => {
      const next: ResizeValue = [
        canvas.clientWidth,
        canvas.clientHeight,
        typeof window !== 'undefined' ? window.devicePixelRatio : 1,
      ];

      if (next[0] === value[0] && next[1] === value[1] && next[2] === value[2]) return;
      value = next;
      for (const cb of listeners) cb(next);
    };

    const observer = new ResizeObserver(emit);

    observer.observe(canvas);

    let mql: MediaQueryList | null = null;
    let mqlHandler: (() => void) | null = null;
    const setupDprWatch = () => {
      if (typeof window === 'undefined') return;
      const dpr = window.devicePixelRatio;
      const next = window.matchMedia(`(resolution: ${dpr}dppx)`);
      const handler = () => {
        emit();
        if (mql && mqlHandler) mql.removeEventListener('change', mqlHandler);
        setupDprWatch();
      };

      next.addEventListener('change', handler);
      mql = next;
      mqlHandler = handler;
    };

    setupDprWatch();

    return () => {
      observer.disconnect();
      if (mql && mqlHandler) mql.removeEventListener('change', mqlHandler);
      mql = null;
      mqlHandler = null;
      listeners.clear();
      setSignal(null);
    };
  }, [ctx]);

  return signal ?? STUB_SIGNAL;
}
