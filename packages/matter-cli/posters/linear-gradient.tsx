import { ShaderScene } from '@lovo/matter-react';
import { LinearGradient } from '@matter/registry/linear-gradient';

export default function LinearGradientPoster() {
  return (
    <ShaderScene>
      <LinearGradient
        angle={90}
        colors={['#661acc', '#9e00ba', '#8c0067']}
        focalPoint={[0.5, 0.5]}
        speed={0}
        stops={[0, 0.5, 1]}
      />
    </ShaderScene>
  );
}
