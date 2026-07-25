/**
 * One labelled row in the panel: label, control, and an optional trailing slot
 * for a numeric readout. Deliberately a plain div rather than a <label> —
 * several controls here (slider plus number box) have two focusable inputs for
 * one prop, and wrapping both in one label would associate it with the wrong one.
 */
import type { ReactNode } from 'react';

export function Field({
  label,
  controlId,
  children,
}: {
  label: string;
  controlId?: string;
  children: ReactNode;
}) {
  return (
    <div className="controls-field">
      <label className="controls-field-label" htmlFor={controlId}>
        {label}
      </label>
      {children}
    </div>
  );
}
