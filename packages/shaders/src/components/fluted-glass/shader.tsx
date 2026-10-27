'use client';

// The fluted glass's GPU half, in two passes that read the same glass. A
// base-pass UV warp moves where the scene texture is sampled, so the image
// beneath the glass bends through repeating flutes. A post-process color
// transform then lights the glass: a highlight on the walls that face the
// light, and a shadow at the grooves. The flute math lives in the engine's
// fluteSurface primitive; this file converts the pass's coordinate into the
// pixels the primitive works in, and what it returns back out. The wrapper
// (./fluted-glass.tsx) supplies the props.
import { useEffect, useMemo } from 'react';

import type { ShaderNodeObject } from 'three/tsl';
import {
  abs,
  cos,
  dot,
  fract,
  max,
  normalize,
  pow,
  screenSize,
  sin,
  smoothstep,
  uniform,
  uv,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import { type Node, Vector3 } from 'three/webgpu';

import { fluteSurface } from '../../engine.js';
import {
  FLAT_EXPONENT,
  GROOVE_SMOOTHING,
  PRISM_EXPONENT,
} from '../../primitives/flute-surface/flute-surface.js';
import type { AnimatableProp } from '../../react/hooks/animatable-signal/animatable-signal.js';
import { useAnimatableUniform } from '../../react/hooks/use-animatable-uniform/use-animatable-uniform.js';
import { useBasePassUv } from '../../react/hooks/use-base-pass-uv/use-base-pass-uv.js';
import { usePostProcessPass } from '../../react/hooks/use-overlay-pass/use-overlay-pass.js';
import { useResize } from '../../react/hooks/use-resize/use-resize.js';
import { useShaderContext } from '../../react/hooks/use-shader-context/use-shader-context.js';
import { parseColor } from '../shared/color.js';

export interface FlutedGlassShaderProps {
  /**
   * The width of one flute, in CSS pixels. Accepts a static value or an
   * animation signal.
   */
  fluteWidth: AnimatableProp<number>;
  /**
   * The direction the flutes run, in degrees on screen: 0 runs them left to
   * right and 90 runs them bottom to top. Accepts a static value or an
   * animation signal.
   */
  angle: AnimatableProp<number>;
  /**
   * How far each flute bends the image beneath it, in half flute widths at
   * the steepest part of the glass. 0 leaves the image unchanged. Accepts a
   * static value or an animation signal.
   */
  refraction: AnimatableProp<number>;
  /**
   * The shape of each flute seen from its end, from 0 to 1: 0 is a prism,
   * 0.5 is round, and 1 is a flat top with steep walls. The wrapper turns a
   * name into its point on this dial. Accepts a static value or an animation
   * signal.
   */
  crossSection: AnimatableProp<number>;
  /**
   * Where the light comes from, as a compass angle in degrees on screen: 0
   * from the right, 90 from below, 180 from the left, and 270 from above.
   * Accepts a static value or an animation signal.
   */
  lightAngle: AnimatableProp<number>;
  /**
   * How bright the highlight is, from 0 to 1, where 1 adds the full
   * `highlightColor` at the brightest point. Accepts a static value or an
   * animation signal.
   */
  highlight: AnimatableProp<number>;
  /** The highlight's color: hex, `oklch()`, or `oklab()`. */
  highlightColor: string;
  /**
   * How dark the glass gets at each groove, from 0 to 1, where 1 is black
   * right on the groove. Accepts a static value or an animation signal.
   */
  shadow: AnimatableProp<number>;
  /**
   * TEMPORARY (build-phase tuning only): dev overrides for the feel
   * constants. Stripped at the defaults-tuning gate.
   */
  tuning: FlutedGlassTuning | undefined;
}

/**
 * TEMPORARY (build-phase tuning only): dev overrides for the feel constants,
 * wired to the docs panel's "Tuning (dev)" section. Stripped at the
 * defaults-tuning gate, when the landed values are baked into constants.
 */
export interface FlutedGlassTuning {
  /** The slope's exponent at a cross-section of 0, the prism. */
  prismExponent?: number;
  /** The slope's exponent at a cross-section of 1, the flat top. */
  flatExponent?: number;
  /** How many screen pixels each groove and the prism's ridge smooth over. */
  grooveSmoothing?: number;
  /** How high the light sits above the glass, in degrees. */
  lightHeight?: number;
  /** The specular exponent: higher draws a thinner, harder highlight. */
  highlightSharpness?: number;
  /** How far the shadow reaches in from each groove, as a share of half a flute. */
  shadowWidth?: number;
}

// ---------------------------------------------
// Feel constants (tuned by eye at the build's visual gates)
// ---------------------------------------------
// How high the light sits above the glass, in degrees: 0 skims across it
// and 90 shines straight down. A lower light catches walls that lean
// further over, so it moves the highlight out toward the grooves.
const LIGHT_HEIGHT = 30;
// The specular exponent. Higher draws a thinner, harder highlight, and
// lower spreads it into a soft sheen across the wall.
const HIGHLIGHT_SHARPNESS = 32;
// How far the shadow reaches in from each groove, as a share of the way to
// the flute's center. 1 shades the whole flute, darkest at the grooves.
const SHADOW_WIDTH = 0.5;

// The pass's frame has y down and the primitive's has y up, so a vector
// that crosses between them flips its y.
function flipY(vector: ShaderNodeObject<Node>): ShaderNodeObject<Node> {
  return vector.mul(vec2(1, -1));
}

// ---------------------------------------------
// Mirroring at the canvas edge
// ---------------------------------------------
// Near the canvas edge the bend can point off the canvas, where the scene
// texture has nothing. Left alone, the sampler, the GPU unit that reads a
// texture, clamps to the edge texel, the texture's outermost pixel, and
// repeats it, which draws a smeared strip. This folds the coordinate back
// instead, as if the image were mirrored past each edge.
//
// fract(x / 2) * 2 counts x along a 0-to-2 cycle, and subtracting 1 makes it
// run -1 to 1. Its absolute value then falls from 1 to 0 and climbs back,
// and 1 minus that rises from 0 to 1 and falls back: a triangle wave. On
// 0..1 it returns x unchanged, past 1 it walks back down, so 1.1 reads 0.9,
// and below 0 it walks back up, so -0.1 reads 0.1. It works per component.
function mirrorOntoCanvas(coordinate: ShaderNodeObject<Node>): ShaderNodeObject<Node> {
  return abs(fract(coordinate.div(2)).mul(2).sub(1)).oneMinus();
}

export function FlutedGlassShader({
  fluteWidth,
  angle,
  refraction,
  crossSection,
  lightAngle,
  highlight,
  highlightColor,
  shadow,
  tuning,
}: FlutedGlassShaderProps) {
  const shaderContext = useShaderContext();

  // The dials live in uniforms, values the CPU writes and the GPU reads at
  // each draw, so changing them never rebuilds the output chain.
  const fluteWidthUniform = useAnimatableUniform(fluteWidth);
  const angleUniform = useAnimatableUniform(angle);
  const refractionUniform = useAnimatableUniform(refraction);
  const crossSectionUniform = useAnimatableUniform(crossSection);
  const lightAngleUniform = useAnimatableUniform(lightAngle);
  const highlightUniform = useAnimatableUniform(highlight);
  const shadowUniform = useAnimatableUniform(shadow);

  // The highlight color decodes once into linear rgb (parseColor reads hex
  // and the wide-gamut oklch() and oklab() strings). The Vector3 and its
  // uniform are created once, and the effect below writes each new color
  // into the Vector3, so a new color never rebuilds the color transform.
  const highlightColorVector = useMemo(() => new Vector3(1, 1, 1), []);
  const highlightColorUniform = useMemo(
    () => uniform(highlightColorVector),
    [highlightColorVector],
  );

  useEffect(() => {
    highlightColorVector.set(...parseColor(highlightColor));
    // The bare-uniform-write gotcha in docs/agents/tsl.md: a write into the
    // Vector3 repaints nothing on a static scene by itself.
    shaderContext?.scheduler.requestRender();
  }, [highlightColor, highlightColorVector, shaderContext]);

  // ---------------------------------------------
  // Tuning (dev): stripped at the defaults gate
  // ---------------------------------------------
  // The feel constants ride uniforms too, so the panel's tuning sliders move
  // the glass without a rebuild. Each falls back to the primitive's constant
  // when the panel leaves it unset. The effect keys on the two numbers, not
  // the tuning object, which the panel rebuilds on every write.
  const prismExponentUniform = useMemo(() => uniform(PRISM_EXPONENT), []);
  const flatExponentUniform = useMemo(() => uniform(FLAT_EXPONENT), []);
  const grooveSmoothingUniform = useMemo(() => uniform(GROOVE_SMOOTHING), []);
  const lightHeightUniform = useMemo(() => uniform(LIGHT_HEIGHT), []);
  const highlightSharpnessUniform = useMemo(() => uniform(HIGHLIGHT_SHARPNESS), []);
  const shadowWidthUniform = useMemo(() => uniform(SHADOW_WIDTH), []);
  const prismExponent = tuning?.prismExponent ?? PRISM_EXPONENT;
  const flatExponent = tuning?.flatExponent ?? FLAT_EXPONENT;
  const grooveSmoothing = tuning?.grooveSmoothing ?? GROOVE_SMOOTHING;
  const lightHeight = tuning?.lightHeight ?? LIGHT_HEIGHT;
  const highlightSharpness = tuning?.highlightSharpness ?? HIGHLIGHT_SHARPNESS;
  const shadowWidth = tuning?.shadowWidth ?? SHADOW_WIDTH;

  useEffect(() => {
    prismExponentUniform.value = prismExponent;
    flatExponentUniform.value = flatExponent;
    grooveSmoothingUniform.value = grooveSmoothing;
    lightHeightUniform.value = lightHeight;
    highlightSharpnessUniform.value = highlightSharpness;
    shadowWidthUniform.value = shadowWidth;
    // A bare uniform write repaints nothing on a static scene (the
    // bare-uniform-write gotcha in docs/agents/tsl.md).
    shaderContext?.scheduler.requestRender();
  }, [
    prismExponent,
    flatExponent,
    grooveSmoothing,
    lightHeight,
    highlightSharpness,
    shadowWidth,
    prismExponentUniform,
    flatExponentUniform,
    grooveSmoothingUniform,
    lightHeightUniform,
    highlightSharpnessUniform,
    shadowWidthUniform,
    shaderContext,
  ]);

  // ---------------------------------------------
  // CSS pixels -> device pixels
  // ---------------------------------------------
  // fluteWidth is in CSS pixels so a flute keeps its size on a 1x and a 2x
  // display, but the warp below counts device pixels. The renderer's pixel
  // ratio, which respects maxDPR clamping, converts between them; useResize
  // fires again on monitor moves and browser zoom, when that ratio changes.
  // Dither builds its ratio the same way.
  const resize = useResize();
  // Created once and never replaced: the effect below writes into it, and
  // the warp depends on the stable wrapper.
  const pixelRatioUniform = useMemo(
    () => uniform(resize.get()[2] || 1),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    const apply = () => {
      const rendererRatio = shaderContext?.renderer.three.getPixelRatio();

      pixelRatioUniform.value =
        rendererRatio !== undefined && rendererRatio > 0 ? rendererRatio : resize.get()[2] || 1;
      // A bare uniform write repaints nothing on a static scene, so ask for
      // a frame (the bare-uniform-write gotcha in docs/agents/tsl.md).
      shaderContext?.scheduler.requestRender();
    };

    apply();

    return resize.on('change', apply);
  }, [resize, pixelRatioUniform, shaderContext]);

  // ---------------------------------------------
  // The glass at a pixel
  // ---------------------------------------------
  // Both passes below start here, so the light lands where the image bends.
  // `coordinate` is a pass coordinate, [0, 0] at the top-left with y growing
  // downward. Into the primitive's frame: subtract 0.5 to measure from the
  // canvas center, so the middle flute sits in the middle of the canvas and
  // the flutes turn around it as `angle` changes. Times screenSize, the
  // drawing buffer in device pixels, turns 0..1 into pixels, so a flute is as
  // wide across a wide canvas as across a tall one. The y flip points y up,
  // the frame the primitive's angle is measured in.
  const surfaceAt = (coordinate: ShaderNodeObject<Node>) =>
    fluteSurface(flipY(coordinate.sub(0.5).mul(screenSize)), {
      fluteWidth: fluteWidthUniform.mul(pixelRatioUniform),
      angle: angleUniform,
      refraction: refractionUniform,
      crossSection: crossSectionUniform,
      prismExponent: prismExponentUniform,
      flatExponent: flatExponentUniform,
      grooveSmoothing: grooveSmoothingUniform,
    });

  // ---------------------------------------------
  // Refraction: bend the scene through the flutes
  // ---------------------------------------------
  // A base-pass UV warp: the callback receives the 0..1 coordinate the
  // rendered scene is about to be sampled at and returns a replacement.
  useBasePassUv(
    (coordinate) => {
      const { bend } = surfaceAt(coordinate);

      // Back out: the bend comes back in device pixels with y up. Flip y
      // again and divide by the buffer size to get a 0..1 offset in the
      // pass's frame, then fold anything off the canvas back onto it.
      const bent = coordinate.add(flipY(bend).div(screenSize));

      return mirrorOntoCanvas(bent);
    },
    [
      fluteWidthUniform,
      angleUniform,
      refractionUniform,
      crossSectionUniform,
      prismExponentUniform,
      flatExponentUniform,
      grooveSmoothingUniform,
      pixelRatioUniform,
    ],
  );

  // ---------------------------------------------
  // Lighting: a shadow at the grooves, a highlight on the walls
  // ---------------------------------------------
  // A post-process pass: the callback receives each pixel the scene drew,
  // already bent by the warp above (`input`, rgba), and returns a
  // replacement. The warp and this pass draw in the same output quad, and
  // uv() here is the same pass coordinate the warp started from, so
  // surfaceAt(uv()) is the glass at this very pixel.
  usePostProcessPass(
    (input) => {
      const { slope, fromCenter } = surfaceAt(uv());

      // The shadow. smoothstep() climbs from 0 to 1 over the outer
      // shadowWidth of the way from the center to the groove, so the shade
      // is 0 across the middle of the flute and full right on the groove.
      // It reads fromCenter rather than the slope: the groove smoothing
      // pulls the slope to 0 on the groove's own pixel, which would leave a
      // bright line down the middle of the dark one. Multiplying darkens
      // without moving alpha, and a transparent pixel, which holds no color
      // here, stays transparent.
      const shade = smoothstep(shadowWidthUniform.oneMinus(), 1, fromCenter).mul(shadowUniform);
      const shaded = input.rgb.mul(shade.oneMinus());

      // The surface normal: the direction the glass faces, one unit long.
      // Flat glass faces straight out of the screen, (0, 0, 1). Tilt it by
      // the slope, turned into the pass's frame, and a wall's normal leans
      // the way the wall faces. At a slope of 1, at a groove, it leans 45
      // degrees. normalize() scales the vector back to one unit long.
      const normal = normalize(vec3(flipY(slope), 1));

      // The direction toward the light, one unit long. lightAngle turns it
      // around the screen by CursorRipple's compass, and the light's height
      // lifts it off the glass: cos(height) of it lies along the screen and
      // sin(height) points out of it.
      const lightRadians = lightAngleUniform.mul(Math.PI / 180);
      const heightRadians = lightHeightUniform.mul(Math.PI / 180);
      const toLight = vec3(
        cos(lightRadians).mul(cos(heightRadians)),
        sin(lightRadians).mul(cos(heightRadians)),
        sin(heightRadians),
      );

      // Specular light, the Blinn-Phong way. A mirror sends light from the
      // light to the eye where its normal points halfway between the two.
      // The eye looks straight at the screen, from (0, 0, 1), so the
      // halfway vector is the normalized sum of that and toLight. dot()
      // of two unit vectors is the cosine of the angle between them: 1
      // where the normal points exactly halfway, and lower as it turns
      // away. pow() raises that to the sharpness, which keeps values near 1
      // and crushes the rest, so the highlight narrows to a bright line on
      // the part of each wall that leans toward the light by the right
      // amount. Flat glass and walls that face away stay dark. max() keeps
      // pow()'s base from going below 0.
      const halfway = normalize(toLight.add(vec3(0, 0, 1)));
      const specular = pow(max(dot(normal, halfway), 0), highlightSharpnessUniform);

      // Added light, scaled by the dial and by the pixel's alpha, as
      // CursorRipple's shine is: a transparent pixel has nothing for light
      // to land on. The color multiplies last, as an argument (the
      // vec-uniform gotcha in docs/agents/tsl.md). Alpha passes through.
      const light = specular.mul(highlightUniform).mul(input.a).mul(highlightColorUniform);

      return vec4(shaded.add(light), input.a);
    },
    [
      fluteWidthUniform,
      angleUniform,
      refractionUniform,
      crossSectionUniform,
      prismExponentUniform,
      flatExponentUniform,
      grooveSmoothingUniform,
      pixelRatioUniform,
      lightAngleUniform,
      highlightUniform,
      highlightColorUniform,
      shadowUniform,
      lightHeightUniform,
      highlightSharpnessUniform,
      shadowWidthUniform,
    ],
  );

  return null;
}
