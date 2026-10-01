/**
 * The homepage's favorites, after the Figma mock: the section heading in the
 * grid's first cell, then one card per favorite, each the component's poster
 * linking to its page. The list and its order come from content/homepage.ts.
 * The cards are still pictures for now. The hover that brings a favorite's
 * scene to life and cuts in its card tab comes in later tickets.
 */
import Image from 'next/image';
import Link from 'next/link';
import { useId } from 'react';

import type { ComponentCatalogRecord } from '@/content/catalog';

import styles from './favorites.module.css';

// The width each poster renders at, per the grid's columns in
// favorites.module.css, so next/image picks a file no larger than it needs.
const POSTER_SIZES = '(width < 40rem) 100vw, (width < 64rem) 50vw, 25vw';

export function Favorites({ records }: { records: ComponentCatalogRecord[] }) {
  const headingId = useId();

  return (
    // Out of the search index, like the components index: each card only
    // repeats a name its component page is already indexed under.
    <section className={`site-gutter ${styles.section}`} data-pagefind-ignore="all">
      <div className={`site-container ${styles.grid}`}>
        <h2 className={styles.heading} id={headingId}>
          Start with one of our favorites
        </h2>
        <ul aria-labelledby={headingId} className={styles.list}>
          {records.map((record) => (
            <li key={record.url}>
              <FavoriteCard record={record} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// The whole card is the link, and the poster's alt is the component's label,
// so the link's name is the label and a screen reader says "Simplex Noise,
// link".
function FavoriteCard({ record }: { record: ComponentCatalogRecord }) {
  return (
    <Link className={styles.card} href={record.url}>
      <span className={styles.poster}>
        <Image alt={record.label} fill sizes={POSTER_SIZES} src={record.poster} />
      </span>
    </Link>
  );
}
