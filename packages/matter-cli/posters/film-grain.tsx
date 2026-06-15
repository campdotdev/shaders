import { ShaderScene } from '@lovo/matter-react';
import { FilmGrain } from '@matter/registry/film-grain';
import { LinearGradient } from '@matter/registry/linear-gradient';

export default function FilmGrainPoster() {
  return (
    <ShaderScene>
      <LinearGradient />
      <FilmGrain grainBlend="additive" intensity={0.45} speed={1} />
    </ShaderScene>
  );
}
