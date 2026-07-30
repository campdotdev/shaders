'use client';

// The radial gradient's GPU half. The wrapper (./radial-gradient.tsx) passes
// resolved props down; this component turns them into shader inputs, builds a
// full-screen plane whose color is computed per pixel, and mounts it into the
// shared ShaderScene. The gradient is one measurement: how far is this pixel
// from the center, as a fraction of the way to the corner? That fraction picks
// a color from the ramp.
import { useEffect, useMemo } from 'react';

import { colorRamp, type ColorSpace, type HueInterpolation } from '@lovo/matter';
import {
  type AnimatableProp,
  useAnimatableUniform,
  useResize,
  useShaderContext,
  useStaticSceneHint,
} from '@lovo/matter-react';
import type { ShaderNodeObject } from 'three/tsl';
import { clamp, cos, fract, length, sin, uniform, uv, vec2 } from 'three/tsl';
import type { Node } from 'three/webgpu';
import { Mesh, MeshBasicNodeMaterial, PlaneGeometry, Vector2 } from 'three/webgpu';

import { type ColorStop, colorStopsKey, toColorRampStops } from '../utils/color';

export interface RadialGradientShaderProps {
  /**
   * Colors along the gradient, running from the center outward. Accepts hex,
   * `oklch()`, or `oklab()`; positions auto-space when omitted.
   */
  stops: ColorStop[];
  /**
   * Where the gradient starts, 0..1 across the canvas; `[0.5, 0.5]` is
   * centered and `[0, 0]` is the top-left corner.
   */
  center: [number, number];
  /**
   * How far out the ramp reaches its last color, where 1 lands at the canvas
   * corners. Accepts a static value or an animation signal.
   */
  radius: AnimatableProp<number>;
  /**
   * Squashes the circle into an ellipse. 1 is a circle; above 1 stretches it
   * wider, below 1 stretches it taller. Accepts a static value or an animation
   * signal.
   */
  stretch: AnimatableProp<number>;
  /**
   * Rotation of the ellipse in degrees, counterclockwise. Inert while
   * `stretch` is 1. Accepts a static value or an animation signal.
   */
  angle: AnimatableProp<number>;
  /**
   * How many times the ramp runs between the center and `radius`. 1 is a
   * single pass; above 1 gives concentric rings. Accepts a static value or an
   * animation signal.
   */
  repeat: AnimatableProp<number>;
  /** Color space the gradient is interpolated in. */
  colorSpace: ColorSpace;
  /** Hue arc for cylindrical color spaces (oklch/lch/hsl/hsv); inert otherwise. */
  hueInterpolation: HueInterpolation;
}

// Guards the divide when radius reaches 0. Small enough that radius 0 reads as
// "the whole canvas is the last color", which is what a zero radius should
// look like, without producing a 0/0 NaN at the exact center pixel.
const MIN_RADIUS = 0.001;

// Guards the divide when stretch reaches 0, where the ellipse would otherwise
// be infinitely wide.
const MIN_STRETCH = 0.001;

// Triangle wave, period 2, running 0 -> 1 -> 0. fract(x/2) ramps 0..1 across
// two units; doubling and subtracting 1 turns that into -1..1; abs() folds the
// negative half up into a V; oneMinus() turns the V into a peak. The reason
// this beats a plain fract() is the fold: fract() would snap the last stop
// straight back to the first at every ring boundary, a hard seam for any
// palette whose ends differ, whereas this runs the ramp back out the way it
// came. On 0..1 it is exactly the identity, which is what makes repeat 1 a
// true no-op.
const pingPong = (value: ShaderNodeObject<Node>): ShaderNodeObject<Node> =>
  fract(value.mul(0.5)).mul(2).sub(1).abs().oneMinus();

export function RadialGradientShader({
  stops,
  center,
  radius,
  stretch,
  angle,
  repeat,
  colorSpace,
  hueInterpolation,
}: RadialGradientShaderProps) {
  const shaderContext = useShaderContext();

  // Nothing in this phase moves on its own, so the scene's frame scheduler can
  // park instead of re-rendering an unchanging image. Task 4 replaces this
  // with a speed-aware version.
  useStaticSceneHint(true);

  // Content fingerprint of the stops array (colors + positions). The build
  // effect below keys on this string, so a re-render that passes a new array
  // with the same contents doesn't rebuild the material.
  const stopsKey = colorStopsKey(stops);

  // Radius lives in a uniform — a value the CPU can update each frame without
  // rebuilding the shader. useAnimatableUniform keeps it current whether the
  // prop is a plain number or an animation signal.
  const radiusUniform = useAnimatableUniform<number>(radius);
  const stretchUniform = useAnimatableUniform<number>(stretch);
  const angleUniform = useAnimatableUniform<number>(angle);
  const repeatUniform = useAnimatableUniform<number>(repeat);

  // ---------------------------------------------
  // Stable vectors the prop effects write into
  // ---------------------------------------------
  // The Vector2 and its uniform wrapper are created once and never replaced.
  // The effect below pushes new prop values in with .set(), and the GPU reads
  // the updated numbers on the next frame. Because the build effect depends
  // only on these stable references, moving the center never tears down and
  // recompiles the material.

  const centerVec = useMemo(() => new Vector2(0.5, 0.5), []);
  const centerUniform = useMemo(() => uniform(centerVec), [centerVec]);

  // The y flip (1 - y) converts the prop's screen-style coordinates (y grows
  // downward, like CSS) into UV space — the mesh's built-in 0..1 surface
  // coordinates, where v grows upward. Without it, moving the center "down"
  // would move the gradient up. Vignette deliberately does NOT flip, because a
  // post-process quad's uv is already screen-style; both are correct.
  useEffect(() => {
    centerVec.set(center[0], 1 - center[1]);
    shaderContext?.scheduler.requestRender();
  }, [shaderContext, centerVec, center]);

  // ---------------------------------------------
  // Track the canvas aspect ratio
  // ---------------------------------------------
  // The distance math needs width/height to keep the gradient circular. The
  // uniform starts from the current canvas size (falling back to 16:9 when the
  // canvas hasn't been laid out yet and reports 0), then follows every resize.
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
        // The scene is hinted static, so a resize would update the uniform and
        // never repaint without this.
        shaderContext?.scheduler.requestRender();
      }
    });
  }, [shaderContext, resize, aspectNode]);

  // ---------------------------------------------
  // Build the material and mount the mesh
  // ---------------------------------------------
  // Runs once per mount — and again only when the stops or color settings
  // change, because colorRamp bakes the stop colors into the compiled shader
  // as constants rather than uniforms. Everything else flows through the
  // stable uniforms above without touching this effect.
  useEffect(() => {
    if (!shaderContext) return;

    const rampStops = toColorRampStops(stops);

    // Where is this pixel relative to the gradient's origin? uv() is its 0..1
    // position on the plane; subtracting the center gives an offset that runs
    // about -0.5..0.5 in each direction.
    const centered = uv().sub(centerUniform);

    // Multiplying the horizontal offset by width/height converts it into the
    // same units as the vertical one. Without this, length() below would
    // measure an ellipse stretched to the canvas shape — a "circle" would come
    // out wide on a wide canvas.
    const corrected = vec2(centered.x.mul(aspectNode), centered.y);

    // Rotate the sampled point by MINUS the angle. Rotating the point
    // backwards is how you rotate the shape forwards: each pixel asks "where
    // would I be if the ellipse were axis-aligned?", the squash below answers
    // in that convenient frame, and the result reads as an ellipse tilted by
    // +angle. Doing it the other way round would do nothing at all — rotation
    // preserves length, so a rotation applied after the squash cancels out
    // entirely by the time length() runs. Degrees go in because that is what
    // the prop takes; radians are what the trig wants.
    const angleRadians = angleUniform.mul(Math.PI / 180);
    const angleCos = cos(angleRadians);
    const angleSin = sin(angleRadians);
    const rotated = vec2(
      corrected.x.mul(angleCos).add(corrected.y.mul(angleSin)),
      corrected.y.mul(angleCos).sub(corrected.x.mul(angleSin)),
    );

    // Dividing x by stretch means a pixel has to sit further out horizontally
    // to reach the same measured distance, so above 1 the shape reaches wider
    // and below 1 it pinches in and reads as taller. The axis this acts along
    // is the ellipse's LONG one only when stretch is above 1.
    const shaped = vec2(rotated.x.div(stretchUniform.max(MIN_STRETCH)), rotated.y);

    // Distance from the canvas center to a corner, in those same corrected
    // units. Dividing by it is what makes radius 1 mean "the ramp finishes
    // exactly at the corners" on any canvas shape, instead of meaning a raw
    // distance that covers differently at 16:9 than at 1:1. It is computed
    // from the canvas rather than from `center`, so moving the center slides
    // the gradient without resizing it.
    const halfDiagonal = length(vec2(aspectNode.mul(0.5), 0.5));

    // 0 at the center, 1 at the corners, then divided by the radius dial so a
    // smaller radius finishes the ramp sooner. Clamping holds the last stop
    // everywhere past the radius — the same thing colorRamp does on its own,
    // but being explicit here is load-bearing once repeat arrives in Task 3,
    // because an unclamped value would fold back into the ramp instead.
    const gradientCoord = clamp(
      length(shaped).div(halfDiagonal).div(radiusUniform.max(MIN_RADIUS)),
      0,
      1,
    );

    // Multiplying by repeat runs the ramp that many times before the radius.
    // gradientCoord is already clamped to 0..1, and that ordering is
    // load-bearing: an unclamped value would let the region beyond `radius`
    // fold back into the ramp instead of holding the last stop, which would
    // change the picture even at repeat 1.
    const rampCoord = pingPong(gradientCoord.mul(repeatUniform));

    // An unlit material whose per-pixel color comes from colorNode (a node
    // graph compiled to GPU code) — colorRamp maps the 0..1 coordinate to a
    // color, interpolating between stops in the chosen color space.
    const material = new MeshBasicNodeMaterial();

    material.colorNode = colorRamp(rampCoord, rampStops, colorSpace, hueInterpolation);

    // A 2x2 plane exactly fills ShaderScene's camera view (-1..1 across both
    // axes), so the gradient covers the whole canvas.
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
    // stopsKey is a stable string proxy for the stops array; the array itself
    // is intentionally omitted to avoid rebuilds on identity-only changes.
    // Animatable uniforms are mutated in place.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    shaderContext,
    stopsKey,
    radiusUniform,
    stretchUniform,
    angleUniform,
    repeatUniform,
    centerUniform,
    aspectNode,
    colorSpace,
    hueInterpolation,
  ]);

  return null;
}
