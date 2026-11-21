'use client';

// The heat shimmer's GPU half: a base-pass UV warp that moves where the
// image beneath is sampled, by a small shift that two noise reads give, one
// for each direction. It adds no light and no color of its own. A pre-pass,
// a draw that runs before the scene each frame, puts the noise into a small
// texture, and each pixel reads one texel (one pixel of a texture) of it.
// The wrapper (./heat-shimmer.tsx) supplies the props. In this phase the
// shimmer has no clock, so the shift holds still.
import { useEffect, useMemo } from 'react';

import {
  clamp,
  Fn,
  max,
  type ShaderNodeObject,
  texture,
  uniform,
  uv,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import {
  LinearFilter,
  type Node,
  RenderTarget,
  type Texture,
  UnsignedByteType,
} from 'three/webgpu';

import { createTexturePass, simplexNoise } from '../../engine.js';
import type { ShaderContextValue } from '../../react/context/shader-context.js';
import type { AnimatableProp } from '../../react/hooks/animatable-signal/animatable-signal.js';
import { useAnimatableUniform } from '../../react/hooks/use-animatable-uniform/use-animatable-uniform.js';
import { useAspectUniform } from '../../react/hooks/use-aspect-uniform/use-aspect-uniform.js';
import { useBasePassUv } from '../../react/hooks/use-base-pass-uv/use-base-pass-uv.js';
import type { ResizeValue } from '../../react/hooks/use-resize/use-resize.js';
import { useShaderContext } from '../../react/hooks/use-shader-context/use-shader-context.js';

// ---------------------------------------------
// Feel constants (provisional until the defaults gate)
// ---------------------------------------------
// The tuning prop overrides the ones HeatShimmerTuning lists, on the docs
// page, and the defaults gate bakes the landed values back in here.

/**
 * The shimmer's largest reach at a `scale` of 1, in canvas heights per unit
 * of noise. `strength={1}` reaches exactly this far, divided by `scale`. Past
 * some value the shift changes faster across the canvas than the pixels it
 * moves, so neighboring pixels swap places and the image folds over itself.
 * The tuning rig finds that value by raising this at `strength={1}` until
 * the image tears, then backing off. Higher pushes harder, lower is fainter.
 */
const FOLD_LIMIT = 0.25;

/**
 * How much wider than tall each lump of shift is. 1 leaves them round, and
 * 2 makes them twice as wide as tall. Higher stretches the lumps further
 * across, and lower than 1 makes them taller than wide.
 */
const STRETCH = 1.5;

/**
 * Where the second noise read sits on the noise's third axis, in noise
 * units. The noise is smooth over about one unit, so a slice this far away
 * gives values with no tie to the first read's, and the sideways and the
 * vertical shift don't move in step. Any distance of a few units works.
 */
const SECOND_SLICE = 37.5;

/**
 * The smallest `scale` the shader accepts. The reach divides by `scale`,
 * so 0 would divide by zero. At 0.1 a lump is ten canvas heights across.
 * Lower lets a `scale` near 0 grow the reach without bound, and higher
 * stops `scale` from making the lumps larger.
 */
const MIN_SCALE = 0.1;

/**
 * How many device pixels one texel of the shift texture covers on each
 * side. At 4 the texture holds a sixteenth of the canvas's pixels, so the
 * two noise reads run a sixteenth as often as they would per pixel. The
 * noise is smooth, so the linear filter fills in between texels. Higher is
 * cheaper and coarser: once a lump spans only a few texels, its bends show
 * as straight segments. Lower is finer and costs more.
 */
const TEXEL_PIXELS = 4;

/**
 * The shift texture's side, in texels, for a canvas side in CSS pixels: the
 * side in device pixels over TEXEL_PIXELS, rounded up so the last few
 * pixels get a texel of their own. A collapsed canvas reports 0, and a
 * texture needs at least one texel a side.
 */
function shiftTextureSide(cssSide: number, pixelRatio: number) {
  return Math.max(1, Math.ceil((cssSide * pixelRatio) / TEXEL_PIXELS));
}

/** TEMPORARY (build-phase tuning only): dev overrides for the feel constants. */
export interface HeatShimmerTuning {
  /** The shimmer's largest reach at a `scale` of 1, in canvas heights per unit of noise. */
  foldLimit?: number;
  /** How much wider than tall each lump is. 1 is round. */
  stretch?: number;
}

/**
 * TEMPORARY (build-phase tuning only): the tuning overrides, each in a
 * uniform so the tuning sliders glide without rebuilding the shader. The
 * defaults gate deletes this hook and bakes the constants back in.
 */
function useTuningUniforms(tuning: HeatShimmerTuning | undefined) {
  const { foldLimit = FOLD_LIMIT, stretch = STRETCH } = tuning ?? {};

  return {
    foldLimitUniform: useAnimatableUniform<number>(foldLimit),
    stretchUniform: useAnimatableUniform<number>(stretch),
  };
}

export interface HeatShimmerShaderProps {
  /**
   * How hard the shimmer pushes, from 0 to 1, where 1 is the most that
   * can't fold the image and 0 leaves it unchanged. Values outside 0 to 1
   * clamp. Accepts a static value or an animation signal.
   */
  strength: AnimatableProp<number>;
  /**
   * How many lumps of shift fit in the canvas's height. Higher is more and
   * smaller. Accepts a static value or an animation signal.
   */
  scale: AnimatableProp<number>;
  /**
   * TEMPORARY (build-phase tuning only): dev overrides for the feel
   * constants.
   */
  tuning: HeatShimmerTuning | undefined;
}

// ---------------------------------------------
// The shift pass: the noise, drawn once a frame
// ---------------------------------------------

type FloatUniform = ReturnType<typeof uniform<number>>;

interface ShiftPassInputs {
  shaderContext: ShaderContextValue;
  /** The canvas's width over its height. */
  aspect: FloatUniform;
  /** How much wider than tall each lump is. */
  stretch: FloatUniform;
  /** `scale`, kept off 0 by MIN_SCALE. */
  safeScale: ShaderNodeObject<Node>;
}

/** The shift pass's texture and its teardown. */
interface ShiftPass {
  /** Both noise values, mapped into 0..1: red across, green down. */
  texture: Texture;
  /** Stop drawing and fitting the pass, and release its texture. */
  dispose: () => void;
}

/**
 * Draws the shimmer's two noise values into a texture once a frame, so each
 * pixel of the warp reads one texel instead of running two noise reads. The
 * noise depends on where a pixel sits and on the uniforms, never on what the
 * image beneath holds, so the texture can be far smaller than the canvas and
 * the linear filter fills in between texels. Swells' and Aurora's field
 * passes are the models.
 *
 * Returns null only after a lost device, because every backend draws into
 * an 8-bit target. The caller creates and disposes the pass in one effect,
 * so a Strict Mode remount builds a fresh one (the Strict Mode gotcha in
 * docs/agents/tsl.md).
 */
function createShiftPass({
  shaderContext,
  aspect,
  stretch,
  safeScale,
}: ShiftPassInputs): ShiftPass | null {
  const renderer = shaderContext.renderer.three;

  // The pass draws one quad over the texture, so this node runs once per
  // texel. Inside it, uv() is the texel's 0..1 position. It runs from the
  // top-left with y growing downward, the same frame as the pass
  // coordinate the warp receives, so the texel the warp reads at a
  // coordinate holds the noise at that coordinate.
  const noiseNode = Fn(() => {
    const coordinate = uv();

    // Where this texel reads the noise. y is already in canvas heights. x
    // runs over the canvas width, so multiplying it by the aspect puts it
    // in canvas heights too, which keeps the lumps the same shape on a wide
    // canvas and a tall one (aspect correction). Dividing x by the stretch
    // slows the noise across, so each lump spans more of the width than
    // the height. `scale` then fits that many lumps in the canvas's height.
    const noisePoint = vec2(coordinate.x.mul(aspect).div(stretch), coordinate.y).mul(safeScale);

    // Two noise reads, each a smooth random number from about -1 to 1 that
    // changes gradually across the canvas. The first sets the sideways
    // shift and the second, one slice further along the noise's third axis,
    // the vertical one. Two independent reads move an edge at every angle:
    // a vertical edge such as a stem bends sideways, and a horizontal one
    // bends up and down. The third axis holds 0 for now, and a later phase
    // moves both slices along it with a clock.
    const shift = vec2(
      simplexNoise(vec3(noisePoint, 0)),
      simplexNoise(vec3(noisePoint, SECOND_SLICE)),
    );

    // An 8-bit channel holds 0 to 1 in 256 steps, so the noise is mapped
    // from -1..1 into 0..1 to keep its sign: times 0.5, plus 0.5. The GPU
    // clamps what it writes to an 8-bit target into 0..1 anyway, and the
    // clamp here says so in the code. The warp undoes the mapping when it
    // reads. Blue and alpha carry nothing.
    return vec4(clamp(shift.mul(0.5).add(0.5), 0, 1), 0, 1);
  })();

  // 8-bit texels draw on every backend, the WebGL2 fallback included,
  // which a half-float target can't without EXT_color_buffer_float. One
  // step is 1/128 of a noise unit, so the shift lands within 1/256 of the
  // reach of the inline noise's: a fraction of a pixel at the default
  // `scale`, and more at a low `scale`, whose reach is larger. The linear
  // filter blends the four texels around each read, so the shift varies
  // smoothly between texel centers. The size is a placeholder until the
  // fit below.
  const pass = createTexturePass(renderer, noiseNode, {
    width: 1,
    height: 1,
    type: UnsignedByteType,
    filter: LinearFilter,
  });
  const shiftTexture = pass.texture;

  if (shiftTexture === null) return null;

  // Size the texture to the canvas: its CSS size times the renderer's pixel
  // ratio, rather than the drawing buffer, which still holds the old size
  // when a zoom reaches this listener before the renderer resizes. The pass
  // keeps its texture object through a resize, so the warp stays bound to
  // it (the resize-rebind gotcha in docs/agents/tsl.md). The frame request
  // redraws a parked scene at the new size (the bare-uniform-write gotcha).
  const fit = ([width, height]: ResizeValue) => {
    const pixelRatio = renderer.getPixelRatio();

    pass.resize(shiftTextureSide(width, pixelRatio), shiftTextureSide(height, pixelRatio));
    shaderContext.scheduler.requestRender();
  };

  fit(shaderContext.canvasSize.get());
  const stopFitting = shaderContext.canvasSize.on('change', fit);

  // The output stage draws every pre-pass ahead of the scene pass, on every
  // frame and on the redraw after a resize, so the warp always reads this
  // frame's noise (the draw-order gotcha in docs/agents/tsl.md).
  const removePrePass = shaderContext.registerPrePass(pass.render);

  return {
    texture: shiftTexture,
    dispose() {
      removePrePass();
      stopFitting();
      pass.dispose();
    },
  };
}

export function HeatShimmerShader({ strength, scale, tuning }: HeatShimmerShaderProps) {
  const shaderContext = useShaderContext();

  // The dials live in uniforms, values the CPU writes and the GPU reads at
  // each draw, so changing them never rebuilds the output chain.
  const strengthUniform = useAnimatableUniform<number>(strength);
  const scaleUniform = useAnimatableUniform<number>(scale);
  const aspectUniform = useAspectUniform();
  const { foldLimitUniform, stretchUniform } = useTuningUniforms(tuning);

  // `scale` kept off 0, which the reach divides by. The pass and the warp
  // share this one node.
  const safeScale = useMemo(() => max(scaleUniform, MIN_SCALE), [scaleUniform]);

  // ---------------------------------------------
  // Point the warp at the shift pass
  // ---------------------------------------------
  // A texture node is the GPU's handle on an image. The warp below reads
  // this one, and the effect after it points it at the shift pass's
  // texture by writing `.value`. Every read the warp makes is a copy that
  // looks up `.value` here, so the swap reaches them all, and the warp
  // never registers again.
  //
  // Until the swap, the node holds a stand-in from a render target, a
  // texture the GPU can draw into, which nothing ever draws into. On the
  // WebGL2 fallback, three flips y when it reads a render target, and it
  // decides the flip from the texture the node holds when the shader
  // compiles. A stand-in of any other kind would compile without the flip
  // and then read the real texture upside down. The stand-in takes no GPU
  // memory unless a shader reads it. Building the node with uv() as its
  // coordinate keeps three's texture matrix off for every copy (the
  // texture-matrix gotcha in docs/agents/tsl.md).
  const shiftTexture = useMemo(() => texture(new RenderTarget(1, 1).texture, uv()), []);

  // 1 while the node holds the pass's texture, 0 otherwise. The stand-in
  // reads 0 in every channel, which decodes to a shift of -1 on both axes,
  // so the warp multiplies the shift by this to leave the image still
  // until the pass's texture is in place, and after a lost device.
  const shiftReady = useMemo(() => uniform(0), []);

  useEffect(() => {
    if (!shaderContext) return;
    const pass = createShiftPass({
      shaderContext,
      aspect: aspectUniform,
      stretch: stretchUniform,
      safeScale,
    });

    if (!pass) return;
    shiftTexture.value = pass.texture;
    shiftReady.value = 1;

    return () => {
      shiftReady.value = 0;
      pass.dispose();
    };
  }, [shaderContext, shiftTexture, shiftReady, aspectUniform, stretchUniform, safeScale]);

  // ---------------------------------------------
  // The warp: move where the image beneath is sampled
  // ---------------------------------------------
  // A base-pass UV warp: the callback receives the 0..1 coordinate the
  // image beneath is about to be sampled at and returns a replacement. The
  // pixel keeps its place on screen and shows the image from a little way
  // off, so an edge under a shift looks bent. `coordinate` is a pass
  // coordinate, [0, 0] at the top-left with y growing downward.
  useBasePassUv(
    (coordinate) => {
      // One filtered texel: the two noise values at this coordinate, back
      // from 0..1 to -1..1 (times 2, minus 1). x is the sideways shift and
      // y the vertical one, each in canvas heights per unit of reach.
      const noise = shiftTexture.uv(coordinate).xy.mul(2).sub(1);

      // The reach: how far a noise value of 1 moves the sample, in canvas
      // heights. `strength` clamps to 0..1, so 1 is the fold limit's reach
      // and 0 leaves the image exactly as it was. Dividing by `scale` keeps
      // the shift's steepness the same as the lumps change size. Smaller
      // lumps change faster across the canvas, so the same reach on them
      // would fold the image sooner. Steepness, not reach, is what folds:
      // once the shift falls by more than a pixel over one pixel's step,
      // the next pixel reads from behind this one.
      //
      // The filter blends in straight lines between texels, and a straight
      // line between two points on a curve is never steeper than the
      // curve's steepest part between them. 8-bit rounding can move two
      // neighboring texels up to one step, 1/128 of a noise unit, further
      // apart than the noise has them. So the texture can fold slightly
      // sooner than the inline noise did, most at a high `scale`, where a
      // lump spans the fewest texels.
      const reach = clamp(strengthUniform, 0, 1)
        .mul(foldLimitUniform)
        .div(safeScale)
        .mul(shiftReady);

      // Back to the pass's units. The vertical shift is already a share of
      // the canvas's height. The sideways one is in canvas heights, so
      // dividing it by the aspect turns it into a share of the width, the
      // same distance on screen as the vertical one.
      const shift = vec2(noise.x.div(aspectUniform), noise.y).mul(reach);

      return coordinate.add(shift);
    },
    [shiftTexture, shiftReady, strengthUniform, safeScale, aspectUniform, foldLimitUniform],
  );

  return null;
}
