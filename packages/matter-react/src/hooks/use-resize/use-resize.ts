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
