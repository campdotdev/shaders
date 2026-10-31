/**
 * FlutedGlass's cross-section for a composition's All props section. The
 * Cross-section slider edits the dial as a number, and the library default
 * is the name `'round'`, so the store needs the number the name stands for.
 */
import type { CrossSectionName } from '@camp-dev/shaders';

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
