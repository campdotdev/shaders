/**
 * The homepage's features section, after the Figma mock: the heading over
 * four feature cards, each an illustration above its title and description,
 * in the order content/homepage.ts lists them. Extensible's illustration is
 * built in code (extensible-illustration.tsx). The others are static images
 * exported from the mock until each card's own issue rebuilds its
 * illustration in code and gives the card its story. Nothing here links or
 * takes focus.
 */
import Image from 'next/image';
import { type ReactNode, useId } from 'react';

import { FEATURE_CARDS, type FeatureCardId } from '@/content/homepage';

import { ExtensibleIllustration } from './extensible-illustration';
import styles from './features.module.css';

// The illustration's size in the mock, in CSS pixels. The exported files are
// twice this. The attributes give the image its shape before it loads, and
// features.module.css scales it to the card's width.
const ILLUSTRATION_WIDTH = 312;
const ILLUSTRATION_HEIGHT = 309;

// An illustration exported from the mock at 2x into public/features.
// Decoration: the title and description carry the card's message, so screen
// readers skip the picture.
function StaticIllustration({ src }: { src: string }) {
  return (
    <Image
      alt=""
      aria-hidden
      className={styles.illustration}
      height={ILLUSTRATION_HEIGHT}
      src={src}
      width={ILLUSTRATION_WIDTH}
    />
  );
}

// Each card's illustration. A complete record, so a card with no
// illustration fails the type check.
const ILLUSTRATIONS: Record<FeatureCardId, ReactNode> = {
  composable: <StaticIllustration src="/features/composable.png" />,
  performant: <StaticIllustration src="/features/performant.png" />,
  reactive: <StaticIllustration src="/features/reactive.png" />,
  extensible: <ExtensibleIllustration />,
};

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
            <li className={styles.card} key={card.id}>
              <div className={styles.window}>{ILLUSTRATIONS[card.id]}</div>
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
