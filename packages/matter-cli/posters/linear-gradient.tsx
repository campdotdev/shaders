import { ShaderScene } from '@lovo/matter-react';
import { LinearGradient } from '@matter/registry/linear-gradient';

export default function LinearGradientPoster() {
  return (
    <ShaderScene>
      <LinearGradient
        angle={90}
        focalPoint={[0.5, 0.5]}
        speed={0}
        stops={[
          { color: '#661acc', position: 0 },
          { color: '#9e00ba', position: 0.5 },
          { color: '#8c0067', position: 1 },
        ]}
      />
    </ShaderScene>
  );
}
