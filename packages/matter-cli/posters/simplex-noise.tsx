import { ShaderScene } from '@lovo/matter-react';
import { SimplexNoise } from '@matter/registry/simplex-noise';

export default function SimplexNoisePoster() {
  return (
    <ShaderScene>
      <SimplexNoise
        bias={0.5}
        colors={['#1837e6', '#661acc', '#9e00ba', '#cc1a99', '#00cda6']}
        focus={2.5}
        scale={10}
        softness={0}
        speed={0.2}
        variant={0}
      />
    </ShaderScene>
  );
}
