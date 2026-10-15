import { describe, expect, it, vi } from 'vitest';

import { createHeroPause } from './hero-pause';

describe('createHeroPause', () => {
  it('starts with the hero playing', () => {
    expect(createHeroPause().isPaused()).toBe(false);
  });

  it('pauses the hero, then lets it play again', () => {
    const heroPause = createHeroPause();
    const release = heroPause.pause();

    expect(heroPause.isPaused()).toBe(true);
    release();
    expect(heroPause.isPaused()).toBe(false);
  });

  // A playing favorite and a feature card's story can overlap, and the
  // first to stop must not resume the hero under the other.
  it('keeps the hero paused until every pause is released', () => {
    const heroPause = createHeroPause();
    const releaseFavorite = heroPause.pause();
    const releaseCard = heroPause.pause();

    releaseFavorite();
    expect(heroPause.isPaused()).toBe(true);
    releaseCard();
    expect(heroPause.isPaused()).toBe(false);
  });

  it('counts a release only once', () => {
    const heroPause = createHeroPause();
    const releaseFavorite = heroPause.pause();

    heroPause.pause();
    releaseFavorite();
    releaseFavorite();
    expect(heroPause.isPaused()).toBe(true);
  });

  it('tells subscribers only when the hero pauses or resumes', () => {
    const heroPause = createHeroPause();
    const onChange = vi.fn();

    heroPause.subscribe(onChange);
    const releaseFirst = heroPause.pause();
    const releaseSecond = heroPause.pause();

    expect(onChange).toHaveBeenCalledTimes(1);
    releaseFirst();
    expect(onChange).toHaveBeenCalledTimes(1);
    releaseSecond();
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('stops telling a subscriber once it unsubscribes', () => {
    const heroPause = createHeroPause();
    const onChange = vi.fn();
    const unsubscribe = heroPause.subscribe(onChange);

    unsubscribe();
    heroPause.pause();
    expect(onChange).not.toHaveBeenCalled();
  });
});
