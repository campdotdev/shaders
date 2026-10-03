// Pauses a scene's frame loop while nothing can be seen, the tab hidden or
// the canvas scrolled out of view, or while the app has paused the scene
// through `paused`. The loop runs only while all three allow it. ShaderScene
// creates one per mount and disposes it with the renderer.
import type { FrameScheduler } from '../frame-scheduler/frame-scheduler.js';
import { createIntersectionWatcher } from '../intersection/intersection.js';
import { createVisibilityWatcher } from '../visibility/visibility.js';

export interface PauseWatcher {
  /** Pause the loop whatever the visibility, or hand it back to the watchers. */
  setPaused(paused: boolean): void;
  /** Stop watching and release both observers. Leaves the scheduler as it is. */
  dispose(): void;
}

export function createPauseWatcher(
  canvas: HTMLCanvasElement,
  scheduler: FrameScheduler,
): PauseWatcher {
  const visibility = createVisibilityWatcher();
  const intersection = createIntersectionWatcher(canvas);
  let pausedByApp = false;

  const updatePauseState = () => {
    if (!pausedByApp && visibility.isVisible() && intersection.isInView()) scheduler.resume();
    else scheduler.pause();
  };

  updatePauseState();

  const unsubscribeVisibility = visibility.subscribe(updatePauseState);
  const unsubscribeIntersection = intersection.subscribe(updatePauseState);

  return {
    setPaused(paused) {
      pausedByApp = paused;
      updatePauseState();
    },
    dispose() {
      unsubscribeVisibility();
      unsubscribeIntersection();
      visibility.dispose();
      intersection.dispose();
    },
  };
}
