import { describe, expect, it } from 'vitest';

import { resolvePlaywright } from './playwright.js';

describe('resolvePlaywright', () => {
  it('returns the playwright module if installed in the project', async () => {
    // shaders-cli itself has playwright as a devDep, so resolution from its own
    // project root must succeed.
    const cliRoot = new URL('../../', import.meta.url).pathname;
    const pw = await resolvePlaywright(cliRoot);

    expect(pw).toBeDefined();
    expect(typeof pw.chromium.launch).toBe('function');
  });

  it('throws a helpful error when playwright is missing', async () => {
    // /tmp has no playwright. Use a fresh tmpdir to be safe.
    const { mkdtemp } = await import('node:fs/promises');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const dir = await mkdtemp(join(tmpdir(), 'matter-no-pw-'));

    await expect(resolvePlaywright(dir)).rejects.toThrow(/Install playwright to use this command/);
  });
});
