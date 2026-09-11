// The first flow: one float travels from a prop change to a repainted canvas.
// Every component shares this path, and the repaint gotcha in AGENTS.md lives
// on it. Captions are what the viewer reads while the payload hops. Files are
// repo-relative and checked by data.test.ts.
import type { Flow } from '../types';

export const propToPixel: Flow = {
  id: 'prop-to-pixel',
  title: 'A prop change reaching the pixel',
  payload: {
    name: 'One float',
    description: 'A single number, such as a new `speed`, written by a React prop.',
  },
  whatItDoes: [
    'Shaders renders on demand. Nothing draws unless something asks for a frame, so a page of static gradients costs nothing after its first paint.',
    'When a prop changes, the value goes into a uniform, which is a slot on the GPU that a shader reads each frame. Writing it does not redraw anything on its own. The hook that wrote it also asks the scheduler for a frame, and that request is what repaints the canvas.',
    'Once the frame is drawn and every component reports that it is static again, the scheduler parks. The next prop change starts the loop over.',
  ],
  howItsBuilt: [
    'Each wrapper holds one uniform node per animatable prop, created once and kept for the life of the material. useAnimatableUniform writes into uniform.value and follows every write with scheduler.requestRender(). A bare write with no request sits on the GPU unseen, which is the repaint gotcha in AGENTS.md.',
    'FrameScheduler owns the requestAnimationFrame loop. requestRender() does nothing while the loop is already running and starts it when parked. Components vote static through useStaticSceneHint, and the loop parks after one flush once every vote is static.',
    'ShaderScene composes its children into a single output node and wraps it as dither(renderOutput(composed)). renderOutput applies tone mapping and the output color-space transform, and dither adds blue noise in display space so gradients do not band. That is why no component adds its own dither.',
  ],
  steps: [
    {
      from: 'linear-gradient',
      to: 'use-animatable-uniform',
      caption: 'A prop changes. The wrapper hands the new value to useAnimatableUniform.',
      files: [
        'packages/shaders/src/components/linear-gradient/linear-gradient.tsx',
        'packages/shaders/src/react/hooks/use-animatable-uniform/use-animatable-uniform.ts',
      ],
    },
    {
      from: 'use-animatable-uniform',
      to: 'frame-scheduler',
      caption: 'The hook writes the float into a stable uniform node and calls requestRender().',
      files: [
        'packages/shaders/src/react/hooks/use-animatable-uniform/use-animatable-uniform.ts',
        'packages/shaders/src/runtime/frame-scheduler/frame-scheduler.ts',
      ],
    },
    {
      from: 'frame-scheduler',
      to: 'shader-scene',
      caption:
        'The scheduler wakes the parked loop. ShaderScene composes its children into one output node.',
      files: [
        'packages/shaders/src/runtime/frame-scheduler/frame-scheduler.ts',
        'packages/shaders/src/react/components/shader-scene/shader-scene.tsx',
      ],
    },
    {
      from: 'shader-scene',
      to: 'dither',
      caption:
        'The output node is dither(renderOutput(composed)): tone mapping, output color space, then blue noise.',
      files: [
        'packages/shaders/src/react/components/shader-scene/shader-scene.tsx',
        'packages/shaders/src/primitives/dither/dither.ts',
      ],
    },
    {
      from: 'dither',
      to: 'create-renderer',
      caption: 'The renderer draws the frame to the canvas. The float is now a pixel.',
      files: ['packages/shaders/src/runtime/create-renderer/create-renderer.ts'],
    },
    {
      from: 'create-renderer',
      to: 'frame-scheduler',
      caption:
        'Every component votes static again, and the scheduler parks until the next request.',
      files: [
        'packages/shaders/src/react/hooks/use-static-hint/use-static-hint.ts',
        'packages/shaders/src/runtime/frame-scheduler/frame-scheduler.ts',
      ],
      duration: 2.2,
    },
  ],
};
