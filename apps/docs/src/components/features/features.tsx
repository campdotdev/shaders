/**
 * The homepage's features section, after the Figma mock: the heading over
 * four feature cards, each an illustration above its title and description,
 * in the order content/homepage.ts lists them. Each illustration is a static
 * image exported from the mock until its card's own issue rebuilds it in code
 * and gives the card its story. Nothing here moves, links, or takes focus.
 */
import Image from 'next/image';
import { useId } from 'react';

import { FEATURE_CARDS } from '@/content/homepage';

import styles from './features.module.css';

// The illustration's size in the mock, in CSS pixels. The exported files are
// twice this. The attributes give the image its shape before it loads, and
// features.module.css scales it to the card's width.
const ILLUSTRATION_WIDTH = 312;
const ILLUSTRATION_HEIGHT = 309;

export function Features() {
  const headingId = useId();

  return (
    // Out of the search index, like the favorites: the cards sell the
    // library rather than document it.
    <section className={`site-gutter ${styles.section}`} data-pagefind-ignore="all">
      <div className={styles.container}>
        <h2 className={styles.heading} id={headingId}>
          We’ll handle the complex stuff
        </h2>
        <ul aria-labelledby={headingId} className={styles.grid}>
          {FEATURE_CARDS.map((card) => (
            <li className={styles.card} key={card.title}>
              <div className={styles.window}>
                {/* Decoration: the title and description carry the card's
                    message, so screen readers skip the picture. */}
                <Image
                  alt=""
                  aria-hidden
                  className={styles.illustration}
                  height={ILLUSTRATION_HEIGHT}
                  src={card.illustration}
                  width={ILLUSTRATION_WIDTH}
                />
              </div>
              <div className={styles.text}>
                <h3 className={styles.title}>{card.title}</h3>
                <p className={styles.description}>{card.description}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
