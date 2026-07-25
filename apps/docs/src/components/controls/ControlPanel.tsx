'use client';

/**
 * The panel shell: title, the Reset / Copy actions, and whatever controls the
 * page puts inside it. The copy callbacks are passed in rather than computed
 * here because only the page knows its component name — see copy.ts.
 */
import { type ReactNode, useState } from 'react';

import { useResetControls } from './useControl';

const COPIED_FEEDBACK_MS = 1200;

export function ControlPanel({
  title,
  onCopyJsx,
  onCopyParams,
  children,
}: {
  title: string;
  onCopyJsx: () => string;
  onCopyParams: () => string;
  children: ReactNode;
}) {
  const reset = useResetControls();
  const [copied, setCopied] = useState<'jsx' | 'params' | null>(null);

  const copy = (kind: 'jsx' | 'params', text: string) => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(kind);
      setTimeout(() => setCopied(null), COPIED_FEEDBACK_MS);
    });
  };

  return (
    <div className="controls-panel">
      <h2 className="controls-panel-title">{title}</h2>
      <div className="controls-actions">
        <button className="controls-button" onClick={reset} type="button">
          Reset all
        </button>
        <button className="controls-button" onClick={() => copy('jsx', onCopyJsx())} type="button">
          {copied === 'jsx' ? 'Copied' : 'Copy JSX'}
        </button>
        <button
          className="controls-button"
          onClick={() => copy('params', onCopyParams())}
          type="button"
        >
          {copied === 'params' ? 'Copied' : 'Copy params'}
        </button>
      </div>
      {children}
    </div>
  );
}
