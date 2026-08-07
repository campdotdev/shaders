'use client';

// The conic gradient's GPU half. The wrapper (./conic-gradient.tsx) passes
// resolved props down; this component turns them into shader inputs, builds a
// full-screen plane whose color is computed per pixel, and mounts it into the
// shared ShaderScene. The gradient is one measurement: what angle does this
// pixel sit at around the center, measured clockwise from 12 o'clock as a
// fraction of a full turn? That fraction picks a color from the ramp.
import { useEffect, useMemo } from 'react';

import { colorRamp, type ColorSpace, type HueInterpolation } from '@lovo/matter';
import {
  type AnimatableProp,
  useAnimatablePoint,
  useResize,
  useShaderContext,
  useStaticSceneHint,
} from '@lovo/matter-react';
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
  /** Color space the gradient is interpolated in. */
  colorSpace: ColorSpace;
  /** Hue arc for cylindrical color spaces (oklch/lch/hsl/hsv); inert otherwise. */
  hueInterpolation: HueInterpolation;
}

export function ConicGradientShader({
  stops,
  center,
  colorSpace,
  hueInterpolation,
}: ConicGradientShaderProps) {
  const shaderContext = useShaderContext();

  // Nothing animates yet (speed arrives in a later phase), so the scene's
  // frame scheduler can idle instead of re-rendering an unchanging image. A
  // signal on `center` still shows up: every uniform write pokes the
  // scheduler, so an idle scene wakes for exactly the frames a signal ticks.
  useStaticSceneHint(true);

  // Content fingerprint of the stops array (colors + positions). The build
  // effect below keys on this string, so a re-render that passes a new array
  // with the same contents doesn't rebuild the material.
  const stopsKey = colorStopsKey(stops);

  // screenOrigin converts the prop's screen-style coordinates (y grows
  // downward, like CSS) into uv space, where v grows upward — without it,
  // moving the center "down" would move the pivot up.
  const centerUniform = useAnimatablePoint(center, { screenOrigin: true });

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

    // fract wraps the ±0.5-turn range into 0..1: the right half keeps its
    // 0..0.5 values and the left half's negatives land on 0.5..1, so one
    // clockwise lap reads the ramp exactly once with no branch. The exact
    // center pixel has no angle (atan2(0, 0) — WGSL returns 0), so it takes
    // the ramp's first color; that is one sub-pixel and nothing divides by
    // zero, so unlike the radial gradient there is nothing to guard.
    const coord = fract(turns);

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
  }, [shaderContext, stopsKey, centerUniform, aspectNode, colorSpace, hueInterpolation]);

  return null;
}
