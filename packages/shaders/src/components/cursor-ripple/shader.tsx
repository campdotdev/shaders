'use client';

// The ripple's GPU half: reads a wave field's height texture and does two
// things with the image beneath it. Refraction is a base-pass UV warp that
// offsets where the scene texture is sampled by the water's slope, so a
// gradient or a dot field under the ripple wobbles. Shine is a post-process
// color transform that adds light where the slope faces a fixed light, so
// the wake shows even over a flat color. The wrapper (./cursor-ripple.tsx)
// owns the field and drives it from the pointer; this file only reads it,
// which is what lets the dev probe route seed a field by hand and mount
// this half over it for a deterministic frame.
import { useEffect, useMemo } from 'react';

import type { ShaderNodeObject } from 'three/tsl';
import { dot, max, oneMinus, smoothstep, texture, uniform, uv, vec2, vec4 } from 'three/tsl';
import type { Node, Texture } from 'three/webgpu';

import type { WaveField } from '../../engine.js';
import type { AnimatableProp } from '../../react/hooks/animatable-signal/animatable-signal.js';
import { useAnimatableUniform } from '../../react/hooks/use-animatable-uniform/use-animatable-uniform.js';
import { useAspectUniform } from '../../react/hooks/use-aspect-uniform/use-aspect-uniform.js';
import { useBasePassUv } from '../../react/hooks/use-base-pass-uv/use-base-pass-uv.js';
import { usePostProcessPass } from '../../react/hooks/use-overlay-pass/use-overlay-pass.js';
import { useShaderContext } from '../../react/hooks/use-shader-context/use-shader-context.js';

// ----------------------------------------------------------------------------
// The light
// ----------------------------------------------------------------------------

/**
 * Where the light comes from, as a compass angle in degrees on the screen:
 * 0 is from the right, 90 from below, 180 from the left, 270 from above.
 * 225 is the upper left, the direction most UI light is drawn from, so a
 * crest's upper-left flank catches it.
 */
const LIGHT_ANGLE_DEGREES = 225;

/**
 * The direction toward the light as a unit vector in the pass's frame, y
 * down. Fixed, so it is worked out once here rather than per pixel.
 */
const TO_LIGHT = [
  Math.cos((LIGHT_ANGLE_DEGREES * Math.PI) / 180),
  Math.sin((LIGHT_ANGLE_DEGREES * Math.PI) / 180),
] as const;

/**
 * The slope, in height per canvas height, at which a flank facing the
 * light reaches full brightness. Smaller makes every ripple glint hard;
 * larger keeps the highlight to the steepest crests.
 */
const SHINE_SOFTNESS = 0.6;

/**
 * The pixel size of a texture's backing image. three types `image` as any,
 * and a render target's texture carries a plain `{ width, height }` there,
 * so this reads it behind guards rather than an assertion.
 */
function textureSize(source: Texture): { width: number; height: number } | null {
  const image: unknown = source.image;

  if (typeof image !== 'object' || image === null) return null;
  if (!('width' in image) || !('height' in image)) return null;
  const { width, height } = image;

  if (typeof width !== 'number' || typeof height !== 'number') return null;
  if (width <= 0 || height <= 0) return null;

  return { width, height };
}

export interface CursorRippleShaderProps {
  /**
   * The water surface to read. Its texture holds height in R, in uv space,
   * and swaps every step, so it is re-read every frame rather than captured
   * once.
   */
  field: WaveField;
  /**
   * How far the water bends the image beneath it, in canvas heights per
   * unit of slope. 0 leaves the image where it is. Accepts a static value
   * or an animation signal.
   */
  refraction: AnimatableProp<number>;
  /**
   * How much light a flank facing the light adds, where 1 adds full white
   * on the steepest crests. 0 adds none. Accepts a static value or an
   * animation signal.
   */
  shine: AnimatableProp<number>;
}

export function CursorRippleShader({ field, refraction, shine }: CursorRippleShaderProps) {
  const shaderContext = useShaderContext();

  // The dials live in uniforms, values the CPU writes and the GPU reads at
  // each draw, so changing them never rebuilds the output chain.
  const refractionUniform = useAnimatableUniform<number>(refraction);
  const shineUniform = useAnimatableUniform<number>(shine);
  const aspectUniform = useAspectUniform();

  // ---------------------------------------------
  // Reading the field
  // ---------------------------------------------
  // A texture node is the GPU's handle on an image. Created once so the
  // output chain compiles against a stable node; the effect below swaps the
  // Texture object it points at, because the field's two targets trade
  // roles on every pass and `field.texture` is whichever was written last.
  // Null when the field is inert, in which case both passes below are
  // identity and the wrapper would not have mounted this half at all.
  const fieldTexture = useMemo(() => {
    const initial = field.texture;

    return initial === null ? null : texture(initial);
  }, [field]);

  // One field texel, in uv units, so the slope below can step to the
  // neighbouring texels. Two floats rather than a vec2 uniform, so they can
  // be chained freely in TSL math (the vec-uniform gotcha in
  // docs/agents/tsl.md).
  const texelWidth = useMemo(() => uniform(0), []);
  const texelHeight = useMemo(() => uniform(0), []);

  // Follow the field every frame: the wrapper steps it inside the scene's
  // scheduler tick, so this runs after that step (it is added later) and
  // the next frame's draw samples the freshest state. A resize recreates
  // the targets between ticks, so bind the new texture and texel size
  // synchronously before the queued resize frame draws.
  useEffect(() => {
    if (!shaderContext || fieldTexture === null) return;

    const follow = () => {
      const current = field.texture;

      if (current === null) return;
      if (fieldTexture.value !== current) fieldTexture.value = current;
      const size = textureSize(current);

      if (size === null) return;
      texelWidth.value = 1 / size.width;
      texelHeight.value = 1 / size.height;
    };

    follow();
    shaderContext.scheduler.add(follow);
    const stopFollowingResizes = field.onResize(() => {
      follow();
      shaderContext.scheduler.requestRender();
    });

    return () => {
      stopFollowingResizes();
      shaderContext.scheduler.remove(follow);
    };
  }, [shaderContext, field, fieldTexture, texelWidth, texelHeight]);

  // ---------------------------------------------
  // The slope: how the water leans at a pixel
  // ---------------------------------------------
  // Both passes below start here. `coordinate` is a pass coordinate: [0, 0]
  // at the top-left with y growing downward, the frame every post-process
  // pass shares (see radial-wipe's shader). The field is a texture in uv
  // space, [0, 0] at the bottom-left, and the wave field flipped the stroke
  // into that frame when it stamped it. So y flips on the way in, and the
  // slope's y flips on the way out, so the result is in the pass's frame.
  // Without this the wake lands mirrored top-to-bottom from the pointer.
  //
  // The slope comes from a central difference: the height one texel ahead
  // less the height one texel behind, on each axis, over the two-texel
  // run. Field texels are square on screen (the field scales both canvas
  // edges by the same factor), so a texel is `texelHeight` canvas heights
  // in either direction and both slopes come out in height per canvas
  // height. A per-texel slope would be tiny (a wake rises a few hundredths
  // over a few texels) and every dial would need values in the tens.
  const slopeAt = (coordinate: ShaderNodeObject<Node>) => {
    if (fieldTexture === null) return null;

    const fieldPoint = vec2(coordinate.x, oneMinus(coordinate.y));
    const stepX = vec2(texelWidth, 0);
    const stepY = vec2(0, texelHeight);
    const heightAt = (point: ReturnType<typeof vec2>) => fieldTexture.uv(point).r;

    const riseX = heightAt(fieldPoint.add(stepX)).sub(heightAt(fieldPoint.sub(stepX)));
    const riseY = heightAt(fieldPoint.add(stepY)).sub(heightAt(fieldPoint.sub(stepY)));
    const run = texelHeight.mul(2);

    return vec2(riseX.div(run), riseY.div(run).negate());
  };

  // ---------------------------------------------
  // Refraction: bend the scene by the water's slope
  // ---------------------------------------------
  // A base-pass UV warp: the callback receives the 0..1 coordinate the
  // rendered scene is about to be sampled at and returns a replacement.
  // Light entering water bends toward the surface's downhill side, so a
  // pixel under a slope shows the scene from a little way along that slope.
  // Slope times the dial is the bend in canvas heights. uv x runs over the
  // canvas width, so the x component is divided by the aspect to land the
  // same distance on screen as the y component (the same aspect correction
  // every round-shape shader uses).
  useBasePassUv(
    (coordinate) => {
      const slope = slopeAt(coordinate);

      if (slope === null) return coordinate;

      const bend = vec2(slope.x.div(aspectUniform), slope.y).mul(refractionUniform);

      return coordinate.add(bend);
    },
    [fieldTexture, texelWidth, texelHeight, aspectUniform, refractionUniform],
  );

  // ---------------------------------------------
  // Shine: light on the flanks that face it
  // ---------------------------------------------
  // A post-process pass: the callback receives each already-rendered pixel
  // (`input`, rgba) and returns a replacement. A flank facing the light
  // brightens; a flank facing away, or flat water, adds nothing, which is
  // what keeps a fresh page identical to one without the ripple.
  usePostProcessPass(
    (input) => {
      const slope = slopeAt(uv());

      if (slope === null) return input;

      // How much the surface leans toward the light: the slope projected
      // onto that direction. Positive on the flank that faces the light,
      // negative on the one that faces away, and max() drops the negative
      // side so shine only ever adds.
      const facing = max(dot(slope, vec2(...TO_LIGHT)), 0);

      // Shape the lean into a glint. smoothstep runs 0 to 1 as the lean
      // runs 0 to the softness, with a soft start and a soft saturation,
      // so gentle ripples glow faintly and steep crests hit full white
      // rather than blowing past it.
      const glint = smoothstep(0, SHINE_SOFTNESS, facing);

      // Added as white light, scaled by the dial and by the pixel's own
      // alpha: a transparent gap (Blobs, a wipe) has nothing for light to
      // land on, and lighting it would write color into a pixel with no
      // coverage. Alpha itself passes through.
      const light = glint.mul(shineUniform).mul(input.a);

      return vec4(input.rgb.add(light), input.a);
    },
    [fieldTexture, texelWidth, texelHeight, shineUniform],
  );

  return null;
}
