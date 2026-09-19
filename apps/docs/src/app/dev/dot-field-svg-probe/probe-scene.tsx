'use client';

// Custom-mark probe for DotField: a triangle passed as inline SVG, drawn at
// every grid point. The top scene ripples a white triangle field over a red
// circle field at the same settings, so the triangle must stay centered in
// its circle if the two ride the wave alike. The bottom scene is confetti:
// a cross, a star, and two triangles in one array, at amplitude 0 so its
// frame loop parks and the custom marks only show if the decode's own
// repaint lands. `dotSize` 4 there puts the atlas reads at the deepest
// mip level the shader allows on a 2x display, where a missing gutter or
// a level past the clamp would show as a sliver of a neighbor. The
// magenta fill is deliberate: only alpha is read.
import { DotField, ShaderScene } from '@camp-dev/shaders';

const TRIANGLE =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#ff00ff" d="M12 2 22 22H2z"/></svg>';
const STAR =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 2l2.9 6.9 7.1.6-5.4 4.7 1.7 7.3L12 17.8 5.7 21.5l1.7-7.3L2 9.5l7.1-.6z"/></svg>';

const CONFETTI = ['cross', { svg: STAR }, { svg: TRIANGLE }, { svg: TRIANGLE }] as const;

export default function ProbeScene() {
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000' }}>
      {/* Each half is positioned, so each scene's canvas fills its own
          half rather than the nearest positioned ancestor. Without this
          the two canvases stack on the viewport and the rippling field
          draws over the static one. */}
      <div style={{ position: 'relative', height: '50%' }}>
        <ShaderScene>
          <DotField color="#FF3B30" dotSize={16} shape="circle" spacing={30} />
          <DotField color="#FFFFFF" dotSize={12} shape={{ svg: TRIANGLE }} spacing={30} />
        </ShaderScene>
      </div>
      <div style={{ position: 'relative', height: '50%' }}>
        <ShaderScene>
          <DotField amplitude={0} color="#FFFFFF" dotSize={4} shape={CONFETTI} spacing={20} />
        </ShaderScene>
      </div>
    </div>
  );
}
