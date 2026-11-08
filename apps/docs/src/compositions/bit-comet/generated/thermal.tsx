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
          { color: 'oklch(0.9 0 0)', position: 0.9 },
          { color: 'oklch(0.9 0 0)' },
        ]}
        stretch={1.5}
      />
      <CursorTrail decay={0.2} hold={true} intensity={1.2} radius={0.1} />
      <PaletteMap
        colors={[
          'oklch(0.99 0 0)',
          'oklch(0.26 0.039 271)',
          'oklch(0.54 0.18 270)',
          'oklch(0.82 0.158 85)',
          'oklch(0.92 0.215 120)',
          'oklch(0.61 0.195 31)',
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
