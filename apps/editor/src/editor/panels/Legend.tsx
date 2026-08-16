'use client';

// The bottom-center legend: explains what the two wire colors mean (field
// vs color) so "same colors connect" reads at a glance without opening a
// card. Split out of Editor.tsx (MAT-94 Task 11.5) to keep the editor file
// under the 300-line bar; it's static and needs no props.
import { Panel } from '@xyflow/react';

import { PORT_COLORS } from '@/editor/graph/registry';

export function Legend() {
  return (
    <Panel position="bottom-center">
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '7px 14px',
          background: '#1e1d27',
          border: '1px solid #2c2a38',
          borderRadius: 7,
          font: '500 10.5px/1 ui-monospace, SF Mono, Menlo, monospace',
          color: '#8b88a0',
        }}
      >
        {(
          [
            ['field', 'pattern (grayscale)'],
            ['color', 'color'],
          ] as const
        ).map(([portType, description]) => (
          <span key={portType} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: PORT_COLORS[portType],
              }}
            />
            {description}
          </span>
        ))}
        <span>same colors connect</span>
      </div>
    </Panel>
  );
}
