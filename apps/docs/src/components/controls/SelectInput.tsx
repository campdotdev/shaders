'use client';

/**
 * An enum prop (colorSpace, hueInterpolation, blend). Base UI's Select gives a
 * styleable listbox with correct roles and keyboard behaviour, which a native
 * <select> can't be styled into.
 */
import { Select } from '@base-ui/react/select';

import { ChevronDownIcon } from '@/components/icons/chevron-down';
import popupStyles from '@/components/popup/popup.module.css';

import styles from './controls.module.css';
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
      <div className={styles.field}>
        <Select.Label className={styles.fieldLabel}>{label}</Select.Label>
        <Select.Trigger className={`${styles.textBox} ${styles.selectTrigger}`}>
          <Select.Value className={styles.selectValue} />
          <Select.Icon className={styles.selectIcon}>
            <ChevronDownIcon />
          </Select.Icon>
        </Select.Trigger>
      </div>
      <Select.Portal>
        <Select.Positioner sideOffset={4}>
          <Select.Popup className={`${popupStyles.popup} ${styles.selectPopup}`}>
            <Select.List>
              {options.map(({ label: optionLabel, value: optionValue }) => (
                <Select.Item className={styles.selectItem} key={optionValue} value={optionValue}>
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
