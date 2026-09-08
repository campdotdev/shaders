'use client';

/**
 * The docs sidebar after the Figma mock: tier headers over group headers
 * over rows, with the current page's row highlighted in lime. It renders
 * whatever tree the docs shell hands it, so on a component page the top
 * level is the taxonomy tiers and on a guide it is the section's groups.
 * A client component because the active row comes from the pathname and
 * because a row click has to pin the sidebar before the page changes.
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type MouseEvent, useRef } from 'react';

import { ScrollArea } from '@/components/scroll-area/scroll-area';
import type { ResolvedNavGroup, ResolvedNavItem } from '@/content/types';

import styles from './docs-sidebar.module.css';

export function DocsSidebar({ tree }: { tree: ResolvedNavGroup[] }) {
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);

  // The sidebar is sticky under a header and banner that scroll away, so a
  // reader reaches its lower groups by scrolling the window until the nav
  // pins at the top of the viewport. Next's default scroll-to-top on
  // navigation would then drop the nav back under the banner and push those
  // groups below the fold again (SHA-130). So the rows opt out of that
  // scroll, and this handler, which runs on the old page before the router
  // swaps in the new one, brings the window up to the point where the nav
  // pins. A reader who was past the banner lands with the sidebar exactly
  // where it was and the new page's breadcrumbs at the top; a reader who was
  // not sees nothing move. Doing it here rather than after the route changes
  // leaves back and forward to the browser's own scroll restoration.
  function pinSidebar(event: MouseEvent<HTMLElement>) {
    const isPlainRowClick =
      event.button === 0 &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.shiftKey &&
      !event.altKey &&
      event.target instanceof Element &&
      event.target.closest('a') !== null;
    const shell = navRef.current?.parentElement;

    if (!isPlainRowClick || !shell) return;

    const shellTop = shell.getBoundingClientRect().top + window.scrollY;

    if (window.scrollY > shellTop) window.scrollTo({ top: shellTop, behavior: 'instant' });
  }

  return (
    <nav
      aria-label="Docs"
      className={styles.sidebar}
      data-pagefind-ignore="all"
      onClick={pinSidebar}
      ref={navRef}
    >
      <ScrollArea>
        <div className={styles.tree}>
          {tree.map((group) => (
            <Tier group={group} key={group.label} pathname={pathname} />
          ))}
        </div>
      </ScrollArea>
    </nav>
  );
}

// A top-level group: the mock's "category", a 16px header over its groups.
// A tier whose items are rows rather than groups, such as Guides on the
// MDX pages, renders those rows directly under its header.
function Tier({ group, pathname }: { group: ResolvedNavGroup; pathname: string }) {
  return (
    <section className={styles.tier}>
      <h2 className={styles.tierHeader}>{group.label}</h2>
      <div className={styles.groups}>
        <Items items={group.items} pathname={pathname} />
      </div>
    </section>
  );
}

// A nested group: the mock's "group", a 14px header over its rows.
function Group({ group, pathname }: { group: ResolvedNavGroup; pathname: string }) {
  return (
    <section className={styles.group}>
      <h3 className={styles.groupHeader}>{group.label}</h3>
      <Items items={group.items} pathname={pathname} />
    </section>
  );
}

// Consecutive rows share one list so their 2px gap is the list's, and a
// group between them breaks the list rather than nesting inside it.
function Items({
  items,
  pathname,
}: {
  items: Array<ResolvedNavGroup | ResolvedNavItem>;
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
      <ul className={styles.list} key={block[0]?.url}>
        {block.map((item) => (
          <li key={item.url}>
            {/* scroll={false} keeps the window where pinSidebar put it; see
                the handler on the nav. */}
            <Link
              aria-current={item.url === pathname ? 'page' : undefined}
              className={styles.row}
              href={item.url}
              scroll={false}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    ) : (
      <Group group={block} key={block.label} pathname={pathname} />
    ),
  );
}
