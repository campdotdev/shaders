'use client';

/**
 * The docs sidebar after the Figma mock: group headers over rows, with the
 * current page's row highlighted in lime. It renders whatever tree the docs
 * shell hands it: on a component page the top level is the taxonomy's
 * category groups, and on a guide it is the section's groups, which may
 * nest one level (Frameworks holds React). One Group component draws both
 * levels, and whether the tree nests at all reaches the stylesheet as a data
 * attribute, which keys the top header's size off it and nothing else. A
 * client component because the active row comes from the pathname, because
 * a row click has to pin the sidebar before the page changes, and because
 * the sticky box's cap is a measurement: how far the nav sits below the
 * viewport's top, taken on every scroll and resize.
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type MouseEvent, useEffect, useId, useRef } from 'react';

import { ScrollArea } from '@/components/scroll-area/scroll-area';
import type { ResolvedNavGroup } from '@/content/types';

import styles from './docs-sidebar.module.css';

type RowClickHandler = (event: MouseEvent<HTMLAnchorElement>) => void;

interface GroupProps {
  group: ResolvedNavGroup;
  /** Which heading this group's label is: h2 at the top, h3 inside a group. */
  level: 2 | 3;
  /** Every row's click handler, the sidebar pin. */
  onRowClick: RowClickHandler;
  pathname: string;
}

export function DocsSidebar({ tree }: { tree: ResolvedNavGroup[] }) {
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);

  // A tree that nests takes a larger top-level header than a flat one, so
  // that a parent reads as the parent of the groups under it. The components
  // tree is flat and the MDX docs tree nests, but the sidebar checks the
  // tree rather than the section, so the docs shell never has to hand down a
  // look. nav.test.ts pins both halves of that at the data level.
  const nests = tree.some((group) => group.items.some((item) => 'items' in item));

  // The nav is sticky under a header and banner that scroll away, so until
  // it pins its top sits some way down the viewport, and a 100vh box would
  // hang that far below the fold. The scroll viewport is contained (see the
  // stylesheet), so the page never scrolls to pin the nav while the wheel is
  // over the tree, and that hidden tail would be unreachable. This measures
  // the distance from the viewport's top to the nav's on every scroll and
  // resize and hands it to the cap, so the box always ends at the fold: 200px
  // short of 100vh at the top of a component page, exactly 100vh once
  // pinned. The window scroll pinSidebar makes fires this too. One effect
  // owns add and remove, so Strict Mode's double mount is safe.
  useEffect(() => {
    const nav = navRef.current;

    if (!nav) return;

    // An expression rather than a declaration: a declaration hoists above
    // the null check, so TypeScript would not carry the narrowing into it.
    const measureOffset = () => {
      // Under 48rem of the site the sidebar is display: none and the
      // dropdown in main carries the tree instead, but this component still
      // mounts and this listener still runs. The cap means nothing while
      // the box is off screen, so a hidden sidebar does none of the work
      // below: the write invalidates style on the nav, and the next scroll
      // event's getBoundingClientRect has to flush that style back out, so
      // a phone pays for the pair through a whole momentum scroll to set a
      // custom property no rule is reading. offsetParent is the test
      // because on an element like this one it is null exactly when
      // display: none applies, to it or to an ancestor. It cannot misfire
      // on a rendered sidebar: the other way to null it is position: fixed,
      // and .sidebar is sticky (docs-sidebar.module.css), which keeps a
      // normal offsetParent. Coming back into range is a resize, and that
      // listener measures again in the same frame, so the cap is right
      // before the box paints.
      if (nav.offsetParent === null) return;

      const offset = Math.max(0, nav.getBoundingClientRect().top);

      nav.style.setProperty('--sidebar-offset', `${offset}px`);
    };

    measureOffset();
    window.addEventListener('scroll', measureOffset, { passive: true });
    window.addEventListener('resize', measureOffset);

    return () => {
      window.removeEventListener('scroll', measureOffset);
      window.removeEventListener('resize', measureOffset);
      nav.style.removeProperty('--sidebar-offset');
    };
  }, []);

  // The sidebar is sticky under a header and banner that scroll away, so a
  // reader reaches its lower groups by scrolling the window until the nav
  // pins at the top of the viewport. Next's default scroll-to-top on
  // navigation would then drop the nav back under the banner and push those
  // groups below the fold again (SHA-130). So the rows opt out of that
  // scroll, and this handler, which every row runs on the old page before
  // the router swaps in the new one, brings the window up to the point where
  // the nav pins. A reader who was past the banner lands with the sidebar
  // exactly where it was and the new page's breadcrumbs at the top; a reader
  // who was not sees nothing move. Doing it here rather than after the route
  // changes leaves back and forward to the browser's own scroll restoration.
  // A modifier-key click opens a new tab and leaves this page alone. Enter
  // on a focused row fires a click event too, so a keyboard reader gets the
  // same pin.
  function pinSidebar(event: MouseEvent<HTMLAnchorElement>) {
    const opensHere =
      event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
    const shell = navRef.current?.parentElement;

    if (!opensHere || !shell) return;

    const shellTop = shell.getBoundingClientRect().top + window.scrollY;

    if (window.scrollY > shellTop) window.scrollTo({ top: shellTop, behavior: 'instant' });
  }

  return (
    <nav aria-label="Docs" className={styles.sidebar} data-pagefind-ignore="all" ref={navRef}>
      <ScrollArea viewportClassName={styles.viewport}>
        <div className={styles.tree} data-nests={nests || undefined}>
          {tree.map((group) => (
            <Group
              group={group}
              key={group.label}
              level={2}
              onRowClick={pinSidebar}
              pathname={pathname}
            />
          ))}
        </div>
      </ScrollArea>
    </nav>
  );
}

// The mock's "group" at either depth: a header over its rows, over its
// nested groups, or over both. A plain div rather than a section, because
// section is for content that belongs in the document's outline and this is
// a grouping of links inside a nav; seven of them would also become seven
// landmarks the day one gained a label. The heading stays, so heading
// navigation still steps through the nav, and its id labels the list below
// it: a screen reader then says "Gradients, list, 4 items" rather than
// reading an unlabelled list.
//
// One list holds everything the group contains, rows and nested groups
// alike, so a nested group is an item of its parent's list rather than a
// sibling of it and the Frameworks-over-React hierarchy reaches assistive
// technology as a hierarchy. The 2px pitch between items is that one list's
// gap, whichever kind of item sits either side of it. Mirrors
// DocsNavDropdown, which draws the same tree.
function Group({ group, level, onRowClick, pathname }: GroupProps) {
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
            // A nested group's header is an h3. No tree nests deeper than
            // this: the components tree is flat and the only nesting in
            // nav.config.ts is Frameworks over React.
            <li key={item.label}>
              <Group group={item} level={3} onRowClick={onRowClick} pathname={pathname} />
            </li>
          ) : (
            <li key={item.url}>
              {/* scroll={false} keeps the window where pinSidebar put it. */}
              <Link
                aria-current={item.url === pathname ? 'page' : undefined}
                className={styles.row}
                href={item.url}
                onClick={onRowClick}
                scroll={false}
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
