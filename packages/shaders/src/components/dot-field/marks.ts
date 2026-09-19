// The dot field's mark vocabulary and the one step between the shape prop
// and the shader: turn whatever the caller passed into an ordered entry
// list the material bakes in. Kept as a pure function, next to the
// component, so it has a unit test and no React in it.
import type { SvgMarkup } from '../../primitives/mark-atlas/plan.js';

export type { SvgMarkup } from '../../primitives/mark-atlas/plan.js';

/**
 * The marks the field can draw at each grid point: a built-in name, or a
 * custom mark as inline SVG markup.
 */
export type DotShape = 'circle' | 'cross' | { svg: SvgMarkup };

export interface MarkEntries {
  /** The marks in the order given, repeats kept. */
  entries: readonly DotShape[];
  /**
   * One string that changes exactly when the entries do, for the material
   * effect to depend on. An inline array literal in JSX is a new reference
   * on every parent render, so depending on the array itself would rebuild
   * the shader each time the parent rendered, and a custom mark's object
   * is the same trap one level down.
   */
  key: string;
}

export function resolveMarkEntries(shape: DotShape | readonly DotShape[]): MarkEntries {
  const entries = isDotShape(shape) ? [shape] : [...shape];

  // JSON rather than a joined string: a markup string can hold any
  // separator, and JSON escapes it, so two different lists never share a
  // key.
  return { entries, key: JSON.stringify(entries) };
}

function isDotShape(shape: DotShape | readonly DotShape[]): shape is DotShape {
  return typeof shape === 'string' || !Array.isArray(shape);
}
