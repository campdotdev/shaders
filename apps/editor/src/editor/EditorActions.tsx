'use client';

// The top-right actions cluster: export the graph as a JSON file, import one
// back, and share it as a URL. All three move the same serialized Preset the
// clipboard and undo history use — one format, four doors.
//
// This component also owns the mount-time half of sharing: a non-empty
// `location.hash` is decoded and loaded here, and every failure path — a
// clipped share link, a hand-edited file, a preset from a newer editor —
// surfaces its PresetError message in the inline toast below the buttons.
// Errors are never silently dropped (the person holding a broken link needs
// to know it's broken), and never thrown (a bad hash still leaves a working
// editor on the starter graph).
import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';

import { Panel } from '@xyflow/react';

import { parsePreset, PresetError, serializePreset } from './preset';
import type { Preset } from './preset';
import { presetFromHash, presetToHash } from './share-url';

/** How long the toast and the share button's copied/failed flash linger. */
const FEEDBACK_MS = 4000;

/** What the share button currently reads — flips to "copied"/"failed" for a
    beat after a click (the probe's button-state pattern) so the copy has
    visible feedback without a toast. */
type ShareLabel = 'share' | 'copied' | 'failed';

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
}: {
  /** Snapshots the live canvas as a preset — called at click time. */
  buildPreset: () => Preset;
  /** Puts a loaded preset on the canvas (and into the undo history). */
  onLoadPreset: (preset: Preset) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [shareLabel, setShareLabel] = useState<ShareLabel>('share');

  // One timer per feedback kind; a new message replaces the old timer so the
  // newest feedback always gets its full linger.
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const shareTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const showToast = (message: string) => {
    clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(null), FEEDBACK_MS);
  };

  const flashShare = (label: Exclude<ShareLabel, 'share'>) => {
    clearTimeout(shareTimer.current);
    setShareLabel(label);
    shareTimer.current = setTimeout(() => setShareLabel('share'), FEEDBACK_MS);
  };

  useEffect(() => {
    return () => {
      clearTimeout(toastTimer.current);
      clearTimeout(shareTimer.current);
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Hash load — the receiving end of a share link, run once on mount.
  // ---------------------------------------------------------------------------

  // The empty dep array on the load effect is deliberate: a share link is an
  // entry point, not a subscription. Later in-page hash writes (the share
  // button's own, say) must not re-load the graph out from under the user.
  // The ref keeps the callback fresh without re-running the load; it's
  // written in an effect, never during render (not concurrent-safe there).
  const loadPresetRef = useRef(onLoadPreset);

  useEffect(() => {
    loadPresetRef.current = onLoadPreset;
  });

  useEffect(() => {
    const hash = window.location.hash;

    if (hash.length <= 1) return;

    presetFromHash(hash)
      .then((preset) => loadPresetRef.current(preset))
      .catch((error: unknown) => {
        if (!(error instanceof PresetError)) throw error;
        showToast(error.message);
      });
  }, []);

  // ---------------------------------------------------------------------------
  // The three verbs
  // ---------------------------------------------------------------------------

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

  const share = () => {
    presetToHash(buildPreset())
      .then(async (hash) => {
        window.location.hash = hash;
        // Writing the clipboard IS gated on a user gesture, but needs no
        // permission prompt the way reading does — and this runs directly
        // from the click.
        await navigator.clipboard.writeText(window.location.href);
        flashShare('copied');
      })
      .catch(() => flashShare('failed'));
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
          <button onClick={share} style={buttonStyle} type="button">
            {shareLabel}
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
      </div>
    </Panel>
  );
}
