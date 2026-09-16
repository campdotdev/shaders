'use client';

/**
 * The docs navigation on a narrow viewport, after the Figma mock: a boxed
 * row at the top of the main column that names the current page and opens
 * into the same groups and rows the sidebar shows on a wide viewport. The
 * docs shell renders both and hands them the same tree, and CSS decides
 * which one shows, at 48rem of the site container. A Base UI Collapsible
 * drives the open state. The tree scrolls inside the shared ScrollArea once
 * it outgrows the box, with a fade at whichever edge has rows past it.
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useId, useState } from 'react';

import { Collapsible } from '@base-ui/react/collapsible';

import { ChevronDownIcon } from '@/components/icons/chevron-down';
import { ScrollArea } from '@/components/scroll-area/scroll-area';
import type { ResolvedNavGroup, ResolvedNavItem } from '@/content/types';

import styles from './docs-nav-dropdown.module.css';

interface DocsNavDropdownProps {
  /** The sidebar's tree: groups of rows, where a group may nest groups. */
  tree: ResolvedNavGroup[];
  /** The trigger's text on a page the tree has no row for, such as the components index. */
  fallbackLabel: string;
}

// How far from the top or bottom edge, in px, still counts as reaching it
// before Base UI clears the root's data-overflow-y-* attributes. Rows are
// 16px on a 24px pitch, so an overflow under half a row is the tree's own
// padding, and a fade over it would hide nothing but air.
const FADE_THRESHOLD_PX = 8;

export function DocsNavDropdown({ tree, fallbackLabel }: DocsNavDropdownProps) {
  const pathname = usePathname();

  // The pathname the panel was opened on, or null while closed. Deriving
  // `open` from it means any navigation closes the panel with no effect: a
  // row click, or back and forward, moves the pathname on and the stored
  // one no longer matches. A row for the current page changes nothing, so
  // rows also close on click.
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const open = openedOn === pathname;
  const close = () => setOpenedOn(null);

  return (
    <Collapsible.Root
      className={styles.root}
      onOpenChange={(next) => setOpenedOn(next ? pathname : null)}
      open={open}
    >
      <Collapsible.Trigger className={styles.trigger}>
        {findLabel(tree, pathname) ?? fallbackLabel}
        <ChevronDownIcon className={styles.chevron} />
      </Collapsible.Trigger>
      <Collapsible.Panel className={styles.panel}>
        {/* The cap lives on this box and flows into the ScrollArea's root
            and viewport through max-height: inherit, the control panel's
            pattern (DemoLayout.tsx). */}
        <div className={styles.body}>
          <ScrollArea
            className={styles.scroller}
            overflowEdgeThreshold={{ yStart: FADE_THRESHOLD_PX, yEnd: FADE_THRESHOLD_PX }}
            overlay={
              <>
                <div aria-hidden="true" className={styles.fadeTop} />
                <div aria-hidden="true" className={styles.fadeBottom} />
              </>
            }
            viewportClassName={styles.viewport}
          >
            <nav aria-label="Docs menu" className={styles.tree} data-pagefind-ignore="all">
              {tree.map((group) => (
                <Group group={group} key={group.label} onRowClick={close} pathname={pathname} />
              ))}
            </nav>
          </ScrollArea>
        </div>
      </Collapsible.Panel>
    </Collapsible.Root>
  );
}

// ----------------------------------------------------------------------------
// The tree
// ----------------------------------------------------------------------------

interface GroupProps {
  group: ResolvedNavGroup;
  onRowClick: () => void;
  pathname: string;
}

// A group header over its rows. A nested group, such as React under
// Frameworks on the docs pages, renders as a group inside the list.
// A plain div rather than a <section>: these are groupings of links inside
// a nav, not sections of the page, and the spec reserves <section> for
// content that would appear in the document's outline. aria-labelledby ties
// the list to its heading, so a screen reader announces "Gradients, list,
// 4 items" instead of an unlabelled list. Mirrors the docs sidebar.
function Group({ group, onRowClick, pathname }: GroupProps) {
  const headingId = useId();

  return (
    <div className={styles.group}>
      <h2 className={styles.groupHeader} id={headingId}>
        {group.label}
      </h2>
      <ul aria-labelledby={headingId} className={styles.list}>
        {group.items.map((item) =>
          'items' in item ? (
            <li key={item.label}>
              <Group group={item} onRowClick={onRowClick} pathname={pathname} />
            </li>
          ) : (
            <li key={item.url}>
              <Link
                aria-current={item.url === pathname ? 'page' : undefined}
                className={styles.row}
                href={item.url}
                onClick={onRowClick}
              >
                {item.label}
              </Link>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}

// The label of the row whose URL is the current page, walking nested groups,
// or null when no row matches.
function findLabel(
  groups: Array<ResolvedNavGroup | ResolvedNavItem>,
  pathname: string,
): string | null {
  for (const entry of groups) {
    if ('items' in entry) {
      const nested = findLabel(entry.items, pathname);

      if (nested !== null) return nested;
    } else if (entry.url === pathname) {
      return entry.label;
    }
  }

  return null;
}
