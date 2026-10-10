/**
 * The site's hover gate: whether the visitor's main pointer can hover, as a
 * mouse or trackpad can. The favorites go live behind it, and the feature
 * cards play their stories behind it. A phone or tablet fails it.
 */
import { useSyncExternalStore } from 'react';

// The same query the stylesheets put hover styles behind.
const HOVER_QUERY = '(hover: hover) and (pointer: fine)';

function subscribeToHoverQuery(onChange: () => void): () => void {
  const query = window.matchMedia(HOVER_QUERY);

  query.addEventListener('change', onChange);

  return () => query.removeEventListener('change', onChange);
}

const readHoverQuery = () => window.matchMedia(HOVER_QUERY).matches;

// The server has no pointer to ask about, so it answers no, which renders
// every favorite as its poster and every feature card on its still frame.
const readServerHoverQuery = () => false;

/** True while the visitor's main pointer can hover. */
export function useCanHover(): boolean {
  return useSyncExternalStore(subscribeToHoverQuery, readHoverQuery, readServerHoverQuery);
}
