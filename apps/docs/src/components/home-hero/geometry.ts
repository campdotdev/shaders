/**
 * The geometry of the homepage hero turning into Aurora's demo, as plain
 * numbers: the two ends of the change, measured from the container, and the
 * frame and panel at any scroll progress between them. home-hero.tsx feeds these
 * into motion values. Every length is in CSS px. The values come from the
 * SHA-182 prototype, whose findings are on that ticket.
 */
import { edgeRevealMask } from '@/lib/edge-reveal';

// ---- Tuning: how the change maps onto the scroll

/**
 * How far the visitor scrolls while the pin is stuck, in viewport heights.
 * The change runs from the top of the page to the pin releasing, so longer
 * makes it slower per scroll tick.
 */
export const SCRUB_DISTANCE_VH = 50;

// ---- Layout constants, from the hero and demo CSS

// The hero's scene box, 1636 by 696 (home-hero.module.css).
const HERO_RATIO = 1636 / 696;
// Every demo scene is 3:2 ([data-shader-demo] in globals.css).
const DEMO_RATIO = 3 / 2;
// The hero frame's 12px padding plus its 2px border, on each side. The frame
// stays through the change and the scene grows out to fill it: the inset
// runs down to 0 while the frame's corner radius runs from the hero's 24px
// to the scene's and the panel's 12px, so at the end the two outlines are
// one. Keeping the inset would need an inner radius of 12 - 14 = -2px to
// stay concentric with a 12px frame.
const FRAME_INSET = 14;
const FRAME_RADIUS_START = 24;
const FRAME_RADIUS_END = 12;
// The demo's 4xl scene column, its 2xs panel, and the 16px gap between them
// (demo-layout.module.css).
const SCENE_MAX_WIDTH = 896;

export const PANEL_WIDTH = 288;
const COLUMN_GAP = 16;
// Under this container width the scene column would drop below 512px, where
// the docs page stacks its demo, so the end state would stack and the hero
// does not pin. 512 + 16 + 288; the docs page's 53.5rem adds its shell's
// 40px inset, which the homepage container doesn't have.
const SIDE_BY_SIDE_MIN = 816;
// The hero section's padding above and below the stage, 32px each way
// (home-hero.module.css).
const PIN_PADDING = 32;

// The panel's reveal: a mask that fades it toward the container's right
// edge, so it emerges through the edge rather than from behind a hard cut
// (lib/edge-reveal.ts). It runs over 160px, against the scroll areas' 64px.
export const PANEL_FADE = 160;

// ---- The two ends of the change

export interface Measure {
  /** The site container's width. */
  width: number;
  /** The viewport's height, toolbars shown on a phone: 100svh. */
  viewportHeight: number;
}

export interface Layout {
  /**
   * Whether the hero pins and scrubs: only when the end state sits side by
   * side and fits the viewport's height.
   */
  pinned: boolean;
  /**
   * The end state's height plus the hero section's padding above and below
   * it. While the pin holds, the demo sits at the viewport's top, so this
   * has to fit the viewport for the visitor to see the demo whole.
   */
  endHeight: number;
  /** The container's width, which the hero fills and the panel reveals at. */
  width: number;
  /** The hero's scene height, inside the frame's inset. */
  heroSceneHeight: number;
  /** The frame at the end, where the scene fills it. */
  frameEnd: { x: number; width: number; sceneHeight: number };
  /** The panel at rest, beside the frame. */
  panel: { x: number; width: number };
}

export function computeLayout({ width, viewportHeight }: Measure): Layout {
  const columnWidth = Math.min(SCENE_MAX_WIDTH, width - COLUMN_GAP - PANEL_WIDTH);
  const sceneHeight = columnWidth / DEMO_RATIO;
  // The frame and the panel center in the container as one group.
  const x = (width - (columnWidth + COLUMN_GAP + PANEL_WIDTH)) / 2;
  const endHeight = sceneHeight + 2 * PIN_PADDING;

  return {
    pinned: width >= SIDE_BY_SIDE_MIN && endHeight <= viewportHeight,
    endHeight,
    width,
    heroSceneHeight: (width - 2 * FRAME_INSET) / HERO_RATIO,
    frameEnd: { x, width: columnWidth, sceneHeight },
    panel: { x: x + columnWidth + COLUMN_GAP, width: PANEL_WIDTH },
  };
}

// ---- Scroll progress to geometry

export interface Frame {
  x: number;
  width: number;
  sceneHeight: number;
  inset: number;
  radius: number;
  panelX: number;
  /**
   * The panel's height, which is the frame's: its scene plus the inset
   * above and below. The two outlines share a top and a bottom the whole
   * way, and land together on the scene's height, as on the docs page.
   */
  panelHeight: number;
  /** A CSS mask-image for the panel, or 'none'. */
  panelMask: string;
}

function lerp(from: number, to: number, t: number) {
  return from + (to - from) * t;
}

/**
 * A quadratic ease-out over 0..1, 1 - (1 - t)^2, clamped: steepest at the
 * start, so a scrub answers the first scroll tick, and flat at the end, so
 * what it moves settles into place rather than stopping hard against the
 * scroll. The favorites' reveal eases its cards with it too.
 */
export function easeOut(t: number) {
  const clamped = Math.min(1, Math.max(0, t));

  return 1 - (1 - clamped) ** 2;
}

/**
 * The frame and the panel at a scroll progress from 0, the top of the page,
 * to 1, the pin releasing. The panel rides the frame's right edge one gap out,
 * so it slides in from the right as the frame narrows and never overlaps the
 * scene. It stays opaque: a fade over the scene ghosted in the prototype.
 */
export function scrubAt(layout: Layout, progress: number): Frame {
  // The morph spans the whole range with no hold at either end: it starts as
  // soon as the page scrolls, carries on through the pin catching at the
  // top, and lands as the pin releases.
  const morph = easeOut(progress);
  const { frameEnd, panel } = layout;
  const x = lerp(0, frameEnd.x, morph);
  const width = lerp(layout.width, frameEnd.width, morph);
  const panelX = x + width + COLUMN_GAP;
  const sceneHeight = lerp(layout.heroSceneHeight, frameEnd.sceneHeight, morph);
  const inset = lerp(FRAME_INSET, 0, morph);
  const panelHeight = sceneHeight + 2 * inset;

  return {
    x,
    width,
    sceneHeight,
    inset,
    radius: lerp(FRAME_RADIUS_START, FRAME_RADIUS_END, morph),
    panelX,
    panelHeight,
    panelMask: edgeRevealMask({
      direction: 'to right',
      edge: layout.width - panelX,
      size: panel.width,
      fade: PANEL_FADE,
      remaining: panelX - panel.x,
    }),
  };
}
