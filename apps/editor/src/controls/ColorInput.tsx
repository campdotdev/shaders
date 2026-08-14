'use client';

/**
 * A color prop's swatch trigger. Clicking it opens the popover holding the three
 * channel sliders and the text field; `value` is already a canonical oklch()
 * string, so the trigger itself only has to paint it.
 *
 * Ported from apps/docs/src/components/controls/ColorInput.tsx (the docs demo
 * panels' color picker). The only change is the prop surface: the docs version
 * reads/writes a path into a shared control store; this one takes plain
 * `value`/`onChange`/`onCommit` props, since the editor has no equivalent
 * store — a ramp row wires these straight to `ParamStore.setStopColor` (glide)
 * and the node's `stops` array (commit). The OKLCH editing and oklch()-string
 * output are unchanged, which is what keeps wide-gamut input working —
 * `parseColorString` accepts only hex/oklch()/oklab().
 */
import { Popover } from '@base-ui/react/popover';

import { ColorPopoverContents } from './ColorPopoverContents';

export interface ColorInputProps {
  label: string;
  /** The committed color, as an oklch() string. */
  value: string;
  /** Fires on every channel-slider preview tick — writes straight to the ramp-stop uniform (glide, no rebuild). */
  onChange: (value: string) => void;
  /** Fires once a gesture settles (slider release, typed Enter/blur) — mirrors into node data. */
  onCommit: (value: string) => void;
}

export function ColorInput({ label, value, onChange, onCommit }: ColorInputProps) {
  return (
    <Popover.Root>
      <Popover.Trigger className="color-swatch-trigger nodrag">
        <span className="sr-only">{`Edit ${label}`}</span>
        <span aria-hidden="true" className="color-swatch" style={{ background: value }} />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={6}>
          <Popover.Popup className="color-popup">
            <ColorPopoverContents
              label={label}
              onChange={onChange}
              onCommit={onCommit}
              value={value}
            />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
