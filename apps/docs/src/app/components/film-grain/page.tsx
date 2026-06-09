'use client';

import dynamic from 'next/dynamic';

import type { FilmGrainMode } from '@matter/registry/film-grain';

import { addCopyButtons } from '@/lib/paneUtils';
import { useTweakpane } from '@/lib/useTweakpane';
import { VisualTestPause } from '@/lib/visualTestHooks';

const ShaderScene = dynamic(() => import('@lovo/matter-react').then((m) => m.ShaderScene), {
  ssr: false,
});
const LinearGradient = dynamic(
  () => import('@matter/registry/linear-gradient').then((m) => m.LinearGradient),
  { ssr: false },
);
const FilmGrain = dynamic(() => import('@matter/registry/film-grain').then((m) => m.FilmGrain), {
  ssr: false,
});

interface FilmGrainParams {
  intensity: number;
  speed: number;
  mode: FilmGrainMode;
}

const INITIAL: FilmGrainParams = {
  intensity: 0.45,
  speed: 1,
  mode: 'additive',
};

const fmtNum = (n: number) => String(Math.round(n * 10000) / 10000);

const fmtJsx = (p: FilmGrainParams) =>
  `<ShaderScene>
  <LinearGradient />
  <FilmGrain
    intensity={${fmtNum(p.intensity)}}
    speed={${fmtNum(p.speed)}}
    mode="${p.mode}"
  />
</ShaderScene>`;

const fmtParams = (p: FilmGrainParams) =>
  `{
  intensity: ${fmtNum(p.intensity)},
  speed: ${fmtNum(p.speed)},
  mode: '${p.mode}',
}`;

export default function FilmGrainPage() {
  const [params, paneContainerRef] = useTweakpane<FilmGrainParams>(
    '<FilmGrain>',
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

      pane.addBinding(local, 'intensity', { min: 0, max: 1, step: 0.01 });
      pane.addBinding(local, 'speed', { min: 0, max: 2, step: 0.01 });
      pane.addBinding(local, 'mode', {
        options: { Additive: 'additive', Subtractive: 'subtractive' },
      });

      pane.on('change', sync);
    },
  );

  return (
    <main style={{ minHeight: '100vh', position: 'relative' }}>
      <div data-shader-demo style={{ position: 'relative', height: '70vh' }}>
        <ShaderScene>
          <LinearGradient />
          <FilmGrain intensity={params.intensity} mode={params.mode} speed={params.speed} />
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
            maxHeight: 'calc(100% - 2rem)',
            overflowY: 'auto',
          }}
        />
      </div>
      <section style={{ padding: '2rem', maxWidth: '60ch', margin: '0 auto' }}>
        <h1 style={{ marginTop: 0 }}>&lt;FilmGrain /&gt;</h1>
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
  <FilmGrain intensity={0.45} speed={1} mode="additive" />
</ShaderScene>`}
        </pre>
      </section>
    </main>
  );
}
