'use client';

// The radial gradient's GPU half. The wrapper (./radial-gradient.tsx) passes
// resolved props down; this component turns them into shader inputs, builds a
// full-screen plane whose color is computed per pixel, and mounts it into the
// shared ShaderScene. The gradient is one measurement: how far is this pixel
// from the center, as a fraction of the way to the corner? That fraction picks
// a color from the ramp.
import { useEffect, useMemo } from 'react';

import { colorRamp, type ColorSpace, elapsedTime, type HueInterpolation } from '@lovo/matter';
import {
  type AnimatableProp,
  useAnimatableUniform,
  useResize,
  useShaderContext,
  useStaticSceneHint,
} from '@lovo/matter-react';
import { clamp, cos, fract, length, mix, sin, step, uniform, uv, vec2 } from 'three/tsl';
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
   * single pass; above 1 gives concentric rings, each running the stops in the
   * same direction and snapping back to the first at its outer edge. Accepts a
   * static value or an animation signal.
   */
  repeat: AnimatableProp<number>;
  /**
   * How fast the ramp drifts outward from the center. 0 holds it still.
   * Accepts a static value or an animation signal.
   */
  speed: AnimatableProp<number>;
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

export function RadialGradientShader({
  stops,
  center,
  radius,
  stretch,
  angle,
  repeat,
  speed,
  colorSpace,
  hueInterpolation,
}: RadialGradientShaderProps) {
  const shaderContext = useShaderContext();

  // A literal speed of 0 means nothing on screen ever changes (an animation
  // signal might move later, so it doesn't count). Telling the scene lets its
  // frame scheduler go idle instead of re-rendering an unchanging image. A
  // signal on any of the dials still shows up: every uniform write pokes the
  // scheduler, so an idle scene wakes for exactly the frames a signal ticks.
  const isStatic = typeof speed === 'number' && speed === 0;

  useStaticSceneHint(isStatic);

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
  const speedUniform = useAnimatableUniform<number>(speed);

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
        // At speed 0 the scene is hinted static, so without this poke a
        // resize would update the uniform and never repaint.
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

    // Multiplying by repeat and taking the fractional part turns the 0..1
    // coordinate into that many sweeps of the ramp, each running the first stop
    // to the last and then snapping back. The snap is a real hard edge unless
    // the palette's ends happen to match, and that is the intended look here:
    // rings that read as the gradient repeated, rather than mirrored bands.
    //
    // Subtracting time slides the pattern outward — a given ramp value has to
    // sit further from the center as the clock advances, the same convention
    // DotField's ripple uses. No gate is needed around the animation the way
    // LinearGradient needs one: its animated form is a cosine that differs from
    // its static form, so a zero speed would still bend the ramp, whereas here
    // the sawtooth IS the static form and the time term multiplies out to
    // nothing at speed 0.
    const swept = fract(gradientCoord.mul(repeatUniform).sub(elapsedTime.mul(speedUniform)));

    // Past the radius the clamp above pins gradientCoord at exactly 1, where
    // fract() returns 0 — which would flood everything outside the radius with
    // the FIRST stop instead of the last, contradicting what `radius` promises
    // when it is below 1. Holding 1 out there fixes that, and it also makes the
    // whole expression collapse to gradientCoord at repeat 1: fract(x) is
    // exactly x for x in 0..1, so the prop is a bit-exact no-op rather than an
    // approximate one.
    const rampCoord = mix(swept, 1, step(1, gradientCoord));

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
    speedUniform,
    centerUniform,
    aspectNode,
    colorSpace,
    hueInterpolation,
  ]);

  return null;
}
