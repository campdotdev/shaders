'use client';

// The generated half of the eject-parity comparison: the CHECKED-IN emitter
// output (../generated.gen.tsx — regenerate via REGEN_PARITY=1, never
// hand-edit) mounted exactly the way its file-top comment says to, inside a
// full-viewport ShaderScene. The visual spec drives this and /parity/runtime
// to the same screenshot baseline; parity.test.ts keeps the file honest
// against the emitter.
import { ShaderScene } from '@camp-dev/shaders-react';

import VisualTestPause from '@/lib/VisualTestPause';

import { GeneratedShader } from '../generated.gen';

export default function ParityGeneratedScene() {
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000' }}>
      <ShaderScene>
        <GeneratedShader />
        <VisualTestPause />
      </ShaderScene>
    </div>
  );
}
