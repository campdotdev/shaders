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
        speed={0.08}
        stops={[
          { color: 'oklch(0.18 0.01 260)', position: 0 },
          { color: 'oklch(0.42 0.015 260)', position: 0.5 },
          { color: 'oklch(0.78 0.01 260)', position: 1 },
        ]}
        swirl={1.1}
      />
      <CursorSmudge decay={0.35} radius={0.2} strength={0.1} />
      <FlutedGlass
        angle={0}
        crossSection="flat"
        dispersion={0}
        fluteWidth={44}
        highlight={0.3}
        shadow={0.35}
      />
      <Grain intensity={0.08} />
      <Vignette intensity={0.35} />
    </ShaderScene>
  );
}
