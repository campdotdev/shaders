/**
 * The docs home at /docs, where the header's Docs link and every
 * Documentation breadcrumb lead. It has no design yet, so it lists the docs
 * sections as the nav config resolves them (getDocsHomeSections in
 * content/nav.ts). The sidebar beside it reads the same config, so a page
 * added there shows up here with no edit to this file.
 */
import type { Metadata } from 'next';
import Link from 'next/link';

import { Breadcrumbs } from '@/components/breadcrumbs/breadcrumbs';
import { DOCS_TRAIL_ROOT, getDocsHomeSections } from '@/content/nav';
import type { ResolvedNavGroup } from '@/content/types';

import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'Documentation',
  description: 'Every page in the Shaders docs, grouped by section.',
};

export default async function DocsHome() {
  const sections = await getDocsHomeSections();

  return (
    <article className="prose">
      {/* The trail ends on this page, so Documentation is the current crumb
          rather than a link. */}
      <Breadcrumbs className={styles.breadcrumbs} crumbs={DOCS_TRAIL_ROOT} />
      <h1>Documentation</h1>
      <p>Every page in the docs, grouped by section.</p>
      {/* Out of the search index, like the sidebar: the list is every page
          title in the docs, so indexing it would add this page to the
          results for any query that names one. */}
      <div data-pagefind-ignore="all">
        {sections.map((section) => (
          <DocsSection group={section} key={section.label} level={2} />
        ))}
      </div>
    </article>
  );
}

// One nav group as a heading over a list. A nested group, such as React
// under Frameworks, is an item of its parent's list with its own h3, the
// same shape the sidebar draws (nav-tree/), so the list keeps the config's
// order and its hierarchy.
function DocsSection({ group, level }: { group: ResolvedNavGroup; level: 2 | 3 }) {
  const Heading = level === 2 ? 'h2' : 'h3';

  return (
    <section className={styles.section}>
      <Heading>{group.label}</Heading>
      <ul className={styles.list}>
        {group.items.map((item) =>
          'items' in item ? (
            <li key={item.label}>
              <DocsSection group={item} level={3} />
            </li>
          ) : (
            <li key={item.url}>
              <Link href={item.url}>{item.label}</Link>
            </li>
          ),
        )}
      </ul>
    </section>
  );
}
