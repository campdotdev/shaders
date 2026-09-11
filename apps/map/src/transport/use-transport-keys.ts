// Space toggles play, the arrow keys step. Space is ignored while any form
// control has focus, including a button, because Space already activates a
// focused button and would fire twice. The arrow keys are ignored only while
// an input, select, or textarea has focus, where the arrow keys already have
// native meaning; a focused transport button does not block them, so the
// keys keep stepping right after a click on the bar.
import { useEffect } from 'react';

import { playback } from '@/timeline/store';

const SPACE_BLOCKING_TAGS = new Set(['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA']);
const ARROW_BLOCKING_TAGS = new Set(['INPUT', 'SELECT', 'TEXTAREA']);

export function useTransportKeys(): void {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      const targetTag = event.target instanceof HTMLElement ? event.target.tagName : '';

      if (event.key === ' ') {
        if (SPACE_BLOCKING_TAGS.has(targetTag)) return;

        event.preventDefault();
        playback.toggle();
      } else if (event.key === 'ArrowRight') {
        if (ARROW_BLOCKING_TAGS.has(targetTag)) return;

        playback.stepForward();
      } else if (event.key === 'ArrowLeft') {
        if (ARROW_BLOCKING_TAGS.has(targetTag)) return;

        playback.stepBack();
      }
    }

    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);
}
