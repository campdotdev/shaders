'use client';

// Renders the last GENERATED component for the side-by-side check against the
// editor's Output card at /dev/editor-probe — same demo graph, so the two
// should show the same animated image. Regenerate scene.gen.tsx from the demo
// graph with `pnpm --filter docs test`.
import { ShaderScene } from '@lovo/matter-react';

import { GeneratedShader } from './scene.gen';

export default function GeneratedPreview() {
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <ShaderScene>
        <GeneratedShader />
      </ShaderScene>
    </div>
  );
}
