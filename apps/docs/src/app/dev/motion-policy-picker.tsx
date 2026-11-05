'use client';

// The motion-policy picker the cursor probes share. It sets the app's
// reduced-motion policy while a probe is open, so a review can check each
// policy without changing the system setting, and restores the app's policy
// when the probe closes.
import { useEffect, useState } from 'react';

import {
  getReducedMotionPolicy,
  type ReducedMotionPolicy,
  setReducedMotionPolicy,
} from '@camp-dev/shaders';

const POLICIES: Array<{ value: ReducedMotionPolicy; label: string }> = [
  { value: 'auto', label: 'Follow system' },
  { value: 'off', label: 'Full speed' },
  { value: 'slow', label: 'Slow' },
  { value: 'paused', label: 'Paused, clear effect' },
];

export function MotionPolicyPicker() {
  const [motion, setMotion] = useState<ReducedMotionPolicy>(getReducedMotionPolicy);

  // Restore the app's policy when leaving the dev-only probe.
  useEffect(() => {
    const previous = getReducedMotionPolicy();

    return () => setReducedMotionPolicy(previous);
  }, []);

  return (
    <label>
      Motion policy{' '}
      <select
        onChange={(event) => {
          const next = POLICIES.find(({ value }) => value === event.target.value);

          if (next) {
            setMotion(next.value);
            setReducedMotionPolicy(next.value);
          }
        }}
        value={motion}
      >
        {POLICIES.map(({ value, label }) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
}
