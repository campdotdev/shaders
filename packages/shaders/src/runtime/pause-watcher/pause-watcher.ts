// Parks a scene's frame loop while nothing can be seen: the tab hidden, or
// the canvas scrolled out of view. The two watchers each vote, and the loop
// runs only while both say visible. ShaderScene creates one per mount and
// disposes it with the renderer.
import type { FrameScheduler } from '../frame-scheduler/frame-scheduler.js';
import { createIntersectionWatcher } from '../intersection/intersection.js';
import { createVisibilityWatcher } from '../visibility/visibility.js';

export interface PauseWatcher {
  /** Stop watching and release both observers. Leaves the scheduler as it is. */
  dispose(): void;
}

export function createPauseWatcher(
  canvas: HTMLCanvasElement,
  scheduler: FrameScheduler,
): PauseWatcher {
  const visibility = createVisibilityWatcher();
  const intersection = createIntersectionWatcher(canvas);

  const updatePauseState = () => {
    if (visibility.isVisible() && intersection.isInView()) scheduler.resume();
    else scheduler.pause();
  };

  updatePauseState();

  const unsubscribeVisibility = visibility.subscribe(updatePauseState);
  const unsubscribeIntersection = intersection.subscribe(updatePauseState);

  return {
    dispose() {
      unsubscribeVisibility();
      unsubscribeIntersection();
      visibility.dispose();
      intersection.dispose();
    },
  };
}
