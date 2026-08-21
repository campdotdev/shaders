'use client';

// The Blobs goo's GPU half. Blob centers roam around `center` on hash-phased
// sine paths (metaballs); each contributes a soft falloff bump, the bumps sum
// into one field, and the threshold on that sum is the goo silhouette — the
// alpha channel, so the space between blobs stays transparent. The blend
// value picks each blob's color from the ramp. The wrapper (./blobs.tsx)
// supplies the props.
import { useEffect, useMemo } from 'react';

import { colorRamp, type ColorSpace, type HueInterpolation, metaballs } from '@camp-dev/shaders';
import {
  type AnimatableProp,
  useAnimatablePoint,
  useAnimatableSpeed,
  useAnimatableUniform,
  useResize,
  useShaderContext,
  useStaticSceneHint,
} from '@camp-dev/shaders-react';
import { add, clamp, fwidth, smoothstep, sub, uniform, uv, vec2, vec4 } from 'three/tsl';
import { Mesh, MeshBasicNodeMaterial, PlaneGeometry } from 'three/webgpu';

import { type ColorStop, colorStopsKey, toColorRampStops } from '../utils/color';

// ---------------------------------------------
// Feel constants (provisional — tuned by eye at the build's visual gates)
// ---------------------------------------------
// Field level where goo begins. The summed field passes this in the gap
// between two approaching blobs — that crossing IS the merge. Down =
// fatter blobs that fuse sooner.
const THRESHOLD = 0.4;
// Extra edge feather at softness 1, in field units on top of the fwidth
// anti-aliasing floor. Up = mistier blobs at full softness.
const MAX_SOFTNESS = 0.35;
// Scales how much field above the threshold counts as full depth for
// shading. Up = cores hit the ramp's end nearer the edge.
const DEPTH_RANGE = 1.5;

export interface BlobsShaderProps {
  /**
   * Palette blobs draw from. Each blob picks its color by a stable per-blob
   * random value mapped along this ramp. Accepts hex, `oklch()`, or
   * `oklab()`; positions auto-space when omitted.
   */
  stops: ColorStop[];
  /**
   * Number of blobs, 1-20. Fractional values grow the last blob in
   * smoothly, so an animated count never pops. Accepts a static value or
   * an animation signal.
   */
  count: AnimatableProp<number>;
  /**
   * Base blob size. 0 is tight beads; 1 is fat blobs that merge from far
   * apart. Accepts a static value or an animation signal.
   */
  size: AnimatableProp<number>;
  /**
   * How much blob sizes differ from each other. 0 renders every blob at
   * `size`; 1 scatters them from near-zero to full size. Accepts a static
   * value or an animation signal.
   */
  sizeVariation: AnimatableProp<number>;
  /**
   * How far blobs roam from `center`. 0 huddles them into one gooey mass;
   * 1 ranges them across the canvas so merges become occasional
   * encounters. Accepts a static value or an animation signal.
   */
  spread: AnimatableProp<number>;
  /**
   * Width of the goo edge. 0 is a crisp anti-aliased silhouette; 1 fades
   * blobs out as soft mist. Accepts a static value or an animation signal.
   */
  softness: AnimatableProp<number>;
  /**
   * Depth inside the goo: slides colors along the ramp by field strength
   * around each blob's own pick — toward the ramp's start at the edges and
   * its end in the cores. 0 is flat. Accepts a static value or an
   * animation signal.
   */
  shading: AnimatableProp<number>;
  /**
   * Center of the roam region, 0..1 across the canvas; `[0.5, 0.5]` is the
   * canvas middle. Accepts a static value or an animation signal.
   */
  center: AnimatableProp<readonly [number, number]>;
  /**
   * How fast blobs drift. 0 freezes them. Accepts a static value or an
   * animation signal.
   */
  speed: AnimatableProp<number>;
  /** Re-rolls every blob's path, size, and color pick. */
  seed: number;
  /** Color space the ramp interpolates in. */
  colorSpace: ColorSpace;
  /**
   * Hue arc for cylindrical color spaces (oklch/lch/hsl/hsv); inert
   * otherwise.
   */
  hueInterpolation: HueInterpolation;
}

export function BlobsShader({
  stops,
  count,
  size,
  sizeVariation,
  spread,
  softness,
  shading,
  center,
  speed,
  seed,
  colorSpace,
  hueInterpolation,
}: BlobsShaderProps) {
  const shaderContext = useShaderContext();

  // A literal speed of 0 freezes the goo, so nothing ever changes on screen
  // (an animation signal might move later and doesn't count). Telling the
  // scene lets its frame scheduler go idle instead of re-rendering.
  const isStatic = typeof speed === 'number' && speed === 0;

  useStaticSceneHint(isStatic);

  // The animated dials live in uniforms (values the CPU can update each
  // frame without rebuilding the shader). Speed is the exception:
  // useAnimatableSpeed integrates it into a phase uniform (speed × delta
  // summed each frame), so a speed change shifts the drift tempo without
  // snapping every blob to a new position.
  const countUniform = useAnimatableUniform<number>(count);
  const sizeUniform = useAnimatableUniform<number>(size);
  const sizeVariationUniform = useAnimatableUniform<number>(sizeVariation);
  const spreadUniform = useAnimatableUniform<number>(spread);
  const softnessUniform = useAnimatableUniform<number>(softness);
  const shadingUniform = useAnimatableUniform<number>(shading);
  const phaseUniform = useAnimatableSpeed(speed);

  // The center tuple rides a Vector2 uniform (vignette's pattern), so a new
  // array with the same coordinates never rebuilds anything.
  const centerUniform = useAnimatablePoint(center);

  // The seed rides a scalar uniform; the primitive hashes it into every
  // per-blob random stream, so consecutive seeds produce unrelated layouts.
  const seedUniform = useMemo(() => uniform(0), []);

  useEffect(() => {
    seedUniform.value = seed;
    shaderContext?.scheduler.requestRender();
  }, [shaderContext, seedUniform, seed]);

  // Content fingerprint of the stops array (colors + positions). The build
  // effect keys on this string, so a re-render that passes a new array with
  // the same contents doesn't rebuild the material.
  const stopsKey = colorStopsKey(stops);

  // ---------------------------------------------
  // Track the canvas aspect ratio
  // ---------------------------------------------
  // Blobs must stay round on any canvas shape. The uniform starts from the
  // current canvas size (16:9 fallback while the canvas is collapsed and
  // reports 0), then follows every resize.
  const resize = useResize();
  const [initialWidth, initialHeight] = resize.get();
  const aspectNode = useMemo(
    () => uniform(initialHeight > 0 ? initialWidth / initialHeight : 16 / 9),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    const [canvasWidth, canvasHeight] = resize.get();

    if (canvasWidth > 0 && canvasHeight > 0) aspectNode.value = canvasWidth / canvasHeight;

    return resize.on('change', ([updatedWidth, updatedHeight]) => {
      if (updatedWidth > 0 && updatedHeight > 0) {
        aspectNode.value = updatedWidth / updatedHeight;
        // At speed 0 the scene is hinted static, so without this poke a
        // resize would update the uniform and never repaint.
        shaderContext?.scheduler.requestRender();
      }
    });
  }, [shaderContext, resize, aspectNode]);

  // ---------------------------------------------
  // Build the material and mount the mesh
  // ---------------------------------------------
  // Runs once per mount — again only when the stops or color space change,
  // because colorRamp bakes the stop colors into the compiled shader as
  // constants. Every dial rides uniforms without touching this effect.
  useEffect(
    () => {
      if (!shaderContext) return;

      // Where to sample the field. uv() is the pixel's 0..1 position;
      // centering on `center` before the aspect multiply keeps blobs round
      // on any canvas shape and anchors the roam region where the prop
      // says. In this centered space the canvas is ~1 unit tall, which is
      // the scale the primitive's roam extent is tuned against.
      const centered = uv().sub(centerUniform);
      const samplePoint = vec2(centered.x.mul(aspectNode), centered.y);

      const balls = metaballs(samplePoint, {
        count: countUniform,
        size: sizeUniform,
        sizeVariation: sizeVariationUniform,
        spread: spreadUniform,
        time: phaseUniform,
        seed: seedUniform,
      });

      const material = new MeshBasicNodeMaterial();

      // ---------------------------------------------
      // Silhouette: threshold the summed field
      // ---------------------------------------------
      // The goo edge is where the field crosses the threshold. fwidth() (a
      // screen-space derivative — how much the field changes across one
      // screen pixel) widens the step by exactly one pixel's worth, so the
      // edge is crisp but never stair-stepped, at any zoom. Softness adds a
      // wider feather in FIELD units on top of that floor, fading each
      // blob out along its own falloff — mist instead of gel.
      const band = fwidth(balls.field).add(softnessUniform.mul(MAX_SOFTNESS));
      const mask = smoothstep(sub(THRESHOLD, band), add(THRESHOLD, band), balls.field);

      // ---------------------------------------------
      // Color: each blob's stable random picks from the ramp
      // ---------------------------------------------
      // blend is a weighted average of per-blob randoms, so inside one blob
      // it's that blob's constant pick, and across a merge seam it slides
      // between the two picks — the seam takes the ramp's in-between color.
      //
      // Shading slides each pixel ALONG the ramp around its own blob's
      // pick, by how far the field sits above the threshold — depth that
      // follows the goo's own shape. Centering (−0.5) holds the blob's
      // base color at mid-depth: edges slide toward the ramp's start,
      // cores toward its end. Offsetting the ramp INPUT (never
      // crossfading toward a shared value) keeps every blob's identity at
      // full shading — and every in-between color on the ramp itself.
      const depth = clamp(balls.field.sub(THRESHOLD).mul(DEPTH_RANGE), 0, 1);
      const rampInput = clamp(balls.blend.add(depth.sub(0.5).mul(shadingUniform)), 0, 1);

      const gooColor = colorRamp(rampInput, toColorRampStops(stops), colorSpace, hueInterpolation);

      // Alpha carries the goo mask, so the space between blobs is
      // transparent and whatever rendered beneath this layer shows through.
      // `transparent` opts the material into GPU alpha blending — without
      // it three ignores fragment alpha and this quad would overwrite any
      // layer stacked beneath it in the scene.
      material.transparent = true;
      material.colorNode = vec4(gooColor, mask);

      const mesh = new Mesh(new PlaneGeometry(2, 2), material);

      shaderContext.scene.add(mesh);

      return () => {
        shaderContext.scene.remove(mesh);
        try {
          material.dispose();
        } catch {
          // three/webgpu can throw during dispose under Strict Mode double-invoke
        }
        try {
          mesh.geometry.dispose();
        } catch {
          // same
        }
      };
    },
    // stopsKey is a stable string proxy for the stops array (identity-only
    // changes must not rebuild); uniforms are mutated in place.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      shaderContext,
      countUniform,
      sizeUniform,
      sizeVariationUniform,
      spreadUniform,
      softnessUniform,
      shadingUniform,
      centerUniform,
      phaseUniform,
      seedUniform,
      aspectNode,
      stopsKey,
      colorSpace,
      hueInterpolation,
    ],
  );

  return null;
}
