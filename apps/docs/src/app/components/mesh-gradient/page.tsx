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
const MeshGradient = dynamic(
  () => import('@matter/registry/mesh-gradient').then((m) => m.MeshGradient),
  { ssr: false },
);
const FilmGrain = dynamic(() => import('@matter/registry/film-grain').then((m) => m.FilmGrain), {
  ssr: false,
});

interface Params {
  speed: number;
  frequency: number;
  amplitude: number;
  cycleSpeed: number;
  cycleEase: number;
  grain: number;
  grainSpeed: number;
  a0: string;
  a1: string;
  a2: string;
  a3: string;
  b0: string;
  b1: string;
  b2: string;
  b3: string;
}

const INITIAL: Params = {
  speed: 2,
  frequency: 5,
  amplitude: 30,
  cycleSpeed: 0.5,
  cycleEase: 0.6,
  grain: 0.08,
  grainSpeed: 1,
  a0: palette.lime.base,
  a1: palette.green.base,
  a2: palette.teal.base,
  a3: palette.sky.base,
  b0: palette.amber.base,
  b1: palette.orange.base,
  b2: palette.red.base,
  b3: palette.magenta.base,
};

const fmtNum = (n: number) => String(Math.round(n * 10000) / 10000);

const fmtPalette = (p: Params, k: 'a' | 'b') =>
  `['${p[`${k}0`]}', '${p[`${k}1`]}', '${p[`${k}2`]}', '${p[`${k}3`]}']`;

const fmtJsx = (p: Params) =>
  `<ShaderScene>
  <MeshGradient
    speed={${fmtNum(p.speed)}}
    frequency={${fmtNum(p.frequency)}}
    amplitude={${fmtNum(p.amplitude)}}
    cycleSpeed={${fmtNum(p.cycleSpeed)}}
    cycleEase={${fmtNum(p.cycleEase)}}
    paletteA={${fmtPalette(p, 'a')}}
    paletteB={${fmtPalette(p, 'b')}}
  />
  <FilmGrain intensity={${fmtNum(p.grain)}} speed={${fmtNum(p.grainSpeed)}} />
</ShaderScene>`;

const fmtParams = (p: Params) =>
  `{
  speed: ${fmtNum(p.speed)},
  frequency: ${fmtNum(p.frequency)},
  amplitude: ${fmtNum(p.amplitude)},
  cycleSpeed: ${fmtNum(p.cycleSpeed)},
  cycleEase: ${fmtNum(p.cycleEase)},
  paletteA: ${fmtPalette(p, 'a')},
  paletteB: ${fmtPalette(p, 'b')},
  grain: ${fmtNum(p.grain)},
  grainSpeed: ${fmtNum(p.grainSpeed)},
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
        () => fmtJsx(local),
        () => fmtParams(local),
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
      pane.addBlade({ view: 'separator' });

      const grainFolder = pane.addFolder({ title: 'FilmGrain overlay' });

      grainFolder.addBinding(local, 'grain', {
        label: 'intensity',
        min: 0,
        max: 1,
        step: 0.01,
      });
      grainFolder.addBinding(local, 'grainSpeed', {
        label: 'speed',
        min: 0,
        max: 5,
        step: 0.01,
      });

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
      <div data-shader-demo style={{ position: 'relative', height: '70vh' }}>
        <Image
          alt=""
          fill
          priority
          sizes="100vw"
          src="/posters/mesh-gradient.jpg"
          style={{ objectFit: 'cover' }}
        />
        <ShaderScene>
          <MeshGradient
            amplitude={params.amplitude}
            cycleEase={params.cycleEase}
            cycleSpeed={params.cycleSpeed}
            frequency={params.frequency}
            paletteA={[params.a0, params.a1, params.a2, params.a3]}
            paletteB={[params.b0, params.b1, params.b2, params.b3]}
            speed={params.speed}
          />
          <FilmGrain intensity={params.grain} speed={params.grainSpeed} />
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
        <h1 style={{ marginTop: 0 }}>&lt;MeshGradient /&gt;</h1>
        <p>
          Animated four-color mesh gradient with a time-cycling palette crossfade and a sine domain
          warp for organic motion. Pure gradient — grain is supplied separately by{' '}
          <code>&lt;FilmGrain&gt;</code>, stacked inside the same <code>&lt;ShaderScene&gt;</code>.
          Drag grain to <code>0</code> in the panel to see the gradient on its own.
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
  <FilmGrain intensity={0.08} speed={1} />
</ShaderScene>`}
        </pre>
      </section>
    </main>
  );
}
