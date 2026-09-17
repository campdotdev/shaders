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
// before the fade over that edge goes off. At the end edge it matches the
// tree's bottom padding, the control panel's reasoning (DemoLayout.tsx): an
// overflow that small clips nothing but padding, so the last row is fully
// visible and a fade over it would only hide it. The start edge has no
// padding to match, because .tree sets none. What fills the first 13px there
// is the opening group's hairline rule and the 12px of air above its header,
// so an overflow inside the threshold is rule and air rather than a row.
// Both edges take one value because the box caps at 384px, where a second
// constant would be another number to keep in step without earning it.
const FADE_THRESHOLD_PX = 16;

// Which edge has rows past it, written straight onto the box the fades sit
// under rather than held in React state. The panel has to open with its
// fades already at the right strength, and a state update would only reach
// the DOM a render later, once the opening panel has painted a frame
// without them. Base UI stamps this same state on the ScrollArea root as
// data-overflow-y-start and -end, but it measures in a microtask and routes
// the result through React state, so those attributes are exactly that
// later render. Hence measuring here rather than reading them.
function syncFadeEdges(viewport: HTMLElement, body: HTMLElement) {
  const maxScroll = viewport.scrollHeight - viewport.clientHeight;
  const scrollable = maxScroll > 0;
  const fromStart = viewport.scrollTop;
  const fromEnd = maxScroll - fromStart;

  body.toggleAttribute('data-fade-top', scrollable && fromStart > FADE_THRESHOLD_PX);
  body.toggleAttribute('data-fade-bottom', scrollable && fromEnd > FADE_THRESHOLD_PX);
}

export function DocsNavDropdown({ tree, fallbackLabel }: DocsNavDropdownProps) {
  const pathname = usePathname();

  // The pathname the panel was opened on, or null while closed. The moment
  // the pathname moves on, the render below clears the stored path, so any
  // navigation closes the panel: a row click, a link in the page, search,
  // or back and forward. Clearing it, rather than only comparing, is what
  // keeps a return from reopening it: leave Aurora by a body link and press
  // back, and the stored path is already null rather than Aurora again.
  // Setting state during render when a render input has changed is React's
  // documented pattern for this; React's page names props, but the pattern
  // is about any input, and here it is the pathname the router hook
  // returns. It needs no effect: React discards this render's output and
  // re-renders with the new state before anything reaches the DOM. A row
  // for the current page changes nothing, so rows also close on click.
  const [openedOn, setOpenedOn] = useState<string | null>(null);

  if (openedOn !== null && openedOn !== pathname) setOpenedOn(null);

  const open = openedOn === pathname;
  const close = () => setOpenedOn(null);

  // The element that scrolls, the current page's row inside it, and the box
  // the fades hang off.
  const viewportRef = useRef<HTMLDivElement>(null);
  const currentRowRef = useRef<HTMLAnchorElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  // Everything the panel opens with, settled in one layout effect on `open`
  // so that all of it lands before the opening panel paints a frame. A
  // layout effect works here because Base UI's Panel renders its DOM in the
  // same render that hands it open=true (shouldRender in
  // useCollapsiblePanel.js includes `open`), so by the time this runs the
  // commit has attached every ref. A callback ref on the row would only be
  // needed if the panel mounted a tick later.
  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const body = bodyRef.current;

    if (!open || !viewport || !body) return;

    // Put the current page's row in the middle of the scroll region, the way
    // the sidebar keeps its place. The write goes to the viewport's
    // scrollTop rather than scrollIntoView, which would also scroll the
    // window to bring the row into view; the window must not move. Nothing
    // to do on a page with no row, such as the components index, and on a
    // tree shorter than the cap the viewport clamps the write to zero.
    const row = currentRowRef.current;

    if (row) {
      const rowTop =
        row.getBoundingClientRect().top - viewport.getBoundingClientRect().top + viewport.scrollTop;

      viewport.scrollTop = rowTop - (viewport.clientHeight - row.offsetHeight) / 2;
    }

    // The edges, measured from the scroll position the centring just settled
    // on. The fades carry no transition at this point, because the CSS only
    // gives them one under data-fades-animate, so the panel opens with each
    // edge simply on or off. That gate is the whole trick. A transition does
    // not run on an element's first style computation, but reading layout
    // forces one, and both the row's box above and the scroll metrics inside
    // this call do exactly that before anything is written. So the write
    // below is already the element's second computation, and without the
    // gate it would fade both edges in over the whole open.
    syncFadeEdges(viewport, body);

    // Arm the transition two frames out. One frame is measurably not enough:
    // a callback scheduled from here still runs inside the current frame's
    // rendering steps, so the gate lands in the same style recalculation as
    // the opacity it is meant to exclude and the fade animates anyway. A
    // frame later the opened state is painted and nothing is left to
    // animate, so from here on only scrolling moves them.
    let armFades = requestAnimationFrame(() => {
      armFades = requestAnimationFrame(() => body.setAttribute('data-fades-animate', ''));
    });

    // Keep the edges honest for the rest of the open: scrolling moves the
    // position, and a rotation reflows the rows into a different height.
    // Both run the same measurement, so neither can leave a stale edge.
    const syncEdges = () => syncFadeEdges(viewport, body);
    const resizeObserver = new ResizeObserver(syncEdges);

    viewport.addEventListener('scroll', syncEdges);
    resizeObserver.observe(viewport);

    return () => {
      cancelAnimationFrame(armFades);
      viewport.removeEventListener('scroll', syncEdges);
      resizeObserver.disconnect();
    };
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
            pattern (DemoLayout.tsx). It also carries the three fade
            attributes the layout effect writes, which is why it takes a
            ref. */}
        <div className={styles.body} ref={bodyRef}>
          <ScrollArea
            overlay={
              <>
                <div aria-hidden="true" className={styles.fadeTop} />
                <div aria-hidden="true" className={styles.fadeBottom} />
              </>
            }
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
