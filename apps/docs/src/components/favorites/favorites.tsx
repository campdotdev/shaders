/**
 * The homepage's favorites, after the Figma mock: the section heading in the
 * grid's first cell, then one card per favorite, its poster linking to its
 * page, in the order content/homepage.ts lists them. The cards and the hover
 * that brings a favorite's scene to life are in favorites-list.tsx. The card
 * tab that cuts in on hover comes in a later ticket.
 */
import { useId } from 'react';

import type { Favorite } from '@/content/homepage';

import { FavoritesList } from './favorites-list';
import styles from './favorites.module.css';

export function Favorites({ favorites }: { favorites: Favorite[] }) {
  const headingId = useId();

  return (
    // Out of the search index, like the components index: each card only
    // repeats a name its component page is already indexed under.
    <section className={`site-gutter ${styles.section}`} data-pagefind-ignore="all">
      <div className={`site-container ${styles.grid}`}>
        <h2 className={styles.heading} id={headingId}>
          Start with one of our favorites
        </h2>
        <FavoritesList favorites={favorites} labelledBy={headingId} />
      </div>
    </section>
  );
}
