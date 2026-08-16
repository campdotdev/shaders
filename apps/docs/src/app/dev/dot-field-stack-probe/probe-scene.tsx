'use client';

// Stacking probe for DotField: white dots over a bright static gradient in
// ONE ShaderScene. The space between dots must show the gradient — a
// DotField that ignores its fragment alpha overwrites the layer beneath and
// the canvas shows the page background (black) there instead. The paired
// spec (visual/dot-field-stack.spec.ts) asserts pixel-color fractions, so
// there is no screenshot baseline to regenerate.
import { ShaderScene } from '@lovo/matter-react';
import { DotField } from '@matter/registry/dot-field';
import { LinearGradient } from '@matter/registry/linear-gradient';

import { VisualTestPause } from '@/lib/visualTestHooks';

// Bright warm stops: unmistakable against both the black page background
// (what shows through where the canvas alpha is 0) and the white dots.
const BACKGROUND_STOPS = [{ color: 'oklch(0.65 0.2 30)' }, { color: 'oklch(0.8 0.16 90)' }];

export default function ProbeScene() {
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000' }}>
      <ShaderScene>
        <LinearGradient angle={90} speed={0} stops={BACKGROUND_STOPS} />
        <DotField color="#FFFFFF" dotSize={4} />
        <VisualTestPause />
      </ShaderScene>
    </div>
  );
}
