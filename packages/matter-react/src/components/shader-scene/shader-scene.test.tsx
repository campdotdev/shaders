import type * as MatterModule from '@lovo/matter';
import { render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
});
