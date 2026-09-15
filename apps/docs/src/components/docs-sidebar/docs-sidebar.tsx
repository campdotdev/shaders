'use client';

/**
 * The docs sidebar after the Figma mock: group headers over rows, with the
 * current page's row highlighted in lime. It renders whatever tree the docs
 * shell hands it: on a component page the top level is the taxonomy's
 * category groups, and on a guide it is the section's groups, which may
 * nest one level (Frameworks holds React). One Group component draws both
 * levels, and whether the tree nests at all reaches the stylesheet as a data
 * attribute, since the size of the top header is all the two sidebars differ
 * by. A client component because the active row comes from the pathname and
 * because a row click has to pin the sidebar before the page changes.
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type MouseEvent, useId, useRef } from 'react';

import { ScrollArea } from '@/components/scroll-area/scroll-area';
import type { ResolvedNavGroup, ResolvedNavItem } from '@/content/types';

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
function Group({ group, level, onRowClick, pathname }: GroupProps) {
  const headingId = useId();
  const Heading = level === 2 ? 'h2' : 'h3';

  return (
    <div className={styles.group}>
      <Heading className={styles.groupHeader} id={headingId}>
        {group.label}
      </Heading>
      <Items
        headingId={headingId}
        items={group.items}
        onRowClick={onRowClick}
        pathname={pathname}
      />
    </div>
  );
}

// Consecutive rows share one list so their 2px gap is the list's, and a
// group between them breaks the list rather than nesting inside it.
function Items({
  headingId,
  items,
  onRowClick,
  pathname,
}: {
  /** The id of the header above these items, which labels each list. */
  headingId: string;
  items: Array<ResolvedNavGroup | ResolvedNavItem>;
  onRowClick: RowClickHandler;
  pathname: string;
}) {
  const blocks: Array<ResolvedNavGroup | ResolvedNavItem[]> = [];

  for (const item of items) {
    const last = blocks[blocks.length - 1];

    if ('items' in item) blocks.push(item);
    else if (Array.isArray(last)) last.push(item);
    else blocks.push([item]);
  }

  return blocks.map((block) =>
    Array.isArray(block) ? (
      <ul aria-labelledby={headingId} className={styles.list} key={block[0]?.url}>
        {block.map((item) => (
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
        ))}
      </ul>
    ) : (
      // A nested group's header is an h3. No tree nests deeper than this:
      // the components tree is flat and the only nesting in nav.config.ts is
      // Frameworks over React.
      <Group
        group={block}
        key={block.label}
        level={3}
        onRowClick={onRowClick}
        pathname={pathname}
      />
    ),
  );
}
