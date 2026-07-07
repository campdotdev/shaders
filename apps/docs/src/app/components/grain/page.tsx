'use client';

import dynamic from 'next/dynamic';

import { DemoPoster } from '@/components/DemoPoster';
import { addCopyButtons } from '@/lib/paneUtils';
import { useTweakpane } from '@/lib/useTweakpane';
import { VisualTestPause } from '@/lib/visualTestHooks';

import { type GrainParams, INITIAL } from './params';

const GrainScene = dynamic(() => import('./scene'), { ssr: false });

const formatNumber = (n: number) => String(Math.round(n * 10000) / 10000);

const formatJsx = (params: GrainParams) =>
  `<ShaderScene>
  <LinearGradient />
  <Grain
    intensity={${formatNumber(params.intensity)}}
    speed={${formatNumber(params.speed)}}
    grainBlend="${params.grainBlend}"
  />
</ShaderScene>`;

const formatParams = (params: GrainParams) =>
  `{
  intensity: ${formatNumber(params.intensity)},
  speed: ${formatNumber(params.speed)},
  grainBlend: '${params.grainBlend}',
}`;

export default function GrainPage() {
  const [params, paneContainerRef] = useTweakpane<GrainParams>(
    '<Grain>',
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
      pane.addBinding(local, 'speed', { min: 0, max: 2, step: 0.01 });
      pane.addBinding(local, 'grainBlend', {
        options: { Additive: 'additive', Subtractive: 'subtractive' },
      });

      pane.on('change', sync);
    },
  );

  return (
    <main style={{ minHeight: '100vh', position: 'relative' }}>
      <div data-shader-demo style={{ position: 'relative' }}>
        <DemoPoster
          alt="Film grain shader preview: violet to magenta gradient overlaid with grain"
          src="/posters/grain.jpg"
        >
          <GrainScene params={params}>
            <VisualTestPause />
          </GrainScene>
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
            maxHeight: 'calc(100% - 2rem)',
            overflowY: 'auto',
          }}
        />
      </div>
      <section style={{ padding: '2rem', maxWidth: '60ch', margin: '0 auto' }}>
        <h1 style={{ marginTop: 0 }}>&lt;Grain /&gt;</h1>
        <p>
          Standalone film grain overlay. Stacks inside any <code>&lt;ShaderScene&gt;</code> on top
          of whatever base component you want — gradients, noise fields, mesh gradients — and
          applies a layer of animated grain via the post-processing pipeline.
        </p>
        <p>
          <strong>Additive</strong> (default) adds signed grain so half the pixels brighten and half
          darken, preserving average exposure — pure texture, no exposure shift.{' '}
          <strong>Subtractive</strong> takes the absolute value of the grain and subtracts it, so
          the image only darkens. Subtractive simulates silver-halide film stock physics, where
          exposed grain blocks light.
        </p>
        <p>
          <code>speed</code> controls the shutter cadence: <code>1</code> ≈ 60Hz (continuous shimmer
          at 60fps), <code>0.4</code> ≈ 24Hz (chunky film cadence), <code>0</code> freezes the grain
          pattern.
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
  <Grain intensity={0.45} speed={1} grainBlend="additive" />
</ShaderScene>`}
        </pre>
      </section>
    </main>
  );
}
