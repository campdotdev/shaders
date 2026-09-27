/**
 * The two rules the sidebar and the dropdown share about the docs tree,
 * beside the NavGroup that draws it. They live apart from nav-tree.tsx so
 * that file exports only components, which is what lets Fast Refresh keep
 * the tree's state across an edit instead of reloading the page.
 */
import type { MouseEvent } from 'react';

import type { ResolvedNavGroup } from '@/content/types';

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

// Whether any group holds a group. A tree that nests takes larger top-level
// headers, so that a parent reads as the parent of the groups under it. The
// components tree is flat and the MDX docs tree nests, but each surface reads
// the tree rather than the section, so the docs shell never has to hand down
// a look. nav.test.ts pins both halves of that at the data level.
export function treeNests(tree: ResolvedNavGroup[]): boolean {
  return tree.some((group) => group.items.some((item) => 'items' in item));
}

// Whether a row click navigates this tab: a plain primary-button click. A
// modifier-key click opens a new tab or window and leaves this page alone.
// Enter on a focused row fires a click event too, so a keyboard reader
// counts.
export function navigatesThisTab(event: MouseEvent<HTMLAnchorElement>): boolean {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}
