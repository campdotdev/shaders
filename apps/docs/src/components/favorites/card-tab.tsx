'use client';

/**
 * A favorite's card tab: the card's frame cut into the window's right edge,
 * with the favorite's short name. It slides in while the card is hovered or
 * focused and slides back out when the card is let go. favorites-list.tsx
 * says when, and favorites.module.css places it.
 */
// `m` under LazyMotion rather than `motion`: the card tab only animates to
// its variants, which domMin covers, and needs none of the gesture and
// layout features `motion` bundles. The card's own handlers track hover and
// focus.
import { domMin, LazyMotion, m, useReducedMotion, type Variants } from 'motion/react';

import styles from './favorites.module.css';

// ---------------------------------------------
// The outline
// ---------------------------------------------

// The mock's card tab outline, turned upright: a strip 24 by 168 CSS pixels
// whose right side runs along the window's right edge and whose left side
// swells 24px into the window and back. It is the mock's two curves
// unchanged, rotated a quarter turn from Figma's horizontal drawing.
const CARD_TAB_PATH = 'M24 168C24 145.417 0 123.022 0 83.98C0 44.937 24 22.542 24 0Z';

// ---------------------------------------------
// The motion
// ---------------------------------------------

// From the motion brief on SHA-184. The strip slides in from behind the
// window's right edge, and the name fades in a beat behind it, so the text
// arrives on a strip that has already mostly settled. On the way out both
// leave at once, and quicker, so letting go feels immediate. Each value
// animates from wherever it is when the card is engaged or let go, so a
// pointer sweeping across the grid makes each card tab peek out and tuck
// back rather than finish its slide first.
//
// Every curve is the site's --ease-out (tokens.css): fast off the mark,
// with a long settle. Durations are in seconds, as Motion takes them.

/** The site's --ease-out, as Motion takes a cubic-bezier. */
const EASE_OUT = [0.32, 0.72, 0, 1] as const;

// How long the strip takes to slide in, as --duration-md does. Longer reads
// heavier. The curve's steep start shows most of the strip within the
// first third.
const SLIDE_IN_SECONDS = 0.25;

// How long the strip and the name take to leave, as --duration-sm does.
// Longer lets the card tab linger after the pointer has moved on.
const LEAVE_SECONDS = 0.15;

// How long the name takes to fade in, and how far behind the strip it
// starts. A longer fade softens the name's arrival, and a longer delay lets
// more of the slide land before the name shows.
const NAME_FADE_IN_SECONDS = 0.15;
const NAME_DELAY_SECONDS = 0.08;

// The strip, out past the window's right edge by its own 24px width, where
// the window's overflow clips it, or in place on the edge. At rest it is
// hidden outright as well, rather than only clipped. Motion turns
// `visibility` to visible on an animation's first frame and to hidden on its
// last, and a visibility animation runs for the whole transition. Both
// variants name it, so each takes over the other's. Without that, a card let
// go mid-slide kept its slide-in's visibility animation running, and that
// animation turned the strip visible again after the leave had hidden it.
const SLIDE_STRIP_VARIANTS: Variants = {
  hidden: {
    x: '100%',
    visibility: 'hidden',
    transition: { duration: LEAVE_SECONDS, ease: EASE_OUT },
  },
  shown: {
    x: 0,
    visibility: 'visible',
    transition: { duration: SLIDE_IN_SECONDS, ease: EASE_OUT },
  },
};

const SLIDE_NAME_VARIANTS: Variants = {
  hidden: {
    opacity: 0,
    transition: { duration: LEAVE_SECONDS, ease: EASE_OUT },
  },
  shown: {
    opacity: 1,
    transition: { duration: NAME_FADE_IN_SECONDS, delay: NAME_DELAY_SECONDS, ease: EASE_OUT },
  },
};

// Under reduced motion the card tab never moves, as SHA-178 asks: the strip
// stays on the edge and fades in and out, and the name, which has no
// variants of its own here, fades with it. FADE_SECONDS is --fade-sm's
// length, both ways. Longer makes the change softer and slower to read.
const FADE_SECONDS = 0.15;

const FADE_STRIP_VARIANTS: Variants = {
  hidden: {
    opacity: 0,
    visibility: 'hidden',
    transition: { duration: FADE_SECONDS, ease: EASE_OUT },
  },
  shown: {
    opacity: 1,
    visibility: 'visible',
    transition: { duration: FADE_SECONDS, ease: EASE_OUT },
  },
};

// ---------------------------------------------
// The card tab
// ---------------------------------------------

// The outline in the frame's own color, with the short name written up it.
// It is hidden from screen readers, because the link already takes the full
// label from the poster's alt text, which a screen reader would otherwise
// follow with the short name. favorites.module.css hides it on a device
// that cannot hover.
//
// It mounts hidden, on the card's first hover or focus, and the name takes
// its variant from the strip's, so `shown` drives both. Mounting on the
// client also keeps the motion out of the server render, which cannot know
// the visitor's Reduce Motion setting. useReducedMotion reads that setting
// once, when the card tab mounts.
export function CardTab({ shortName, shown }: { shortName: string; shown: boolean }) {
  // Motion answers null only on the server, which never renders a card tab.
  const reducedMotion = useReducedMotion() === true;

  return (
    <LazyMotion features={domMin} strict>
      <m.div
        animate={shown ? 'shown' : 'hidden'}
        aria-hidden
        className={styles.cardTab}
        data-card-tab
        initial="hidden"
        variants={reducedMotion ? FADE_STRIP_VARIANTS : SLIDE_STRIP_VARIANTS}
      >
        <svg className={styles.cardTabShape} viewBox="0 0 24 168">
          <path d={CARD_TAB_PATH} />
        </svg>
        <m.span
          className={styles.cardTabName}
          variants={reducedMotion ? undefined : SLIDE_NAME_VARIANTS}
        >
          {shortName}
        </m.span>
      </m.div>
    </LazyMotion>
  );
}
