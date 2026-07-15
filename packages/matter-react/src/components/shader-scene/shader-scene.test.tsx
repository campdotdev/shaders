import type * as MatterModule from '@lovo/matter';
import { createRenderer } from '@lovo/matter';
import { render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MatterError } from '../../errors/matter-error.js';
import { PosterContext } from '../shader-poster/poster-context.js';
import { ShaderScene } from './shader-scene.js';

vi.mock('@lovo/matter', async (importOriginal) => {
  const actual = await importOriginal<typeof MatterModule>();

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
  });

  it('mounts a canvas element', () => {
    const { container } = render(<ShaderScene />);

    expect(container.querySelector('canvas')).toBeInTheDocument();
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

  it('fires onError with a renderer-init MatterError when init fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const cause = new Error('no gpu backend');

    vi.mocked(createRenderer).mockRejectedValueOnce(cause);
    const onError = vi.fn();

    render(<ShaderScene onError={onError} />);

    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    const error = onError.mock.calls[0]?.[0] as MatterError;

    expect(error).toBeInstanceOf(MatterError);
    expect(error.code).toBe('renderer-init');
    expect(error.cause).toBe(cause);
    consoleError.mockRestore();
  });

  it('renders no error text and mounts no children after init failure', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    vi.mocked(createRenderer).mockRejectedValueOnce(new Error('no gpu backend'));

    const { queryByTestId, container } = render(
      <ShaderScene>
        <div data-testid="child" />
      </ShaderScene>,
    );

    await waitFor(() => expect(console.error).toHaveBeenCalled());
    expect(queryByTestId('child')).not.toBeInTheDocument();
    expect(container.textContent ?? '').not.toContain('init failed');
    consoleError.mockRestore();
  });

  it('swallows a throwing onError handler', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    vi.mocked(createRenderer).mockRejectedValueOnce(new Error('no gpu backend'));
    const onError = vi.fn(() => {
      throw new Error('handler boom');
    });

    expect(() => render(<ShaderScene onError={onError} />)).not.toThrow();
    await waitFor(() => expect(onError).toHaveBeenCalled());
    consoleError.mockRestore();
  });

  it('does not fire onError on successful init', async () => {
    const onError = vi.fn();

    render(<ShaderScene onError={onError} />);
    await waitFor(() => {});
    expect(onError).not.toHaveBeenCalled();
  });
});
