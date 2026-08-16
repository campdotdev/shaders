// The permanent eject-parity gate, source half: the checked-in
// generated.gen.tsx must be EXACTLY what the emitter produces for the
// starter graph today — the file can only change by re-running the
// generator, never by hand-edit.
//
// Two modes, same test:
//   check (default):  pnpm --filter @matter/editor test parity
//   regenerate:       REGEN_PARITY=1 pnpm --filter @matter/editor test parity
//
// The pixel half lives in apps/docs-tests/visual/editor-parity.spec.ts,
// which drives /parity/runtime (the editor's live compiler) and
// /parity/generated (this checked-in file) to the SAME screenshot baseline.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { emitComponentSource } from './emit';
import type { GraphEdge } from './graph';
import { defaultParamsOf } from './registry';
import { STARTER_EDGES, STARTER_NODES } from './starter-graph';

const starterNodes = STARTER_NODES.map(({ id, spec }) => ({
  id,
  spec,
  params: defaultParamsOf(spec),
}));
const starterEdges: GraphEdge[] = STARTER_EDGES.map((edge) => ({ ...edge }));
const source = emitComponentSource(starterNodes, starterEdges, 'output-1');

const here = dirname(fileURLToPath(import.meta.url));
const target = join(here, '..', '..', 'app', 'parity', 'generated.gen.tsx');

describe('eject parity (source half)', () => {
  it('matches the checked-in generated component byte-for-byte', () => {
    if (process.env.REGEN_PARITY === '1') {
      writeFileSync(target, source);
    }

    let checkedIn: string;

    try {
      checkedIn = readFileSync(target, 'utf8');
    } catch {
      throw new Error(
        `generated.gen.tsx is missing — regenerate it:\n` +
          `  REGEN_PARITY=1 pnpm --filter @matter/editor test parity`,
      );
    }

    expect(
      checkedIn,
      `generated.gen.tsx drifted from the emitter. If the emitter change is intentional, regenerate:\n` +
        `  REGEN_PARITY=1 pnpm --filter @matter/editor test parity`,
    ).toBe(source);
  });
});
