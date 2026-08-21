'use client';

// Smoothed cursor position as an animatable signal (0..1 across the scene's
// canvas), ready to feed any AnimatableProp. This file is also the repo's
// canonical Strict-Mode-safe pattern for hooks that own long-lived
// disposables: ONE effect creates the CursorInput, attaches its tick source,
// and returns the teardown. React 18's Strict Mode runs every effect twice
// on mount (mount → unmount → mount); splitting create and dispose across
// separate effects lets that double-cycle leak a listener or kill a live
// instance — collapsed into one effect, each cycle cleans up after itself.
import { useEffect, useState } from 'react';

import { CursorInput, type CursorInputOptions, type Vector2 } from '@camp-dev/shaders';

import { useShaderContext } from '../use-shader-context/use-shader-context.js';

export interface CursorSignal {
  get(): Vector2;
  on(event: 'change', cb: (value: Vector2) => void): () => void;
}

const STUB_SIGNAL: CursorSignal = {
  get: () => [0.5, 0.5] as const,
  on: () => () => undefined,
};

export function useCursor(opts: CursorInputOptions = {}): CursorSignal {
  const shaderContext = useShaderContext();
  const [input, setInput] = useState<CursorInput | null>(null);

  useEffect(() => {
    // Default the coordinate frame to the scene's canvas, so (0,0)/(1,1) are
    // the canvas corners and cursor values line up with shader uv space no
    // matter where the canvas sits on the page.
    const canvas = shaderContext?.renderer.three.domElement;
    const resolvedElement = opts.element ?? (canvas instanceof HTMLElement ? canvas : undefined);
    const newCursorInput = new CursorInput({ ...opts, element: resolvedElement });

    setInput(newCursorInput);

    // The smoothing needs a steady tick. Inside a ShaderScene, ride the
    // scene's frame scheduler; outside one (Mode 2), run a private rAF loop.
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

      // The loop IS cancelled: cleanup calls detach(), which cancels the most
      // recently scheduled frame. The detector can't follow the cancellation
      // through the closure variable.
      // react-doctor-disable-next-line react-doctor/effect-raf-loop-needs-cancel
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
