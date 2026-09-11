// The hovered item, shared between the scene and the panel. A tiny external
// store: the scene writes on pointer events, and both the scene and the panel
// read through useSyncExternalStore. Kept outside React state so a pointer
// move over the canvas never re-renders the canvas's parent.
import { useSyncExternalStore } from 'react';

export type Hovered = { readonly kind: 'neighborhood' | 'module'; readonly id: string } | null;

const listeners = new Set<() => void>();
let hovered: Hovered = null;

function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): Hovered {
  return hovered;
}

export function setHovered(next: Hovered): void {
  const same =
    (next === null && hovered === null) ||
    (next !== null && hovered !== null && next.kind === hovered.kind && next.id === hovered.id);

  if (same) return;

  hovered = next;

  for (const listener of listeners) listener();
}

export function useHovered(): Hovered {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
