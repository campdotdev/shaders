'use client';

/**
 * The homepage's hero, which turns into Aurora's demo as the visitor scrolls,
 * with the rest of the page riding in its sticky pin. geometry.ts holds the
 * numbers, and this file feeds them into motion values. Where the hero
 * doesn't pin (FLOW_MEDIA), the finished demo sits in the page's flow.
 * What rides in the pin can pause the hero's scene (hero-pause.ts).
 */
import Image from 'next/image';
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

import { ShaderPoster } from '@camp-dev/shaders/poster';
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
import { HERO_POSTER_SRC, POSTER_SRC } from '@/app/components/aurora/params';
import { ControlsScroller } from '@/components/controls';

import {
  computeLayout,
  FLOW_MEDIA,
  FRAME_INSET,
  FRAME_RADIUS_START,
  type Layout,
  type Measure,
  SCRUB_DISTANCE_VH,
  scrubAt,
} from './geometry';
import { createHeroPause, type HeroPause, HeroPauseContext, useIsHeroPaused } from './hero-pause';
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
  // Created once. Only HeroScene subscribes, so a pause re-renders the
  // scene's box and not the panel's controls.
  const [heroPause] = useState(createHeroPause);

  // A keyboard visitor who tabs into the panel before it has slid in would
  // be focusing controls past the container's edge, so the page scrolls to
  // where the change ends and the panel is at rest, as the pin releases.
  // Only keyboard focus, which :focus-visible marks: a pointer visitor who
  // clicks a control mid-change can already see it, and a jump to the end
  // would take the page out from under the pointer.
  const revealPanel = (event: FocusEvent<HTMLElement>) => {
    if (layout?.pinned !== true || !event.target.matches(':focus-visible')) return;
    if (scrollY.get() < range) window.scrollTo({ top: range });
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
              <HeroScene heroPause={heroPause} sceneHeight={frame.sceneHeight} />
            </m.div>
            {/* Rendered from the start, so the flow demo has its controls
                before any script runs. While the hero may pin, the CSS
                hides it until the first measure places it. */}
            <m.div
              className={styles.panel}
              onFocus={revealPanel}
              style={{
                width: layout?.panel.width,
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
          </div>
        </section>
        {/* What rides in the pin reads the progress only while the hero
            pins, and plays on its own clock otherwise. It can pause the
            hero whatever the layout. */}
        <HeroPauseContext value={heroPause}>
          <HeroProgressContext value={layout?.pinned === true ? progress : null}>
            {children}
          </HeroProgressContext>
        </HeroPauseContext>
      </div>
      <div className={styles.spacer} ref={spacerRef} style={SPACER_STYLE} />
    </div>
  );
}

// ---- The scene

// The scene's box, which the frame grows through the change. Aurora draws
// over a transparent ground, so the scene sits on the same dusk backdrop as
// on its own page. The scene pauses whenever something in the pin pauses
// the hero (hero-pause.ts), and `data-paused` says so for the Playwright spec.
function HeroScene({
  heroPause,
  sceneHeight,
}: {
  heroPause: HeroPause;
  sceneHeight: MotionValue<number | string>;
}) {
  const paused = useIsHeroPaused(heroPause);

  return (
    <m.div
      className={`${styles.scene} ${auroraStyles.demoBackdrop}`}
      data-home-hero
      data-paused={paused || undefined}
      style={{ height: sceneHeight }}
    >
      <HeroPoster>
        <LiveAuroraScene paused={paused} />
      </HeroPoster>
    </m.div>
  );
}

// ---- The poster

// The still shown before the scene's first frame, and in its place with no
// WebGPU. The hero and the flow demo are different shapes, and each poster
// is captured at its own (params.ts), because a still cover-cropped into
// the other shape doesn't line up with the live scene that replaces it. A
// <picture> picks the flow demo's 3:2 one wherever FLOW_MEDIA matches,
// the same rule the script pins by, so the still always matches the
// layout. The alt
// is empty because the hero is decoration: the heading above says what the
// library is, and the live canvas that replaces the poster has no text
// either.
function HeroPoster({ children }: { children: ReactNode }) {
  return (
    <ShaderPoster
      poster={
        <picture className={styles.poster}>
          <source media={FLOW_MEDIA} srcSet={POSTER_SRC} />
          <Image
            alt=""
            fill
            priority
            sizes="100vw"
            src={HERO_POSTER_SRC}
            style={{ objectFit: 'cover' }}
          />
        </picture>
      }
    >
      {children}
    </ShaderPoster>
  );
}

// ---- Scroll progress to motion values

// The motion values the frame and the panel render from, and the progress
// they were set from, which the pin's other contents read. They start at the
// hero's start: a 100% width and an auto scene height leave the size to the
// CSS, and the inset and the corners are the hero's own, so the server's
// HTML and the first client render agree.
// Once measured, they are set on every scroll and again whenever the layout
// changes, from the scroll as a fraction of `range`: 0 at the top of the
// page, 1 where the pin releases. A layout that doesn't pin hands the frame
// back to the CSS.
function useScrub(layout: Layout | null, scrollY: MotionValue<number>, range: number) {
  const x = useMotionValue(0);
  const width = useMotionValue<number | string>('100%');
  const sceneHeight = useMotionValue<number | string>('auto');
  const inset = useMotionValue(FRAME_INSET);
  const radius = useMotionValue(FRAME_RADIUS_START);
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
        inset.set(FRAME_INSET);
        radius.set(FRAME_RADIUS_START);

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

// The container's width, whether the hero pins, where the track starts on
// the page, and the spacer's height. The container's box changes with the
// window's width, the root element's box changes whenever anything above
// the track changes height (the intro rewrapping once its font loads), the
// spacer's box follows the window's height through its vh, and FLOW_MEDIA
// reports its own changes.
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
    const flow = window.matchMedia(FLOW_MEDIA);
    const read = () => {
      const next = {
        width: container.clientWidth,
        canPin: !flow.matches,
        trackTop: track.getBoundingClientRect().top + window.scrollY,
        scrubDistance: spacer.offsetHeight,
      };

      // A new object re-renders the hero, so keep the old one when nothing
      // moved. The root's box also changes on every scroll tick of the
      // change, as the pin's height follows the frame's, and those reads
      // land here.
      setMeasure((current) =>
        current?.width === next.width &&
        current.canPin === next.canPin &&
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
    flow.addEventListener('change', read);
    read();

    return () => {
      observer.disconnect();
      flow.removeEventListener('change', read);
    };
  }, [containerRef, trackRef, spacerRef]);

  return measure;
}
