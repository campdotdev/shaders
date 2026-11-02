'use client';

import {
  CursorSmudge,
  FlutedGlass,
  Grain,
  LiquidGradient,
  ShaderScene,
  type ShaderSceneProps,
  Vignette,
} from '@camp-dev/shaders';

export function ReededGlass(props: Omit<ShaderSceneProps, 'children'>) {
  return (
    <ShaderScene {...props}>
      <LiquidGradient
        angle={20}
        speed={0.12}
        stops={[
          { color: 'oklch(0.32 0.08 200)', position: 0 },
          { color: 'oklch(0.55 0.11 175)', position: 0.5 },
          { color: 'oklch(0.80 0.10 150)', position: 1 },
        ]}
        swirl={0.8}
      />
      <CursorSmudge decay={0.35} radius={0.2} strength={0.1} />
      <FlutedGlass
        dispersion={0.15}
        fluteWidth={64}
        highlight={0.3}
        refraction={0.8}
        shadow={0.25}
      />
      <Grain intensity={0.06} />
      <Vignette intensity={0.35} />
    </ShaderScene>
  );
}
