import { ShaderScene } from '@lovo/matter-react';
import { SimplexNoise } from '@matter/registry/simplex-noise';

export default function SimplexNoisePoster() {
  return (
    <ShaderScene>
      <SimplexNoise
        bias={0.5}
        contrast={2.5}
        scale={10}
        seed={0}
        softness={0}
        speed={0.2}
        stops={[
          { color: '#1837e6' },
          { color: '#661acc' },
          { color: '#9e00ba' },
          { color: '#cc1a99' },
          { color: '#00cda6' },
        ]}
      />
    </ShaderScene>
  );
}
