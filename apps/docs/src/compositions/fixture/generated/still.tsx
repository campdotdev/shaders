'use client';

import { Grain, MeshGradient, ShaderScene, type ShaderSceneProps } from '@camp-dev/shaders';

export function Fixture(props: Omit<ShaderSceneProps, 'children'>) {
  return (
    <ShaderScene {...props}>
      <MeshGradient cycleSpeed={0} speed={0} />
      <Grain intensity={0.08} />
    </ShaderScene>
  );
}
