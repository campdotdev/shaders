'use client';

/**
 * A color prop's swatch trigger. The popover contents (plane, hue slider,
 * lightness/chroma sliders, text field) live in a dynamically-imported
 * module — parsing color strings pulls in `@lovo/matter`'s bundled WebGPU
 * renderer, which crashes any server render that reaches it. `stored` is
 * already a canonical oklch() string, so the trigger itself needs none of that.
 */
import dynamic from 'next/dynamic';

import { Popover } from '@base-ui/react/popover';

import type { PathInput } from './store';
import { usePropValue } from './useControl';

const ColorPopoverContents = dynamic(
  () => import('./ColorPopoverContents').then((module) => module.ColorPopoverContents),
  { ssr: false },
);

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
