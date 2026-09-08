'use client';

/**
 * The site's scroll container: a Base UI Scroll Area that hides the native
 * scrollbar and draws the thin one the control panel introduced, an 8px bar
 * that fades in while the reader scrolls or hovers it and is gone the rest
 * of the time. Every inner scroll region on the site uses it (the docs
 * sidebar, the control panel, code blocks, search results, the guide
 * table of contents), so they all scroll the same way. Base UI stamps
 * scroll state on the root as data attributes, which is what the fade and
 * any overlay a consumer adds key off.
 */
import type { ReactNode } from 'react';

import { ScrollArea as BaseScrollArea } from '@base-ui/react/scroll-area';

import styles from './scroll-area.module.css';

interface ScrollAreaProps {
  /** Which way the content scrolls, and so which bar is drawn. Defaults to vertical. */
  orientation?: 'vertical' | 'horizontal';
  /** Class for the root, the box the bar and any overlay position against. */
  className?: string;
  /** Class for the viewport, the element that actually scrolls. */
  viewportClassName?: string;
  /**
   * Passed through to Base UI: how far from an edge, in px, still counts
   * as reaching it before the root's data-overflow-* attributes clear.
   */
  overflowEdgeThreshold?: number | Partial<Record<'xStart' | 'xEnd' | 'yStart' | 'yEnd', number>>;
  /**
   * Drawn inside the root but outside the viewport, so it sits over the
   * content without scrolling with it. The control panel's bottom fade.
   */
  overlay?: ReactNode;
  children: ReactNode;
}

export function ScrollArea({
  orientation = 'vertical',
  className,
  viewportClassName,
  overflowEdgeThreshold,
  overlay,
  children,
}: ScrollAreaProps) {
  return (
    <BaseScrollArea.Root
      className={join(styles.root, className)}
      overflowEdgeThreshold={overflowEdgeThreshold}
    >
      <BaseScrollArea.Viewport className={join(styles.viewport, viewportClassName)}>
        <BaseScrollArea.Content>{children}</BaseScrollArea.Content>
      </BaseScrollArea.Viewport>
      <BaseScrollArea.Scrollbar
        className={join(styles.scrollbar, styles[orientation])}
        orientation={orientation}
      >
        <BaseScrollArea.Thumb className={styles.thumb} />
      </BaseScrollArea.Scrollbar>
      {overlay}
    </BaseScrollArea.Root>
  );
}

function join(...classes: Array<string | undefined>) {
  return classes.filter(Boolean).join(' ');
}
