'use client';

import dynamic from 'next/dynamic';

import { palette } from '@/lib/palette';
import { useTweakpane } from '@/lib/useTweakpane';
import { VisualTestPause } from '@/lib/visualTestHooks';

const ShaderScene = dynamic(() => import('@lovo/matter-react').then((m) => m.ShaderScene), {
  ssr: false,
});
const Waves = dynamic(() => import('@matter/registry/waves').then((m) => m.Waves), { ssr: false });

interface Params {
  color: string;
  amplitude: number;
  frequency: number;
  speed: number;
  layers: number;
}

const INITIAL: Params = {
  color: palette.teal.base,
  amplitude: 0.1,
  frequency: 5,
  speed: 1,
  layers: 3,
};

export default function WavesPage() {
  const [params, paneContainerRef] = useTweakpane<Params>(
    '<Waves>',
    INITIAL,
    (pane, local, sync) => {
      pane.addBinding(local, 'color');
      pane.addBlade({ view: 'separator' });
      pane.addBinding(local, 'amplitude', { min: 0, max: 0.5, step: 0.005 });
      pane.addBinding(local, 'frequency', { min: 1, max: 30, step: 0.1 });
      pane.addBinding(local, 'speed', { min: 0, max: 4, step: 0.05 });
      pane.addBinding(local, 'layers', { min: 1, max: 6, step: 1 });
      pane.addBlade({ view: 'separator' });
      pane.addButton({ title: 'Apply layers' }).on('click', sync);
      pane.on('change', (ev) => {
        if ('key' in ev.target && ev.target.key === 'layers') {
          return;
        }
        sync();
      });
    },
  );

  return (
    <main style={{ minHeight: '100vh', position: 'relative' }}>
      <div data-shader-demo style={{ position: 'relative', height: '70vh', background: '#0a0a14' }}>
        <ShaderScene>
          <Waves
            amplitude={params.amplitude}
            color={params.color}
            frequency={params.frequency}
            layers={params.layers}
            speed={params.speed}
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
        <h1 style={{ marginTop: 0 }}>&lt;Waves /&gt;</h1>
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
  <Waves amplitude={0.1} frequency={5} speed={1} layers={3} />
</ShaderScene>`}
        </pre>
      </section>
    </main>
  );
}
