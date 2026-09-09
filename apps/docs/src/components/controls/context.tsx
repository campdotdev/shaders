'use client';

/**
 * Four contexts. ControlsProvider carries the page's store down to every
 * control. PathPrefixProvider is how list rows work: ListInput wraps each row
 * in a prefix like ['stops', 2], so the ColorInput inside that row can say
 * path="color" and land on stops[2].color without knowing its own index.
 * ListRowProvider carries the row's name ("stop 2") alongside, so a control
 * inside a row can drop its own visible label and still name itself fully
 * for a screen reader. CopySourceProvider runs the other way: it sits above
 * the island, ControlsProvider publishes its store up into it, and the page
 * header's Copy React button (page-actions/) reads the store from there.
 */
import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react';

import type { ControlPath, ControlStore, PathSegment } from './store';

const StoreContext = createContext<ControlStore<object> | null>(null);
const PathPrefixContext = createContext<ControlPath>([]);

// ----------------------------------------------------------------------------
// The copy source
// ----------------------------------------------------------------------------

/**
 * The page's store as seen from outside the island. The component page
 * template renders the header and the demo island as siblings, and only
 * the island creates the store, so the header can't reach it through
 * ordinary context. This pair of contexts bridges the gap: the outer one
 * hands ControlsProvider a setter to publish into, the inner one hands the
 * header whatever was published. Null until an island has mounted, and on
 * pages with no island.
 */
const CopySourceContext = createContext<ControlStore<object> | null>(null);
const PublishCopySourceContext = createContext<
  ((store: ControlStore<object> | null) => void) | null
>(null);

export function CopySourceProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<ControlStore<object> | null>(null);

  return (
    <PublishCopySourceContext.Provider value={setStore}>
      <CopySourceContext.Provider value={store}>{children}</CopySourceContext.Provider>
    </PublishCopySourceContext.Provider>
  );
}

/** The mounted island's store, or null before it mounts. */
export function useCopySource(): ControlStore<object> | null {
  return useContext(CopySourceContext);
}

/**
 * Trail of ancestor row labels, outermost first ("line 5", then "stop 2").
 * Empty outside any list. Controls read it for two things: whether they are
 * inside a row at all, which switches them to their compact form, and how to
 * qualify their accessible names, since eight rows each holding a plain
 * "Color" would otherwise be indistinguishable to a screen reader. Only rows
 * contribute to the trail, never a list's own heading, so a nested list's
 * controls read "stop 2 from line 5" rather than "stop 2 from Colors from
 * line 5".
 */
const ListRowContext = createContext<readonly string[]>([]);

export function ControlsProvider({
  store,
  children,
}: {
  store: ControlStore<object>;
  children: ReactNode;
}) {
  const publish = useContext(PublishCopySourceContext);

  // Publishes the store to the page header for as long as this island is
  // mounted. Islands render inside CopySourceProvider only on the component
  // pages; the dev playgrounds have no header and no provider, so there is
  // nothing to publish to there.
  useEffect(() => {
    if (publish === null) return;

    publish(store);

    return () => publish(null);
  }, [publish, store]);

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
  // Keyed on the segments themselves (via JSON.stringify, not join('.') --
  // a segment could itself contain a dot and collide with a different path)
  // so a row keeps one prefix identity across re-renders; a fresh array each
  // render would defeat the memo in useResolvedPath and make every path read
  // a new subscription.
  const prefix = useMemo(
    () => [...parent, ...segments],
    [parent, JSON.stringify(segments)], // eslint-disable-line react-hooks/exhaustive-deps
  );

  return <PathPrefixContext.Provider value={prefix}>{children}</PathPrefixContext.Provider>;
}

export function ListRowProvider({
  trail,
  children,
}: {
  trail: readonly string[];
  children: ReactNode;
}) {
  // Keyed on the labels themselves so a row keeps one trail identity across
  // re-renders, the same way PathPrefixProvider keeps its prefix.
  const value = useMemo(
    () => trail,
    [JSON.stringify(trail)], // eslint-disable-line react-hooks/exhaustive-deps
  );

  return <ListRowContext.Provider value={value}>{children}</ListRowContext.Provider>;
}

export function useListRowTrail(): readonly string[] {
  return useContext(ListRowContext);
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
