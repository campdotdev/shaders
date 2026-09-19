'use client';

// Custom-mark probe for DotField, three static-or-rippling scenes. The top
// scene ripples a white triangle field over a red circle field at the same
// settings, so the triangle must stay centered in its circle if the two
// ride the wave alike. The middle scene is the edge cases at a legible
// size: a 2:1 ellipse that must come out twice as wide as tall, a square
// sized by width and height with no viewBox, a bare <svg> with no box, and
// malformed markup. The last two must each warn once and leave their cells
// empty while the others draw. The bottom scene is confetti at the default
// `dotSize` of 3, which reads the atlas at mip level 4 on a 2x display and
// at the shader's level-5 clamp on a 1x display, where a missing gutter
// would show as a sliver of a neighbor. The magenta fill is deliberate:
// only alpha is read.
import { DotField, ShaderScene } from '@camp-dev/shaders';

const TRIANGLE =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#ff00ff" d="M12 2 22 22H2z"/></svg>';
const STAR =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 2l2.9 6.9 7.1.6-5.4 4.7 1.7 7.3L12 17.8 5.7 21.5l1.7-7.3L2 9.5l7.1-.6z"/></svg>';
const WIDE_ELLIPSE =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 24"><ellipse cx="24" cy="12" rx="24" ry="12"/></svg>';
const SIZED_SQUARE =
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><rect width="24" height="24"/></svg>';
const NO_BOX = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24"/></svg>';
const MALFORMED = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M0 0';

const EDGE_CASES = [
  { svg: WIDE_ELLIPSE },
  { svg: SIZED_SQUARE },
  { svg: NO_BOX },
  { svg: MALFORMED },
] as const;
const CONFETTI = ['cross', { svg: STAR }, { svg: TRIANGLE }, { svg: TRIANGLE }] as const;

// Each scene wrapper is positioned, so each canvas fills its own band
// rather than the nearest positioned ancestor. Without this the canvases
// stack on the viewport and draw over each other.
const band = { position: 'relative', height: '33.33%' } as const;

export default function ProbeScene() {
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000' }}>
      <div style={band}>
        <ShaderScene>
          <DotField color="#FF3B30" dotSize={16} shape="circle" spacing={30} />
          <DotField color="#FFFFFF" dotSize={12} shape={{ svg: TRIANGLE }} spacing={30} />
        </ShaderScene>
      </div>
      <div style={band}>
        <ShaderScene>
          <DotField amplitude={0} color="#FFFFFF" dotSize={14} shape={EDGE_CASES} spacing={30} />
        </ShaderScene>
      </div>
      <div style={band}>
        <ShaderScene>
          <DotField amplitude={0} color="#FFFFFF" dotSize={3} shape={CONFETTI} spacing={20} />
        </ShaderScene>
      </div>
    </div>
  );
}
