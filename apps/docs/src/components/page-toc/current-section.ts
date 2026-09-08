/**
 * The rule behind the floating table of contents: given where every section
 * title sits in the viewport, which section is the reader in? It is a pure
 * function of the measurements so that page-toc.tsx can stay a thin loop that
 * reads the DOM once a frame and hands the numbers here, and so the rule can
 * be tested in plain Node, where the docs Vitest runs with no DOM.
 */

// How far down the viewport the reading line sits, in px. A section is
// current once its title has scrolled up past this line. A fixed distance
// rather than a share of the viewport, so that a jump from the menu (which
// lands a section's title 24px from the top) always puts that section, and
// never the next one, under the line, however tall the window is.
export const READING_LINE_PX = 200;

// How far short of the end a scroll position may sit and still count as the
// bottom, in px. Scroll positions are fractional on zoomed and Retina
// displays while the document height is an integer, so an exact comparison
// can miss the bottom by a fraction of a pixel.
const BOTTOM_TOLERANCE_PX = 1;

export interface SectionMeasurements {
  /** Each section title's top edge, in px from the top of the viewport. */
  tops: number[];
  /** Index of the section the reader last chose from the menu, or -1. */
  chosenIndex: number;
  /** The viewport's height, in px. */
  viewportHeight: number;
  /** How far the page has scrolled, in px. */
  scrollTop: number;
  /** The whole page's height, in px, including the part scrolled away. */
  scrollHeight: number;
}

export interface CurrentSection {
  /** Index into `tops` of the section to light. */
  index: number;
  /** True when the chosen section won by choice rather than by position. */
  held: boolean;
}

/**
 * Three rules, checked in order:
 *
 * 1. A section the reader chose from the menu stays current while its title
 *    is on screen. A jump that lands at the bottom of a short page can leave
 *    two titles in view, and the reader has already said which one they
 *    meant. Scrolling the title off releases it.
 * 2. At the bottom of a page that scrolls, the last section is current. A
 *    short page can end before its last title ever reaches the reading line,
 *    and once the reader can scroll no further, nothing else is left to
 *    reach. A page that fits its window has no bottom to reach, so this
 *    rule does not apply to it.
 * 3. Otherwise the last section whose title has passed the reading line is
 *    current, and the first section before any title has.
 *
 * Reading positions each frame rather than watching for crossings means a
 * jump that skips a whole section still lands on the right answer.
 */
export function pickCurrentSection({
  tops,
  chosenIndex,
  viewportHeight,
  scrollTop,
  scrollHeight,
}: SectionMeasurements): CurrentSection {
  const chosenTop = tops[chosenIndex];

  if (chosenTop !== undefined && chosenTop >= 0 && chosenTop <= viewportHeight) {
    return { index: chosenIndex, held: true };
  }

  const scrolls = scrollHeight > viewportHeight + BOTTOM_TOLERANCE_PX;
  const atBottom = scrolls && viewportHeight + scrollTop >= scrollHeight - BOTTOM_TOLERANCE_PX;

  if (atBottom) return { index: tops.length - 1, held: false };

  for (let candidate = tops.length - 1; candidate >= 0; candidate -= 1) {
    if ((tops[candidate] ?? Infinity) <= READING_LINE_PX) return { index: candidate, held: false };
  }

  return { index: 0, held: false };
}
