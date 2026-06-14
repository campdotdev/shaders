import { ShaderScene } from '@lovo/matter-react';
import { FilmGrain } from '@matter/registry/film-grain';
import { LinearGradient } from '@matter/registry/linear-gradient';

export default function FilmGrainPoster() {
  return (
    <ShaderScene>
      <LinearGradient />
      <FilmGrain intensity={0.45} grainBlend="additive" speed={1} />
    </ShaderScene>
  );
}
