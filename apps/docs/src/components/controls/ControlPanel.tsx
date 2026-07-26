'use client';

/**
 * The panel shell: title, the Reset / Copy actions, and whatever controls the
 * page puts inside it. Copy strings are built from the store's live snapshot
 * inside the click handlers, not from a subscribed prop — reading the store
 * only at click time (via useControlStore, which does not subscribe) keeps
 * this panel from re-rendering on every drag tick of every sibling control.
 */
import { type ReactNode, useEffect, useRef, useState } from 'react';

import { useControlStore } from './context';
import { type CopyConfig, formatJsx, formatParams } from './copy';
import { useResetControls } from './useControl';

const COPIED_FEEDBACK_MS = 1200;

export function ControlPanel({
  title,
  copyConfig,
  children,
}: {
  title: string;
  copyConfig: CopyConfig;
  children: ReactNode;
}) {
  const store = useControlStore();
  const reset = useResetControls();
  const [copied, setCopied] = useState<'jsx' | 'params' | null>(null);
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (feedbackTimeoutRef.current !== null) {
        clearTimeout(feedbackTimeoutRef.current);
      }
    };
  }, []);

  const copy = (kind: 'jsx' | 'params', text: string) => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(kind);
      if (feedbackTimeoutRef.current !== null) {
        clearTimeout(feedbackTimeoutRef.current);
      }
      feedbackTimeoutRef.current = setTimeout(() => setCopied(null), COPIED_FEEDBACK_MS);
    });
  };

  return (
    <div aria-label={title} className="controls-panel" role="group">
      <p className="controls-panel-title">{title}</p>
      <div className="controls-actions">
        <button className="controls-button" onClick={reset} type="button">
          Reset all
        </button>
        <button
          className="controls-button"
          onClick={() => copy('jsx', formatJsx(copyConfig, store.getSnapshot()))}
          type="button"
        >
          {copied === 'jsx' ? 'Copied' : 'Copy JSX'}
        </button>
        <button
          className="controls-button"
          onClick={() => copy('params', formatParams(store.getSnapshot()))}
          type="button"
        >
          {copied === 'params' ? 'Copied' : 'Copy params'}
        </button>
      </div>
      {children}
    </div>
  );
}
