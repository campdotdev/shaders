'use client';

import dynamic from 'next/dynamic';
import Image from 'next/image';

import { palette } from '@/lib/palette';
import { addCopyButtons } from '@/lib/paneUtils';
import { useTweakpane } from '@/lib/useTweakpane';
import { VisualTestPause } from '@/lib/visualTestHooks';

const ShaderScene = dynamic(() => import('@lovo/matter-react').then((m) => m.ShaderScene), {
  ssr: false,
});
const SimplexNoise = dynamic(
  () => import('@matter/registry/simplex-noise').then((m) => m.SimplexNoise),
  { ssr: false },
);

interface Params {
  scale: number;
  speed: number;
  contrast: number;
  bias: number;
  softness: number;
  seed: number;
  colorCount: number;
  color0: string;
  color1: string;
  color2: string;
  color3: string;
  color4: string;
}

const INITIAL: Params = {
  scale: 10,
  speed: 0.2,
  contrast: 2.5,
  bias: 0.5,
  softness: 0,
  seed: 0,
  colorCount: 5,
  color0: palette.blue.base,
  color1: palette.violet.base,
  color2: palette.purple.base,
  color3: palette.magenta.base,
  color4: palette.teal.base,
};

const fmtNum = (numericValue: number) => String(Math.round(numericValue * 10000) / 10000);

const fmtColors = (params: Params) => {
  const colorList = [params.color0, params.color1, params.color2, params.color3, params.color4];

  return colorList
    .slice(0, params.colorCount)
    .map((colorHex) => `'${colorHex}'`)
    .join(', ');
};

const fmtJsx = (params: Params) =>
  `<ShaderScene>
  <SimplexNoise
    colors={[${fmtColors(params)}]}
    scale={${fmtNum(params.scale)}}
    speed={${fmtNum(params.speed)}}
    contrast={${fmtNum(params.contrast)}}
    bias={${fmtNum(params.bias)}}
    softness={${fmtNum(params.softness)}}
    seed={${params.seed}}
  />
</ShaderScene>`;

const fmtParams = (params: Params) =>
  `{
  colors: [${fmtColors(params)}],
  scale: ${fmtNum(params.scale)},
  speed: ${fmtNum(params.speed)},
  contrast: ${fmtNum(params.contrast)},
  bias: ${fmtNum(params.bias)},
  softness: ${fmtNum(params.softness)},
  seed: ${params.seed},
}`;

export default function SimplexNoisePage() {
  const [params, paneContainerRef] = useTweakpane<Params>(
    '<SimplexNoise>',
    INITIAL,
    (pane, local, sync) => {
      pane.addButton({ title: 'Reset all' }).on('click', () => {
        Object.assign(local, INITIAL);
        pane.refresh();
        sync();
      });

      addCopyButtons(
        pane,
        () => fmtJsx(local),
        () => fmtParams(local),
      );

      pane.addBinding(local, 'scale', { min: 0.5, max: 30, step: 0.1 });
      pane.addBinding(local, 'speed', { min: 0, max: 2, step: 0.01 });
      pane.addBinding(local, 'contrast', { min: 0, max: 4, step: 0.01 });
      pane.addBinding(local, 'bias', { min: 0, max: 1, step: 0.01 });
      pane.addBinding(local, 'softness', { min: 0, max: 1, step: 0.01 });
      pane.addBinding(local, 'seed', { min: 0, max: 100, step: 1 });
      pane.addBlade({ view: 'separator' });

      const colorsFolder = pane.addFolder({ title: 'Colors' });

      colorsFolder.addBinding(local, 'colorCount', {
        label: 'count',
        min: 2,
        max: 5,
        step: 1,
      });
      colorsFolder.addBinding(local, 'color0', { label: 'color 0' });
      colorsFolder.addBinding(local, 'color1', { label: 'color 1' });
      colorsFolder.addBinding(local, 'color2', { label: 'color 2' });
      colorsFolder.addBinding(local, 'color3', { label: 'color 3' });
      colorsFolder.addBinding(local, 'color4', { label: 'color 4' });

      pane.on('change', sync);
    },
  );

  const allColors = [params.color0, params.color1, params.color2, params.color3, params.color4];
  const colors = allColors.slice(0, params.colorCount);

  return (
    <main style={{ minHeight: '100vh', position: 'relative' }}>
      <div data-shader-demo style={{ position: 'relative', height: '70vh' }}>
        <Image
          alt="Simplex noise shader preview: posterized organic noise pattern in blue, violet, magenta, and teal"
          fill
          priority
          sizes="100vw"
          src="/posters/simplex-noise.png"
          style={{ objectFit: 'cover' }}
        />
        <ShaderScene>
          <SimplexNoise
            bias={params.bias}
            colors={colors}
            contrast={params.contrast}
            scale={params.scale}
            softness={params.softness}
            speed={params.speed}
            seed={params.seed}
          />
          <VisualTestPause />
        </ShaderScene>
        <div
          aria-hidden="true"
          data-tweakpane-host
          ref={paneContainerRef}
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            zIndex: 10,
            width: '320px',
          }}
        />
      </div>
      <section style={{ padding: '2rem', maxWidth: '60ch', margin: '0 auto' }}>
        <h1 style={{ marginTop: 0 }}>&lt;SimplexNoise /&gt;</h1>
        <pre
          style={{
            background: '#1a1a2a',
            color: '#e0e0f0',
            padding: '1rem',
            borderRadius: '0.5rem',
            overflow: 'auto',
            fontSize: '0.85rem',
          }}
        >
          {`import { ShaderScene } from '@lovo/matter-react'
import { SimplexNoise } from '@/components/matter/simplex-noise'

<ShaderScene>
  <SimplexNoise />
</ShaderScene>`}
        </pre>
      </section>
    </main>
  );
}
