import { ShaderScene } from '@lovo/matter-react';
import { Grain } from '@matter/registry/grain';
import { MeshGradient } from '@matter/registry/mesh-gradient';

export default function MeshGradientPoster() {
  return (
    <ShaderScene>
      <MeshGradient
        amplitude={30}
        cycleEase={0.6}
        cycleSpeed={0.5}
        frequency={5}
        palettes={[
          ['#bcdc33', '#0ae24b', '#00cda6', '#007bc6'],
          ['#ecb100', '#ee6600', '#ff0029', '#cc1a99'],
        ]}
        speed={2}
      />
      <Grain intensity={0.08} speed={1} />
    </ShaderScene>
  );
}
