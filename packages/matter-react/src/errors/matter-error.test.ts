import { describe, expect, it } from 'vitest';

import { MatterError } from './matter-error.js';

describe('MatterError', () => {
  it('carries code, message, and cause', () => {
    const cause = new Error('boom');
    const error = new MatterError('renderer-init', 'init failed', { cause });

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(MatterError);
    expect(error.name).toBe('MatterError');
    expect(error.code).toBe('renderer-init');
    expect(error.message).toBe('init failed');
    expect(error.cause).toBe(cause);
  });
});
