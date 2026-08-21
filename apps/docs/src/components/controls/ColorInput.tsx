'use client';

/**
 * A color prop's swatch trigger. Clicking it opens the popover holding the three
 * channel sliders and the text field; `stored` is already a canonical oklch()
 * string, so the trigger itself only has to paint it.
 *
 * This used to load the popover through `next/dynamic` with `ssr: false`,
 * because reaching the color math meant importing three/webgpu, which reads
 * `self` at module load. Both halves of that now come from three-free subpaths
 * (`@camp-dev/shaders/color` and `@camp-dev/shaders-react/gamut`), so it is a plain
 * import.
 */
import { Popover } from '@base-ui/react/popover';

import { ColorPopoverContents } from './ColorPopoverContents';
import type { PathInput } from './store';
import { usePropValue } from './useControl';

export interface ColorInputProps {
  path: PathInput;
  label: string;
}

export function ColorInput({ path, label }: ColorInputProps) {
  const stored = usePropValue<string>(path);

  return (
    <div className="controls-field">
      <span className="controls-field-label">{label}</span>
      <Popover.Root>
        <Popover.Trigger className="color-swatch-trigger">
          <span className="sr-only">{`Edit ${label}`}</span>
          <span aria-hidden="true" className="color-swatch" style={{ background: stored }} />
          <span className="color-swatch-value">{stored}</span>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner sideOffset={6}>
            <Popover.Popup className="color-popup">
              <ColorPopoverContents label={label} path={path} />
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
