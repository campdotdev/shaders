// Unit tests for the wave field, through a stub renderer: what the field
// asks the renderer to draw and when, never what the water looks like. The
// look is the dev probe route and its visual spec (apps/docs-tests/visual/
// wave-field.spec.ts). Modelled on the output-stage tests next door.
import { HalfFloatType, type RenderTarget } from 'three';
import type { WebGPURenderer } from 'three/webgpu';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { setReducedMotionPolicy } from '../reduced-motion/reduced-motion.js';
import { createWaveField, strokePushForFrame, strokeStrength } from './wave-field.js';

// The field only asks the renderer to bind a target and draw one quad into
// it, and reads the backend to find out whether half-float targets can be
// rendered to, so a plain object stands in. `backend` mirrors the two shapes
// three's renderer can hold: the WebGPU backend (always supports them) and
// the WebGL2 fallback, which needs the EXT_color_buffer_float extension.
interface StubOptions {
  backend?: 'webgpu' | 'webgl2';
  floatTargets?: boolean;
}

function makeRenderer({ backend = 'webgpu', floatTargets = true }: StubOptions = {}) {
  let boundTarget: RenderTarget | null = null;

  return {
    render: vi.fn(),
    setRenderTarget: vi.fn((target: RenderTarget | null) => {
      boundTarget = target;
    }),
    getRenderTarget: vi.fn(() => boundTarget),
    backend:
      backend === 'webgl2'
        ? {
            isWebGLBackend: true,
            extensions: {
              has: (name: string) => floatTargets && name === 'EXT_color_buffer_float',
            },
          }
        : {},
  } as unknown as WebGPURenderer;
}

// three's renderer records a lost device on a private flag.
const loseDevice = (renderer: WebGPURenderer) => {
  (renderer as unknown as { _isDeviceLost: boolean })._isDeviceLost = true;
};

describe('createWaveField', () => {
  it('sizes the field to a quarter of the canvas and exposes a half-float texture at rest', () => {
    const field = createWaveField(makeRenderer(), 1280, 720);

    expect(field.texture?.type).toBe(HalfFloatType);
    expect(field.texture?.image).toMatchObject({ width: 320, height: 180 });
    expect(field.atRest).toBe(true);
  });

  it('caps the long edge and keeps the aspect', () => {
    const field = createWaveField(makeRenderer(), 4000, 2000);

    expect(field.texture?.image).toMatchObject({ width: 512, height: 256 });
  });

  it('runs on the WebGL2 fallback when the float extension is present', () => {
    const field = createWaveField(makeRenderer({ backend: 'webgl2' }), 1280, 720);

    expect(field.texture).not.toBeNull();
  });

  // ADR 0003: where the extension or the device is missing the caller renders
  // as identity, so the module has to go quiet rather than throw.
  it('is inert without float render-target support: texture is null and step never draws', () => {
    const renderer = makeRenderer({ backend: 'webgl2', floatTargets: false });
    const field = createWaveField(renderer, 1280, 720);

    expect(field.texture).toBeNull();
    expect(() => {
      field.step(1 / 60, { from: [0.2, 0.5], to: [0.4, 0.5], presence: 1 });
      field.resize(640, 360);
      field.dispose();
    }).not.toThrow();
    expect(renderer.render).not.toHaveBeenCalled();
    expect(field.texture).toBeNull();
  });

  it('is inert when created on a renderer that has already lost its device', () => {
    const renderer = makeRenderer();

    loseDevice(renderer);
    const field = createWaveField(renderer, 1280, 720);

    expect(field.texture).toBeNull();
  });

  it('recreates both targets at the new size on resize', () => {
    const field = createWaveField(makeRenderer(), 1280, 720);
    const before = field.texture;

    field.resize(640, 360);

    expect(field.texture).not.toBe(before);
    expect(field.texture?.image).toMatchObject({ width: 160, height: 90 });
  });
});

// A stroke that moves with the pointer over the canvas. Every step test that
// needs the field awake pushes this one in first.
const movingStroke = { from: [0.2, 0.5], to: [0.4, 0.5], presence: 1 } as const;

/** Every target the field bound, in order, including the restore at the end. */
const boundTargets = (renderer: WebGPURenderer) =>
  vi.mocked(renderer.setRenderTarget).mock.calls.map(([target]) => target);

describe('step', () => {
  // A frame with a stroke draws the stamp pass and then its substeps. The
  // substep is 1/120 s and a frame at 60Hz holds two of them, so three
  // passes, each into the target the previous one read from.
  it('swaps two targets every pass, exposes the last written one, and restores the bound target', () => {
    const renderer = makeRenderer();
    const field = createWaveField(renderer, 1280, 720);

    field.step(1 / 60, movingStroke);

    expect(renderer.render).toHaveBeenCalledTimes(3);
    const [stamp, first, second, restored] = boundTargets(renderer);

    expect(stamp).toBeDefined();
    expect(first).toBeDefined();
    expect(first).not.toBe(stamp);
    expect(second).toBe(stamp);
    expect(restored).toBeNull();
    expect(field.texture).toBe(second?.texture);

    field.step(1 / 120);

    expect(boundTargets(renderer)[4]).toBe(first);
    expect(field.texture).toBe(first?.texture);
  });

  // A tab that comes back after a second away must not try to run 120
  // substeps in one frame. The excess is dropped, not banked: the next
  // ordinary frame runs its own two, not the cap again.
  it('clamps a long delta to the maximum substeps and drops the excess', () => {
    const renderer = makeRenderer();
    const field = createWaveField(renderer, 1280, 720);

    field.step(1, movingStroke);
    expect(renderer.render).toHaveBeenCalledTimes(1 + 4);

    field.step(1 / 60);
    expect(renderer.render).toHaveBeenCalledTimes(1 + 4 + 2);
  });

  // 240Hz frames are half a substep each: the first banks its time and the
  // second spends it, so the wave runs at the same speed as at 60Hz. The
  // stroke still lands on its own frame, so a fast pointer leaves no gaps.
  it('carries a short delta into the next frame but stamps a stroke at once', () => {
    const renderer = makeRenderer();
    const field = createWaveField(renderer, 1280, 720);

    field.step(1 / 240, movingStroke);
    expect(renderer.render).toHaveBeenCalledTimes(1);

    field.step(1 / 240);
    expect(renderer.render).toHaveBeenCalledTimes(2);
  });
});

describe('strokeStrength', () => {
  // A fifth of the canvas in one 60Hz frame is 12 canvas widths per second.
  it('scales with pointer speed and the presence gate', () => {
    expect(strokeStrength([0.2, 0.5], [0.4, 0.5], 1 / 60, 1, 1)).toBeCloseTo(12);
    expect(strokeStrength([0.2, 0.5], [0.4, 0.5], 1 / 60, 0.5, 1)).toBeCloseTo(6);
    expect(strokeStrength([0.2, 0.5], [0.4, 0.5], 1 / 30, 1, 1)).toBeCloseTo(6);
  });

  it('is 0 for a still pointer, an absent one, or a zero delta', () => {
    expect(strokeStrength([0.3, 0.3], [0.3, 0.3], 1 / 60, 1, 1)).toBe(0);
    expect(strokeStrength([0.2, 0.5], [0.4, 0.5], 1 / 60, 0, 1)).toBe(0);
    expect(strokeStrength([0.2, 0.5], [0.4, 0.5], 0, 1, 1)).toBe(0);
  });

  it('gives equal physical movement equal strength on a wide canvas', () => {
    const aspect = 16 / 9;
    const horizontal = strokeStrength([0.2, 0.5], [0.3, 0.5], 1 / 60, 1, aspect);
    const vertical = strokeStrength([0.2, 0.5], [0.2, 0.5 + 0.1 * aspect], 1 / 60, 1, aspect);

    expect(horizontal).toBeCloseTo(vertical);
  });
});

describe('strokePushForFrame', () => {
  it('integrates the same pointer speed to the same push across frame rates', () => {
    const speed = 2;
    const pushAt60Hz = strokePushForFrame(speed, 1 / 60) * 60;
    const pushAt144Hz = strokePushForFrame(speed, 1 / 144) * 144;

    expect(pushAt60Hz).toBeCloseTo(pushAt144Hz);
    expect(strokePushForFrame(10, 1 / 60)).toBeCloseTo(0.2);
  });
});

describe('injection', () => {
  it('leaves the field at rest when the pointer is still', () => {
    const renderer = makeRenderer();
    const field = createWaveField(renderer, 1280, 720);

    field.step(1 / 60, { from: [0.3, 0.3], to: [0.3, 0.3], presence: 1 });

    expect(renderer.render).not.toHaveBeenCalled();
    expect(field.atRest).toBe(true);
  });

  it('leaves the field at rest when presence is 0', () => {
    const renderer = makeRenderer();
    const field = createWaveField(renderer, 1280, 720);

    field.step(1 / 60, { ...movingStroke, presence: 0 });

    expect(renderer.render).not.toHaveBeenCalled();
    expect(field.atRest).toBe(true);
  });

  it('wakes the field for a moving, present stroke', () => {
    const field = createWaveField(makeRenderer(), 1280, 720);

    field.step(1 / 60, movingStroke);

    expect(field.atRest).toBe(false);
  });
});

describe('settling', () => {
  // Energy is never read back, so the settle window is a clock: the time
  // the damping constant takes to shrink the last push below one 8-bit
  // step, about 3 s. At 60Hz that is roughly 180 frames of two substeps.
  it('steps through the settle window, then clears both targets and rests', () => {
    const renderer = makeRenderer();
    const field = createWaveField(renderer, 1280, 720);

    field.step(1 / 60, movingStroke);
    let frames = 1;

    while (!field.atRest && frames < 1000) {
      field.step(1 / 60);
      frames += 1;
    }

    expect(frames).toBeGreaterThan(170);
    expect(frames).toBeLessThan(200);
    // One stamp, two substeps per frame, and one clear draw into each target.
    expect(renderer.render).toHaveBeenCalledTimes(1 + 2 * frames + 2);

    const drawsAtRest = vi.mocked(renderer.render).mock.calls.length;

    field.step(1 / 60);
    field.step(1 / 60);
    expect(renderer.render).toHaveBeenCalledTimes(drawsAtRest);
    expect(field.atRest).toBe(true);
  });

  it('wakes again from a new stroke after resting', () => {
    const renderer = makeRenderer();
    const field = createWaveField(renderer, 1280, 720);

    field.step(1 / 60, movingStroke);
    for (let frame = 0; frame < 400 && !field.atRest; frame += 1) field.step(1 / 60);
    expect(field.atRest).toBe(true);

    field.step(1 / 60, movingStroke);
    expect(field.atRest).toBe(false);
  });

  // Repeated strokes can hold more energy than one stroke. The settle model
  // must carry that accumulation past the last stroke rather than restart the
  // same one-stroke window every frame.
  it('takes longer to settle after strokes accumulate', () => {
    const settleFramesAfter = (strokeFrames: number) => {
      const field = createWaveField(makeRenderer(), 1280, 720);

      for (let frame = 0; frame < strokeFrames; frame += 1) {
        field.step(1 / 60, movingStroke);
      }

      let settleFrames = 0;

      while (!field.atRest && settleFrames < 1000) {
        field.step(1 / 60);
        settleFrames += 1;
      }

      expect(field.atRest).toBe(true);

      return settleFrames;
    };

    expect(settleFramesAfter(60)).toBeGreaterThan(settleFramesAfter(1));
  });
});

describe('lost device', () => {
  // three's renderer turns every draw into a silent no-op once the device is
  // lost, and flags it on a private field. The field goes inert on either
  // signal: the flag, or a draw that throws.
  it('goes inert when the renderer reports a lost device', () => {
    const renderer = makeRenderer();
    const field = createWaveField(renderer, 1280, 720);

    field.step(1 / 60, movingStroke);
    expect(field.texture).not.toBeNull();

    loseDevice(renderer);
    field.step(1 / 60);

    expect(field.texture).toBeNull();
    expect(renderer.render).toHaveBeenCalledTimes(3);
  });

  // A resting field is not stepped, so the loss has to show on the reads a
  // consumer still makes.
  it('reports a null texture after a lost device without waiting for a step', () => {
    const renderer = makeRenderer();
    const field = createWaveField(renderer, 1280, 720);

    loseDevice(renderer);

    expect(field.texture).toBeNull();
    field.resize(640, 360);
    expect(field.texture).toBeNull();
  });

  it('goes inert when a draw throws, without rethrowing, and restores the bound target', () => {
    const renderer = makeRenderer();
    const field = createWaveField(renderer, 1280, 720);

    vi.mocked(renderer.render).mockImplementationOnce(() => {
      throw new Error('device lost');
    });

    expect(() => field.step(1 / 60, movingStroke)).not.toThrow();
    expect(field.texture).toBeNull();
    expect(renderer.getRenderTarget()).toBeNull();

    field.step(1 / 60, movingStroke);
    expect(renderer.render).toHaveBeenCalledTimes(1);
  });
});

describe('dispose', () => {
  it('releases both targets and reports no texture after', () => {
    const renderer = makeRenderer();
    const field = createWaveField(renderer, 1280, 720);

    field.step(1 / 60, movingStroke);
    const [first, second] = boundTargets(renderer);

    if (!first || !second) throw new Error('expected the step to bind both targets');
    const disposeFirst = vi.spyOn(first, 'dispose');
    const disposeSecond = vi.spyOn(second, 'dispose');

    field.dispose();

    expect(disposeFirst).toHaveBeenCalledTimes(1);
    expect(disposeSecond).toHaveBeenCalledTimes(1);
    expect(field.texture).toBeNull();
  });
});

describe('reduced motion', () => {
  afterEach(() => {
    setReducedMotionPolicy('auto');
  });

  // Under "paused" the factor is 0: the field neither steps nor takes the
  // stroke, so it stays at rest and the scene can idle.
  it('neither steps nor injects when the factor is 0', () => {
    setReducedMotionPolicy('paused');
    const renderer = makeRenderer();
    const field = createWaveField(renderer, 1280, 720);

    field.step(1 / 60, movingStroke);

    expect(renderer.render).not.toHaveBeenCalled();
    expect(field.atRest).toBe(true);
  });

  // "slow" is 0.3: four substeps of frame time become 1.2, so one runs,
  // after the stroke's own stamp pass.
  it('scales the simulated time by the factor', () => {
    setReducedMotionPolicy('slow');
    const renderer = makeRenderer();
    const field = createWaveField(renderer, 1280, 720);

    field.step(4 / 120, movingStroke);

    expect(renderer.render).toHaveBeenCalledTimes(1 + 1);
  });
});
