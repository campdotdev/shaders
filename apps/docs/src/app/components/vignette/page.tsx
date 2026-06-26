'use client';

import dynamic from 'next/dynamic';

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
const Grain = dynamic(() => import('@matter/registry/grain').then((m) => m.Grain), {
  ssr: false,
});
const Vignette = dynamic(() => import('@matter/registry/vignette').then((m) => m.Vignette), {
  ssr: false,
});

interface VignetteParams {
  intensity: number;
  softness: number;
  centerX: number;
  centerY: number;
  radius: number;
  color: string;
  grainOrderFirst: boolean;
  grainIntensity: number;
}

const INITIAL: VignetteParams = {
  intensity: 0.7,
  softness: 0.5,
  centerX: 0.5,
  centerY: 0.5,
  radius: 0.6,
  color: '#000000',
  grainOrderFirst: true,
  grainIntensity: 0.3,
};

const formatNumber = (n: number) => String(Math.round(n * 10000) / 10000);

const formatJsx = (p: VignetteParams) => {
  const grain = `<Grain intensity={${formatNumber(p.grainIntensity)}} />`;
  const vignette = `<Vignette
    intensity={${formatNumber(p.intensity)}}
    softness={${formatNumber(p.softness)}}
    center={[${formatNumber(p.centerX)}, ${formatNumber(p.centerY)}]}
    radius={${formatNumber(p.radius)}}
    color="${p.color}"
  />`;

  return p.grainOrderFirst
    ? `<ShaderScene>
  <LinearGradient />
  ${grain}
  ${vignette}
</ShaderScene>`
    : `<ShaderScene>
  <LinearGradient />
  ${vignette}
  ${grain}
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

      const stackFolder = pane.addFolder({ title: 'Stack with Grain' });

      stackFolder.addBinding(local, 'grainOrderFirst', {
        label: 'grain first?',
      });
      stackFolder.addBinding(local, 'grainIntensity', {
        label: 'grain intensity',
        min: 0,
        max: 0.5,
        step: 0.005,
      });

      pane.on('change', sync);
    },
  );

  const vignetteEl = (
    <Vignette
      center={[params.centerX, params.centerY]}
      color={params.color}
      intensity={params.intensity}
      radius={params.radius}
      softness={params.softness}
    />
  );
  const grainEl = <Grain intensity={params.grainIntensity} />;

  return (
    <main style={{ minHeight: '100vh', position: 'relative' }}>
      <div data-shader-demo style={{ position: 'relative' }}>
        <ShaderScene>
          <LinearGradient />
          {params.grainOrderFirst ? (
            <>
              {grainEl}
              {vignetteEl}
            </>
          ) : (
            <>
              {vignetteEl}
              {grainEl}
            </>
          )}
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
        <h1 style={{ marginTop: 0 }}>&lt;Vignette /&gt;</h1>
        <p>
          Radial darkening at the canvas edges. Stacks inside any <code>&lt;ShaderScene&gt;</code>{' '}
          on top of whatever base component you want and fades the upstream pixels toward an edge
          color along a soft falloff ring. Unlike <code>&lt;Grain /&gt;</code>, which generates new
          noise from <code>uv</code>, Vignette reads the upstream pixel and mixes it toward{' '}
          <code>color</code> — the {`"read-upstream"`} half of the post-processing pipeline.
        </p>
        <p>
          <strong>Stacking order matters.</strong> The {`"grain first?"`} toggle in the panel swaps
          which overlay runs first. With grain first, the vignette darkens the already-grainy output
          — grain dims in the corners along with everything else. With vignette first, the grain is
          added on top of the already-darkened corners, so grain stays bright even where the image
          is dark. Both are useful looks; the choice is a stylistic call.
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
