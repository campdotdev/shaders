/**
 * A titled group of controls ("Motion", "Color", "Shape"). A fieldset/legend
 * pair rather than a div/heading so screen readers announce the group name when
 * focus enters it.
 */
import type { ReactNode } from 'react';

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="controls-section">
      <legend className="controls-section-title">{title}</legend>
      {children}
    </fieldset>
  );
}
