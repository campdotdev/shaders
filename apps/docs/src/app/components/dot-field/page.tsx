'use client';

import dynamic from 'next/dynamic';

import * as TweakpanePluginColorPlus from 'tweakpane-plugin-color-plus';

import { DemoPoster } from '@/components/DemoPoster';
import { addCopyButtons } from '@/lib/paneUtils';
import { useTweakpane } from '@/lib/useTweakpane';
import { VisualTestPause } from '@/lib/visualTestHooks';

import { INITIAL, type Params } from './params';

const DotFieldScene = dynamic(() => import('./scene'), { ssr: false });

const formatNumber = (n: number) => String(Math.round(n * 10000) / 10000);

const formatJsx = (params: Params) => {
  const dotField = `<DotField
    spacing={${formatNumber(params.spacing)}}
    dotSize={${formatNumber(params.dotSize)}}
    color="${params.color}"
    speed={${formatNumber(params.speed)}}
    amplitude={${formatNumber(params.amplitude)}}
    wavelength={${formatNumber(params.wavelength)}}
    decay={${formatNumber(params.decay)}}
    center={[${formatNumber(params.centerX)}, ${formatNumber(params.centerY)}]}
  />`;

  return `<ShaderScene>
  ${dotField}
</ShaderScene>`;
};

const formatParams = (params: Params) =>
  `{
  spacing: ${formatNumber(params.spacing)},
  dotSize: ${formatNumber(params.dotSize)},
  color: '${params.color}',
  speed: ${formatNumber(params.speed)},
  amplitude: ${formatNumber(params.amplitude)},
  wavelength: ${formatNumber(params.wavelength)},
  decay: ${formatNumber(params.decay)},
  center: [${formatNumber(params.centerX)}, ${formatNumber(params.centerY)}],
}`;

export default function DotFieldPage() {
  const [params, paneContainerRef] = useTweakpane<Params>(
    '<DotField>',
    INITIAL,
    (pane, local, sync) => {
      // Wide-gamut color picker: the built-in picker is sRGB and rejects
      // oklch()/oklab() strings, so register color-plus for P3-capable input.
      pane.registerPlugin(TweakpanePluginColorPlus);

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
      pane.addBinding(local, 'color', {
        label: 'color',
        view: 'color-plus',
        color: { formatLocked: true },
      });
      pane.addBlade({ view: 'separator' });
      pane.addBinding(local, 'spacing', { min: 8, max: 80, step: 1 });
      pane.addBinding(local, 'dotSize', {
        label: 'dot size',
        min: 1,
        max: 8,
        step: 0.5,
      });
      pane.addBlade({ view: 'separator' });
      pane.addBinding(local, 'speed', { min: 0, max: 4, step: 0.05 });
      pane.addBinding(local, 'amplitude', { min: 0, max: 0.9, step: 0.01 });
      pane.addBinding(local, 'wavelength', { min: 20, max: 400, step: 5 });
      pane.addBinding(local, 'decay', { min: 0, max: 5, step: 0.05 });
      pane.addBlade({ view: 'separator' });
      pane.addBinding(local, 'centerX', { label: 'center.x', min: 0, max: 1, step: 0.01 });
      pane.addBinding(local, 'centerY', { label: 'center.y', min: 0, max: 1, step: 0.01 });
      pane.on('change', sync);
    },
  );

  return (
    <main style={{ minHeight: '100vh', position: 'relative' }}>
      <div data-shader-demo style={{ position: 'relative', background: '#0a0a14' }}>
        <DemoPoster
          alt="Dot field shader preview: a sparse grid of small gray dots on a dark background"
          src="/posters/dot-field.png"
        >
          <DotFieldScene params={params}>
            <VisualTestPause />
          </DotFieldScene>
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
        <h1 style={{ marginTop: 0 }}>&lt;DotField /&gt;</h1>
        <pre
          style={{
            background: '#1a1a2a',
            color: '#e0e0f0',
            padding: '1rem',
            borderRadius: '0.5rem',
            fontSize: '0.85rem',
          }}
        >
          {`<ShaderScene>
  <DotField spacing={30} dotSize={3} color="oklch(0.65 0.01 150)" speed={0.45} amplitude={0.15} />
</ShaderScene>`}
        </pre>
      </section>
    </main>
  );
}
