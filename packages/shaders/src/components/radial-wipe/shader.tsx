'use client';

// The radial wipe's GPU half: a post-process effect that reveals or hides
// the rendered scene from a point with a smooth edge. Every pixel measures
// its distance from `center`, normalized so the far corner is 1, and
// `progress` sweeps a threshold across that distance with a feathered
// band at the front. Stack a Dissolve after it to grain that band. The
// wrapper (./radial-wipe.tsx) supplies the props.
import { useEffect, useMemo } from 'react';

import { length, max, smoothstep, uniform, uv, vec2, vec3, vec4 } from 'three/tsl';

import {
  type AnimatableProp,
  isSignal,
} from '../../react/hooks/animatable-signal/animatable-signal.js';
import { useAnimatablePoint } from '../../react/hooks/use-animatable-point/use-animatable-point.js';
import { useAnimatableUniform } from '../../react/hooks/use-animatable-uniform/use-animatable-uniform.js';
import { usePostProcessPass } from '../../react/hooks/use-overlay-pass/use-overlay-pass.js';
import { useResize } from '../../react/hooks/use-resize/use-resize.js';
import { useStaticSceneHint } from '../../react/hooks/use-static-hint/use-static-hint.js';

export interface RadialWipeShaderProps {
  /**
   * The wipe. 0 hides the scene, 1 shows it, and values between sweep the
   * front outward from `center`. Accepts a static value or an animation
   * signal.
   */
  progress: AnimatableProp<number>;
  /**
   * Where the wipe starts, 0..1 across the canvas; `[0.5, 0.5]` is the
   * middle and `[0, 0]` the top-left corner. Accepts a static value or an
   * animation signal.
   */
  center: AnimatableProp<readonly [number, number]>;
  /**
   * Softness of the front, as a fraction of the distance from `center` to
   * the far corner. 0 is a hard edge, 1 feathers across the whole canvas.
   * Accepts a static value or an animation signal.
   */
  feather: AnimatableProp<number>;
}

// ---------------------------------------------
// Constants
// ---------------------------------------------
// Floor on the feather band. smoothstep needs its two edges apart, so a
// feather of exactly 0 gets a band this wide instead: hard to the eye,
// and never a zero-width step.
const MIN_FEATHER = 0.001;

export function RadialWipeShader({ progress, center, feather }: RadialWipeShaderProps) {
  // The dials live in uniforms: values the CPU can update each frame without
  // rebuilding the shader, tracking either a static number or an animation
  // signal.
  const progressUniform = useAnimatableUniform(progress);
  const featherUniform = useAnimatableUniform(feather);
  // The pair is already in the pass's screen frame, [0, 0] at the top-left
  // with y growing downward, so it needs no conversion. uv() in a
  // post-process pass shares that frame; a mesh's uv() does not, which is
  // why DotField converts and this file does not.
  const centerUniform = useAnimatablePoint(center);

  // The render-on-demand vote: a fixed progress at any value draws nothing
  // that changes between frames, so the scene may stop. A signal is live by
  // definition, whatever it reads right now.
  useStaticSceneHint(!isSignal(progress));

  // ---------------------------------------------
  // Track the canvas aspect ratio
  // ---------------------------------------------
  // The distance math below multiplies the horizontal offset by
  // width/height so the wipe's front stays a circle on a wide canvas. The
  // uniform starts from the current canvas size (16:9 when the canvas has
  // no layout yet and reports 0), then follows every resize.
  const resize = useResize();
  const [initialWidth, initialHeight] = resize.get();
  const aspectUniform = useMemo(
    () => uniform(initialHeight > 0 ? initialWidth / initialHeight : 16 / 9),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    const [canvasWidth, canvasHeight] = resize.get();

    if (canvasWidth > 0 && canvasHeight > 0) aspectUniform.value = canvasWidth / canvasHeight;

    return resize.on('change', ([updatedWidth, updatedHeight]) => {
      if (updatedWidth > 0 && updatedHeight > 0) {
        aspectUniform.value = updatedWidth / updatedHeight;
      }
    });
  }, [resize, aspectUniform]);

  // ---------------------------------------------
  // The pass: distance -> threshold -> compose
  // ---------------------------------------------
  // A post-process pass: the callback receives each already-rendered pixel
  // (`input`, rgba) and returns a replacement.
  usePostProcessPass(
    (input) => {
      // Aspect-corrected distance from center. The far corner then measures
      // 1 wherever the center sits: the farthest corner from a point in the
      // unit box is max(c, 1 - c) on each axis, corrected the same way.
      // vec2(0, 0).add(centerUniform) lifts the bare vec uniform into a node
      // receiver so the chain stays safe (the vec-uniform-as-receiver
      // gotcha).
      const toPixel = uv().sub(centerUniform);
      const corrected = vec2(toPixel.x.mul(aspectUniform), toPixel.y);
      const centerLifted = vec2(0, 0).add(centerUniform);
      const farCorner = max(centerLifted, centerLifted.oneMinus());
      const farDistance = length(vec2(farCorner.x.mul(aspectUniform), farCorner.y));
      const distance = length(corrected).div(farDistance);

      // progress sweeps a threshold across the distance. The threshold's
      // range covers the distance's maximum, 1, plus one feather of
      // headroom, so that at progress 1 the far edge of the band lands on
      // the far corner and everything is shown, and at progress 0 the
      // threshold sits at 0 below every distance and nothing is.
      const band = featherUniform.max(MIN_FEATHER);
      const threshold = progressUniform.mul(band.add(1));

      // The front itself: a smoothstep with its edges REVERSED (high to
      // low), which flips the ramp so it returns 1 once the distance sits a
      // feather under the threshold, 0 above it, and an S-curve in between.
      const reveal = smoothstep(threshold, threshold.sub(band), distance);

      // Compose. The scene texture is premultiplied by construction (the
      // scene blends over a transparent clear), so scaling rgb and alpha by
      // the same factor is the correct way to hide it: at 0 the alpha goes
      // to 0 and the page shows through. Inside the band the alpha ramps,
      // which is exactly the soft edge a Dissolve stacked after this pass
      // reads to grain it.
      return vec4(vec3(input.rgb).mul(reveal), input.a.mul(reveal));
    },
    [progressUniform, featherUniform, centerUniform, aspectUniform],
  );

  return null;
}
