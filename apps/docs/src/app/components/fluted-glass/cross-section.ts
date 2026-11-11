/**
 * FlutedGlass's cross-section in a composition's store. A slider edits the
 * dial as a number, and the library default is the name `'round'`, so the
 * store holds the number the name stands for. The copied file turns a number
 * on a named point back into its name.
 */
import type { CrossSectionName } from '@camp-dev/shaders';

import { roundNumber } from '@/lib/print-literal';

// Where fluted-glass.tsx puts each name on the dial. The package doesn't
// export its table; the type keeps these names in step with it.
const CROSS_SECTION_DIAL: Record<CrossSectionName, number> = {
  prism: 0,
  round: 0.5,
  flat: 1,
};

const isCrossSectionName = (value: unknown): value is CrossSectionName =>
  typeof value === 'string' && Object.hasOwn(CROSS_SECTION_DIAL, value);

/** Turns a named cross-section into the dial value the component renders it at. */
export function seedCrossSection(props: Record<string, unknown>): Record<string, unknown> {
  const { crossSection } = props;

  if (!isCrossSectionName(crossSection)) return props;

  return { ...props, crossSection: CROSS_SECTION_DIAL[crossSection] };
}

/**
 * Turns a dial value on one of the named points into its name, so the copied
 * file prints `crossSection="prism"` rather than `crossSection={0}`. It
 * compares the value as the file would print it, so slider float noise still
 * matches.
 */
export function printCrossSection(props: Record<string, unknown>): Record<string, unknown> {
  const { crossSection } = props;

  if (typeof crossSection !== 'number') return props;

  const printed = roundNumber(crossSection);
  const name = Object.keys(CROSS_SECTION_DIAL)
    .filter(isCrossSectionName)
    .find((point) => CROSS_SECTION_DIAL[point] === printed);

  return name === undefined ? props : { ...props, crossSection: name };
}
