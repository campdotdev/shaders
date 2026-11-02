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
        speed={0.18}
        stops={[
          { color: 'oklch(0.28 0.12 25)', position: 0 },
          { color: 'oklch(0.55 0.16 50)', position: 0.5 },
          { color: 'oklch(0.82 0.15 80)', position: 1 },
        ]}
        swirl={1.4}
      />
      <CursorSmudge decay={0.35} radius={0.2} strength={0.1} />
      <FlutedGlass
        crossSection="prism"
        dispersion={0.4}
        fluteWidth={28}
        highlight={0.2}
        shadow={0.25}
      />
      <Grain intensity={0.06} />
      <Vignette intensity={0.45} />
    </ShaderScene>
  );
}
