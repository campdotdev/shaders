// The dot field's mark vocabulary and the one step between the shape prop
// and the shader: turn whatever the caller passed into an ordered entry
// list the material bakes in. Kept as a pure function, next to the
// component, so it has a unit test and no React in it.

/** The marks the field can draw at each grid point. */
export type DotShape = 'circle' | 'cross';

export interface MarkEntries {
  /** The marks in the order given, repeats kept. */
  entries: readonly DotShape[];
  /**
   * One string that changes exactly when the entries do, for the material
   * effect to depend on. An inline array literal in JSX is a new reference
   * on every parent render, so depending on the array itself would rebuild
   * the shader each time the parent rendered.
   */
  key: string;
}

export function resolveMarkEntries(shape: DotShape | readonly DotShape[]): MarkEntries {
  const entries = typeof shape === 'string' ? [shape] : [...shape];

  return { entries, key: entries.join('|') };
}
