import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useDisplayGamut } from './use-display-gamut.js';

type Listener = (event: { matches: boolean }) => void;

function mockMatchMedia(matches: boolean) {
  const listeners = new Set<Listener>();
  const mediaQueryList = {
    matches,
    media: '(color-gamut: p3)',
    addEventListener: (_type: string, listener: Listener) => listeners.add(listener),
    removeEventListener: (_type: string, listener: Listener) => listeners.delete(listener),
  };

  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => mediaQueryList),
  );

  return {
    emit(next: boolean) {
      mediaQueryList.matches = next;
      for (const listener of listeners) listener({ matches: next });
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useDisplayGamut', () => {
  it('returns explicit preference verbatim without querying', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => {
        throw new Error('should not be called for explicit preference');
      }),
    );
    expect(renderHook(() => useDisplayGamut('srgb')).result.current).toBe('srgb');
    expect(renderHook(() => useDisplayGamut('p3')).result.current).toBe('p3');
  });

  it('resolves auto to p3 when the display supports it', () => {
    mockMatchMedia(true);
    expect(renderHook(() => useDisplayGamut('auto')).result.current).toBe('p3');
  });

  it('resolves auto to srgb when the display does not support p3', () => {
    mockMatchMedia(false);
    expect(renderHook(() => useDisplayGamut('auto')).result.current).toBe('srgb');
  });

  it('updates when the display gamut changes', () => {
    const media = mockMatchMedia(false);
    const { result } = renderHook(() => useDisplayGamut('auto'));

    expect(result.current).toBe('srgb');
    act(() => media.emit(true));
    expect(result.current).toBe('p3');
  });
});
