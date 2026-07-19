'use client';

import dynamic from 'next/dynamic';

import { DemoPoster } from '@/components/DemoPoster';
import { addCopyButtons } from '@/lib/paneUtils';
import { useTweakpane } from '@/lib/useTweakpane';
import { VisualTestPause } from '@/lib/visualTestHooks';

import { INITIAL, type Params } from './params';

const SimplexNoiseScene = dynamic(() => import('./scene'), { ssr: false });

const formatNumber = (numericValue: number) => String(Math.round(numericValue * 10000) / 10000);

const formatStops = (params: Params) => {
  const colorList = [params.color0, params.color1, params.color2, params.color3, params.color4];

  return colorList
    .slice(0, params.colorCount)
    .map((colorHex) => `{ color: '${colorHex}' }`)
    .join(', ');
};

const formatJsx = (params: Params) =>
  `<ShaderScene>
  <SimplexNoise
    stops={[${formatStops(params)}]}
    scale={${formatNumber(params.scale)}}
    speed={${formatNumber(params.speed)}}
    contrast={${formatNumber(params.contrast)}}
    balance={${formatNumber(params.balance)}}
    softness={${formatNumber(params.softness)}}
    seed={${params.seed}}
    colorSpace="${params.colorSpace}"
    hueInterpolation="${params.hueInterpolation}"
  />
</ShaderScene>`;

const formatParams = (params: Params) =>
  `{
  stops: [${formatStops(params)}],
  scale: ${formatNumber(params.scale)},
  speed: ${formatNumber(params.speed)},
  contrast: ${formatNumber(params.contrast)},
  balance: ${formatNumber(params.balance)},
  softness: ${formatNumber(params.softness)},
  seed: ${params.seed},
  colorSpace: '${params.colorSpace}',
  hueInterpolation: '${params.hueInterpolation}',
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
        () => formatJsx(local),
        () => formatParams(local),
      );

      pane.addBinding(local, 'scale', { min: 0.5, max: 30, step: 0.1 });
      pane.addBinding(local, 'speed', { min: 0, max: 2, step: 0.01 });
      pane.addBinding(local, 'contrast', { min: 0, max: 4, step: 0.01 });
      pane.addBinding(local, 'balance', { min: 0, max: 1, step: 0.01 });
      pane.addBinding(local, 'softness', { min: 0, max: 1, step: 0.01 });
      pane.addBinding(local, 'seed', { min: 0, max: 100, step: 1 });
      pane.addBinding(local, 'colorSpace', {
        options: {
          OKLab: 'oklab',
          OKLch: 'oklch',
          Linear: 'linear',
          LCH: 'lch',
          HSL: 'hsl',
          HSV: 'hsv',
        },
      });
      pane.addBinding(local, 'hueInterpolation', {
        label: 'hue arc',
        options: {
          shorter: 'shorter',
          longer: 'longer',
          increasing: 'increasing',
          decreasing: 'decreasing',
        },
      });
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

  return (
    <main style={{ minHeight: '100vh', position: 'relative' }}>
      <div data-shader-demo style={{ position: 'relative' }}>
        <DemoPoster
          alt="Simplex noise shader preview: posterized organic noise pattern in blue, violet, magenta, and teal"
          src="/posters/simplex-noise.png"
        >
          <SimplexNoiseScene params={params}>
            <VisualTestPause />
          </SimplexNoiseScene>
        </DemoPoster>
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
