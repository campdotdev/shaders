'use client';

/**
 * A color prop's trigger: the 24px swatch and, beside it, the 80px box that
 * prints the stored color. Clicking either opens the popover holding the
 * three channel sliders and the text field; `stored` is already a canonical
 * oklch() string, so the trigger itself only has to paint and print it. The
 * printed string is the oklch() form on purpose: a hex code could not name a
 * wide-gamut color at all, and the popover is where the full value lives.
 * Inside a list row the visible label drops away, since the row already
 * names the control.
 *
 * This used to load the popover through `next/dynamic` with `ssr: false`,
 * because reaching the color math meant importing three/webgpu, which reads
 * `self` at module load. Both halves of that now come from three-free subpaths
 * (`@camp-dev/shaders/color` and `@camp-dev/shaders/gamut`), so it is a plain
 * import.
 */
import { useRef } from 'react';

import { Popover } from '@base-ui/react/popover';

import { ColorPopoverContents } from './ColorPopoverContents';
import { useListRowTrail } from './context';
import styles from './controls.module.css';
import type { PathInput } from './store';
import { usePropValue } from './useControl';

export interface ColorInputProps {
  path: PathInput;
  label: string;
}

export function ColorInput({ path, label }: ColorInputProps) {
  const stored = usePropValue<string>(path);
  const trail = useListRowTrail();
  const inRow = trail.length > 0;

  // "Color for stop 2" rather than a bare "Color" repeated on every row, so
  // a screen reader can tell the triggers apart.
  const name = inRow ? `${label} for ${trail.join(' > ')}` : label;

  // The picker hangs off the whole row rather than the swatch, so its width
  // spans the row's controls rather than the 24px swatch alone. Outside a
  // list the field itself is the row.
  const fieldRef = useRef<HTMLDivElement>(null);
  const anchor = () => fieldRef.current?.closest('[data-list-row]') ?? fieldRef.current;

  return (
    <div className={styles.field} ref={fieldRef}>
      {!inRow && <span className={styles.fieldLabel}>{label}</span>}
      <Popover.Root>
        <Popover.Trigger className={styles.swatchTrigger}>
          <span className={styles.srOnly}>{`Edit ${name}`}</span>
          <span aria-hidden="true" className={styles.swatch} style={{ background: stored }} />
          <span className={styles.swatchValue}>{stored}</span>
        </Popover.Trigger>
        <Popover.Portal>
          {/* Aligned to the row's end, not its start, because the end is the
              edge that holds still relative to the swatch. Both .listRow and
              .field give their label flex: 1 (controls.module.css), so the
              label absorbs every spare pixel and the swatch, value, position,
              and remove controls stay packed against the row's right edge.
              The row's left edge is the one that moves, because the row is
              254px wide in the 2xs column and around 714px once the grid
              stacks and the panel goes full-bleed. A start-aligned popup
              followed it out to the row's name, hundreds of pixels from the
              swatch the reader clicked. */}
          <Popover.Positioner align="end" anchor={anchor} sideOffset={4}>
            <Popover.Popup className={styles.colorPopup}>
              <ColorPopoverContents label={name} path={path} />
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
