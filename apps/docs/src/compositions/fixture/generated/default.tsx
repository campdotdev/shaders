'use client';

import { Grain, MeshGradient, ShaderScene, type ShaderSceneProps } from '@camp-dev/shaders';

export function Fixture(props: Omit<ShaderSceneProps, 'children'>) {
  return (
    <ShaderScene {...props}>
      <MeshGradient speed={0.4} />
      <Grain intensity={0.08} />
    </ShaderScene>
  );
}
