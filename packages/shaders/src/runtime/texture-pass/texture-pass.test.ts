// Unit tests for the texture pass, through a stub renderer: what the pass
// asks the renderer to draw and when, never what the texture holds. What it
// holds is the consumer's visual spec (Aurora's slice colors land in
// apps/docs-tests/visual/aurora.spec.ts). Modelled on the wave field's tests.
import { vec4 } from 'three/tsl';
import {
  FloatType,
  HalfFloatType,
  LinearFilter,
  NearestFilter,
  RedFormat,
  type RenderTarget,
  RGBAFormat,
  type WebGPURenderer,
} from 'three/webgpu';
import { describe, expect, it, vi } from 'vitest';

import { createTexturePass } from './texture-pass.js';

// The pass only asks the renderer to bind a target and draw one quad into
// it, and reads the backend to find out which texel types it can render to,
// so a plain object stands in. `backend` mirrors the two shapes three's
// renderer can hold: the WebGPU backend, which reports optional device
// features through hasFeature, and the WebGL2 fallback, which reads its
// extension registry.
interface StubOptions {
  backend?: 'webgpu' | 'webgl2';
  /** WebGPU: whether the device can filter a full-float texture. */
  float32Filterable?: boolean;
  /** WebGL2: whether EXT_color_buffer_float lets it render to float targets. */
  floatTargets?: boolean;
  /** WebGL2: whether OES_texture_float_linear lets it filter full floats. */
  floatLinear?: boolean;
}

function makeRenderer({
  backend = 'webgpu',
  float32Filterable = true,
  floatTargets = true,
  floatLinear = true,
}: StubOptions = {}) {
  let boundTarget: RenderTarget | null = null;
  const extensions = new Set([
    ...(floatTargets ? ['EXT_color_buffer_float'] : []),
    ...(floatLinear ? ['OES_texture_float_linear'] : []),
  ]);

  return {
    render: vi.fn(),
    setRenderTarget: vi.fn((target: RenderTarget | null) => {
      boundTarget = target;
    }),
    getRenderTarget: vi.fn(() => boundTarget),
    hasFeature: (name: string) =>
      backend === 'webgpu' && float32Filterable && name === 'float32-filterable',
    backend:
      backend === 'webgl2'
        ? { isWebGLBackend: true, extensions: { has: (name: string) => extensions.has(name) } }
        : {},
  } as unknown as WebGPURenderer;
}

const red = vec4(1, 0, 0, 1);

describe('createTexturePass', () => {
  it('sizes the target and gives its texture the requested type and filter', () => {
    const pass = createTexturePass(makeRenderer(), red, {
      width: 60,
      height: 1,
      type: FloatType,
      filter: NearestFilter,
    });

    expect(pass.texture?.image).toMatchObject({ width: 60, height: 1 });
    expect(pass.texture?.type).toBe(FloatType);
    expect(pass.texture?.minFilter).toBe(NearestFilter);
    expect(pass.texture?.magFilter).toBe(NearestFilter);
  });

  // Four channels unless asked otherwise. A value that needs one channel,
  // such as Aurora's field, asks for RedFormat and stores a quarter of the
  // bytes.
  it('holds four channels by default, or one when asked for RedFormat', () => {
    const renderer = makeRenderer();
    const field = { width: 64, height: 32, type: HalfFloatType, filter: LinearFilter } as const;

    expect(createTexturePass(renderer, red, field).texture?.format).toBe(RGBAFormat);
    expect(createTexturePass(renderer, red, { ...field, format: RedFormat }).texture?.format).toBe(
      RedFormat,
    );
  });
});

// Where the renderer cannot render to, or bind, the requested type, the
// consumer falls back to computing the value inline, so the pass has to go
// quiet with a null texture rather than throw or draw into nothing.
describe('without a target the renderer can use', () => {
  it('runs float targets on the WebGL2 fallback when the float extension is present', () => {
    const renderer = makeRenderer({ backend: 'webgl2' });

    expect(createTexturePass(renderer, red, floatSlices).texture).not.toBeNull();
    expect(
      createTexturePass(renderer, red, { ...floatSlices, type: HalfFloatType }).texture,
    ).not.toBeNull();
  });

  it('has no texture and never draws on WebGL2 without EXT_color_buffer_float', () => {
    const renderer = makeRenderer({ backend: 'webgl2', floatTargets: false });

    for (const type of [FloatType, HalfFloatType]) {
      const pass = createTexturePass(renderer, red, { ...floatSlices, type });

      expect(pass.texture).toBeNull();
      expect(() => {
        pass.render();
        pass.resize(30, 1);
        pass.dispose();
      }).not.toThrow();
    }
    expect(renderer.render).not.toHaveBeenCalled();
  });

  // Filtering a full float between texels takes a second extension on
  // WebGL2. Nearest reads need only the first.
  it('has no linear-filtered full float on WebGL2 without OES_texture_float_linear', () => {
    const renderer = makeRenderer({ backend: 'webgl2', floatLinear: false });

    expect(createTexturePass(renderer, red, floatSlices).texture).not.toBeNull();
    expect(
      createTexturePass(renderer, red, { ...floatSlices, filter: LinearFilter }).texture,
    ).toBeNull();
  });

  // three binds every render target's texture as filterable, and WebGPU
  // allows that for a full float only with the float32-filterable feature.
  // Half floats are filterable in core.
  it('has no full float on WebGPU without float32-filterable, but keeps half floats', () => {
    const renderer = makeRenderer({ float32Filterable: false });

    expect(createTexturePass(renderer, red, floatSlices).texture).toBeNull();
    expect(
      createTexturePass(renderer, red, { ...floatSlices, type: HalfFloatType }).texture,
    ).not.toBeNull();
  });
});

/** Every target the pass bound, in order, including the restore at the end. */
const boundTargets = (renderer: WebGPURenderer) =>
  vi.mocked(renderer.setRenderTarget).mock.calls.map(([target]) => target);

/** The material of the mesh the renderer was asked to draw on call `index`. */
const drawnNode = (renderer: WebGPURenderer, index = 0) => {
  const [mesh] = vi.mocked(renderer.render).mock.calls[index] ?? [];

  return (mesh as unknown as { material: { fragmentNode: unknown } }).material.fragmentNode;
};

const floatSlices = { width: 60, height: 1, type: FloatType, filter: NearestFilter } as const;

describe('render', () => {
  it('draws nothing until asked', () => {
    const renderer = makeRenderer();

    createTexturePass(renderer, red, floatSlices);

    expect(renderer.render).not.toHaveBeenCalled();
  });

  // A consumer that renders once per material build calls this once; one
  // that renders every frame calls it every frame. Either way each call is
  // one quad of the given node into the pass's own target.
  it('draws the node once per call into its own target, then restores the bound target', () => {
    const renderer = makeRenderer();
    const pass = createTexturePass(renderer, red, floatSlices);

    pass.render();

    expect(renderer.render).toHaveBeenCalledTimes(1);
    expect(drawnNode(renderer)).toBe(red);
    const [drawnInto, restored] = boundTargets(renderer);

    expect(drawnInto?.texture).toBe(pass.texture);
    expect(restored).toBeNull();

    pass.render();
    expect(renderer.render).toHaveBeenCalledTimes(2);
  });
});

describe('resize', () => {
  // The texture object survives, so a consumer's texture node stays bound to
  // it. Its contents do not: the consumer renders again after a resize.
  it('resizes the same texture and draws nothing', () => {
    const renderer = makeRenderer();
    const pass = createTexturePass(renderer, red, floatSlices);
    const before = pass.texture;

    pass.resize(120, 2);

    expect(pass.texture).toBe(before);
    expect(pass.texture?.image).toMatchObject({ width: 120, height: 2 });
    expect(renderer.render).not.toHaveBeenCalled();
  });
});

// three's renderer records a lost device on a private flag.
const loseDevice = (renderer: WebGPURenderer) => {
  (renderer as unknown as { _isDeviceLost: boolean })._isDeviceLost = true;
};

// After a lost device the pass goes inert for good, the way the wave field
// does: a null texture, so a consumer that rebuilds falls back to inline
// math, and no more draws.
describe('lost device', () => {
  it('is inert when created on a renderer that has already lost its device', () => {
    const renderer = makeRenderer();

    loseDevice(renderer);

    expect(createTexturePass(renderer, red, floatSlices).texture).toBeNull();
  });

  // three turns every draw into a silent no-op once the device is lost, so
  // the loss has to show on the next read, render or not.
  it('reports a null texture after a lost device and never draws again', () => {
    const renderer = makeRenderer();
    const pass = createTexturePass(renderer, red, floatSlices);

    pass.render();
    loseDevice(renderer);

    expect(pass.texture).toBeNull();
    pass.render();
    pass.resize(30, 1);
    expect(renderer.render).toHaveBeenCalledTimes(1);
  });

  it('goes inert when a draw throws, without rethrowing, and restores the bound target', () => {
    const renderer = makeRenderer();
    const pass = createTexturePass(renderer, red, floatSlices);

    vi.mocked(renderer.render).mockImplementationOnce(() => {
      throw new Error('device lost');
    });

    expect(() => pass.render()).not.toThrow();
    expect(pass.texture).toBeNull();
    expect(renderer.getRenderTarget()).toBeNull();

    pass.render();
    expect(renderer.render).toHaveBeenCalledTimes(1);
  });
});

describe('dispose', () => {
  it('releases the target and the material, then has no texture and never draws', () => {
    const renderer = makeRenderer();
    const pass = createTexturePass(renderer, red, floatSlices);

    pass.render();
    const [target] = boundTargets(renderer);

    if (!target) throw new Error('expected the render to bind the target');
    const [mesh] = vi.mocked(renderer.render).mock.calls[0] ?? [];
    const { material } = mesh as unknown as { material: { dispose: () => void } };
    const disposeTarget = vi.spyOn(target, 'dispose');
    const disposeMaterial = vi.spyOn(material, 'dispose');

    pass.dispose();

    expect(disposeTarget).toHaveBeenCalledTimes(1);
    expect(disposeMaterial).toHaveBeenCalledTimes(1);
    expect(pass.texture).toBeNull();

    pass.render();
    pass.resize(30, 1);
    pass.dispose();
    expect(renderer.render).toHaveBeenCalledTimes(1);
    expect(disposeTarget).toHaveBeenCalledTimes(1);
  });

  // ShaderScene disposes its renderer before its children's cleanups run,
  // and three then throws from the dispose of any material that renderer
  // drew. A component that disposes its pass on unmount meets exactly that,
  // and a throw there crashes the page it is leaving.
  it('swallows a throw from the material dispose and still goes inert', () => {
    const renderer = makeRenderer();
    const pass = createTexturePass(renderer, red, floatSlices);

    pass.render();
    const [mesh] = vi.mocked(renderer.render).mock.calls[0] ?? [];
    const { material } = mesh as unknown as { material: { dispose: () => void } };

    vi.spyOn(material, 'dispose').mockImplementation(() => {
      throw new TypeError("Cannot read properties of undefined (reading 'usedTimes')");
    });

    expect(() => pass.dispose()).not.toThrow();
    expect(pass.texture).toBeNull();
  });
});
