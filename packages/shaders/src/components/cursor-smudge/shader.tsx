'use client';

// Bridges the scene's cursor and frame loop to a displacement texture.
// The texture updates inside a pre-pass, so the scene samples the new state
// and ShaderMonitor includes the simulation in its GPU measurement.
import { useEffect, useMemo } from 'react';

import { oneMinus, texture, uniform, uv, vec2 } from 'three/tsl';
import { Texture, Vector2 as ThreeVector2 } from 'three/webgpu';

import {
  createReducedMotionWatcher,
  type PushStroke,
  type SchedulerTick,
  type Vector2,
} from '../../engine.js';
import { useAnimatableUniform } from '../../react/hooks/use-animatable-uniform/use-animatable-uniform.js';
import { useAspectUniform } from '../../react/hooks/use-aspect-uniform/use-aspect-uniform.js';
import { useBasePassUv } from '../../react/hooks/use-base-pass-uv/use-base-pass-uv.js';
import { useShaderContext } from '../../react/hooks/use-shader-context/use-shader-context.js';
import { useStaticSceneHint } from '../../react/hooks/use-static-hint/use-static-hint.js';
import type { CursorSmudgeProps } from './cursor-smudge.js';
import { createSmudgeField } from './field.js';

// Longest a stroke's first frame of travel counts for, in seconds: one
// frame at 60 Hz. Longer lets a fast first move after the scene parks pull
// harder than the same move mid-stroke; shorter makes it pull softer.
const STROKE_START_SECONDS = 1 / 60;

export function CursorSmudgeShader({
  strength = 0.12,
  radius = 0.18,
  decay = 0.4,
}: CursorSmudgeProps) {
  const context = useShaderContext();
  const strengthUniform = useAnimatableUniform(strength);
  const radiusUniform = useAnimatableUniform(radius);
  const decayUniform = useAnimatableUniform(decay);
  const aspect = useAspectUniform();
  const fieldTexture = useMemo(() => texture(new Texture(), uv()), []);
  const active = useMemo(() => uniform(0), []);

  useStaticSceneHint(true);

  // ---- Read displacement when the Sources are sampled
  // Pass coordinates start at the top-left; the field starts at the
  // bottom-left, so flip y both when reading and when applying the vector.
  // Subtract the pull: to move the image right, show the pixel to the left.
  useBasePassUv(
    (coordinate) => {
      const pull = fieldTexture.uv(vec2(coordinate.x, oneMinus(coordinate.y))).rg;

      return coordinate.sub(
        vec2(pull.x.div(aspect), pull.y.negate()).mul(strengthUniform).mul(active),
      );
    },
    [fieldTexture, aspect, strengthUniform, active],
  );

  // ---- Create, drive, and dispose together for Strict Mode
  useEffect(() => {
    if (!context) return;
    const { scheduler } = context;
    const input = context.getCursorInput();
    const size = context.renderer.three.getSize(new ThreeVector2());
    const field = createSmudgeField(context.renderer.three, size.width, size.height);
    const motion = createReducedMotionWatcher();
    let previous: Vector2 | null = null;
    let inside = false;
    let pendingStroke: PushStroke | null = null;
    let stroking = false;
    let pendingDelta = 0;
    let pendingRecoveryDelta = 0;
    let recovering = decayUniform.value > 0;

    const endStroke = () => {
      previous = null;
      inside = false;
      pendingStroke = null;
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
      pendingRecoveryDelta = 0;
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
      const push = input.getPush();

      pendingStroke = mouse ?? push;
      previous = inside ? current : null;
      // A parked scene's first tick reports the whole sleep as its delta,
      // but the travel it carries took about one frame. Without the cap, the
      // field's speed limit would see a slow move and let a fast one through.
      pendingDelta = pendingStroke && !stroking ? Math.min(delta, STROKE_START_SECONDS) : delta;
      stroking = pendingStroke !== null;
      // A held smudge can sleep for minutes. When recovery is enabled,
      // start its clock now instead of applying the time spent asleep.
      pendingRecoveryDelta = recovering ? delta : 0;
      recovering = decayUniform.value > 0;
      if (pendingStroke || (decayUniform.value > 0 && !field.atRest)) scheduler.requestRender();
    };

    scheduler.add(gather);

    const stopPass = context.registerPrePass(() => {
      const scale = motion.scale();

      field.step({
        delta: pendingRecoveryDelta * scale,
        inputDelta: pendingDelta,
        stroke: pendingStroke,
        radius: radiusUniform.value,
        decay: decayUniform.value,
        disabled: strengthUniform.value <= 0 || scale <= 0,
      });
      pendingStroke = null;
      pendingDelta = 0;
      pendingRecoveryDelta = 0;
      const current = field.texture;

      active.value = current && strengthUniform.value > 0 && scale > 0 ? 1 : 0;
      if (current) fieldTexture.value = current;
    });
    const stopResize = context.canvasSize.on('change', ([width, height]) =>
      field.resize(width, height),
    );

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
      // A parked scene still shows the last smudged frame. Draw once more
      // so a held distortion leaves the canvas with the effect.
      scheduler.requestRender();
    };
  }, [context, fieldTexture, active, strengthUniform, radiusUniform, decayUniform]);

  return null;
}
