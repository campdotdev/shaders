'use client';

// Public face of the cursor ripple: owns the props, their JSDoc, and their
// defaults, and owns the water. Each instance creates one wave field (the
// runtime module in src/runtime/wave-field), feeds it the scene's shared
// pointer every frame, resizes it with the canvas, and hands it to
// CursorRippleShader (./shader.tsx), which reads it to bend and light the
// image beneath. CursorRipple is an Effect: stack it after other components
// inside a <ShaderScene> and dragging the pointer leaves a wake over them.
import { useEffect, useMemo, useState } from 'react';

import { Vector2 as ThreeVector2 } from 'three/webgpu';

import { createWaveField, type SchedulerTick, type Vector2, type WaveField } from '../../engine.js';
import {
  type AnimatableProp,
  isSignal,
} from '../../react/hooks/animatable-signal/animatable-signal.js';
import { useCursor } from '../../react/hooks/use-cursor/use-cursor.js';
import { useResize } from '../../react/hooks/use-resize/use-resize.js';
import { useShaderContext } from '../../react/hooks/use-shader-context/use-shader-context.js';
import { useStaticSceneHint } from '../../react/hooks/use-static-hint/use-static-hint.js';
import { dampingForDecay } from './decay.js';
import { CursorRippleShader } from './shader.js';
import { deriveStroke } from './stroke.js';

export interface CursorRippleProps {
  /**
   * How far the water bends the image beneath it, in canvas heights per
   * unit of slope. 0 leaves the image where it is. Defaults to 0.1.
   * Accepts a static value or an animation signal.
   */
  refraction?: AnimatableProp<number>;
  /**
   * Width of the wake the pointer leaves, in canvas units where 1 is the
   * canvas height. Small is a thin line that rings out fast, large is a
   * broad swell. Defaults to 0.05. Accepts a static value or an animation
   * signal.
   */
  radius?: AnimatableProp<number>;
  /**
   * How fast the water calms, 0..1. At 0 a ring lives about five seconds
   * and keeps spreading the whole time; at 1 a dent is gone in a twentieth
   * of a second, so the wake stays tight to the pointer. Each step of the
   * dial shortens the life by the same factor. Defaults to 0.75. Accepts a
   * static value or an animation signal.
   */
  decay?: AnimatableProp<number>;
  /**
   * How much light the wake catches, where 1 adds full white on the
   * steepest crests and 0 adds none. It is what shows the wake over a flat
   * single color, where refraction has nothing to bend. Defaults to 0.4.
   * Accepts a static value or an animation signal.
   */
  shine?: AnimatableProp<number>;
}

// ----------------------------------------------------------------------------
// Feeding an animatable prop into the field
// ----------------------------------------------------------------------------

/**
 * Hands every value of an animatable prop to `write`: once for a static
 * value, and on every change for a signal, seeded from its current value.
 * The same contract useAnimatableUniform keeps, for a value that lives in
 * the wave field's own uniforms rather than in one of this component's.
 */
function useAnimatableWrite<T>(value: AnimatableProp<T>, write: ((next: T) => void) | null) {
  useEffect(() => {
    if (!write) return;
    if (isSignal(value)) {
      write(value.get());

      return value.on('change', write);
    }
    write(value);

    return undefined;
  }, [value, write]);
}

// ----------------------------------------------------------------------------
// The inert path
// ----------------------------------------------------------------------------

// Said once per page, not once per instance or per Strict Mode mount cycle:
// the cause is the renderer, which every instance on the page shares.
let inertWarned = false;

/**
 * The one development-only note when the water cannot run (ADR 0003): the
 * WebGL2 fallback without float render targets, or a lost device. The
 * Effect then registers nothing and the scene renders as if it were not
 * there, which is the intended degradation, so this is a warning and not
 * an error.
 */
function warnInertOnce(): void {
  if (inertWarned || process.env.NODE_ENV === 'production') return;
  inertWarned = true;
  console.warn(
    '[CursorRipple] The renderer cannot draw to a half-float render target ' +
      '(WebGL2 without EXT_color_buffer_float, or a lost device), so the ' +
      'ripple is off and the scene renders as if it were not mounted.',
  );
}

// ----------------------------------------------------------------------------
// The component
// ----------------------------------------------------------------------------

/**
 * A water surface over the scene: dragging the pointer leaves a wake that
 * spreads, catches light, and settles. Mount it inside a `<ShaderScene>`
 * after the components it should act on. Mode 1 only, because it needs the
 * scene's output stage; it has no `useShaderMaterial` form. Refraction
 * bends the image the Sources drew, not the output of an Effect mounted
 * before it.
 */
export function CursorRipple({
  refraction = 0.1,
  radius = 0.05,
  decay = 0.75,
  shine = 0.4,
}: CursorRippleProps) {
  const shaderContext = useShaderContext();

  // The render-on-demand vote. Nothing here changes on its own: the water
  // only moves after a pointer move, and the drive below asks for frames
  // for exactly as long as the field holds energy. So the vote is static,
  // and a scene of still Sources plus this ripple parks between drags.
  useStaticSceneHint(true);
  // The scene's shared pointer, unsmoothed: the water wants the raw path
  // the pointer took, and the field does its own easing by spreading the
  // stroke. Presence comes with it, easing in on entry and out on leave,
  // so a fresh page injects nothing and a pointer leaving fades rather
  // than freezing. The hook also wakes a parked scene on every move.
  const cursor = useCursor({ smoothing: 0 });
  const resize = useResize();
  const [field, setField] = useState<WaveField | null>(null);

  // One field per instance, created with the renderer at the canvas's
  // current size and released with it. One effect creates and disposes so a
  // Strict Mode double-mount cleans up after itself.
  useEffect(() => {
    if (!shaderContext) return;
    const renderer = shaderContext.renderer.three;
    const size = renderer.getSize(new ThreeVector2());
    const created = createWaveField(renderer, size.width, size.height);

    if (created.texture === null) warnInertOnce();
    setField(created);

    return () => {
      created.dispose();
      setField(null);
    };
  }, [shaderContext]);

  // Drive the water from the scene's frame loop. Every tick hands the field
  // the segment the pointer swept since the last tick, gated by presence,
  // and the frame's delta, which the field turns into pointer speed and
  // into fixed-length substeps. The scene renders on demand, so while the
  // field still holds energy this asks for another frame; once it settles
  // the request stops and an otherwise static scene parks.
  useEffect(() => {
    if (!shaderContext || !field) return;
    const { scheduler } = shaderContext;
    let previous: Vector2 | null = null;

    const drive = ({ delta }: SchedulerTick) => {
      const current = cursor.get();
      const stroke = deriveStroke(previous, current, cursor.presence.get());

      previous = current;
      field.step(delta, stroke);
      if (!field.atRest) scheduler.requestRender();
    };

    scheduler.add(drive);

    return () => scheduler.remove(drive);
  }, [shaderContext, field, cursor]);

  // `radius` and `decay` live in the field's own uniforms. Each write is a
  // uniform write followed by a scheduler poke (a bare write repaints
  // nothing on a parked scene), and neither rebuilds anything. The writers
  // are memoized on the field so the subscriptions below survive re-renders.
  const writeRadius = useMemo(
    () =>
      field && shaderContext
        ? (next: number) => {
            field.tune({ strokeRadius: next });
            shaderContext.scheduler.requestRender();
          }
        : null,
    [field, shaderContext],
  );
  const writeDecay = useMemo(
    () =>
      field && shaderContext
        ? (next: number) => {
            const damping = dampingForDecay(next);

            field.tune({ heightDamping: damping, velocityDamping: damping });
            shaderContext.scheduler.requestRender();
          }
        : null,
    [field, shaderContext],
  );

  useAnimatableWrite(radius, writeRadius);
  useAnimatableWrite(decay, writeDecay);

  // A resize gives the field new targets at the new size. The water is not
  // carried across (out of scope in SHA-138), so a layout change resets it.
  useEffect(() => {
    if (!field) return;

    return resize.on('change', ([width, height]) => {
      if (width > 0 && height > 0) field.resize(width, height);
    });
  }, [field, resize]);

  if (!field?.texture) return null;

  return <CursorRippleShader field={field} refraction={refraction} shine={shine} />;
}
