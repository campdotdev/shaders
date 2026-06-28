'use client';

import dynamic from 'next/dynamic';
import Image from 'next/image';

import { addCopyButtons } from '@/lib/paneUtils';
import { useTweakpane } from '@/lib/useTweakpane';
import { VisualTestPause } from '@/lib/visualTestHooks';

import { INITIAL, type VignetteParams } from './params';

const VignetteScene = dynamic(() => import('./scene'), { ssr: false });

const formatNumber = (n: number) => String(Math.round(n * 10000) / 10000);

const formatJsx = (p: VignetteParams) => {
  const vignette = `<Vignette
    intensity={${formatNumber(p.intensity)}}
    softness={${formatNumber(p.softness)}}
    center={[${formatNumber(p.centerX)}, ${formatNumber(p.centerY)}]}
    radius={${formatNumber(p.radius)}}
    color="${p.color}"
  />`;

  return `<ShaderScene>
  <LinearGradient />
  ${vignette}
</ShaderScene>`;
};

const formatParams = (p: VignetteParams) =>
  `{
  intensity: ${formatNumber(p.intensity)},
  softness: ${formatNumber(p.softness)},
  center: [${formatNumber(p.centerX)}, ${formatNumber(p.centerY)}],
  radius: ${formatNumber(p.radius)},
  color: '${p.color}',
}`;

export default function VignettePage() {
  const [params, paneContainerRef] = useTweakpane<VignetteParams>(
    '<Vignette>',
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

      pane.addBinding(local, 'intensity', { min: 0, max: 1, step: 0.01 });
      pane.addBinding(local, 'softness', { min: 0, max: 1, step: 0.01 });
      pane.addBinding(local, 'centerX', {
        min: 0,
        max: 1,
        step: 0.01,
        label: 'center.x',
      });
      pane.addBinding(local, 'centerY', {
        min: 0,
        max: 1,
        step: 0.01,
        label: 'center.y',
      });
      pane.addBinding(local, 'radius', { min: 0, max: 1.5, step: 0.01 });
      pane.addBinding(local, 'color');

      pane.on('change', sync);
    },
  );

  return (
    <main style={{ minHeight: '100vh', position: 'relative' }}>
      <div data-shader-demo style={{ position: 'relative' }}>
        <Image
          alt="Vignette shader preview: a violet-to-magenta gradient darkened toward the edges"
          fill
          priority
          sizes="100vw"
          src="/posters/vignette.jpg"
          style={{ objectFit: 'cover' }}
        />
        <VignetteScene params={params}>
          <VisualTestPause />
        </VignetteScene>
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
            maxHeight: 'calc(100% - 2rem)',
            overflowY: 'auto',
          }}
        />
      </div>
      <section style={{ padding: '2rem', maxWidth: '60ch', margin: '0 auto' }}>
        <h1 style={{ marginTop: 0 }}>&lt;Vignette /&gt;</h1>
        <p>
          Radial darkening at the canvas edges. Stacks inside any <code>&lt;ShaderScene&gt;</code>{' '}
          on top of whatever base component you want and fades the upstream pixels toward an edge
          color along a soft falloff ring. Unlike <code>&lt;Grain /&gt;</code>, which generates new
          noise from <code>uv</code>, Vignette reads the upstream pixel and mixes it toward{' '}
          <code>color</code> — the {`"read-upstream"`} half of the post-processing pipeline.
        </p>
        <p>
          <code>softness</code> controls how gradual the falloff is. At <code>0</code> the ring is a
          hard cutoff; at <code>1</code> the entire canvas is in the falloff (a smooth radial
          gradient from center to edge). <code>radius</code> is the outer edge of the ring;{' '}
          <code>center</code> is the bright spot in normalized UV space.
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
  <LinearGradient />
  <Vignette intensity={0.5} radius={0.6} softness={0.5} />
</ShaderScene>`}
        </pre>
      </section>
    </main>
  );
}
