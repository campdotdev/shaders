'use client';

/**
 * An enum prop (colorSpace, hueInterpolation, blend). Base UI's Select gives a
 * styleable listbox with correct roles and keyboard behaviour, which a native
 * <select> can't be styled into.
 */
import { Select } from '@base-ui/react/select';

import type { PathInput } from './store';
import { usePropValue, useSetProp } from './useControl';

export interface SelectOption {
  label: string;
  value: string;
}

export interface SelectInputProps {
  path: PathInput;
  label: string;
  options: readonly SelectOption[];
}

export function SelectInput({ path, label, options }: SelectInputProps) {
  const value = usePropValue<string>(path);
  const setProp = useSetProp();

  return (
    <Select.Root items={options} onValueChange={(next) => setProp(path, next)} value={value}>
      <div className="controls-field">
        <Select.Label className="controls-field-label">{label}</Select.Label>
        <Select.Trigger className="select-trigger">
          <Select.Value />
          <Select.Icon aria-hidden="true">▾</Select.Icon>
        </Select.Trigger>
      </div>
      <Select.Portal>
        <Select.Positioner sideOffset={4}>
          <Select.Popup className="select-popup">
            <Select.List>
              {options.map(({ label: optionLabel, value: optionValue }) => (
                <Select.Item className="select-item" key={optionValue} value={optionValue}>
                  <Select.ItemText>{optionLabel}</Select.ItemText>
                </Select.Item>
              ))}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}
