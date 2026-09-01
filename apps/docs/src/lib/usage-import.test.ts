import { describe, expect, it } from 'vitest';

import { deriveUsageImport } from './usage-import';

describe('deriveUsageImport', () => {
  it('collects the component and its scene wrap', () => {
    const snippet = `<ShaderScene>
  <Aurora intensity={1} stops={[...]} />
</ShaderScene>`;

    expect(deriveUsageImport(snippet)).toBe(
      "import { Aurora, ShaderScene } from '@camp-dev/shaders'",
    );
  });

  it('lists every stacked component once, sorted', () => {
    const snippet = `<ShaderScene>
  <LinearGradient />
  <Blobs />
</ShaderScene>`;

    expect(deriveUsageImport(snippet)).toBe(
      "import { Blobs, LinearGradient, ShaderScene } from '@camp-dev/shaders'",
    );
  });

  it('ignores props, string values, and lowercase tags', () => {
    const snippet = `<ShaderScene>
  <Dither pattern="bayer-8x8" pixelSize={4} levels={4} color="oklch(0.65 0.01 150)" />
</ShaderScene>`;

    expect(deriveUsageImport(snippet)).toBe(
      "import { Dither, ShaderScene } from '@camp-dev/shaders'",
    );
  });
});
