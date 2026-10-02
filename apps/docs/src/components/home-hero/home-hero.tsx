'use client';

/**
 * The homepage's hero: Aurora's live scene in a full-width frame, after the
 * Figma mock. It renders the same scene module and poster as Aurora's
 * component page (app/components/aurora/), at Aurora's initial params, so the
 * hero cannot drift from the demo. The poster is in the server's HTML and
 * gives way to the scene on its first frame, or stays when WebGPU is missing.
 * A client component only because next/dynamic's `ssr: false` must be called
 * from one (the SSR gotcha in docs/agents/docs-site.md).
 */
import dynamic from 'next/dynamic';

import auroraStyles from '@/app/components/aurora/demo.module.css';
import { DemoPoster } from '@/components/DemoPoster';

import styles from './home-hero.module.css';

const AuroraScene = dynamic(() => import('@/app/components/aurora/scene'), { ssr: false });

export function HomeHero() {
  return (
    <div className={styles.frame}>
      {/* Aurora draws over a transparent ground, so the scene sits on the
          same dusk backdrop as on its own page. The poster's alt is empty
          because the hero is decoration: the heading above says what the
          library is, and the live canvas that replaces the poster has no
          text either. */}
      <div className={`${styles.scene} ${auroraStyles.demoBackdrop}`} data-home-hero>
        {/* Capped at one canvas pixel per CSS pixel. Aurora marches 60
            steps per pixel, and at the full 2x of a retina screen the
            full-width hero is 4.5 million pixels, which pinned an M1 Max's
            GPU and halved the frame rate. At 1x it is a quarter of that,
            and the soft curtains lose little from the upscale. */}
        <DemoPoster alt="" src="/posters/aurora.jpg">
          <AuroraScene maxDPR={1} />
        </DemoPoster>
      </div>
    </div>
  );
}
