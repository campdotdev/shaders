// @vitest-environment node
import type { AnimationPlaybackControlsWithThen } from 'motion/react';
import { describe, expect, it, vi } from 'vitest';

import { createScenePause } from './scene-pause';

// Stand-in controls that track the play state the way Motion's do, and
// finish when the test says so.
function fakeControls() {
  let finish = () => {};
  const finished = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const controls = {
    state: 'running',
    pause: vi.fn(() => {
      controls.state = 'paused';
    }),
    play: vi.fn(() => {
      controls.state = 'running';
    }),
    stop: vi.fn(() => {
      controls.state = 'idle';
    }),
    then: (resolve: () => void) => finished.then(resolve),
  };

  return {
    controls,
    held: controls as unknown as AnimationPlaybackControlsWithThen,
    finish: async () => {
      controls.state = 'finished';
      finish();
      await finished;
    },
  };
}

describe('a scene pause', () => {
  it('pauses what it holds while the scene is paused, and plays it on as the scene resumes', () => {
    const scenePause = createScenePause();
    const { controls, held } = fakeControls();

    scenePause.hold(held);
    scenePause.setPaused(true);
    expect(controls.state).toBe('paused');
    scenePause.setPaused(false);
    expect(controls.state).toBe('running');
  });

  it('starts an animation paused when the scene already is', () => {
    const scenePause = createScenePause();
    const { controls, held } = fakeControls();

    scenePause.setPaused(true);
    scenePause.hold(held);
    expect(controls.state).toBe('paused');
  });

  it('never plays a finished animation again, which would restart it', async () => {
    const scenePause = createScenePause();
    const { controls, held, finish } = fakeControls();

    scenePause.hold(held);
    await finish();
    scenePause.setPaused(true);
    scenePause.setPaused(false);
    expect(controls.play).not.toHaveBeenCalled();
  });

  it('stops an animation and lets it go when its effect cleans up', () => {
    const scenePause = createScenePause();
    const { controls, held } = fakeControls();
    const stop = scenePause.hold(held);

    stop();
    expect(controls.stop).toHaveBeenCalledOnce();
    scenePause.setPaused(true);
    expect(controls.pause).not.toHaveBeenCalled();
  });
});
