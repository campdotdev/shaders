/**
 * Whether the browser hands out a WebGPU adapter. The favorites and the
 * Reactive feature card mount a live scene only where it does. Without an
 * adapter, ShaderScene would fall back to WebGL2, and they show an image
 * instead.
 */
import { useEffect, useState } from 'react';

/**
 * True once the browser has handed out a WebGPU adapter. False on the
 * server, until the adapter arrives, and while `enabled` is false, which
 * skips the request.
 */
export function useHasWebGpu(enabled = true): boolean {
  const [hasWebGpu, setHasWebGpu] = useState(false);

  useEffect(() => {
    // navigator.gpu is typed as always present, but it is missing in a
    // browser without WebGPU and outside a secure context, so probe with `in`.
    if (!enabled || !('gpu' in navigator)) return;

    let cancelled = false;

    void navigator.gpu
      .requestAdapter()
      // A browser that refuses the request has no WebGPU to offer either.
      .catch(() => null)
      .then((adapter) => {
        if (!cancelled) setHasWebGpu(adapter !== null);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return enabled && hasWebGpu;
}
