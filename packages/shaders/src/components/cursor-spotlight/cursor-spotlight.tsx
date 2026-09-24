'use client';

// Public face of the cursor spotlight: owns the props, their JSDoc, and
// their defaults, and owns the pointer. It reads the scene's shared cursor
// and its presence and hands both to CursorSpotlightShader (./shader.tsx),
// which brightens the image around that point. CursorSpotlight is an
// Effect: stack it after other components inside a <ShaderScene> and the
// area around the pointer lights up over whatever they drew.
import type { AnimatableProp } from '../../react/hooks/animatable-signal/animatable-signal.js';
import { useCursor } from '../../react/hooks/use-cursor/use-cursor.js';
import { useShaderContext } from '../../react/hooks/use-shader-context/use-shader-context.js';
import { useStaticSceneHint } from '../../react/hooks/use-static-hint/use-static-hint.js';
import { CursorSpotlightShader } from './shader.js';

/**
 * How much of the gap between the light and the pointer survives one 60fps
 * frame, 0..1. Low pins the light under the pointer; raising it adds a
 * glide that trails a fast swipe. At 0.65 the light closes 99% of a jump in
 * about 180ms, so it drifts after the pointer like a hand-held lamp rather
 * than sticking to it. Chosen by feel at the defaults gate.
 */
const POINTER_SMOOTHING = 0.65;

export interface CursorSpotlightProps {
  /**
   * Reach of the light from the pointer, in canvas units where 1 is the
   * canvas height. The light is strongest under the pointer and fades to
   * nothing at this distance. Defaults to 0.3. Accepts a static value or an
   * animation signal.
   */
  radius?: AnimatableProp<number>;
  /**
   * How much brighter the image gets under the pointer. 0 is off and 1
   * doubles it. It only scales color that is already there, so black stays
   * black. Defaults to 0.75. Accepts a static value or an animation signal.
   */
  intensity?: AnimatableProp<number>;
}

/**
 * Brightens the scene around the pointer. Mount it inside a `<ShaderScene>`
 * after the components it should light. It is invisible until the pointer
 * first moves over the canvas and fades out when the pointer leaves. Mode 1
 * only, because it needs the scene's output stage; it has no
 * `useShaderMaterial` form. It keeps following the pointer under reduced
 * motion, because it only moves when the pointer does.
 */
export function CursorSpotlight({ radius = 0.3, intensity = 0.75 }: CursorSpotlightProps) {
  const shaderContext = useShaderContext();

  // The render-on-demand vote. Nothing here changes on its own: the light
  // only moves when the pointer does, and the cursor hook asks for frames
  // until its smoothing and presence settle. So the vote is static, and a
  // scene of still Sources plus this spotlight parks while the pointer is
  // still.
  useStaticSceneHint(true);

  // The scene's shared pointer, smoothed at this Effect's own rate, plus
  // presence, which eases in on entry and out on leave. Outside a scene
  // there is no output stage to light, so the hook stays off and attaches
  // no listener.
  const cursor = useCursor({ smoothing: POINTER_SMOOTHING, enabled: shaderContext !== null });

  return (
    <CursorSpotlightShader
      center={cursor}
      intensity={intensity}
      presence={cursor.presence}
      radius={radius}
    />
  );
}
