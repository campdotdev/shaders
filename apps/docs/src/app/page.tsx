/**
 * The homepage, after the Figma mock: the heading, description, and Get
 * started button, then the live Aurora hero, the favorites grid, and the
 * footer, which no other page renders. With no sidebar or section banner, it
 * renders straight into the root layout. Its motion comes in later tickets.
 */
import Link from 'next/link';

import { Favorites } from '@/components/favorites/favorites';
import { HomeFooter } from '@/components/home-footer/home-footer';
import { HomeHero } from '@/components/home-hero/home-hero';
import { ChevronDownIcon } from '@/components/icons/chevron-down';
import textButtonStyles from '@/components/text-button/text-button.module.css';
import { getFavorites } from '@/content/homepage';

import styles from './page.module.css';

export default async function Home() {
  const favorites = await getFavorites();

  return (
    <>
      <section className={`site-gutter ${styles.intro}`}>
        <div className={styles.introRow}>
          <h1 className={styles.title}>Shader components for the modern web</h1>
          <div className={styles.lede}>
            <p className={styles.description}>
              A growing library for React, written in TSL and rendered with WebGPU.
            </p>
            <Link
              className={`${textButtonStyles.box} ${textButtonStyles.button} ${styles.getStarted}`}
              href="/getting-started"
            >
              Get started
              <ChevronDownIcon className={styles.chevron} />
            </Link>
          </div>
        </div>
      </section>
      <section className={`site-gutter ${styles.hero}`}>
        <div className="site-container">
          <HomeHero />
        </div>
      </section>
      <Favorites records={favorites} />
      <HomeFooter />
    </>
  );
}
