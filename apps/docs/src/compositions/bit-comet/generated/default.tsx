'use client';

import {
  CursorTrail,
  FractalNoise,
  LedWall,
  PaletteMap,
  ShaderScene,
  type ShaderSceneProps,
} from '@camp-dev/shaders';

export function BitComet(props: Omit<ShaderSceneProps, 'children'>) {
  return (
    <ShaderScene {...props}>
      <FractalNoise
        angle={45}
        balance={0.5}
        contrast={3}
        detail={0.45}
        octaves={6}
        scale={4}
        speed={0.05}
        stops={[
          { color: 'oklch(0 0 0)' },
          { color: 'oklch(0.833 0 0)', position: 0.833 },
          { color: 'oklch(0.833 0 0)' },
        ]}
        stretch={1.5}
      />
      <CursorTrail decay={0.2} hold={true} intensity={1.2} radius={0.1} />
      <PaletteMap
        colors={[
          'oklch(0.97 0.01 90)',
          'oklch(0.45 0.17 265)',
          'oklch(0.68 0.24 0)',
          'oklch(0.88 0.17 95)',
        ]}
        pixelSize={8}
        spread={1}
      />
      <LedWall
        bleed={0.3}
        dotSize={7}
        flicker={0}
        panelColor="oklch(1 0 0)"
        spacing={8}
        swell={0}
        variation={0}
      />
    </ShaderScene>
  );
}
