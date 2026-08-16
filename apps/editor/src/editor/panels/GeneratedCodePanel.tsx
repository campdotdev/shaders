'use client';

// The eject-to-code panel: a "view code" toggle revealing the generated
// component source, with copy and download. Rendered inside EditorActions'
// top-right stack. The source arrives as a prop — Editor regenerates it on
// any graph or param change while the panel is open, so the code always
// mirrors what the Output card is rendering.
import { useEffect, useRef, useState } from 'react';

import { downloadTextFile } from '@/lib/download';

const COPY_LABELS = { idle: 'copy', copied: 'copied', failed: 'copy failed' } as const;

export function GeneratedCodePanel({
  open,
  onToggle,
  source,
}: {
  open: boolean;
  onToggle: () => void;
  source: string;
}) {
  // The copy button reports what actually happened — clipboard writes can
  // fail (permissions, non-secure context) and silence would read as success.
  // Each result remembers the source it wrote, and the label only claims
  // "copied"/"copy failed" while that source is still the one on screen — so
  // a graph edit resets the button, and a slow writeText resolving after the
  // edit can't claim code the clipboard doesn't hold.
  const [copyResult, setCopyResult] = useState<{
    source: string;
    state: 'copied' | 'failed';
  } | null>(null);
  const copyState = copyResult !== null && copyResult.source === source ? copyResult.state : 'idle';

  // Latest source, readable from the async clipboard callbacks: a result for
  // a source that's already been replaced is dropped instead of stored, so it
  // can't clobber a fresher result from a later click.
  const latestSource = useRef(source);

  useEffect(() => {
    latestSource.current = source;
  }, [source]);

  const copy = () => {
    // The DOM types say clipboard always exists, but outside a secure
    // context it's undefined and writeText would throw synchronously — past
    // the .catch. The widening assertion lets the guard route that case into
    // the "copy failed" label.
    const clipboard = navigator.clipboard as Clipboard | undefined;

    if (clipboard === undefined) {
      setCopyResult({ source, state: 'failed' });

      return;
    }
    clipboard
      .writeText(source)
      .then(() => {
        if (latestSource.current === source) setCopyResult({ source, state: 'copied' });
      })
      .catch(() => {
        if (latestSource.current === source) setCopyResult({ source, state: 'failed' });
      });
  };

  const download = () => {
    downloadTextFile('generated-shader.tsx', source, 'text/plain');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
      <button
        onClick={onToggle}
        style={{
          padding: '6px 10px',
          background: '#1e1d27',
          border: '1px solid #2c2a38',
          borderRadius: 7,
          color: '#e8e6f2',
          font: '500 11px/1 ui-monospace, SF Mono, Menlo, monospace',
          cursor: 'pointer',
        }}
        type="button"
      >
        {open ? 'hide code' : 'view code'}
      </button>
      {open && (
        <div
          style={{
            width: 460,
            maxHeight: '72vh',
            display: 'flex',
            flexDirection: 'column',
            background: '#16151df2',
            border: '1px solid #2c2a38',
            borderRadius: 9,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 12px',
              borderBottom: '1px solid #2c2a38',
              font: '600 10.5px/1 ui-monospace, SF Mono, Menlo, monospace',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: '#8b88a0',
            }}
          >
            generated component
            <button
              onClick={copy}
              style={{
                marginLeft: 'auto',
                padding: '4px 10px',
                background: '#2c2a38',
                border: 0,
                borderRadius: 5,
                color: '#e8e6f2',
                font: '500 10.5px/1 ui-monospace, SF Mono, Menlo, monospace',
                cursor: 'pointer',
              }}
              type="button"
            >
              {COPY_LABELS[copyState]}
            </button>
            <button
              onClick={download}
              style={{
                padding: '4px 10px',
                background: '#2c2a38',
                border: 0,
                borderRadius: 5,
                color: '#e8e6f2',
                font: '500 10.5px/1 ui-monospace, SF Mono, Menlo, monospace',
                cursor: 'pointer',
              }}
              type="button"
            >
              download
            </button>
          </div>
          <pre
            style={{
              margin: 0,
              padding: 12,
              overflow: 'auto',
              font: '400 10.5px/1.55 ui-monospace, SF Mono, Menlo, monospace',
              color: '#d6d4e4',
            }}
          >
            {source}
          </pre>
        </div>
      )}
    </div>
  );
}
