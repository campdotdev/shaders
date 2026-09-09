'use client';

/**
 * The two-column frame every component demo page uses: shader on the left in
 * a column capped at 4xl, controls on the right in a sticky 2xs column that
 * scrolls on its own once the panel outgrows the shader, and stacks below
 * the shader under 1024px. The column is the site's shared ScrollArea, and a
 * fade over the column's bottom edge says there are more controls below,
 * keyed off the overflow state Base UI stamps on the scroll area's root, so
 * there is no measuring here. The shader child keeps its own
 * [data-shader-demo] wrapper, which is what the Playwright visual suite
 * sizes against.
 */
import type { ReactNode } from 'react';

import { ScrollArea } from '@/components/scroll-area/scroll-area';

import styles from './demo-layout.module.css';

// How much of the panel can hang below the column, in px, before Base UI
// reports the end as unreached and the fade appears. Matches the panel's
// bottom padding: an overflow that small clips nothing but padding, so the
// last row is fully visible and a fade over it would only hide it. Without
// the margin, a panel that outgrows the cap by a fraction of a pixel (Aurora
// at the 4xl stage overflows by 0.67px) keeps the fade on for good, because
// Base UI resolves a scroll range of 1px or less toward the start and a
// Retina display snaps the offset to half a pixel, so the end never
// registers. Whole scroll extents are what the reveal is for.
const FADE_THRESHOLD_PX = 16;

export function DemoLayout({ controls, children }: { controls: ReactNode; children: ReactNode }) {
  return (
    <div className={styles.layout}>
      <div>{children}</div>
      <aside className={styles.controls}>
        <ScrollArea
          className={styles.scroller}
          overflowEdgeThreshold={{ yEnd: FADE_THRESHOLD_PX }}
          overlay={<div aria-hidden="true" className={styles.fade} />}
          viewportClassName={styles.viewport}
        >
          {controls}
        </ScrollArea>
      </aside>
    </div>
  );
}
