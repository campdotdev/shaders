'use client';

/**
 * The SHA-182 prototype: a tall scroll track holding a sticky pin, and inside
 * the pin the hero's frame, which scroll progress morphs into Aurora's demo
 * layout (the 3:2 scene beside the 288px panel, or stacked above it on a
 * narrow screen). A floating switcher picks how the canvas follows the
 * changing box, and its readouts report frame rate, renderer resizes, and
 * whether the stacked end state fits the pin. Throwaway: see page.dev.tsx.
 */
import dynamic from 'next/dynamic';
import {
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  motion,
  type MotionValue,
  useMotionValue,
  useMotionValueEvent,
  useScroll,
} from 'motion/react';

import { AuroraControls } from '@/app/components/aurora/demo';
import auroraStyles from '@/app/components/aurora/demo.module.css';
import { type AuroraParams, INITIAL } from '@/app/components/aurora/params';
import { ControlsProvider, createControlStore, useSnapshot } from '@/components/controls';

import styles from './prototype.module.css';

const AuroraScene = dynamic(() => import('@/app/components/aurora/scene'), { ssr: false });

// ---- Options the switcher sets

/**
 * How the canvas follows the scene box. `resize` fills the box, so the
 * renderer resizes on every scroll frame. `crop` renders at a fixed size big
 * enough to cover every shape the box takes and lets the box clip it, so the
 * renderer never resizes. `settle` crops while the scroll moves and resizes
 * once when it stops.
 */
type CanvasMode = 'resize' | 'crop' | 'settle';

/** Stacked end state's panel: the docs page's 384px cap, or shrunk to fit the pin. */
type PanelHeight = 'cap' | 'fit';

/** The CSS unit the pin's height uses. Only phones tell the three apart. */
type PinUnit = 'svh' | 'dvh' | 'lvh';

/**
 * Where the side-by-side end state sits in the container. The docs page
 * left-aligns it beside the sidebar, but the homepage has no sidebar.
 */
type EndAlign = 'center' | 'left';

interface Options {
  mode: CanvasMode;
  maxDPR: 1 | 2;
  panelHeight: PanelHeight;
  pinUnit: PinUnit;
  endAlign: EndAlign;
}

// ---- Layout constants, in CSS px, from the hero and demo CSS

// The hero mock's scene box, 1636 by 696 (home-hero.module.css).
const HERO_RATIO = 1636 / 696;
// The phone hero is 16:9 and drops the frame.
const PHONE_HERO_RATIO = 16 / 9;
// Every demo scene is 3:2 ([data-shader-demo] in globals.css).
const DEMO_RATIO = 3 / 2;
// The hero frame's 12px padding plus its 2px border, on each side. The frame
// stays through the change, and the scene grows out to fill it: the inset
// runs down to 0 while the frame's corner radius runs from the hero's 24px to
// the scene's and the panel's 12px, so at the end the two outlines are one.
// Keeping the inset instead would need an inner radius of 12 - 14 = -2px,
// square corners, to stay concentric with a 12px frame.
const FRAME_INSET = 14;
const FRAME_RADIUS_START = 24;
const RADIUS_END = 12;
// The demo's 4xl scene column, 2xs panel, and the 16px gap between them
// (demo-layout.module.css).
const SCENE_MAX_WIDTH = 896;
const PANEL_WIDTH = 288;
const COLUMN_GAP = 16;
// Stacked, the gap closes to 12px and the panel caps at 384px.
const STACK_GAP = 12;
const STACK_PANEL_MAX = 384;
// The docs page stacks once the scene column would drop under 512px. Its
// 53.5rem floor adds the docs shell's 40px inset, which the homepage
// container doesn't have, so the floor here is 512 + 16 + 288.
const STACK_BELOW = 816;
// Space above and below the stage inside the pin, matching the hero
// section's padding (page.module.css): 32px each way on a wide screen, and
// on a phone none above, where the intro's own padding sits, and 24px below.
const PIN_PADDING = { top: 32, bottom: 32 };
const PHONE_PIN_PADDING = { top: 0, bottom: 24 };
// How far the visitor scrolls while the pin is stuck, in CSS viewport
// heights. Longer makes the change slower per scroll tick.
const SCRUB_DISTANCE_VH = 150;
// The site's phone width, the 40rem query that home-hero.module.css and
// page.module.css put on the site container, which spans the viewport.
const PHONE_QUERY = '(width < 40rem)';
// A fit panel never shrinks under this, so it keeps at least a few rows.
const FIT_PANEL_MIN = 120;
// The scroll stops counting as moving after this long without a change, in ms.
const SETTLE_DELAY = 150;

// ---- Geometry: the two ends of the change, measured from the pin

// Frame rects all sit at the stage's top, so only the panel carries a y.
interface FrameRect {
  x: number;
  width: number;
  height: number;
}

interface Rect extends FrameRect {
  y: number;
}

interface Size {
  width: number;
  height: number;
}

interface Layout {
  phone: boolean;
  stacked: boolean;
  frameStart: FrameRect;
  frameEnd: FrameRect;
  // The container's width, where the panel's reveal ends.
  width: number;
  // The frame's padding plus border at the start: 14px on a wide screen, 0
  // on a phone, whose hero has no frame. It is 0 at the end.
  inset: number;
  panel: Rect;
  stageHeight: number;
  // The end state's full height plus the pin's padding, against the pin's height.
  endHeight: number;
  pinHeight: number;
  // The fixed canvas size crop mode renders at: big enough to cover the
  // scene box at both ends.
  cover: Size;
}

interface Measure {
  width: number;
  pinHeight: number;
  phone: boolean;
}

function computeLayout(
  { width, pinHeight, phone }: Measure,
  { panelHeight, endAlign }: Pick<Options, 'panelHeight' | 'endAlign'>,
): Layout {
  const padding = phone ? PHONE_PIN_PADDING : PIN_PADDING;
  const verticalPadding = padding.top + padding.bottom;
  const inset = phone ? 0 : FRAME_INSET;
  const heroWidth = width - 2 * inset;
  const heroHeight = heroWidth / (phone ? PHONE_HERO_RATIO : HERO_RATIO);
  const frameStart = { x: 0, width, height: heroHeight + 2 * inset };
  const stacked = width < STACK_BELOW;

  let frameEnd: FrameRect;
  let panel: Rect;
  let sceneEnd: Size;

  if (stacked) {
    sceneEnd = { width, height: width / DEMO_RATIO };
    const frameHeight = sceneEnd.height;
    const room = pinHeight - verticalPadding - frameHeight - STACK_GAP;
    const height =
      panelHeight === 'fit'
        ? Math.max(FIT_PANEL_MIN, Math.min(STACK_PANEL_MAX, room))
        : STACK_PANEL_MAX;

    frameEnd = { x: 0, width, height: frameHeight };
    panel = { x: 0, y: frameHeight + STACK_GAP, width, height };
  } else {
    // The frame ends as the docs page's 3:2 scene column, with the scene
    // filling it.
    const columnWidth = Math.min(SCENE_MAX_WIDTH, width - COLUMN_GAP - PANEL_WIDTH);

    sceneEnd = { width: columnWidth, height: columnWidth / DEMO_RATIO };
    const frameHeight = sceneEnd.height;
    // The frame and panel move as one group, centered or against the left.
    const x = endAlign === 'center' ? (width - (columnWidth + COLUMN_GAP + PANEL_WIDTH)) / 2 : 0;
    // Beside the frame the panel is capped at the frame's height, or the pin's.
    const height = Math.min(frameHeight, pinHeight - verticalPadding);

    frameEnd = { x, width: columnWidth, height: frameHeight };
    panel = { x: x + columnWidth + COLUMN_GAP, y: 0, width: PANEL_WIDTH, height };
  }

  const endBottom = Math.max(frameEnd.height, panel.y + panel.height);

  return {
    phone,
    stacked,
    frameStart,
    frameEnd,
    width,
    inset,
    panel,
    stageHeight: Math.max(frameStart.height, endBottom),
    endHeight: endBottom + verticalPadding,
    pinHeight,
    cover: {
      width: Math.max(heroWidth, sceneEnd.width),
      height: Math.max(heroHeight, sceneEnd.height),
    },
  };
}

// ---- Scroll progress to geometry

function lerp(from: number, to: number, t: number) {
  return from + (to - from) * t;
}

// Maps progress inside [start, end] to 0..1 with a smoothstep, so each phase
// eases in and out instead of starting and stopping hard against the scroll.
function phase(progress: number, start: number, end: number) {
  const t = Math.min(1, Math.max(0, (progress - start) / (end - start)));

  return t * t * (3 - 2 * t);
}

// The frame morphs across the middle of the pinned range, so the hero holds
// still for a beat after the pin catches and the demo holds before release.
// Side by side, the panel rides the frame's right edge, so it slides in from
// the right as the frame narrows and never overlaps it. Stacked, it rides
// the frame's bottom edge and slides in from the right over the morph's
// second half. Either way it stays opaque: a fade over the scene ghosted.
const MORPH = [0.1, 0.8] as const;
const STACKED_PANEL_IN = [0.45, 0.9] as const;

// The panel's reveal: a mask that fades it out toward the container's right
// edge, so it emerges through the edge rather than from behind a hard cut.
// It runs the scroll areas' edge-fade curve (scroll-area.module.css), clear
// at the edge and 20% at 39% of the way in, over 160px instead of their
// 64px. Its strength follows how far the panel still has to travel, so the
// mask is gone by the time the panel comes to rest, as a scroll fade goes
// once the end is reached.
const REVEAL_WIDTH = 160;

function revealMask(edge: number, panelWidth: number, remaining: number) {
  const strength = Math.min(1, remaining / REVEAL_WIDTH);

  if (strength <= 0 || edge - REVEAL_WIDTH >= panelWidth) return 'none';

  return `linear-gradient(to right, #000 ${edge - REVEAL_WIDTH}px, rgb(0 0 0 / ${
    1 - 0.8 * strength
  }) ${edge - 0.39 * REVEAL_WIDTH}px, rgb(0 0 0 / ${1 - strength}) ${edge}px)`;
}

// ---- The page

export function HeroToDemoPrototype() {
  const store = useMemo(() => createControlStore<AuroraParams>(INITIAL), []);

  return (
    <ControlsProvider store={store}>
      <Prototype />
    </ControlsProvider>
  );
}

function Prototype() {
  const [options, setOptions] = useState<Options>({
    mode: 'resize',
    maxDPR: 1,
    panelHeight: 'cap',
    pinUnit: 'svh',
    endAlign: 'center',
  });
  const trackRef = useRef<HTMLDivElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const measure = useMeasure(containerRef, pinRef);
  const layout = useMemo(
    () =>
      measure
        ? computeLayout(measure, { panelHeight: options.panelHeight, endAlign: options.endAlign })
        : null,
    [measure, options.panelHeight, options.endAlign],
  );
  // Progress runs 0 to 1 while the pin is stuck: from the track's top
  // reaching the viewport's top to its bottom reaching the pin's bottom,
  // where the sticky pin releases. The viewport's bottom would drift from
  // that release whenever the pin unit differs from the viewport's height.
  const { scrollYProgress } = useScroll({
    target: trackRef,
    offset: ['start start', measure ? `end ${measure.pinHeight}px` : 'end end'],
  });
  const moving = useScrollMoving(scrollYProgress);

  return (
    <>
      <section className={`site-gutter ${styles.intro}`}>
        <div className="site-container">
          <h1 className={styles.title}>Hero to demo prototype</h1>
          <p className={styles.description}>
            Scroll to scrub the hero into Aurora&rsquo;s demo. The switcher in the corner picks how
            the canvas follows the box.
          </p>
        </div>
      </section>
      <div
        ref={trackRef}
        style={{ height: `calc(100${options.pinUnit} + ${SCRUB_DISTANCE_VH}vh)` }}
      >
        <div
          className={`site-gutter ${styles.pin}`}
          ref={pinRef}
          style={{ height: `100${options.pinUnit}` }}
        >
          <div className={`site-container ${styles.container}`} ref={containerRef}>
            <Stage
              layout={layout}
              moving={moving}
              options={options}
              progress={scrollYProgress}
              sceneRef={sceneRef}
            />
          </div>
        </div>
      </div>
      <section className={`site-gutter ${styles.after}`}>
        <div className={`site-container ${styles.afterBox}`}>The favorites grid comes next.</div>
      </section>
      <Switcher
        layout={layout}
        options={options}
        progress={scrollYProgress}
        sceneRef={sceneRef}
        setOptions={setOptions}
      />
    </>
  );
}

// ---- The stage: the frame and the panel

function Stage({
  layout,
  options,
  moving,
  progress,
  sceneRef,
}: {
  layout: Layout | null;
  options: Options;
  moving: boolean;
  progress: MotionValue<number>;
  sceneRef: RefObject<HTMLDivElement | null>;
}) {
  const { frameX, frameWidth, frameHeight, frameInset, frameRadius, panelX, panelY, panelMask } =
    useScrub(layout, progress);
  // The canvas box: the scene box itself, or a fixed cover that the box crops.
  const cropping = options.mode === 'crop' || (options.mode === 'settle' && moving);
  const canvasStyle =
    cropping && layout ? { width: layout.cover.width, height: layout.cover.height } : undefined;

  return (
    <div className={styles.stage} style={{ height: layout?.stageHeight }}>
      <motion.div
        className={styles.frame}
        style={{
          x: frameX,
          width: frameWidth,
          height: frameHeight,
          padding: frameInset,
        }}
      >
        {layout?.phone === false && (
          <>
            <motion.div className={styles.chromeFill} style={{ borderRadius: frameRadius }} />
            <motion.div className={styles.chromeRing} style={{ borderRadius: frameRadius }} />
          </>
        )}
        <div
          className={`${styles.scene} ${layout?.phone === true ? styles.sceneHairline : ''} ${auroraStyles.demoBackdrop}`}
          ref={sceneRef}
        >
          <div className={styles.canvasBox} style={canvasStyle}>
            <LiveAuroraScene maxDPR={options.maxDPR} />
          </div>
        </div>
      </motion.div>
      {layout && (
        <motion.div
          className={styles.panel}
          style={{
            width: layout.panel.width,
            height: layout.panel.height,
            x: panelX,
            y: panelY,
            maskImage: panelMask,
          }}
        >
          <AuroraControls />
        </motion.div>
      )}
    </div>
  );
}

// ---- Scroll progress to motion values

// The motion values the frame and the panel render from, set from scroll
// progress on every change and again whenever the layout changes.
function useScrub(layout: Layout | null, scrollYProgress: MotionValue<number>) {
  const frameX = useMotionValue(0);
  const frameWidth = useMotionValue(0);
  const frameHeight = useMotionValue(0);
  const frameInset = useMotionValue(0);
  const frameRadius = useMotionValue(FRAME_RADIUS_START);
  const panelX = useMotionValue(0);
  const panelY = useMotionValue(0);
  const panelMask = useMotionValue('none');

  const scrubTo = useCallback(
    (progress: number) => {
      if (!layout) return;
      const morph = phase(progress, ...MORPH);
      const { frameStart, frameEnd, panel } = layout;
      const x = lerp(frameStart.x, frameEnd.x, morph);
      const width = lerp(frameStart.width, frameEnd.width, morph);
      const height = lerp(frameStart.height, frameEnd.height, morph);

      frameX.set(x);
      frameWidth.set(width);
      frameHeight.set(height);
      frameInset.set(lerp(layout.inset, 0, morph));
      frameRadius.set(lerp(FRAME_RADIUS_START, RADIUS_END, morph));

      let left: number;

      if (layout.stacked) {
        // Starts one gap past the container's right edge, which clips it.
        const slide = phase(progress, ...STACKED_PANEL_IN);

        left = lerp(panel.width + STACK_GAP, panel.x, slide);
        panelY.set(height + STACK_GAP);
      } else {
        left = x + width + COLUMN_GAP;
        panelY.set(panel.y);
      }
      panelX.set(left);
      panelMask.set(revealMask(layout.width - left, panel.width, left - panel.x));
    },
    [layout, frameX, frameWidth, frameHeight, frameInset, frameRadius, panelX, panelY, panelMask],
  );

  useMotionValueEvent(scrollYProgress, 'change', scrubTo);
  // A new layout (a resize, or a switcher change) re-applies the current
  // progress, since the scroll has not moved to fire the handler.
  useLayoutEffect(() => scrubTo(scrollYProgress.get()), [scrubTo, scrollYProgress]);

  return { frameX, frameWidth, frameHeight, frameInset, frameRadius, panelX, panelY, panelMask };
}

// The scene with the panel's live params. The params subscription lives in
// this leaf so a slider drag re-renders only the scene, not the page and
// its unmemoized controls (the demo-store gotcha in docs/agents/docs-site.md).
function LiveAuroraScene({ maxDPR }: { maxDPR: 1 | 2 }) {
  const params = useSnapshot<AuroraParams>();

  return <AuroraScene maxDPR={maxDPR} params={params} />;
}

// ---- Measuring the pin

// The container's width and the pin's height, re-read whenever either box
// changes. `phone` mirrors the site's 40rem container query, which the site
// container answers at the viewport's width.
function useMeasure(
  containerRef: RefObject<HTMLDivElement | null>,
  pinRef: RefObject<HTMLDivElement | null>,
) {
  const [measure, setMeasure] = useState<Measure | null>(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const pin = pinRef.current;

    if (!container || !pin) return undefined;
    const phoneQuery = window.matchMedia(PHONE_QUERY);
    const read = () => {
      setMeasure({
        width: container.clientWidth,
        pinHeight: pin.clientHeight,
        phone: phoneQuery.matches,
      });
    };
    const observer = new ResizeObserver(read);

    observer.observe(container);
    observer.observe(pin);
    read();

    return () => observer.disconnect();
  }, [containerRef, pinRef]);

  return measure;
}

// True while the scroll progress keeps changing, false once it has held
// still for SETTLE_DELAY. Settle mode reads it to swap crop for resize.
function useScrollMoving(progress: MotionValue<number>) {
  const [moving, setMoving] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useMotionValueEvent(progress, 'change', () => {
    setMoving(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMoving(false), SETTLE_DELAY);
  });
  useEffect(() => () => clearTimeout(timer.current), []);

  return moving;
}

// ---- The switcher and its readouts

interface Stats {
  progress: number;
  fps: number;
  worstFrame: number;
  box: string;
  buffer: string;
  resizes: number;
}

// Samples every animation frame and publishes twice a second: the average
// frame rate and the longest frame, the scene box's CSS size, the canvas's
// drawing-buffer size (its real pixels), and how many times that buffer has
// changed size, which is how many times the renderer resized.
function useStats(sceneRef: RefObject<HTMLDivElement | null>, progress: MotionValue<number>) {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    let windowStart = last;
    let frames = 0;
    let worst = 0;
    let resizes = 0;
    let lastBuffer = '';

    const tick = (now: number) => {
      const delta = now - last;

      last = now;
      frames += 1;
      worst = Math.max(worst, delta);

      const scene = sceneRef.current;
      const canvas = scene?.querySelector('canvas');
      const buffer = canvas ? `${canvas.width} x ${canvas.height}` : '-';

      if (lastBuffer !== '' && buffer !== lastBuffer) resizes += 1;
      lastBuffer = buffer;

      if (now - windowStart >= 500) {
        setStats({
          progress: progress.get(),
          fps: (frames * 1000) / (now - windowStart),
          worstFrame: worst,
          box: scene ? `${scene.clientWidth} x ${scene.clientHeight}` : '-',
          buffer,
          resizes,
        });
        windowStart = now;
        frames = 0;
        worst = 0;
      }

      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frame);
  }, [sceneRef, progress]);

  return stats;
}

function Switcher({
  layout,
  options,
  progress,
  sceneRef,
  setOptions,
}: {
  layout: Layout | null;
  options: Options;
  progress: MotionValue<number>;
  sceneRef: RefObject<HTMLDivElement | null>;
  setOptions: (update: (options: Options) => Options) => void;
}) {
  const stats = useStats(sceneRef, progress);
  const detailsRef = useRef<HTMLDetailsElement>(null);

  // Open on a wide screen, closed on a phone, where it would cover the stage,
  // and set again whenever the viewport crosses the phone width.
  useEffect(() => {
    const phoneQuery = window.matchMedia(PHONE_QUERY);
    const sync = () => {
      if (detailsRef.current) detailsRef.current.open = !phoneQuery.matches;
    };

    sync();
    phoneQuery.addEventListener('change', sync);

    return () => phoneQuery.removeEventListener('change', sync);
  }, []);
  const overflow = layout ? Math.round(layout.endHeight - layout.pinHeight) : 0;

  return (
    <details className={styles.switcher} ref={detailsRef}>
      <summary className={styles.summary}>Prototype</summary>
      <Choice
        label="Canvas"
        onChange={(mode) => setOptions((current) => ({ ...current, mode }))}
        options={[
          ['resize', 'Resize'],
          ['crop', 'Crop'],
          ['settle', 'Crop, resize at rest'],
        ]}
        value={options.mode}
      />
      <Choice
        label="Max DPR"
        onChange={(maxDPR) => setOptions((current) => ({ ...current, maxDPR }))}
        options={[
          [1, '1x'],
          [2, '2x'],
        ]}
        value={options.maxDPR}
      />
      <Choice
        label="Stacked panel"
        onChange={(panelHeight) => setOptions((current) => ({ ...current, panelHeight }))}
        options={[
          ['cap', '384px'],
          ['fit', 'Fit the pin'],
        ]}
        value={options.panelHeight}
      />
      <Choice
        label="End alignment"
        onChange={(endAlign) => setOptions((current) => ({ ...current, endAlign }))}
        options={[
          ['center', 'Center'],
          ['left', 'Left'],
        ]}
        value={options.endAlign}
      />
      <Choice
        label="Pin height"
        onChange={(pinUnit) => setOptions((current) => ({ ...current, pinUnit }))}
        options={[
          ['svh', '100svh'],
          ['dvh', '100dvh'],
          ['lvh', '100lvh'],
        ]}
        value={options.pinUnit}
      />
      {stats && layout && (
        <dl className={styles.readouts}>
          <dt>Progress</dt>
          <dd>{Math.round(stats.progress * 100)}%</dd>
          <dt>Frame rate</dt>
          <dd>
            {Math.round(stats.fps)} fps, worst {Math.round(stats.worstFrame)} ms
          </dd>
          <dt>Scene box</dt>
          <dd>{stats.box}</dd>
          <dt>Canvas buffer</dt>
          <dd>{stats.buffer}</dd>
          <dt>Renderer resizes</dt>
          <dd>{stats.resizes}</dd>
          <dt>End layout</dt>
          <dd>{layout.stacked ? 'stacked' : 'side by side'}</dd>
          <dt>End height / pin</dt>
          <dd className={overflow > 0 ? styles.bad : styles.good}>
            {Math.round(layout.endHeight)} / {Math.round(layout.pinHeight)} px
            {overflow > 0 ? `, ${overflow} px over` : ', fits'}
          </dd>
        </dl>
      )}
    </details>
  );
}

function Choice<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: ReadonlyArray<readonly [T, string]>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className={styles.choice}>
      <legend className={styles.choiceLabel}>{label}</legend>
      <div className={styles.choiceButtons}>
        {options.map(([option, text]) => (
          <button
            aria-pressed={option === value}
            className={styles.choiceButton}
            key={option}
            onClick={() => onChange(option)}
            type="button"
          >
            {text}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
