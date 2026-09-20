'use client';

/**
 * The site's scroll container: a Base UI Scroll Area that hides the native
 * scrollbar and draws the thin one the control panel introduced, an 8px bar
 * that fades in while the reader scrolls or hovers it and is gone the rest
 * of the time. Every inner scroll region on the site uses it (the docs
 * sidebar, the control panel, code blocks, search results, the guide
 * table of contents), so they all scroll the same way. A region that
 * scrolls behind a height cap can also ask for the edge fades, the 64px
 * gradient over an edge that says there is more past it, and those come
 * from here too, so every capped region reveals the same way. Base UI
 * stamps scroll state on the root as data attributes, which is what the bar
 * and the fades key off.
 */
import type { ReactNode, Ref } from 'react';

import { ScrollArea as BaseScrollArea } from '@base-ui/react/scroll-area';

import styles from './scroll-area.module.css';

interface ScrollAreaProps {
  /** Which way the content scrolls, and so which bar is drawn. Defaults to vertical. */
  orientation?: 'vertical' | 'horizontal';
  /**
   * Class for the root, the box the bar and the fades position against.
   * Also where a consumer sets the fades' custom properties, which
   * scroll-area.module.css lists.
   */
  className?: string;
  /** Class for the viewport, the element that actually scrolls. */
  viewportClassName?: string;
  /** Ref to the viewport, for a consumer that needs to set its scroll position. */
  viewportRef?: Ref<HTMLDivElement>;
  /**
   * Passed through to Base UI: how far from an edge, in px, still counts
   * as reaching it before the root's data-overflow-* attributes clear.
   * A consumer with the fades on matches it to its content's edge padding,
   * so an overflow that clips nothing but padding gets no fade.
   */
  overflowEdgeThreshold?: number | Partial<Record<'xStart' | 'xEnd' | 'yStart' | 'yEnd', number>>;
  /**
   * Draws a fade over each edge that has content past it, for a vertical
   * region behind a height cap. 'both' fades the top and the bottom and
   * 'end' only the bottom, for a region whose top edge something else
   * already covers, both keyed off Base UI's overflow state. 'manual' draws
   * both and leaves the switching to the consumer, through the
   * --scroll-fade-start and --scroll-fade-end properties. Off by default.
   */
  edgeFades?: 'both' | 'end' | 'manual';
  children: ReactNode;
}

export function ScrollArea({
  orientation = 'vertical',
  className,
  viewportClassName,
  viewportRef,
  overflowEdgeThreshold,
  edgeFades,
  children,
}: ScrollAreaProps) {
  return (
    <BaseScrollArea.Root
      className={join(styles.root, className)}
      data-edge-fades={edgeFades}
      overflowEdgeThreshold={overflowEdgeThreshold}
    >
      <BaseScrollArea.Viewport
        className={join(styles.viewport, viewportClassName)}
        ref={viewportRef}
      >
        <BaseScrollArea.Content>{children}</BaseScrollArea.Content>
      </BaseScrollArea.Viewport>
      <BaseScrollArea.Scrollbar
        className={join(styles.scrollbar, styles[orientation])}
        orientation={orientation}
      >
        <BaseScrollArea.Thumb className={styles.thumb} />
      </BaseScrollArea.Scrollbar>
      {/* Inside the root but outside the viewport, so the fades sit over
          the content without scrolling with it. Decorative, so hidden from
          assistive technology. The data attribute is for the browser tests,
          which read each fade's opacity. */}
      {edgeFades !== undefined && edgeFades !== 'end' && (
        <div
          aria-hidden="true"
          className={join(styles.fade, styles.fadeStart)}
          data-scroll-fade="start"
        />
      )}
      {edgeFades !== undefined && (
        <div
          aria-hidden="true"
          className={join(styles.fade, styles.fadeEnd)}
          data-scroll-fade="end"
        />
      )}
    </BaseScrollArea.Root>
  );
}

function join(...classes: Array<string | undefined>) {
  return classes.filter(Boolean).join(' ');
}
