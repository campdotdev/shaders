'use client';

/**
 * The hooks controls actually use. usePropValue is the important one: it reads
 * a single field through useSyncExternalStore, so React compares that field
 * against its previous value and skips the re-render when nothing moved. Paired
 * with the store's structural sharing, dragging one slider re-renders that
 * slider and the scene and nothing else.
 */
import { useCallback, useMemo, useSyncExternalStore } from 'react';

import { useControlStore, usePathPrefix } from './context';
import { type ControlPath, normalizePath, type PathInput } from './store';

/** Resolves a control's relative path against its list-row prefix, memoized. */
export function useResolvedPath(path: PathInput): ControlPath {
  const prefix = usePathPrefix();
  const normalized = normalizePath(path);
  const key = normalized.join('.');

  return useMemo(
    () => [...prefix, ...normalized],
    [prefix, key], // eslint-disable-line react-hooks/exhaustive-deps
  );
}

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- TValue is set by the caller (e.g. usePropValue<number>('speed')) since the store has no way to infer it from a path string
export function usePropValue<TValue>(path: PathInput): TValue {
  const store = useControlStore();
  const resolved = useResolvedPath(path);

  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- getAtPath returns unknown; the caller-supplied TValue is what widgets bind to
  const read = useCallback(() => store.getAtPath(resolved) as TValue, [store, resolved]);

  return useSyncExternalStore(store.subscribe, read, read);
}

export function useSetProp(): (path: PathInput, value: unknown) => void {
  const store = useControlStore();
  const prefix = usePathPrefix();

  return useCallback(
    (path, value) => {
      store.setAtPath([...prefix, ...normalizePath(path)], value);
    },
    [store, prefix],
  );
}

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- TParams is set by the caller to the page's own params shape; the store itself only knows `object`
export function useSnapshot<TParams extends object>(): TParams {
  const store = useControlStore();

  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- getSnapshot() is typed as `object` on the shared store; the caller-supplied TParams narrows it back to the page's params
  const read = useCallback(() => store.getSnapshot() as TParams, [store]);

  return useSyncExternalStore(store.subscribe, read, read);
}

export function useResetControls(): () => void {
  const store = useControlStore();

  return useCallback(() => {
    store.reset();
  }, [store]);
}
