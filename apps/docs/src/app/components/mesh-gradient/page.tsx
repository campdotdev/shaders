'use client';

import dynamic from 'next/dynamic';
import Image from 'next/image';

import { addCopyButtons } from '@/lib/paneUtils';
import { useTweakpane } from '@/lib/useTweakpane';
import { VisualTestPause } from '@/lib/visualTestHooks';

import { INITIAL, type Params } from './params';

const MeshGradientScene = dynamic(() => import('./scene'), { ssr: false });

const formatNumber = (numericValue: number) => String(Math.round(numericValue * 10000) / 10000);

const formatPalette = (params: Params, paletteKey: 'a' | 'b') =>
  `['${params[`${paletteKey}0`]}', '${params[`${paletteKey}1`]}', '${params[`${paletteKey}2`]}', '${params[`${paletteKey}3`]}']`;

const formatJsx = (params: Params) =>
  `<ShaderScene>
  <MeshGradient
    speed={${formatNumber(params.speed)}}
    frequency={${formatNumber(params.frequency)}}
    amplitude={${formatNumber(params.amplitude)}}
    cycleSpeed={${formatNumber(params.cycleSpeed)}}
    cycleEase={${formatNumber(params.cycleEase)}}
    colorSpace="${params.colorSpace}"
    hueInterpolation="${params.hueInterpolation}"
    palettes={[
      ${formatPalette(params, 'a')},
      ${formatPalette(params, 'b')},
    ]}
  />
</ShaderScene>`;

const formatParams = (params: Params) =>
  `{
  speed: ${formatNumber(params.speed)},
  frequency: ${formatNumber(params.frequency)},
  amplitude: ${formatNumber(params.amplitude)},
  cycleSpeed: ${formatNumber(params.cycleSpeed)},
  cycleEase: ${formatNumber(params.cycleEase)},
  colorSpace: '${params.colorSpace}',
  hueInterpolation: '${params.hueInterpolation}',
  palettes: [
    ${formatPalette(params, 'a')},
    ${formatPalette(params, 'b')},
  ],
}`;

export default function MeshGradientPage() {
  const [params, paneContainerRef] = useTweakpane<Params>(
    '<MeshGradient>',
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

      pane.addBinding(local, 'speed', { min: 0, max: 5, step: 0.01 });
      pane.addBinding(local, 'frequency', { min: 0.5, max: 20, step: 0.1 });
      pane.addBinding(local, 'amplitude', { min: 5, max: 100, step: 0.5 });
      pane.addBinding(local, 'cycleSpeed', {
        label: 'palette cycle',
        min: 0,
        max: 2,
        step: 0.01,
      });
      pane.addBinding(local, 'cycleEase', {
        label: 'cycle ease',
        min: 0.1,
        max: 3,
        step: 0.01,
      });
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

      const aFolder = pane.addFolder({ title: 'Palette A', expanded: false });

      aFolder.addBinding(local, 'a0', { label: 'color 0' });
      aFolder.addBinding(local, 'a1', { label: 'color 1' });
      aFolder.addBinding(local, 'a2', { label: 'color 2' });
      aFolder.addBinding(local, 'a3', { label: 'color 3' });

      const bFolder = pane.addFolder({ title: 'Palette B', expanded: false });

      bFolder.addBinding(local, 'b0', { label: 'color 0' });
      bFolder.addBinding(local, 'b1', { label: 'color 1' });
      bFolder.addBinding(local, 'b2', { label: 'color 2' });
      bFolder.addBinding(local, 'b3', { label: 'color 3' });

      pane.on('change', sync);
    },
  );

  return (
    <main style={{ minHeight: '100vh', position: 'relative' }}>
      <div data-shader-demo style={{ position: 'relative' }}>
        <Image
          alt="Mesh gradient shader preview: warped four-color gradient blending pink, magenta, yellow, and orange"
          fill
          priority
          sizes="100vw"
          src="/posters/mesh-gradient.jpg"
          style={{ objectFit: 'cover' }}
        />
        <MeshGradientScene params={params}>
          <VisualTestPause />
        </MeshGradientScene>
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
        <h1 style={{ marginTop: 0 }}>&lt;MeshGradient /&gt;</h1>
        <p>
          Animated four-color mesh gradient with a time-cycling palette crossfade and a sine domain
          warp for organic motion.
        </p>
        <pre
          style={{
            background: '#1a1a2a',
            color: '#e0e0f0',
            padding: '1rem',
            borderRadius: '0.5rem',
            fontSize: '0.85rem',
            whiteSpace: 'pre-wrap',
          }}
        >
          {`<ShaderScene>
  <MeshGradient />
</ShaderScene>`}
        </pre>
      </section>
    </main>
  );
}
