import { describe, expect, it, vi } from 'vitest';

import { createHeroPause } from './hero-pause';

describe('createHeroPause', () => {
  it('starts with the hero playing', () => {
    expect(createHeroPause().isPaused()).toBe(false);
  });

  it('pauses the hero, then lets it play again', () => {
    const heroPause = createHeroPause();

    heroPause.setPaused(true);
    expect(heroPause.isPaused()).toBe(true);
    heroPause.setPaused(false);
    expect(heroPause.isPaused()).toBe(false);
  });

  it('tells subscribers only when the hero pauses or resumes', () => {
    const heroPause = createHeroPause();
    const onChange = vi.fn();

    heroPause.subscribe(onChange);
    heroPause.setPaused(true);
    heroPause.setPaused(true);
    expect(onChange).toHaveBeenCalledTimes(1);
    heroPause.setPaused(false);
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('stops telling a subscriber once it unsubscribes', () => {
    const heroPause = createHeroPause();
    const onChange = vi.fn();
    const unsubscribe = heroPause.subscribe(onChange);

    unsubscribe();
    heroPause.setPaused(true);
    expect(onChange).not.toHaveBeenCalled();
  });
});
