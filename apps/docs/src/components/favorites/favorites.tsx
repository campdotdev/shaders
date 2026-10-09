/**
 * The homepage's favorites, after the Figma mock: the section heading in the
 * grid's first cell, then one card per favorite, its poster linking to its
 * page, in the order content/homepage.ts lists them. The cards and their
 * hover are in favorites-list.tsx, the card tab in card-tab.tsx, and the
 * grid's entrance in favorites-reveal.tsx.
 */
import { useId } from 'react';

import type { Favorite } from '@/content/homepage';

import { FavoritesList } from './favorites-list';
import { FavoritesReveal } from './favorites-reveal';
import styles from './favorites.module.css';

export function Favorites({ favorites }: { favorites: Favorite[] }) {
  const headingId = useId();

  return (
    // Out of the search index, like the components index: each card only
    // repeats a name its component page is already indexed under.
    <section className={`site-gutter ${styles.section}`} data-pagefind-ignore="all">
      <FavoritesReveal className={styles.grid}>
        <h2 className={styles.heading} id={headingId}>
          Add some fun to your website
        </h2>
        <FavoritesList favorites={favorites} labelledBy={headingId} />
      </FavoritesReveal>
    </section>
  );
}
