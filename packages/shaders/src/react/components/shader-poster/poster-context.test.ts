import { afterEach, describe, expect, it, vi } from 'vitest';

describe('PosterContext', () => {
  afterEach(() => {
    vi.resetModules();
  });

  it('returns the same context object across module re-evaluations', async () => {
    const firstEvaluation = await import('./poster-context.js');

    vi.resetModules();
    const secondEvaluation = await import('./poster-context.js');

    // The index and poster package entries each bundle a copy of this module;
    // both copies must resolve to one context or provider and consumer split.
    expect(secondEvaluation.PosterContext).toBe(firstEvaluation.PosterContext);
  });
});
