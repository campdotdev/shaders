import { describe, expect, it } from 'vitest';

import { rewriteImports } from './rewriteImports.js';

describe('rewriteImports', () => {
  it('rewrites @matter-internal/X to <alias>/X when an alias matches', () => {
    const src = `import { foo } from '@matter-internal/lib'\n`;
    const out = rewriteImports(src, { '@matter-internal/': '@/lib/matter/' });

    expect(out).toBe(`import { foo } from '@/lib/matter/lib'\n`);
  });

  it('handles double-quoted imports', () => {
    const src = `import { foo } from "@matter-internal/lib"\n`;
    const out = rewriteImports(src, { '@matter-internal/': '@/lib/matter/' });

    expect(out).toBe(`import { foo } from "@/lib/matter/lib"\n`);
  });

  it('handles dynamic imports', () => {
    const src = `const x = await import('@matter-internal/lib')\n`;
    const out = rewriteImports(src, { '@matter-internal/': '@/lib/matter/' });

    expect(out).toBe(`const x = await import('@/lib/matter/lib')\n`);
  });

  it('leaves unrelated imports alone', () => {
    const src =
      `import { LinearGradient } from '@mattermix/shaders-react'\n` +
      `import { foo } from '@matter-internal/lib'\n`;
    const out = rewriteImports(src, { '@matter-internal/': '@/lib/matter/' });

    expect(out).toContain(`import { LinearGradient } from '@mattermix/shaders-react'`);
    expect(out).toContain(`import { foo } from '@/lib/matter/lib'`);
  });

  it('is a no-op when no alias matches', () => {
    const src = `import { LinearGradient } from '@mattermix/shaders-react'\n`;
    const out = rewriteImports(src, { '@/': 'src/' });

    expect(out).toBe(src);
  });

  it('handles multiple aliases', () => {
    const src = `import { a } from '@matter-internal/lib'\n` + `import { b } from '@/utils'\n`;
    const out = rewriteImports(src, {
      '@matter-internal/': '@/lib/matter/',
      '@/': 'src/',
    });

    expect(out).toContain(`from '@/lib/matter/lib'`); // @matter-internal/ wins because longer prefix
    expect(out).toContain(`from 'src/utils'`);
  });
});
