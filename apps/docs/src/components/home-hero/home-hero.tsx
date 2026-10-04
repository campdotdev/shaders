'use client';

/**
 * The homepage's hero, which turns into Aurora's demo as the visitor scrolls.
 * A track holds a sticky pin and, under it, an empty spacer. The pin holds
 * the hero and the rest of the page after it (the favorites and the footer,
 * passed as children), and it stays stuck while the spacer scrolls under
 * it, so the favorites sit against the demo the whole time, with no empty
 * space between. From the top of the page to the pin releasing, scroll
 * progress morphs the hero's framed scene into the demo's 3:2 scene with
 * the control panel beside it. geometry.ts holds the numbers, and this file
 * feeds them into motion values. Before any script runs, CSS lays out
 * the hero alone, which is the change at progress 0, so hydration moves
 * nothing. The demo has a store of its own (AuroraControlsProvider), so
 * every load starts from Aurora's defaults.
 */
import {
  type CSSProperties,
  type FocusEvent,
  type ReactNode,
  type RefObject,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

// `m` under LazyMotion rather than `motion`: these elements only bind
// motion values to style, so they need the DOM renderer that domMin carries
// and none of the gesture and layout features `motion` bundles.
import {
  domMin,
  LazyMotion,
  m,
  type MotionValue,
  useMotionValue,
  useMotionValueEvent,
  useScroll,
} from 'motion/react';

import {
  AuroraControls,
  AuroraControlsProvider,
  LiveAuroraScene,
} from '@/app/components/aurora/demo';
import auroraStyles from '@/app/components/aurora/demo.module.css';
import { HERO_POSTER_SRC } from '@/app/components/aurora/params';
import { ControlsScroller } from '@/components/controls';
import { DemoPoster } from '@/components/DemoPoster';

import { computeLayout, type Layout, type Measure, SCRUB_DISTANCE_VH, scrubAt } from './geometry';
import { HeroProgressContext } from './hero-progress';
import styles from './home-hero.module.css';

type SpacerStyle = CSSProperties & { '--scrub-distance': string };

// The spacer's height, the scroll the pin holds for.
const SPACER_STYLE: SpacerStyle = { '--scrub-distance': `${SCRUB_DISTANCE_VH}vh` };

/**
 * The hero, then `children` riding in the same pin, so they stay against it
 * through the change. Pass the rest of the page: anything after the track
 * would wait for the spacer to scroll past before it came into view.
 */
export function HomeHero({ children }: { children?: ReactNode }) {
  return (
    <AuroraControlsProvider>
      <LazyMotion features={domMin} strict>
        <PinnedHero>{children}</PinnedHero>
      </LazyMotion>
    </AuroraControlsProvider>
  );
}

// ---- The track, the pin, and the stage

function PinnedHero({ children }: { children?: ReactNode }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const spacerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const measure = useMeasure(containerRef, trackRef, spacerRef);
  const layout = useMemo(() => (measure ? computeLayout(measure) : null), [measure]);
  // The pin catches when the page has scrolled the track's top to the
  // viewport's top, then holds while the spacer scrolls under it, and
  // releases once the page has scrolled that far again. Progress runs from
  // the top of the page to that release, a point that holds however tall
  // the pin is, which matters because the pin's height follows the frame's
  // through the change.
  const range = measure ? measure.trackTop + measure.scrubDistance : 0;
  const { scrollY } = useScroll();
  const { progress, ...frame } = useScrub(layout, scrollY, range);

  // A keyboard visitor who tabs into the panel before it has slid in would
  // be focusing controls past the container's edge, so the page scrolls to
  // where the change ends and the panel is at rest, as the pin releases.
  // Only keyboard focus, which :focus-visible marks: a pointer visitor who
  // clicks a control mid-change can already see it, and a jump to the end
  // would take the page out from under the pointer.
  const revealPanel = (event: FocusEvent<HTMLElement>) => {
    if (!event.target.matches(':focus-visible')) return;
    if (range > 0 && scrollY.get() < range) window.scrollTo({ top: range });
  };

  return (
    <div className={styles.track} data-pinned={layout ? layout.pinned : undefined} ref={trackRef}>
      <div className={styles.pin}>
        <section className={`site-gutter ${styles.hero}`}>
          <div className={`site-container ${styles.container}`} ref={containerRef}>
            <m.div
              className={styles.frame}
              style={{ x: frame.x, width: frame.width, padding: frame.inset }}
            >
              <m.div className={styles.chromeFill} style={{ borderRadius: frame.radius }} />
              <m.div className={styles.chromeRing} style={{ borderRadius: frame.radius }} />
              {/* Aurora draws over a transparent ground, so the scene sits on
                the same dusk backdrop as on its own page. The poster's alt is
                empty because the hero is decoration: the heading above says
                what the library is, and the live canvas that replaces the
                poster has no text either. */}
              <m.div
                className={`${styles.scene} ${auroraStyles.demoBackdrop}`}
                data-home-hero
                style={{ height: frame.sceneHeight }}
              >
                {/* Capped at one canvas pixel per CSS pixel. Aurora marches
                  60 steps per pixel, and at the full 2x of a retina screen
                  the full-width hero is 4.5 million pixels, which pinned an
                  M1 Max's GPU and halved the frame rate. At 1x it is a
                  quarter of that, at the cost of softer filaments, until
                  Aurora gets a cheaper render path. The cap holds through
                  the change, because a new pixel ratio mid-scrub would be
                  one more resize. */}
                <DemoPoster alt="" src={HERO_POSTER_SRC}>
                  <LiveAuroraScene maxDPR={1} />
                </DemoPoster>
              </m.div>
            </m.div>
            {layout?.pinned === true && (
              <m.div
                className={styles.panel}
                onFocus={revealPanel}
                style={{
                  width: layout.panel.width,
                  // The scroller inside takes its cap from max-height, and
                  // height keeps the box as tall as the frame when the
                  // controls are shorter.
                  height: frame.panelHeight,
                  maxHeight: frame.panelHeight,
                  x: frame.panelX,
                  maskImage: frame.panelMask,
                }}
              >
                <ControlsScroller className={styles.panelScroller}>
                  <AuroraControls />
                </ControlsScroller>
              </m.div>
            )}
          </div>
        </section>
        {/* What rides in the pin reads the progress only while the hero
            pins, and plays on its own clock otherwise. */}
        <HeroProgressContext value={layout?.pinned === true ? progress : null}>
          {children}
        </HeroProgressContext>
      </div>
      <div className={styles.spacer} ref={spacerRef} style={SPACER_STYLE} />
    </div>
  );
}

// ---- Scroll progress to motion values

// The motion values the frame and the panel render from, and the progress
// they were set from, which the pin's other contents read. They start at what
// the CSS lays out before measuring (the full-width hero, its scene sized by
// its aspect ratio), so the server's HTML and the first client render agree.
// Once measured, they are set on every scroll and again whenever the layout
// changes, from the scroll as a fraction of `range`: 0 at the top of the
// page, 1 where the pin releases. A layout that doesn't pin hands the frame
// back to the CSS.
function useScrub(layout: Layout | null, scrollY: MotionValue<number>, range: number) {
  const x = useMotionValue(0);
  const width = useMotionValue<number | string>('100%');
  const sceneHeight = useMotionValue<number | string>('auto');
  const inset = useMotionValue(14);
  const radius = useMotionValue(24);
  const panelX = useMotionValue(0);
  const panelHeight = useMotionValue(0);
  const panelMask = useMotionValue('none');
  const progress = useMotionValue(0);

  const scrubTo = useCallback(
    (y: number) => {
      if (!layout || range <= 0) return;

      if (!layout.pinned) {
        x.set(0);
        width.set('100%');
        sceneHeight.set('auto');
        inset.set(14);
        radius.set(24);

        return;
      }
      const at = Math.min(1, Math.max(0, y / range));
      const frame = scrubAt(layout, at);

      progress.set(at);
      x.set(frame.x);
      width.set(frame.width);
      sceneHeight.set(frame.sceneHeight);
      inset.set(frame.inset);
      radius.set(frame.radius);
      panelX.set(frame.panelX);
      panelHeight.set(frame.panelHeight);
      panelMask.set(frame.panelMask);
    },
    [layout, range, x, width, sceneHeight, inset, radius, panelX, panelHeight, panelMask, progress],
  );

  useMotionValueEvent(scrollY, 'change', scrubTo);
  // A new layout (a resize) re-applies the current scroll, since the scroll
  // has not moved to fire the handler.
  useLayoutEffect(() => scrubTo(scrollY.get()), [scrubTo, scrollY]);

  return { x, width, sceneHeight, inset, radius, panelX, panelHeight, panelMask, progress };
}

// ---- Measuring the page

interface PageMeasure extends Measure {
  /** How far down the page the track starts, with the page scrolled to the top. */
  trackTop: number;
  /** The spacer's height, the scroll the pin holds for: 0 when it doesn't pin. */
  scrubDistance: number;
}

// The container's width, the viewport's height, where the track starts on
// the page, and the spacer's height. The container's box changes with the
// window's width, the root element's box changes whenever anything above
// the track changes height (the intro rewrapping once its font loads), and
// the window's resize event covers a change of height alone, which the
// spacer's vh height follows. The root element's clientHeight is the
// viewport's height less any scrollbar, which on a phone is the height with
// its toolbars shown, so it matches 100svh.
function useMeasure(
  containerRef: RefObject<HTMLDivElement | null>,
  trackRef: RefObject<HTMLDivElement | null>,
  spacerRef: RefObject<HTMLDivElement | null>,
) {
  const [measure, setMeasure] = useState<PageMeasure | null>(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const track = trackRef.current;
    const spacer = spacerRef.current;

    if (!container || !track || !spacer) return undefined;
    const root = document.documentElement;
    const read = () => {
      const next = {
        width: container.clientWidth,
        viewportHeight: root.clientHeight,
        trackTop: track.getBoundingClientRect().top + window.scrollY,
        scrubDistance: spacer.offsetHeight,
      };

      // A new object re-renders the hero, so keep the old one when nothing
      // moved. The root's box also changes on every scroll tick of the
      // change, as the pin's height follows the frame's, and those reads
      // land here.
      setMeasure((current) =>
        current?.width === next.width &&
        current.viewportHeight === next.viewportHeight &&
        current.trackTop === next.trackTop &&
        current.scrubDistance === next.scrubDistance
          ? current
          : next,
      );
    };
    const observer = new ResizeObserver(read);

    observer.observe(container);
    observer.observe(root);
    observer.observe(spacer);
    window.addEventListener('resize', read);
    read();

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', read);
    };
  }, [containerRef, trackRef, spacerRef]);

  return measure;
}
