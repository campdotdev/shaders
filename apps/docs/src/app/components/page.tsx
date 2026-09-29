/**
 * The components index at /components, after the Figma mock: every component
 * as a card under its category heading, in the order the sidebar lists them.
 * A card shows a thumbnail cut from the component's poster, the catalog label,
 * and the description cut to two lines, and links to the component's page.
 * Everything comes from the catalog's taxonomy tree (content/catalog.ts), so a
 * new component gets a card with no edit to this file.
 */
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { useId } from 'react';

import { Breadcrumbs } from '@/components/breadcrumbs/breadcrumbs';
import visuallyHiddenStyles from '@/components/visually-hidden/visually-hidden.module.css';
import { type ComponentCatalogRecord, getComponentsTree } from '@/content/catalog';
import { DOCS_TRAIL_ROOT } from '@/content/nav';
import type { TaxonomyGroup } from '@/content/taxonomy';
import type { DocsBreadcrumb } from '@/content/types';

import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'Components',
  description: 'Tier 1 shader components, imported from @camp-dev/shaders and tuned through props.',
};

const crumbs: DocsBreadcrumb[] = [...DOCS_TRAIL_ROOT, { label: 'Components', url: '/components' }];

// The card's thumbnail edge in CSS pixels, the square the mock draws inside
// the card's padding. scripts/build-thumbnail.mjs writes the file at twice
// this, for a 2x screen.
const THUMBNAIL_SIZE = 62;

export default async function ComponentsIndex() {
  // The sidebar shows the category groups without the Sources and Effects
  // tiers above them (getDocsSidebarTree in content/nav.ts), so the index
  // drops the tiers too and the two list the same groups in the same order.
  const groups = (await getComponentsTree()).flatMap((tier) => tier.groups);

  return (
    <article>
      <Breadcrumbs className={styles.breadcrumbs} crumbs={crumbs} />
      {/* The section banner prints "Components" as a paragraph, because it
          also sits over every component page, where the component's name is
          the h1. This gives the index its h1 without a second visible title. */}
      <h1 className={visuallyHiddenStyles.srOnly}>Components</h1>
      {/* Out of the search index, like the docs home's list: every card
          repeats the name and description its component page is already
          indexed under, so the index would turn up in every search for a
          component beside the component itself. */}
      <div data-pagefind-ignore="all">
        {groups.map((group) => (
          <CategorySection group={group} key={group.slug} />
        ))}
      </div>
    </article>
  );
}

// One category as a heading over its grid of cards. The heading's id labels
// the list, as in the sidebar (nav-tree/), so a screen reader says
// "Gradients, list, 4 items".
function CategorySection({ group }: { group: TaxonomyGroup<ComponentCatalogRecord> }) {
  const headingId = useId();

  return (
    <section className={styles.category}>
      <h2 className={styles.categoryTitle} id={headingId}>
        {group.label}
      </h2>
      <ul aria-labelledby={headingId} className={styles.grid}>
        {group.items.map((record) => (
          <li key={record.url}>
            <ComponentCard record={record} />
          </li>
        ))}
      </ul>
    </section>
  );
}

// The whole card is the link. Its name is the label alone and the
// description is attached as the link's description, so a screen reader
// says "Conic Gradient, link" and then the description, rather than one
// run-on name. The thumbnail repeats the label in pictures, so its alt is
// empty. The description is cut to two lines by CSS only, so a screen
// reader still hears all of it.
function ComponentCard({ record }: { record: ComponentCatalogRecord }) {
  const id = useId();
  const labelId = `${id}-label`;
  const descriptionId = `${id}-description`;

  return (
    <Link
      aria-describedby={descriptionId}
      aria-labelledby={labelId}
      className={styles.card}
      href={record.url}
    >
      <Image
        alt=""
        className={styles.thumbnail}
        height={THUMBNAIL_SIZE}
        src={record.thumbnail}
        width={THUMBNAIL_SIZE}
      />
      <span className={styles.text}>
        <span className={styles.label} id={labelId}>
          {record.label}
        </span>
        <span className={styles.description} id={descriptionId}>
          {record.description}
        </span>
      </span>
    </Link>
  );
}
