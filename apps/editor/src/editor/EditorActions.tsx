'use client';

// The top-right actions cluster: export the graph as a JSON file, and import
// one back. Both move the same serialized Preset the clipboard and undo
// history use — one format, every door.
//
// A hash-based share button lived here briefly and was pulled back out:
// URL sharing is deferred until a backend can hand out short stable links
// (tracked in Linear). The import error path stays — a hand-edited file or a
// preset from a newer editor surfaces its PresetError message in the inline
// toast below the buttons, never a silent drop and never a crash.
import { useRef, useState } from 'react';
import type { ChangeEvent, ReactNode } from 'react';

import { Panel } from '@xyflow/react';

import { parsePreset, PresetError, serializePreset } from './preset';
import type { Preset } from './preset';

/** How long the toast lingers. */
const FEEDBACK_MS = 4000;

const buttonStyle = {
  padding: '6px 10px',
  background: '#1e1d27',
  border: '1px solid #2c2a38',
  borderRadius: 7,
  color: '#e8e6f2',
  font: '500 11px/1 ui-monospace, SF Mono, Menlo, monospace',
  cursor: 'pointer',
} as const;

export function EditorActions({
  buildPreset,
  onLoadPreset,
  children,
}: {
  /** Snapshots the live canvas as a preset — called at click time. */
  buildPreset: () => Preset;
  /** Puts a loaded preset on the canvas (and into the undo history). */
  onLoadPreset: (preset: Preset) => void;
  /** Extra rows for the top-right stack (the generated-code panel) — a slot
      rather than a second Panel, since two Panels in one corner overlap. */
  children?: ReactNode;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [toast, setToast] = useState<string | null>(null);

  // A new message replaces the old timer so the newest toast gets its full
  // linger.
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const showToast = (message: string) => {
    clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(null), FEEDBACK_MS);
  };

  const exportFile = () => {
    // A Blob anchor is the no-permission download path (the anchor's
    // `download` attribute), mirroring how copy/paste avoids the async
    // clipboard API's permission prompt.
    const blob = new Blob([serializePreset(buildPreset())], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');

    anchor.href = url;
    anchor.download = 'matter-graph.json';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const importFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    // Reset so picking the same file twice still fires a change event.
    event.target.value = '';

    if (file === undefined) return;

    file
      .text()
      .then((text) => onLoadPreset(parsePreset(text)))
      .catch((error: unknown) => {
        if (!(error instanceof PresetError)) throw error;
        showToast(error.message);
      });
  };

  return (
    <Panel position="top-right">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={exportFile} style={buttonStyle} type="button">
            export
          </button>
          <button onClick={() => fileInputRef.current?.click()} style={buttonStyle} type="button">
            import
          </button>
          <input
            accept="application/json"
            aria-label="import preset file"
            onChange={importFile}
            ref={fileInputRef}
            style={{ display: 'none' }}
            type="file"
          />
        </div>
        {toast !== null && (
          <output
            style={{
              maxWidth: 280,
              padding: '6px 10px',
              background: '#1e1d27',
              border: '1px solid #7c2d3e',
              borderRadius: 7,
              color: '#f0a3b5',
              font: '500 10.5px/1.4 ui-monospace, SF Mono, Menlo, monospace',
            }}
          >
            {toast}
          </output>
        )}
        {children}
      </div>
    </Panel>
  );
}
