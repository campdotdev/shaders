'use client';

/**
 * The panel shell: the "Shader Controls" title row with its Reset button,
 * then whatever controls the page puts inside it. The Copy JSX and Copy
 * params buttons that used to live here are moving to the page header's
 * copy menu (SHA-115); copy.ts keeps the formatters ready for that.
 */
import type { ReactNode } from 'react';

import { ResetIcon } from '@/components/icons/reset';
import { TextButton } from '@/components/text-button/text-button';

import styles from './controls.module.css';
import { useResetControls } from './useControl';

export function ControlPanel({ children }: { children: ReactNode }) {
  const reset = useResetControls();

  return (
    <div aria-label="Shader controls" className={styles.panel} role="group">
      <div className={styles.titleRow}>
        <p className={styles.title}>Shader Controls</p>
        <TextButton onClick={reset}>
          <ResetIcon />
          Reset
        </TextButton>
      </div>
      {children}
    </div>
  );
}
