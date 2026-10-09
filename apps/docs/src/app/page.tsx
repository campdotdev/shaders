/**
 * The homepage, after the Figma mock: the heading, description, and Get
 * started button, then the live Aurora hero that turns into Aurora's demo on
 * scroll, the favorites grid, the features section, and the footer, which no
 * other page renders. With no sidebar or section banner, it renders straight
 * into the root layout.
 */
import Link from 'next/link';

import { Favorites } from '@/components/favorites/favorites';
import { Features } from '@/components/features/features';
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
              A growing library for React, written in Three.js Shading Language and rendered with
              WebGPU.
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
      {/* The rest of the page rides in the hero's pin, so the favorites
          sit against it while it turns into Aurora's demo, and the pin
          always reaches past the viewport's bottom. */}
      <HomeHero>
        <Favorites favorites={favorites} />
        <Features />
        <HomeFooter />
      </HomeHero>
    </>
  );
}
