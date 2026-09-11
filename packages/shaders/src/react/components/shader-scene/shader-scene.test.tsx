import { render, waitFor } from '@testing-library/react';
import type { QuadMesh } from 'three/webgpu';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as ShadersModule from '../../../engine.js';
import { createRenderer } from '../../../engine.js';
import { ShadersError } from '../../errors/shaders-error.js';
import { PosterContext } from '../shader-poster/poster-context.js';
import { ShaderScene } from './shader-scene.js';

vi.mock('../../../engine.js', async (importOriginal) => {
  const actual = await importOriginal<typeof ShadersModule>();

  return {
    ...actual,
    createRenderer: vi.fn(async () => ({
      three: {
        render: vi.fn(),
        dispose: vi.fn(),
        domElement: document.createElement('canvas'),
        getPixelRatio: () => 1,
        setSize: vi.fn(),
      },
      backend: 'webgl2' as const,
      dispose: vi.fn(),
      resize: vi.fn(),
    })),
  };
});

describe('ShaderScene', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', () => 0);
    vi.stubGlobal('cancelAnimationFrame', () => {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('mounts a canvas element', () => {
    const { container } = render(<ShaderScene />);

    expect(container.querySelector('canvas')).toBeInTheDocument();
  });

  // three 0.170's PostProcessing shares one quad and one material across
  // every instance, so two scenes on a page drew whichever output was set
  // last. Each scene must draw its own quad with its own material.
  it('gives every scene its own output quad and material', async () => {
    const frames: FrameRequestCallback[] = [];

    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.push(callback);

      return frames.length;
    });
    vi.mocked(createRenderer).mockClear();

    render(
      <>
        <ShaderScene />
        <ShaderScene />
      </>,
    );

    await waitFor(() => expect(frames.length).toBeGreaterThanOrEqual(2));
    for (const frame of frames.splice(0)) frame(16);

    const renderers = await Promise.all(
      vi.mocked(createRenderer).mock.results.map((result) => result.value),
    );
    const quads = renderers.map(
      (gpuRenderer) => vi.mocked(gpuRenderer.three.render).mock.calls.at(-1)?.[0] as QuadMesh,
    );

    const [first, second] = quads;

    expect(quads).toHaveLength(2);
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    expect(first).not.toBe(second);
    expect(first?.material).not.toBe(second?.material);
  });

  it('signals painted=false to an enclosing poster boundary on teardown', async () => {
    const setShaderPainted = vi.fn();
    const { unmount } = render(
      <PosterContext.Provider value={{ setShaderPainted }}>
        <ShaderScene />
      </PosterContext.Provider>,
    );

    // Allow a tick for the async setup to run.
    await waitFor(() => {});
    unmount();

    // requestAnimationFrame is stubbed inert in this suite, so the paint
    // signal never fires; teardown must still re-arm the poster.
    expect(setShaderPainted).toHaveBeenCalledWith(false);
  });

  it('does not throw on unmount', async () => {
    const { unmount } = render(<ShaderScene />);

    // Allow a tick for the async setup to run (or be cancelled).
    await waitFor(() => {});
    expect(() => unmount()).not.toThrow();
  });

  it('fires onError with a renderer-init ShadersError when init fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const cause = new Error('no gpu backend');

    vi.mocked(createRenderer).mockRejectedValueOnce(cause);
    const onError = vi.fn();

    render(<ShaderScene onError={onError} />);

    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    const error = onError.mock.calls[0]?.[0] as ShadersError;

    expect(error).toBeInstanceOf(ShadersError);
    expect(error.code).toBe('renderer-init');
    expect(error.cause).toBe(cause);
  });

  it('mounts no children after init failure', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    vi.mocked(createRenderer).mockRejectedValueOnce(new Error('no gpu backend'));

    const { queryByTestId } = render(
      <ShaderScene>
        <div data-testid="child" />
      </ShaderScene>,
    );

    await waitFor(() => expect(console.error).toHaveBeenCalled());
    expect(queryByTestId('child')).not.toBeInTheDocument();
  });

  it('fires onError once even when a failing setup re-runs', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const cause = new Error('no gpu backend');

    vi.mocked(createRenderer).mockRejectedValueOnce(cause).mockRejectedValueOnce(cause);
    const onError = vi.fn();

    const { rerender } = render(<ShaderScene maxDPR={1} onError={onError} />);

    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));

    // A maxDPR change re-runs the setup effect; init fails again.
    rerender(<ShaderScene maxDPR={2} onError={onError} />);

    // The dev log fires per attempt, so it marks the second failure settling.
    await waitFor(() => expect(console.error).toHaveBeenCalledTimes(2));
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('swallows a throwing onError handler', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    vi.mocked(createRenderer).mockRejectedValueOnce(new Error('no gpu backend'));
    const onError = vi.fn(() => {
      throw new Error('handler boom');
    });

    let queryByTestId!: ReturnType<typeof render>['queryByTestId'];

    expect(() => {
      ({ queryByTestId } = render(
        <ShaderScene onError={onError}>
          <div data-testid="child" />
        </ShaderScene>,
      ));
    }).not.toThrow();
    await waitFor(() => expect(onError).toHaveBeenCalled());
    expect(queryByTestId('child')).not.toBeInTheDocument();
  });

  it('does not fire onError on successful init', async () => {
    const onError = vi.fn();

    const { getByTestId } = render(
      <ShaderScene onError={onError}>
        <div data-testid="child" />
      </ShaderScene>,
    );

    // Children mount only once setup has committed the shader context, so
    // this waits for the success path to fully settle.
    await waitFor(() => expect(getByTestId('child')).toBeInTheDocument());
    expect(onError).not.toHaveBeenCalled();
  });
});
