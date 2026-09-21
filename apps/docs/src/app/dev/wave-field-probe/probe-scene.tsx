'use client';

// Raw-field probe for the wave field runtime module (SHA-157): one fixed
// stroke across the middle, stepped a fixed number of frames, then the raw
// height drawn over a flat color. Bright is a crest and dark is a trough, so
// the picture proves the ping-pong keeps state between passes, the Laplacian
// spreads the dent into a ring, and both backends agree. The paired spec
// (visual/wave-field.spec.ts) captures it with `reducedMotion=off`, because
// VisualTestPause otherwise sets the "paused" policy and the field, which
// honors the shared factor, would neither step nor take the stroke.
import { useEffect } from 'react';

import { createWaveField, ShaderScene, useShaderContext } from '@camp-dev/shaders';
import { texture, uv, vec3 } from 'three/tsl';
import { Vector2 } from 'three/webgpu';

import { addPlaneMesh } from '@/lib/meshUtils';
import { VisualTestPause } from '@/lib/visualTestHooks';

// A brisk sweep across the middle third of the canvas in one 60Hz frame.
const STROKE = { from: [0.35, 0.5], to: [0.65, 0.5], presence: 1 } as const;

// Two substeps per frame at 60Hz. 30 frames is 60 substeps, which carries the
// ring about 38 texels out from the stroke, well clear of the stamp and well
// short of the edge, so neither the brush nor the reflection is in the shot.
const FRAME_SECONDS = 1 / 60;
const FRAMES = 30;

// A flat deep blue the height is added to. Neutral enough that a crest reads
// as a lighter band and a trough as a darker one.
const FLAT_COLOR = [0.08, 0.12, 0.22] as const;

// Height units to color units. The stroke dents the surface by about 0.36
// and the spreading ring is a fraction of that, so 0.5 keeps a crest visible
// without clipping the trough to black.
const HEIGHT_GAIN = 0.5;

function WaveFieldProbe() {
  const shaderContext = useShaderContext();

  useEffect(() => {
    if (!shaderContext) return;

    const renderer = shaderContext.renderer.three;
    const size = renderer.getSize(new Vector2());
    const field = createWaveField(renderer, size.width, size.height);

    // Seed and settle the field before the scene's first frame: the step
    // draws synchronously once the renderer is initialized, and it is by the
    // time the context exists.
    field.step(FRAME_SECONDS, STROKE);
    for (let frame = 1; frame < FRAMES; frame += 1) field.step(FRAME_SECONDS);

    // An inert field (no float targets) leaves the flat color alone, which is
    // the identity behavior CursorRipple will have. The spec would then fail
    // on the missing ring, which is the point of the probe.
    const height = field.texture ? texture(field.texture).uv(uv()).r : null;
    const color =
      height === null ? vec3(...FLAT_COLOR) : vec3(...FLAT_COLOR).add(height.mul(HEIGHT_GAIN));
    const removeMesh = addPlaneMesh(shaderContext, color);

    return () => {
      removeMesh();
      field.dispose();
    };
  }, [shaderContext]);

  return null;
}

export default function ProbeScene() {
  return (
    // Fixed and stacked above the site header (z-index 1) and the search
    // portal (2): the spec screenshots the canvas element's box, which would
    // otherwise include whatever chrome overlaps it, and page chrome must not
    // be able to re-roll a shader baseline (the visual-regression gotcha in
    // AGENTS.md). The other probes assert pixel fractions and never needed it.
    <div style={{ position: 'fixed', inset: 0, zIndex: 10 }}>
      <ShaderScene>
        <WaveFieldProbe />
        <VisualTestPause />
      </ShaderScene>
    </div>
  );
}
