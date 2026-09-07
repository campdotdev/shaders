import { describe, expect, it } from 'vitest';

import { ShadersError } from './shaders-error.js';

describe('ShadersError', () => {
  it('carries code, message, and cause', () => {
    const cause = new Error('boom');
    const error = new ShadersError('renderer-init', 'init failed', { cause });

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ShadersError);
    expect(error.name).toBe('ShadersError');
    expect(error.code).toBe('renderer-init');
    expect(error.message).toBe('init failed');
    expect(error.cause).toBe(cause);
  });
});
