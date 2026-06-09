import { ShaderScene } from '@lovo/matter-react';
import { FilmGrain } from '@matter/registry/film-grain';
import { MeshGradient } from '@matter/registry/mesh-gradient';

export default function MeshGradientPoster() {
  return (
    <ShaderScene>
      <MeshGradient
        amplitude={30}
        cycleEase={0.6}
        cycleSpeed={0.5}
        frequency={5}
        paletteA={['#bcdc33', '#0ae24b', '#00cda6', '#007bc6']}
        paletteB={['#ecb100', '#ee6600', '#ff0029', '#cc1a99']}
        speed={2}
      />
      <FilmGrain intensity={0.08} speed={1} />
    </ShaderScene>
  );
}
