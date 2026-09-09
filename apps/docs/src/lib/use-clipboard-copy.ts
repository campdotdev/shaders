/**
 * One clipboard write with the feedback state every copy button on the
 * site shows: "copied" for a moment after a successful write, "failed" when
 * the browser refused it, and back to idle. The color picker's copy button
 * and the header's Copy React button both build on it, so a copy behaves
 * the same wherever it lives.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export type CopyStatus = 'idle' | 'copied' | 'failed';

/**
 * What a live region reads out for each state. A changed aria-label on the
 * button itself would go unannounced, so callers render this in a polite
 * live region beside the button.
 */
export const COPY_ANNOUNCEMENTS: Record<CopyStatus, string> = {
  idle: '',
  copied: 'Copied',
  failed: 'Copy failed',
};

// How long the copied or failed state shows before the button returns to
// idle, in ms. Long enough to read, short enough that a second copy right
// after the first still gets fresh feedback.
const FEEDBACK_MS = 1200;

export function useClipboardCopy(): { status: CopyStatus; copy: (text: string) => void } {
  const [status, setStatus] = useState<CopyStatus>('idle');
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (feedbackTimeoutRef.current !== null) clearTimeout(feedbackTimeoutRef.current);
    };
  }, []);

  const copy = useCallback((text: string) => {
    // The write starts inside a promise chain: `navigator.clipboard` is
    // undefined outside a secure context, and a plain call would throw out
    // of the click handler, whereas here the throw lands in the rejection
    // path with every other failure.
    void Promise.resolve()
      .then(() => navigator.clipboard.writeText(text))
      .then(
        () => setStatus('copied'),
        () => setStatus('failed'),
      );

    if (feedbackTimeoutRef.current !== null) clearTimeout(feedbackTimeoutRef.current);

    feedbackTimeoutRef.current = setTimeout(() => setStatus('idle'), FEEDBACK_MS);
  }, []);

  return { status, copy };
}
