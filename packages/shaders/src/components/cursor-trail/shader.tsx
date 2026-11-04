'use client';

// Bridges the scene's cursor and frame loop to a heat texture, and adds the
// heat to the image beneath. It registers as a resample, not a color
// transform, so a UV warp mounted after it moves the heat with the image:
// under LedWall's cell snap each cell reads one heat value (ADR 0006).
import { useEffect, useMemo } from 'react';

import { oneMinus, texture, uniform, uv, vec2, vec3, vec4 } from 'three/tsl';
import { Texture, Vector2 as ThreeVector2 } from 'three/webgpu';

import {
  createReducedMotionWatcher,
  type PushStroke,
  type SchedulerTick,
  type Vector2,
} from '../../engine.js';
import { useAnimatableUniform } from '../../react/hooks/use-animatable-uniform/use-animatable-uniform.js';
import { useResample } from '../../react/hooks/use-resample/use-resample.js';
import { useShaderContext } from '../../react/hooks/use-shader-context/use-shader-context.js';
import { useStaticSceneHint } from '../../react/hooks/use-static-hint/use-static-hint.js';
import type { CursorTrailProps } from './cursor-trail.js';
import { createTrailField } from './field.js';

export function CursorTrailShader({
  radius = 0.1,
  intensity = 0.5,
  decay = 0.5,
}: CursorTrailProps) {
  const context = useShaderContext();
  const radiusUniform = useAnimatableUniform(radius);
  const intensityUniform = useAnimatableUniform(intensity);
  const decayUniform = useAnimatableUniform(decay);
  const fieldTexture = useMemo(() => texture(new Texture(), uv()), []);
  const active = useMemo(() => uniform(0), []);

  useStaticSceneHint(true);

  // ---- Add the heat where the image beneath is sampled
  // Sample the image once at the coordinate given, then add the heat there.
  // The coordinate starts at the top-left and the field at the bottom-left,
  // so flip y to read it. The scene texture is premultiplied, so the added
  // light is scaled by alpha too, and a transparent pixel stays transparent.
  useResample(
    (sampleBeneath) => (coordinate) => {
      const beneath = sampleBeneath(coordinate);
      const heat = fieldTexture.uv(vec2(coordinate.x, oneMinus(coordinate.y))).r.mul(active);
      const lift = heat.mul(intensityUniform).mul(beneath.a);

      return vec4(vec3(beneath.rgb).add(lift), beneath.a);
    },
    [fieldTexture, intensityUniform, active],
  );

  // ---- Create, drive, and dispose together for Strict Mode
  useEffect(() => {
    if (!context) return;
    const { scheduler } = context;
    const input = context.getCursorInput();
    const size = context.renderer.three.getSize(new ThreeVector2());
    const field = createTrailField(context.renderer.three, size.width, size.height);
    const motion = createReducedMotionWatcher();
    let previous: Vector2 | null = null;
    let inside = false;
    let pendingStroke: PushStroke | null = null;
    let pendingDelta = 0;

    // A pointer boundary ends a pointer stroke, but not a scripted one. The
    // Input has already moved past a gathered scripted segment, so dropping
    // it here would leave a gap in the scripted path.
    const endStroke = () => {
      previous = null;
      inside = false;
      if (!input.isScripting()) pendingStroke = null;
    };

    const canvas = context.renderer.three.domElement;

    window.addEventListener('blur', endStroke);
    canvas.addEventListener('pointerleave', endStroke);
    canvas.addEventListener('pointercancel', endStroke);

    // Reset at the actual boundary, not after eased presence reaches zero.
    // A move back onto the canvas seeds a new stroke instead of joining it
    // to the last exit point, even if both events arrive between frames.
    const stopMoves = input.onMove(() => {
      const currentInside = input.isInside();

      if (!currentInside || !inside) previous = currentInside ? input.getTarget() : null;
      inside = currentInside;
      if (inside) scheduler.requestRender();
    });
    const stopPause = scheduler.onPauseChange((paused) => {
      previous = null;
      pendingStroke = null;
      pendingDelta = 0;
      if (!paused && !field.atRest) scheduler.requestRender();
    });
    const stopMotion = motion.subscribe(() => scheduler.requestRender());

    // The scene renders before child scheduler clients. Gather input here
    // for the next draw; do the GPU work only inside its timed pre-pass.
    const gather = ({ delta }: SchedulerTick) => {
      const current = input.getTarget();
      const from = previous;
      const moved =
        inside &&
        current !== null &&
        from !== null &&
        (current[0] !== from[0] || current[1] !== from[1]);
      const mouse = moved ? { from, to: current, presence: 1 } : null;

      // A scripted stroke beats the mouse, and the mouse beats the push.
      // While a script is attached, the mouse and the push count for nothing.
      pendingStroke = input.isScripting() ? input.getScriptedStroke() : (mouse ?? input.getPush());
      previous = inside ? current : null;
      // The field only draws while it holds heat, and the scene keeps
      // drawing until it cools, so the delta is a frame's. After the scene
      // parks or pauses, the delta spans the sleep, and the field is cold or
      // should be.
      pendingDelta = delta;
      if (pendingStroke || !field.atRest) scheduler.requestRender();
    };

    scheduler.add(gather);

    const stopPass = context.registerPrePass(() => {
      const disabled = intensityUniform.value <= 0 || motion.scale() <= 0;

      field.step({
        delta: pendingDelta,
        stroke: pendingStroke,
        radius: radiusUniform.value,
        decay: decayUniform.value,
        disabled,
      });
      pendingStroke = null;
      pendingDelta = 0;
      const current = field.texture;

      active.value = current && !disabled ? 1 : 0;
      if (current) fieldTexture.value = current;
    });
    // A resize clears the field, and the scene redraws it before the next
    // gather. Drop the stroke gathered for the old field, so the redraw
    // leaves the new field clear and the next stroke starts afresh.
    const stopResize = context.canvasSize.on('change', ([width, height]) => {
      pendingStroke = null;
      pendingDelta = 0;
      field.resize(width, height);
    });

    scheduler.requestRender();

    return () => {
      window.removeEventListener('blur', endStroke);
      canvas.removeEventListener('pointerleave', endStroke);
      canvas.removeEventListener('pointercancel', endStroke);
      stopMoves();
      stopPause();
      stopMotion();
      stopPass();
      stopResize();
      scheduler.remove(gather);
      motion.dispose();
      field.dispose();
      active.value = 0;
      // A parked scene still shows the last frame. Draw once more so any
      // heat still showing leaves the canvas with the effect.
      scheduler.requestRender();
    };
  }, [context, fieldTexture, active, intensityUniform, radiusUniform, decayUniform]);

  return null;
}
