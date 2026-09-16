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
import { type RefObject, useId, useLayoutEffect, useRef, useState } from 'react';

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
// before Base UI clears the root's data-overflow-y-* attributes. Matches
// the tree's bottom padding, the control panel's reasoning (DemoLayout.tsx):
// an overflow that small clips nothing but padding, so the last row is
// fully visible and a fade over it would only hide it.
const FADE_THRESHOLD_PX = 16;

export function DocsNavDropdown({ tree, fallbackLabel }: DocsNavDropdownProps) {
  const pathname = usePathname();

  // The pathname the panel was opened on, or null while closed. The moment
  // the pathname moves on, the render below clears the stored path, so any
  // navigation closes the panel: a row click, a link in the page, search,
  // or back and forward. Clearing it, rather than only comparing, is what
  // keeps a return from reopening it: leave Aurora by a body link and press
  // back, and the stored path is already null rather than Aurora again.
  // Setting state during render when a prop has changed is React's
  // documented pattern for resetting state on a change, and it needs no
  // effect: React discards this render's output and re-renders with the
  // new state before anything reaches the DOM. A row for the current page
  // changes nothing, so rows also close on click.
  const [openedOn, setOpenedOn] = useState<string | null>(null);

  if (openedOn !== null && openedOn !== pathname) setOpenedOn(null);

  const open = openedOn === pathname;
  const close = () => setOpenedOn(null);

  // The element that scrolls, and the current page's row inside it.
  const viewportRef = useRef<HTMLDivElement>(null);
  const currentRowRef = useRef<HTMLAnchorElement>(null);

  // On open, put the current page's row in the middle of the scroll region,
  // the way the sidebar keeps its place. A layout effect on `open` because
  // Base UI's Panel renders its DOM in the same render that hands it
  // open=true (shouldRender in useCollapsiblePanel.js includes `open`), so
  // by the time this runs the commit has attached both refs, and a write
  // here lands before the frame paints. A callback ref on the row would
  // only be needed if the panel mounted a tick later. The write goes to the
  // viewport's scrollTop rather than scrollIntoView, which would also
  // scroll the window to bring the row into view; the window must not
  // move. Nothing to do on a page with no row, such as the components
  // index, and on a tree shorter than the cap the viewport clamps the
  // write to zero.
  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const row = currentRowRef.current;

    if (!open || !viewport || !row) return;

    const rowTop =
      row.getBoundingClientRect().top - viewport.getBoundingClientRect().top + viewport.scrollTop;

    viewport.scrollTop = rowTop - (viewport.clientHeight - row.offsetHeight) / 2;
  }, [open]);

  // A tree whose groups hold groups takes larger top-level headers, so that
  // a parent reads as the parent of the groups under it. Read off the tree
  // rather than handed down as a look, the way the sidebar does it. The
  // `|| undefined` is what drops the attribute on a flat tree: React writes
  // a literal false out as data-nests="false", and [data-nests] matches any
  // value, that string included.
  const nests = tree.some((group) => group.items.some((item) => 'items' in item));

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
            viewportRef={viewportRef}
          >
            <nav
              aria-label="Docs menu"
              className={styles.tree}
              data-nests={nests || undefined}
              data-pagefind-ignore="all"
            >
              {tree.map((group) => (
                <Group
                  currentRowRef={currentRowRef}
                  group={group}
                  key={group.label}
                  level={2}
                  onRowClick={close}
                  pathname={pathname}
                />
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
  /** Attached to the current page's row, which the open effect scrolls to. */
  currentRowRef: RefObject<HTMLAnchorElement | null>;
  group: ResolvedNavGroup;
  /** Which heading this group's label is: h2 at the top, h3 inside a group. */
  level: 2 | 3;
  onRowClick: () => void;
  pathname: string;
}

// A group header over its rows. A nested group, such as React under
// Frameworks on the docs pages, renders as a group inside the list, and
// its header steps down to an h3 so that heading navigation reads it as
// the child of the h2 above it, the same levels the docs sidebar gives the
// same tree. No tree nests deeper than that. A plain div rather than a
// <section>: these are groupings of links inside a nav, not sections of
// the page, and the spec reserves <section> for content that would appear
// in the document's outline. aria-labelledby ties the list to its heading,
// so a screen reader announces "Gradients, list, 4 items" instead of an
// unlabelled list. Mirrors the docs sidebar.
function Group({ currentRowRef, group, level, onRowClick, pathname }: GroupProps) {
  const headingId = useId();
  const Heading = level === 2 ? 'h2' : 'h3';

  return (
    <div className={styles.group}>
      <Heading className={styles.groupHeader} id={headingId}>
        {group.label}
      </Heading>
      <ul aria-labelledby={headingId} className={styles.list}>
        {group.items.map((item) =>
          'items' in item ? (
            <li key={item.label}>
              <Group
                currentRowRef={currentRowRef}
                group={item}
                level={3}
                onRowClick={onRowClick}
                pathname={pathname}
              />
            </li>
          ) : (
            <li key={item.url}>
              <Link
                aria-current={item.url === pathname ? 'page' : undefined}
                className={styles.row}
                href={item.url}
                onClick={onRowClick}
                ref={item.url === pathname ? currentRowRef : undefined}
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
