'use client';

import { useEffect, useState } from 'react';

import { CursorInput, type CursorInputOptions, type Vec2 } from '@lovo/matter';

import { useShaderContext } from '../use-shader-context/use-shader-context.js';

export interface CursorSignal {
  get(): Vec2;
  on(event: 'change', cb: (value: Vec2) => void): () => void;
}

const STUB_SIGNAL: CursorSignal = {
  get: () => [0.5, 0.5] as const,
  on: () => () => undefined,
};

export function useCursor(opts: CursorInputOptions = {}): CursorSignal {
  const shaderContext = useShaderContext();
  const [input, setInput] = useState<CursorInput | null>(null);

  useEffect(() => {
    const canvas = shaderContext?.renderer.three.domElement;
    const elementOpt = opts.element ?? (canvas instanceof HTMLElement ? canvas : undefined);
    const newCursorInput = new CursorInput({ ...opts, element: elementOpt });

    setInput(newCursorInput);

    let detach: (() => void) | null = null;

    if (shaderContext?.scheduler) {
      const schedulerTickHandler = ({ delta }: { delta: number }) => newCursorInput.tick(delta);

      shaderContext.scheduler.add(schedulerTickHandler);
      detach = () => shaderContext.scheduler.remove(schedulerTickHandler);
    } else {
      let animationFrameId: number | null = null;
      let lastNow = performance.now();
      const loop = (now: number) => {
        const delta = (now - lastNow) / 1000;

        lastNow = now;
        newCursorInput.tick(delta);
        animationFrameId = requestAnimationFrame(loop);
      };

      animationFrameId = requestAnimationFrame(loop);
      detach = () => {
        if (animationFrameId !== null) cancelAnimationFrame(animationFrameId);
      };
    }

    return () => {
      detach();
      newCursorInput.dispose();
      setInput(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shaderContext]);

  return input ?? STUB_SIGNAL;
}
