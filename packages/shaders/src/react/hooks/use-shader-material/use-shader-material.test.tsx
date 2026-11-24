import { renderHook } from '@testing-library/react';
import { vec3 } from 'three/tsl';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useShaderMaterial } from './use-shader-material.js';

describe('useShaderMaterial', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a MeshBasicNodeMaterial with colorNode set', () => {
    const { result } = renderHook(() => useShaderMaterial(() => vec3(1, 0, 0)));

    expect(result.current).toBeDefined();
    expect((result.current as unknown as { isMaterial: boolean }).isMaterial).toBe(true);
    expect(result.current.colorNode).toBeDefined();
  });

  it('disposes the material on unmount', () => {
    const { result, unmount } = renderHook(() => useShaderMaterial(() => vec3(1, 0, 0)));
    const material = result.current;
    let disposed = false;
    const original = material.dispose.bind(material);

    material.dispose = () => {
      disposed = true;
      original();
    };
    unmount();
    expect(disposed).toBe(true);
  });

  it('returns a material that is not disposed after a Strict Mode remount', () => {
    // Strict Mode mounts, cleans up, and mounts the effects again while it
    // keeps the memoized material. The material the hook hands back after
    // that cycle must still be live, or the user's mesh draws with a
    // disposed one.
    const disposeSpy = vi.spyOn(MeshBasicNodeMaterial.prototype, 'dispose');
    const { result } = renderHook(() => useShaderMaterial(() => vec3(1, 0, 0)), {
      reactStrictMode: true,
    });

    expect(disposeSpy.mock.instances).not.toContain(result.current);
  });

  it('rebuilds the material when the build function reference changes', () => {
    const { result, rerender } = renderHook(({ build }) => useShaderMaterial(build), {
      initialProps: { build: () => vec3(1, 0, 0) },
    });
    const first = result.current;

    rerender({ build: () => vec3(0, 1, 0) });
    expect(result.current).not.toBe(first);
  });
});
