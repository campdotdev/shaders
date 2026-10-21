/**
 * Keeps a feature card's timed animations on its live scene's time. The
 * scene pauses its loop off screen and in a hidden tab, and a scripted
 * stroke and a smudge's decay advance only while it runs, but a Motion
 * animation runs on regardless. One that strokes the scene, or waits for
 * its smudge to clear, pauses with the scene instead, so a card that
 * scrolls away mid-stroke finishes the stroke on its return.
 * reactive-scene.tsx reports the pauses, and both it and
 * reactive-illustration.tsx run their timed animations through one.
 */
import type { AnimationPlaybackControlsWithThen } from 'motion/react';

/** Pauses the animations it holds while the scene is paused. */
export interface ScenePause {
  /** Called with true when the scene pauses, and with false when it resumes. */
  setPaused: (paused: boolean) => void;
  /**
   * Holds `controls` until it finishes, paused whenever the scene is,
   * starting now. Returns its stop, for the cleanup of the effect that
   * started it.
   */
  hold: (controls: AnimationPlaybackControlsWithThen) => () => void;
}

export function createScenePause(): ScenePause {
  let paused = false;
  const held = new Set<AnimationPlaybackControlsWithThen>();

  return {
    setPaused(nowPaused) {
      paused = nowPaused;
      for (const controls of held) {
        // Only a paused animation plays on: play() restarts a finished one.
        if (nowPaused) controls.pause();
        else if (controls.state === 'paused') controls.play();
      }
    },
    hold(controls) {
      held.add(controls);
      if (paused) controls.pause();
      void controls.then(() => held.delete(controls));

      return () => {
        held.delete(controls);
        controls.stop();
      };
    },
  };
}
