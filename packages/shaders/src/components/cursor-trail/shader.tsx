'use client';

// Bridges the scene's cursor and frame loop to a heat texture, and adds the
// heat to the image beneath. path.ts records where the pointer has been,
// grow.ts sizes the brush with its speed, and field.ts draws the path into
// the texture as one shape: full at the head, tapering to a point.
import { useEffect, useMemo, useRef } from 'react';

import { max, oneMinus, texture, uniform, uv, vec2, vec3, vec4 } from 'three/tsl';
import { Texture, Vector2 as ThreeVector2 } from 'three/webgpu';

import {
  createReducedMotionWatcher,
  type PushStroke,
  type SchedulerTick,
  type Vector2,
} from '../../engine.js';
import { useAnimatableUniform } from '../../react/hooks/use-animatable-uniform/use-animatable-uniform.js';
import { useAspectUniform } from '../../react/hooks/use-aspect-uniform/use-aspect-uniform.js';
import { useResample } from '../../react/hooks/use-resample/use-resample.js';
import { useShaderContext } from '../../react/hooks/use-shader-context/use-shader-context.js';
import { useStaticSceneHint } from '../../react/hooks/use-static-hint/use-static-hint.js';
import type { CursorTrailProps } from './cursor-trail.js';
import { createTrailField } from './field.js';
import { createGrowth } from './grow.js';
import { createTrailPath, MAX_POINTS } from './path.js';

// Longest the first tick after the scene parks counts for, in seconds: one
// frame at 60 Hz. Longer would run out the path behind a head the pointer
// just left by the time spent asleep, and wipe it before it shows.
const WAKE_SECONDS = 1 / 60;
// Smallest alpha the image's color is divided by when the premultiplied
// alpha is undone, as in PaletteMap. It only has to keep the divide finite.
const MIN_ALPHA = 1e-4;

// The mouse's move since the last gather, or null when it didn't move or
// isn't on the canvas.
function mouseStroke(inside: boolean, from: Vector2 | null, to: Vector2 | null): PushStroke | null {
  if (!inside || !from || !to) return null;

  return to[0] === from[0] && to[1] === from[1] ? null : { from, to, presence: 1 };
}

export function CursorTrailShader({
  radius = 0.1,
  intensity = 0.5,
  decay = 0.75,
  hold = false,
  grow = 0.3,
  smoothing = 0.05,
}: CursorTrailProps) {
  const context = useShaderContext();
  const radiusUniform = useAnimatableUniform(radius);
  const intensityUniform = useAnimatableUniform(intensity);
  const decayUniform = useAnimatableUniform(decay);
  const growUniform = useAnimatableUniform(grow);
  const smoothingUniform = useAnimatableUniform(smoothing);
  const fieldTexture = useMemo(() => texture(new Texture(), uv()), []);
  const active = useMemo(() => uniform(0), []);
  const aspect = useAspectUniform();

  useStaticSceneHint(true);

  // The pre-pass reads hold on the CPU each frame, so it lives in a ref the
  // pass's effect can keep without re-running. Turning it off lets the head
  // fade, which a parked scene starts only on its next frame.
  const holdRef = useRef(hold);

  useEffect(() => {
    holdRef.current = hold;
    context?.scheduler.requestRender();
  }, [context, hold]);

  // ---- Add the heat where the image beneath is sampled
  // It registers as a resample, not a color transform, so a UV warp mounted
  // after it moves the heat with the image: under LedWall's cell snap each
  // cell reads one heat value (ADR 0006).
  // Sample the image once at the coordinate given, then add the heat there.
  // The coordinate starts at the top-left and the field at the bottom-left,
  // so flip y to read it.
  useResample(
    (sampleBeneath) => (coordinate) => {
      const beneath = sampleBeneath(coordinate);
      const heat = fieldTexture.uv(vec2(coordinate.x, oneMinus(coordinate.y))).r.mul(active);
      const lift = heat.mul(intensityUniform);

      // Add the same amount of linear light to every channel. The scene
      // texture is premultiplied, so undo the alpha first and put it back at
      // the end, which keeps a transparent pixel transparent.
      const color = vec3(beneath.rgb).div(max(beneath.a, MIN_ALPHA));

      return vec4(color.add(lift).mul(beneath.a), beneath.a);
    },
    [fieldTexture, active, intensityUniform],
  );

  // ---- Create, drive, and dispose together for Strict Mode
  useEffect(() => {
    if (!context) return;
    const { scheduler } = context;
    const input = context.getCursorInput();
    const size = context.renderer.three.getSize(new ThreeVector2());
    const field = createTrailField(context.renderer.three, size.width, size.height);
    const path = createTrailPath();
    const packed = new Float32Array(MAX_POINTS * 4);
    const motion = createReducedMotionWatcher();
    let previous: Vector2 | null = null;
    let inside = false;
    let pendingStroke: PushStroke | null = null;
    let pendingDelta = 0;
    // Whether the last gather asked for the next frame, so this tick's delta
    // spans one frame rather than a sleep.
    let running = false;
    // Whether the last draw changed the field. A frame that changed nothing
    // means the trail has settled, and the scene can stop drawing.
    let changed = true;
    // How far the brush has grown. It eases toward the pointer's speed, so
    // it lags a little.
    const growth = createGrowth();

    // A pointer boundary ends a pointer stroke, but not a scripted one. The
    // Input has already moved past a gathered scripted segment, so dropping
    // it here would leave a gap in the scripted path.
    const endStroke = () => {
      previous = null;
      inside = false;
      if (!input.isScripting()) pendingStroke = null;
      // A parked scene still shows a held head. Draw again to let it fade.
      scheduler.requestRender();
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
      if (!paused) scheduler.requestRender();
    });
    const stopMotion = motion.subscribe(() => scheduler.requestRender());

    // The scene renders before child scheduler clients. Gather input here
    // for the next draw; do the GPU work only inside its timed pre-pass.
    const gather = ({ delta }: SchedulerTick) => {
      const current = input.getTarget();
      const mouse = mouseStroke(inside, previous, current);

      // A scripted stroke beats the mouse, and the mouse beats the push.
      // While a script is attached, the mouse and the push count for nothing.
      pendingStroke = input.isScripting() ? input.getScriptedStroke() : (mouse ?? input.getPush());
      previous = inside ? current : null;
      // A parked scene's first tick reports the whole sleep as its delta.
      // Nothing moved while it slept, so count at most one frame of it. The
      // first tick after a pause reports 0, so a trail cut off by the pause
      // picks up where it left off.
      pendingDelta = running ? delta : Math.min(delta, WAKE_SECONDS);
      running = pendingStroke !== null || changed || growth.share > 0;
      if (running) scheduler.requestRender();
    };

    scheduler.add(gather);

    // ---- Step the path and draw it before the scene draws
    const stopPass = context.registerPrePass(() => {
      const visible = intensityUniform.value > 0 && radiusUniform.value > 0;
      // Under the paused motion policy the trail is off. With hold on, the
      // head stays, as CursorSpotlight's spot does, because it moves only
      // when the pointer does. With hold off, nothing shows. A scripted
      // stroke holds no head: the pointer isn't what is moving.
      const disabled = !visible || motion.scale() <= 0;
      const rest = visible && holdRef.current && !input.isScripting() ? previous : null;

      const grown = growth.step(pendingStroke, pendingDelta, aspect.value, disabled);

      path.step({
        delta: pendingDelta,
        stroke: pendingStroke,
        rest,
        radius: radiusUniform.value * (1 + Math.max(0, growUniform.value) * grown),
        decay: decayUniform.value,
        smoothing: smoothingUniform.value,
        aspect: aspect.value,
        disabled,
      });
      pendingStroke = null;
      pendingDelta = 0;
      changed = field.draw(packed, path.pack(packed));
      const current = field.texture;

      active.value = current ? 1 : 0;
      if (current) fieldTexture.value = current;
    });
    // A resize redraws the path at the new size on the next frame.
    const stopResize = context.canvasSize.on('change', ([width, height]) => {
      field.resize(width, height);
      scheduler.requestRender();
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
  }, [
    context,
    fieldTexture,
    active,
    aspect,
    intensityUniform,
    radiusUniform,
    decayUniform,
    growUniform,
    smoothingUniform,
  ]);

  return null;
}
