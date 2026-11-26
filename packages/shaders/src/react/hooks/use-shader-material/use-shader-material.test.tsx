import { renderHook } from '@testing-library/react';
import { vec3, vec4 } from 'three/tsl';
import { AdditiveBlending, MeshBasicNodeMaterial, NormalBlending } from 'three/webgpu';
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

  it('sets vertexNode when the build function returns color and vertex nodes', () => {
    const color = vec3(1, 0, 0);
    const vertex = vec4(0, 0, 0, 1);
    const { result } = renderHook(() => useShaderMaterial(() => ({ color, vertex })));

    expect(result.current.colorNode).toBe(color);
    expect(result.current.vertexNode).toBe(vertex);
  });

  it('leaves vertexNode alone when the build function returns a color node', () => {
    const { result } = renderHook(() => useShaderMaterial(() => vec3(1, 0, 0)));

    expect(result.current.vertexNode).toBeNull();
  });

  it('blends normally and writes depth by default', () => {
    const { result } = renderHook(() => useShaderMaterial(() => vec3(1, 0, 0)));

    expect(result.current.blending).toBe(NormalBlending);
    expect(result.current.depthWrite).toBe(true);
    expect(result.current.transparent).toBe(false);
  });

  it('keeps the defaults under normal blending', () => {
    const { result } = renderHook(() =>
      useShaderMaterial(() => vec3(1, 0, 0), { blending: 'normal' }),
    );

    expect(result.current.blending).toBe(NormalBlending);
    expect(result.current.depthWrite).toBe(true);
    expect(result.current.transparent).toBe(false);
  });

  it('adds light, stops writing depth, and turns transparent under additive blending', () => {
    const { result } = renderHook(() =>
      useShaderMaterial(() => vec3(1, 0, 0), { blending: 'additive' }),
    );

    expect(result.current.blending).toBe(AdditiveBlending);
    expect(result.current.depthWrite).toBe(false);
    expect(result.current.transparent).toBe(true);
  });

  it('keeps the material when the options object is new but its blending is the same', () => {
    const build = () => vec3(1, 0, 0);
    const { result, rerender } = renderHook(() =>
      useShaderMaterial(build, { blending: 'additive' }),
    );
    const first = result.current;

    rerender();
    expect(result.current).toBe(first);
  });

  it('rebuilds the material when blending changes', () => {
    const build = () => vec3(1, 0, 0);
    const { result, rerender } = renderHook(
      ({ blending }: { blending: 'normal' | 'additive' }) => useShaderMaterial(build, { blending }),
      { initialProps: { blending: 'normal' } },
    );
    const first = result.current;

    rerender({ blending: 'additive' });
    expect(result.current).not.toBe(first);
    expect(result.current.blending).toBe(AdditiveBlending);
  });
});
