// Space toggles play, the arrow keys step. Ignored while a form control has
// focus, because Space already activates a focused button and would fire
// twice.
import { useEffect } from 'react';

import { playback } from '@/timeline/store';

const FORM_TAGS = new Set(['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA']);

export function useTransportKeys(): void {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.target instanceof HTMLElement && FORM_TAGS.has(event.target.tagName)) return;

      if (event.code === 'Space') {
        event.preventDefault();
        playback.toggle();
      } else if (event.key === 'ArrowRight') {
        playback.stepForward();
      } else if (event.key === 'ArrowLeft') {
        playback.stepBack();
      }
    }

    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);
}
