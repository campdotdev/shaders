'use client';

// The linear gradient's GPU half. The wrapper (./linear-gradient.tsx) passes
// resolved props down; this component turns them into shader inputs, builds
// a full-screen plane whose color is computed per pixel, and mounts it into
// the shared ShaderScene. The gradient itself is one projection: each pixel's
// position is measured along a direction vector and that distance picks a
// color from the ramp.
import { useEffect } from 'react';

import { colorRamp, type ColorSpace, type HueInterpolation } from '@camp-dev/shaders';
import {
  type AnimatableProp,
  useAnimatablePoint,
  useAnimatableSpeed,
  useAnimatableUniform,
  useShaderContext,
  useStaticSceneHint,
} from '@camp-dev/shaders-react';
import { cos, fract, mix, sin, smoothstep, sub, uv, vec2 } from 'three/tsl';
import { Mesh, MeshBasicNodeMaterial, PlaneGeometry } from 'three/webgpu';

import { type ColorStop, colorStopsKey, toColorRampStops } from '../utils/color';

export interface LinearGradientShaderProps {
  /**
   * Colors along the gradient. Accepts hex, `oklch()`, or `oklab()`;
   * positions auto-space when omitted.
   */
  stops: ColorStop[];
  /**
   * Gradient direction in degrees. 0 runs left to right, 90 runs bottom to
   * top. Accepts a static value or an animation signal.
   */
  angle: AnimatableProp<number>;
  /**
   * Anchor point of the gradient, 0..1 across the canvas; `[0.5, 0.5]` is
   * centered and `[0, 0]` is the top-left corner. The middle of the color
   * ramp sits at the anchor, so moving it slides the whole gradient along
   * its direction. Accepts a static value or an animation signal.
   */
  center: AnimatableProp<readonly [number, number]>;
  /**
   * How many times the stops run across the gradient's span. 1 is a single
   * pass; above 1 the pattern tiles past both ends, so stripes run edge to
   * edge at any angle. Each pass runs the stops in the same direction and
   * snaps back to the first, so unless the first and last stop match there
   * is a visible edge at every stripe boundary. Values at or below 1 render
   * as a single pass. Accepts a static value or an animation signal.
   */
  repeat: AnimatableProp<number>;
  /**
   * Speed of the gradient's motion. At a single pass the colors drift back
   * and forth along the axis; combined with `repeat` above 1 the stripes
   * march steadily in the angle's direction instead. 0 gives a static
   * gradient. Accepts a static value or an animation signal.
   */
  speed: AnimatableProp<number>;
  /** Color space the gradient is interpolated in. */
  colorSpace: ColorSpace;
  /**
   * Hue arc for cylindrical color spaces (oklch/lch/hsl/hsv); inert
   * otherwise.
   */
  hueInterpolation: HueInterpolation;
}

export function LinearGradientShader({
  stops,
  angle,
  center,
  repeat,
  speed,
  colorSpace,
  hueInterpolation,
}: LinearGradientShaderProps) {
  const shaderContext = useShaderContext();

  // A literal speed of 0 means nothing on screen ever changes (an animation
  // signal might move later, so it doesn't count). Telling the scene lets its
  // frame scheduler go idle instead of re-rendering an unchanging image.
  const isStatic = typeof speed === 'number' && speed === 0;

  useStaticSceneHint(isStatic);

  // Content fingerprint of the stops array (colors + positions). The build
  // effect below keys on this string, so a re-render that passes a new array
  // with the same contents doesn't rebuild the material.
  const stopsKey = colorStopsKey(stops);

  // Speed lives in a uniform (a value the CPU can update each frame without
  // rebuilding the shader) — kept ONLY for the GPU-side static/animated gate
  // below. The motion itself comes from the accumulated phase: speed x delta
  // summed on the CPU each frame, so changing speed shifts the tempo without
  // snapping (a time x speed product re-evaluates the whole history).
  const speedUniform = useAnimatableUniform<number>(speed);
  const phaseUniform = useAnimatableSpeed(speed);

  // screenOrigin converts the prop's screen-style coordinates (y grows
  // downward, [0, 0] top-left, like CSS) into uv space — the mesh's
  // built-in 0..1 surface coordinates, where v grows upward. Without it,
  // moving the anchor "down" would slide the gradient up.
  const centerUniform = useAnimatablePoint(center, { screenOrigin: true });

  // Angle lives in a scalar uniform; useAnimatableUniform keeps it current
  // whether the prop is a static number or an animation signal. The build
  // effect below derives the direction vector from it in the shader.
  const angleUniform = useAnimatableUniform<number>(angle);

  // Repeat rides its own scalar uniform so dragging or animating it never
  // rebuilds the material; the gate in the build effect reads it on the GPU.
  const repeatUniform = useAnimatableUniform<number>(repeat);

  // ---------------------------------------------
  // Build the material and mount the mesh
  // ---------------------------------------------
  // Runs once per mount — and again only when the stops or color space
  // change, because colorRamp bakes the stop colors into the compiled shader
  // as constants rather than uniforms. Everything else flows through the
  // stable uniforms above without touching this effect.
  useEffect(() => {
    if (!shaderContext) return;

    const rampStops = toColorRampStops(stops);

    // Degrees to radians, then the unit direction. Scalar uniforms are safe
    // as chained receivers, so the multiply reads left to right; the vec2 is
    // built from the results rather than chained off a vec uniform, which is
    // the form gotcha 11 requires.
    const angleRadians = angleUniform.mul(Math.PI / 180);
    const direction = vec2(cos(angleRadians), sin(angleRadians));

    // Project each pixel onto the gradient axis. uv() is the pixel's position
    // on the plane (0..1 both ways); subtracting the anchor and taking the
    // dot product with the unit direction gives a signed distance along that
    // direction — 0 at the anchor, positive ahead of it, negative behind.
    // Adding 0.5 shifts that distance into ramp coordinates, placing the
    // ramp's midpoint at the anchor. With the defaults (centered anchor,
    // angle 0) this reduces to plain left-to-right u: 0 at the left edge,
    // 1 at the right.
    const gradientCoord = uv().sub(centerUniform).dot(direction).add(0.5);

    // Cosine-smoothed ping-pong: (1 - cos(π·x)) / 2 has period 2, peaks at x=1
    // and troughs at x=0/2 — same rhythm as a triangle wave but C∞ smooth so
    // the apex doesn't show as a visible band.
    //
    // The mix(static, animated, smoothstep(0, 0.01, speedUniform)) gates the
    // animation on the GPU: when speedUniform ≤ 0 the mix picks gradientCoord
    // exactly (no S-curve distortion); above ~0.01 it fades into the cosine
    // animation. No JS-side branch, no material rebuild on speed changes.
    const cosineAnimated = sub(1, cos(gradientCoord.add(phaseUniform).mul(Math.PI))).mul(0.5);
    const animatedGradientCoord = mix(
      gradientCoord,
      cosineAnimated,
      smoothstep(0, 0.01, speedUniform),
    );

    // Tiled form: multiplying by repeat squeezes that many passes of the
    // ramp into the span one pass covered, and fract() keeps only the
    // fractional part, so the coordinate saws 0 -> 1 over and over.
    // Deliberately no clamp first (RadialGradient clamps because its
    // coordinate is bounded): the projection above runs past 0..1 at
    // diagonal angles, and fract tiling that overhang is what fills the
    // corners with stripes instead of flat end-stop color. Subtracting the
    // phase means a given ramp value needs a larger coordinate as the phase
    // grows, so the stripes march along the angle's direction — the barber
    // pole. No speed gate here: this sawtooth is its own static form, so at
    // speed 0 the phase simply stops advancing.
    const tiled = fract(gradientCoord.mul(repeatUniform).sub(phaseUniform));

    // The repeat gate, same trick as the speed gate above: at repeat <= 1
    // the smoothstep is exactly 0 and the mix returns the single-pass form
    // bit for bit, so the default render is unchanged from before this prop
    // existed. Above ~1.01 the tiled form fully takes over; animating repeat
    // across 1 crosses a narrow morph instead of a hard pop.
    const rampCoord = mix(animatedGradientCoord, tiled, smoothstep(1, 1.01, repeatUniform));

    // An unlit material whose per-pixel color comes from colorNode (a node
    // graph compiled to GPU code) — colorRamp maps the 0..1 coordinate to a
    // color, interpolating between stops in the chosen color space.
    const material = new MeshBasicNodeMaterial();

    const gradientColor = colorRamp(rampCoord, rampStops, colorSpace, hueInterpolation);

    material.colorNode = gradientColor;

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
    speedUniform,
    phaseUniform,
    centerUniform,
    repeatUniform,
    angleUniform,
    colorSpace,
    hueInterpolation,
  ]);

  return null;
}
