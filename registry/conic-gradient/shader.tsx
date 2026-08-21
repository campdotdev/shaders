'use client';

// The conic gradient's GPU half. The wrapper (./conic-gradient.tsx) passes
// resolved props down; this component turns them into shader inputs, builds a
// full-screen plane whose color is computed per pixel, and mounts it into the
// shared ShaderScene. The gradient is one measurement: what angle does this
// pixel sit at around the center, measured clockwise from 12 o'clock as a
// fraction of a full turn? That fraction picks a color from the ramp.
import { useEffect, useMemo } from 'react';

import { colorRamp, type ColorSpace, type HueInterpolation } from '@camp-dev/shaders';
import {
  type AnimatableProp,
  useAnimatablePoint,
  useAnimatableSpeed,
  useAnimatableUniform,
  useResize,
  useShaderContext,
  useStaticSceneHint,
} from '@camp-dev/shaders-react';
import { atan2, fract, uniform, uv, vec2 } from 'three/tsl';
import { Mesh, MeshBasicNodeMaterial, PlaneGeometry } from 'three/webgpu';

import { type ColorStop, colorStopsKey, toColorRampStops } from '../utils/color';

export interface ConicGradientShaderProps {
  /**
   * Colors around the sweep, running clockwise from the top. Accepts hex,
   * `oklch()`, or `oklab()`; positions auto-space when omitted.
   */
  stops: ColorStop[];
  /**
   * Pivot the sweep rotates around, 0..1 across the canvas, screen-style
   * (y grows downward). Accepts a static value or an animation signal.
   */
  center: AnimatableProp<readonly [number, number]>;
  /**
   * Degrees; rotates the whole sweep clockwise (CSS conic-gradient's
   * direction — the siblings' `angle` turns counterclockwise). Accepts a
   * static value or an animation signal.
   */
  angle: AnimatableProp<number>;
  /**
   * How many times the ramp runs around the full circle. Above 1 gives a
   * pinwheel of sectors, each running the stops clockwise and snapping back
   * to the first at its boundary. Accepts a static value or an animation
   * signal.
   */
  repeat: AnimatableProp<number>;
  /**
   * Rotation speed of the sweep; positive spins clockwise. 0 holds it
   * still. Accepts a static value or an animation signal.
   */
  speed: AnimatableProp<number>;
  /** Color space the gradient is interpolated in. */
  colorSpace: ColorSpace;
  /** Hue arc for cylindrical color spaces (oklch/lch/hsl/hsv); inert otherwise. */
  hueInterpolation: HueInterpolation;
}

export function ConicGradientShader({
  stops,
  center,
  angle,
  repeat,
  speed,
  colorSpace,
  hueInterpolation,
}: ConicGradientShaderProps) {
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

  // screenOrigin converts the prop's screen-style coordinates (y grows
  // downward, like CSS) into uv space, where v grows upward — without it,
  // moving the center "down" would move the pivot up.
  const centerUniform = useAnimatablePoint(center, { screenOrigin: true });

  // Angle and repeat live in uniforms — values the CPU can update each frame
  // without rebuilding the shader. useAnimatableUniform keeps them current
  // whether the prop is a plain number or an animation signal.
  const angleUniform = useAnimatableUniform<number>(angle);
  const repeatUniform = useAnimatableUniform<number>(repeat);

  // Speed is integrated, not sampled: useAnimatableSpeed sums speed x delta
  // into a phase uniform each frame, so changing the dial shifts the
  // rotation's tempo without snapping its position.
  const phaseUniform = useAnimatableSpeed(speed);

  // ---------------------------------------------
  // Track the canvas aspect ratio
  // ---------------------------------------------
  // The angle math needs width/height so equal fractions of the sweep occupy
  // equal angles on screen. The uniform starts from the current canvas size
  // (falling back to 16:9 when the canvas hasn't been laid out yet and
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
        // The scene is hinted static, so without this poke a resize would
        // update the uniform and never repaint.
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

    // Where is this pixel relative to the pivot? uv() is its 0..1 position on
    // the plane; subtracting the center gives an offset that runs about
    // -0.5..0.5 in each direction, with v growing upward.
    const centered = uv().sub(centerUniform);

    // Multiplying the horizontal offset by width/height converts it into the
    // same units as the vertical one. Without this the angle below would be
    // measured in a squashed space — equal slices of the sweep would bunch
    // along the short axis, and a 4-stop wheel's seams would drift off the
    // true 12/3/6/9 o'clock positions on any non-square canvas.
    const corrected = vec2(centered.x.mul(aspectNode), centered.y);

    // atan2's arguments are deliberately swapped — this is not a typo. The
    // textbook atan2(y, x) measures counterclockwise from 3 o'clock; feeding
    // it (x, y) instead measures clockwise from 12 o'clock, which is exactly
    // the CSS conic-gradient convention, with no 90-degree offset and no
    // negation. Dividing by 2*pi converts radians into turns: 0 at the top,
    // +0.25 at 3 o'clock, and negative (down to -0.5) on the left half.
    const turns = atan2(corrected.x, corrected.y).mul(1 / (2 * Math.PI));

    // The prop is in degrees because that is what people type; the
    // coordinate is in turns, so divide by 360. Subtracting BEFORE the
    // repeat multiply below rotates the whole pattern rigidly no matter how
    // many sectors repeat creates; subtracting after would spin each sector
    // by a repeat-scaled amount instead. Subtraction (not addition) is what
    // makes the rotation clockwise: as angle grows, a pixel must sit at a
    // larger screen angle to land on the same color, so the pattern turns
    // the same way the sweep runs.
    const angleTurns = angleUniform.mul(1 / 360);

    // Multiplying by repeat turns one lap of the circle into that many laps
    // of the ramp. The single fract at the end wraps everything into 0..1 at
    // once — atan2's negative left half and the repeat overflow together, so
    // one clockwise lap reads the ramp `repeat` times with no branch. At
    // angle 0, repeat 1 this collapses bit-exactly to fract(turns), the
    // plain sweep, because fract(x) is exactly x for x already in 0..1. The
    // exact center pixel has no angle (atan2(0, 0) — WGSL returns 0), so it
    // takes whatever color sits at the wrap; that is one sub-pixel and
    // nothing divides by zero, so unlike the radial gradient there is
    // nothing to guard.
    //
    // Subtracting the phase AFTER the repeat multiply spins the pattern
    // clockwise — a pixel must sit at a larger angle to land on the same
    // color as the phase advances — and counts in ramp cycles, so at repeat
    // 1 one phase unit is one full rotation. No gate is needed around the
    // animation the way LinearGradient needs one: its animated form is a
    // cosine that differs from its static form, whereas here the sawtooth IS
    // the static form and the phase simply stops advancing at speed 0.
    const coord = fract(turns.sub(angleTurns).mul(repeatUniform).sub(phaseUniform));

    // An unlit material whose per-pixel color comes from colorNode (a node
    // graph compiled to GPU code) — colorRamp maps the 0..1 coordinate to a
    // color, interpolating between stops in the chosen color space.
    const material = new MeshBasicNodeMaterial();

    material.colorNode = colorRamp(coord, rampStops, colorSpace, hueInterpolation);

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
    centerUniform,
    angleUniform,
    repeatUniform,
    phaseUniform,
    aspectNode,
    colorSpace,
    hueInterpolation,
  ]);

  return null;
}
