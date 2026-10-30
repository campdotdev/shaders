'use client';

/**
 * The loaded preset's name, from a composition's store. The picker shows it,
 * and the scene remounts VisualTestPause on it, so each read subscribes to
 * the name alone rather than to the props.
 */
import { useSyncExternalStore } from 'react';

import type { CompositionStore } from '@/compositions/store';

export function useLoadedPreset(store: CompositionStore): string {
  return useSyncExternalStore(store.subscribe, store.getPreset, store.getPreset);
}
