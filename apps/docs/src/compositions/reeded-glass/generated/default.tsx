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
          { color: 'oklch(0.30 0.11 345)', position: 0 },
          { color: 'oklch(0.52 0.17 15)', position: 0.5 },
          { color: 'oklch(0.76 0.14 45)', position: 1 },
        ]}
        swirl={1.1}
      />
      <CursorSmudge decay={0.35} radius={0.2} strength={0.1} />
      <FlutedGlass dispersion={0.25} fluteWidth={44} highlight={0.2} shadow={0.25} />
      <Grain intensity={0.06} />
      <Vignette intensity={0.35} />
    </ShaderScene>
  );
}
