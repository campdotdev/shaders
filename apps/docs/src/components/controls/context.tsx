'use client';

/**
 * Two contexts. ControlsProvider carries the page's store down to every
 * control. PathPrefixProvider is how list rows work: ListInput wraps each row
 * in a prefix like ['stops', 2], so the ColorInput inside that row can say
 * path="color" and land on stops[2].color without knowing its own index.
 */
import { createContext, type ReactNode, useContext, useMemo } from 'react';

import type { ControlPath, ControlStore, PathSegment } from './store';

const StoreContext = createContext<ControlStore<object> | null>(null);
const PathPrefixContext = createContext<ControlPath>([]);

export function ControlsProvider({
  store,
  children,
}: {
  store: ControlStore<object>;
  children: ReactNode;
}) {
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function PathPrefixProvider({
  segments,
  children,
}: {
  segments: readonly PathSegment[];
  children: ReactNode;
}) {
  const parent = useContext(PathPrefixContext);
  // Joined on the segments themselves so a row keeps one prefix identity
  // across re-renders; a fresh array each render would defeat the memo in
  // useResolvedPath and make every path read a new subscription.
  const prefix = useMemo(
    () => [...parent, ...segments],
    [parent, segments.join('.')], // eslint-disable-line react-hooks/exhaustive-deps
  );

  return <PathPrefixContext.Provider value={prefix}>{children}</PathPrefixContext.Provider>;
}

export function useControlStore(): ControlStore<object> {
  const store = useContext(StoreContext);

  if (store === null) {
    throw new Error('Control components must be rendered inside <ControlsProvider>.');
  }

  return store;
}

export function usePathPrefix(): ControlPath {
  return useContext(PathPrefixContext);
}
