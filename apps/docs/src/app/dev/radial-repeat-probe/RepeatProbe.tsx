'use client';

// Side-by-side comparison of the two ways to repeat a radial color ramp, so the
// choice can be made by eye rather than by argument.
//
// LEFT is a triangle wave that folds the ramp back on itself, so ring N ends on
// the colour ring N+1 starts on and no boundary ever seams. RIGHT is a plain
// fract(), which sweeps the ramp in one direction every time and snaps from the
// last stop back to the first at each boundary.
//
// RIGHT is what `<RadialGradient>` ships. The fold was built first and rejected
// at the 2026-07-31 gate: mirrored bands read as a target, where the wanted look
// was the gradient repeated, seam and all. This probe is kept because the same
// choice is still open for `<LinearGradient>`'s repeat.
//
// Both halves share one center, one radius and one repeat value, and the center
// sits on the dividing line, so any difference you see is the wave rather than
// the geometry. Ring boundaries do NOT line up across the divider, and that is
// not a bug: the fold has period 2 and fract has period 1, so at a given repeat
// the fold spends two bands (one toward the last stop, one back) where fract
// spends one. Both end up with roughly `repeat` visible bands; they just start
// their cycles differently.
import { useEffect, useMemo, useState } from 'react';

import { colorRamp } from '@lovo/matter';
import { ShaderScene, useShaderContext } from '@lovo/matter-react';
import { parseColorString } from '@lovo/matter/color';
import type { ShaderNodeObject } from 'three/tsl';
import { clamp, fract, length, mix, step, uniform, uv, vec2, vec3, vec4 } from 'three/tsl';
import type { Node } from 'three/webgpu';

import { addPlaneMesh } from '@/lib/meshUtils';

// The component's shipped defaults (magenta[9] -> purple[6] -> blue[3]).
const STOPS = [
  'oklch(0.720 0.281 343.895)',
  'oklch(0.460 0.211 320)',
  'oklch(0.303 0.152 265.847)',
];

/** Triangle wave, period 2, 0 -> 1 -> 0. Never seams. Rejected 2026-07-31. */
const fold = (value: ShaderNodeObject<Node>): ShaderNodeObject<Node> =>
  fract(value.mul(0.5)).mul(2).sub(1).abs().oneMinus();

/**
 * Sawtooth, period 1. Seams wherever the first and last stop differ, which is
 * the point. This is what the component ships.
 */
const wrap = (value: ShaderNodeObject<Node>): ShaderNodeObject<Node> => fract(value);

function ProbeMesh({ repeat }: { repeat: number }) {
  const shaderContext = useShaderContext();

  // Stable uniform so dragging the slider pushes a value rather than
  // recompiling the material.
  const repeatUniform = useMemo(() => uniform(repeat), []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    repeatUniform.value = repeat;
  }, [repeat, repeatUniform]);

  useEffect(() => {
    if (!shaderContext) return;

    const rampStops = STOPS.map((color, index) => {
      const [red, green, blue] = parseColorString(color);

      return { color: vec3(red, green, blue), position: index / (STOPS.length - 1) };
    });

    // Distance from the canvas centre, in units where a circle stays circular
    // and 1 lands at a corner. The probe hardcodes 3:2 rather than tracking the
    // real canvas, which is close enough for an A/B.
    const aspect = 3 / 2;
    const centered = uv().sub(vec2(0.5, 0.5));
    const corrected = vec2(centered.x.mul(aspect), centered.y);
    const halfDiagonal = Math.hypot(0.5 * aspect, 0.5);
    const coord = clamp(length(corrected).div(halfDiagonal), 0, 1);

    const scaled = coord.mul(repeatUniform);
    const gradient = mix(
      colorRamp(fold(scaled), rampStops, 'oklab'),
      colorRamp(wrap(scaled), rampStops, 'oklab'),
      // step(0.5, uv().x) is 0 on the left half, 1 on the right.
      step(0.5, uv().x),
    );

    // A hairline down the middle so the two halves read as a comparison rather
    // than as one strange image.
    const divider = step(uv().x.sub(0.5).abs(), 0.0012);
    const withDivider = mix(gradient, vec3(0, 0, 0), divider);

    return addPlaneMesh(shaderContext, vec4(withDivider, 1));
  }, [shaderContext, repeatUniform]);

  return null;
}

export default function RepeatProbe() {
  const [repeat, setRepeat] = useState(8);

  return (
    <div style={{ padding: '1.5rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ margin: '0 0 0.25rem', fontSize: '1.1rem' }}>
        RadialGradient — repeat wave A/B
      </h1>
      <p style={{ margin: '0 0 1rem', color: '#888', fontSize: '0.85rem', maxWidth: '70ch' }}>
        Left: triangle fold — symmetric bands, never seams. Right: fract, what the component ships —
        repeated sweeps in one direction, snapping back to the first stop at every boundary. Same
        centre, radius and repeat on both sides. Ring boundaries do not line up across the divider,
        because the fold has period 2 and fract has period 1.
      </p>
      <label style={{ display: 'block', margin: '0 0 1rem', fontSize: '0.85rem' }}>
        repeat: {repeat.toFixed(1)}
        <input
          max={16}
          min={1}
          onChange={(event) => setRepeat(Number(event.target.value))}
          step={0.1}
          style={{ display: 'block', width: 360, marginTop: '0.35rem' }}
          type="range"
          value={repeat}
        />
      </label>
      <div style={{ position: 'relative', width: '100%', maxWidth: 1200, aspectRatio: '3 / 2' }}>
        <ShaderScene>
          <ProbeMesh repeat={repeat} />
        </ShaderScene>
      </div>
    </div>
  );
}
