import { describe, expect, it } from 'vitest';

import { presetFrom } from './preset';
import type { Preset, PresetEdge, PresetNode } from './preset';
import { PresetError } from './preset';
import { DEFAULT_RAMP_STOPS, defaultParamsOf, NODE_SPECS } from './registry';
import type { SpecId } from './registry';
import { presetFromHash, presetToHash } from './share-url';

/**
 * One node per registry spec, wired into a single linear chain, mirroring
 * `buildFullPreset` in `preset.test.ts` -- the codec needs to prove it
 * survives a full tour of the vocabulary, not just a trivial preset.
 */
function buildFullPreset(): Preset {
  const specIds = Object.keys(NODE_SPECS) as SpecId[];
  const nodes: PresetNode[] = specIds.map((spec, index) => ({
    id: spec,
    spec,
    position: { x: index * 160, y: 0 },
    params: defaultParamsOf(spec),
  }));
  const edges: PresetEdge[] = [
    { source: 'gradient', target: 'warp', targetHandle: 'source' },
    { source: 'noise', target: 'warp', targetHandle: 'by' },
    { source: 'warp', target: 'blend', targetHandle: 'in' },
    { source: 'fractalNoise', target: 'blend', targetHandle: 'with' },
    { source: 'blend', target: 'colorRamp', targetHandle: 'in' },
    { source: 'colorRamp', target: 'tone', targetHandle: 'in' },
    { source: 'tone', target: 'levels', targetHandle: 'in' },
    { source: 'levels', target: 'vignette', targetHandle: 'in' },
    { source: 'vignette', target: 'grain', targetHandle: 'in' },
    { source: 'grain', target: 'output', targetHandle: 'in' },
  ];

  return presetFrom(nodes, edges);
}

describe('presetToHash / presetFromHash round trip', () => {
  it('round-trips a preset touching every spec', async () => {
    const preset = buildFullPreset();
    const hash = await presetToHash(preset);
    const decoded = await presetFromHash(hash);

    expect(decoded).toEqual(preset);
  });

  it('round-trips a trivial empty preset', async () => {
    const preset = presetFrom([], []);
    const hash = await presetToHash(preset);
    const decoded = await presetFromHash(hash);

    expect(decoded).toEqual(preset);
  });

  it('produces a hash containing only the base64url alphabet, unpadded', async () => {
    const preset = buildFullPreset();
    const hash = await presetToHash(preset);

    expect(hash).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(hash).not.toContain('=');
    expect(hash).not.toContain('+');
    expect(hash).not.toContain('/');
  });

  it('accepts a hash with a leading "#"', async () => {
    const preset = presetFrom(
      [{ id: 'n1', spec: 'output', position: { x: 0, y: 0 }, params: {} }],
      [],
    );
    const hash = await presetToHash(preset);
    const decoded = await presetFromHash(`#${hash}`);

    expect(decoded).toEqual(preset);
  });

  it('preserves ramp stops through the round trip', async () => {
    const preset = presetFrom(
      [
        {
          id: 'ramp1',
          spec: 'colorRamp',
          position: { x: 0, y: 0 },
          params: { stops: DEFAULT_RAMP_STOPS },
        },
      ],
      [],
    );
    const hash = await presetToHash(preset);
    const decoded = await presetFromHash(hash);

    expect(decoded).toEqual(preset);
  });
});

describe('presetFromHash decode failures', () => {
  it('throws a damaged-link PresetError on a truncated hash', async () => {
    const preset = buildFullPreset();
    const hash = await presetToHash(preset);
    const truncated = hash.slice(0, Math.floor(hash.length / 2));

    await expect(presetFromHash(truncated)).rejects.toThrow(PresetError);
    await expect(presetFromHash(truncated)).rejects.toThrow(
      'This share link is damaged or truncated.',
    );
  });

  it('throws a damaged-link PresetError on a hash with invalid base64url characters', async () => {
    await expect(presetFromHash('not valid base64url!!!')).rejects.toThrow(PresetError);
    await expect(presetFromHash('not valid base64url!!!')).rejects.toThrow(
      'This share link is damaged or truncated.',
    );
  });

  it('throws a damaged-link PresetError on an empty hash', async () => {
    await expect(presetFromHash('')).rejects.toThrow(PresetError);
    await expect(presetFromHash('#')).rejects.toThrow(PresetError);
  });

  it("lets a decoded-but-invalid preset throw parsePreset's own message unchanged", async () => {
    const badPreset = JSON.stringify({ version: 999, nodes: [], edges: [] });
    const hash = await encodeRawJsonForTest(badPreset);

    await expect(presetFromHash(hash)).rejects.toThrow(
      'This preset needs a newer editor (preset version 999, editor supports 1).',
    );
  });
});

/** Encodes arbitrary JSON the same way `presetToHash` does, without going
    through `serializePreset` -- lets the "bad preset, not bad bytes" test
    produce a hash that decodes cleanly but fails `parsePreset` validation. */
async function encodeRawJsonForTest(json: string): Promise<string> {
  const stream = new Blob([json]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  let binary = '';

  for (const byte of bytes) binary += String.fromCharCode(byte);

  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}
