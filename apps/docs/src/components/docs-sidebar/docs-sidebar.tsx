'use client';

/**
 * The docs sidebar after the Figma mock: tier headers over group headers
 * over rows, with the current page's row highlighted in lime. It renders
 * whatever tree the docs shell hands it, so on a component page the top
 * level is the taxonomy tiers and on a guide it is the section's groups.
 * A client component only because the active row comes from the pathname.
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import type { ResolvedNavGroup, ResolvedNavItem } from '@/content/types';

import styles from './docs-sidebar.module.css';

export function DocsSidebar({ tree }: { tree: ResolvedNavGroup[] }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Docs" className={styles.sidebar} data-pagefind-ignore="all">
      {tree.map((group) => (
        <Tier group={group} key={group.label} pathname={pathname} />
      ))}
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
            <Link
              aria-current={item.url === pathname ? 'page' : undefined}
              className={styles.row}
              href={item.url}
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
