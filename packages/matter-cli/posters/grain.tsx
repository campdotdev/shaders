import { ShaderScene } from '@lovo/matter-react';
import { Grain } from '@matter/registry/grain';
import { LinearGradient } from '@matter/registry/linear-gradient';

export default function GrainPoster() {
  return (
    <ShaderScene>
      <LinearGradient />
      <Grain grainBlend="additive" intensity={0.45} speed={1} />
    </ShaderScene>
  );
}
