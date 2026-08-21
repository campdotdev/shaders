import { useEffect, useState } from 'react';

import type { OutputGamut } from '@camp-dev/shaders';

/** What the consumer asks for: a fixed gamut, or 'auto' to detect the display. */
export type GamutPreference = 'auto' | OutputGamut;

const P3_QUERY = '(color-gamut: p3)';

function detectGamut(): OutputGamut {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'srgb';
  }

  return window.matchMedia(P3_QUERY).matches ? 'p3' : 'srgb';
}

/**
 * Resolve a gamut preference to a concrete output gamut. Explicit 'srgb'/'p3'
 * pass through untouched; 'auto' queries `(color-gamut: p3)` and re-resolves
 * when the display capability changes (e.g. window dragged to another monitor).
 */
export function useDisplayGamut(preference: GamutPreference): OutputGamut {
  const [resolved, setResolved] = useState<OutputGamut>(() =>
    preference === 'auto' ? detectGamut() : preference,
  );

  useEffect(() => {
    if (preference !== 'auto') {
      setResolved(preference);

      return;
    }

    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      setResolved('srgb');

      return;
    }

    const mediaQuery = window.matchMedia(P3_QUERY);
    const update = () => setResolved(mediaQuery.matches ? 'p3' : 'srgb');

    update();
    mediaQuery.addEventListener('change', update);

    return () => mediaQuery.removeEventListener('change', update);
  }, [preference]);

  return resolved;
}
