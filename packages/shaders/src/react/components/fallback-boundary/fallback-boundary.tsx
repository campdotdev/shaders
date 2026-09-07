'use client';

// Client-only gate: renders `fallback` during server rendering and the first
// client render, then swaps in `children` after mount. Effects only run in
// the browser, so `mounted` is false exactly for the server-rendered pass —
// both sides of hydration agree on the fallback, and the browser-only
// children (a shader canvas) appear one render later without a hydration
// mismatch.
import { type ReactNode, useEffect, useState } from 'react';

export interface FallbackBoundaryProps {
  fallback?: ReactNode;
  children: ReactNode;
}

export function FallbackBoundary({ fallback, children }: FallbackBoundaryProps) {
  const [mounted, setMounted] = useState(false);

  // The post-mount flip IS the component — it cannot initialize from render,
  // because the server pass and first client render must both choose the
  // fallback for hydration to match (see the file-top comment). The swap the
  // detector reads as a flicker is the deliberate fallback-to-canvas handoff.
  // react-doctor-disable-next-line react-doctor/rendering-hydration-no-flicker
  useEffect(() => {
    // react-doctor-disable-next-line react-doctor/no-initialize-state
    setMounted(true);
  }, []);

  return <>{mounted ? children : (fallback ?? null)}</>;
}
