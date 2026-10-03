'use client';

// Canvas size as an animatable signal: [width, height, devicePixelRatio],
// updating on element resize AND on pixel-density changes (browser zoom, or
// the window dragged to a monitor with different scaling). Components use it
// to keep pixel-valued props and aspect corrections honest. The enclosing
// <ShaderScene> owns the one signal per canvas, and updates it before it
// redraws a resized canvas, so a listener's uniform write lands in that
// frame. inputs/canvas-size/canvas-size.ts is where the measuring happens.
import { type ResizeSignal } from '../../../inputs/canvas-size/canvas-size.js';
import { useShaderContext } from '../use-shader-context/use-shader-context.js';

export type { ResizeSignal, ResizeValue } from '../../../inputs/canvas-size/canvas-size.js';

const STUB_SIGNAL: ResizeSignal = {
  get: () => [0, 0, 1] as const,
  on: () => () => undefined,
};

export function useResize(): ResizeSignal {
  return useShaderContext()?.canvasSize ?? STUB_SIGNAL;
}
