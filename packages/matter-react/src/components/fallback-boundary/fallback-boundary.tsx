'use client';

import { type ReactNode, useEffect, useState } from 'react';

export interface FallbackBoundaryProps {
  fallback?: ReactNode;
  children: ReactNode;
}

export function FallbackBoundary({ fallback, children }: FallbackBoundaryProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return <>{mounted ? children : (fallback ?? null)}</>;
}
