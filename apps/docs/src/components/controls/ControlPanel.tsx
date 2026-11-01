'use client';

/**
 * The panel shell: the title row with its Reset button, then whatever
 * controls the page puts inside it. Demo pages keep the "Shader Controls"
 * title, and a composition's page titles its panel "Customize". The title
 * also names the panel's group for a screen reader.
 */
import { type ReactNode, useId } from 'react';

import { ResetIcon } from '@/components/icons/reset';
import textButtonStyles from '@/components/text-button/text-button.module.css';

import styles from './controls.module.css';
import { useResetControls } from './useControl';

export function ControlPanel({
  title = 'Shader Controls',
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  const reset = useResetControls();
  const titleId = useId();

  return (
    <div aria-labelledby={titleId} className={styles.panel} role="group">
      <div className={styles.titleRow}>
        <p className={styles.title} id={titleId}>
          {title}
        </p>
        <button
          className={`${textButtonStyles.box} ${textButtonStyles.button}`}
          onClick={reset}
          type="button"
        >
          <ResetIcon />
          Reset
        </button>
      </div>
      {children}
    </div>
  );
}
