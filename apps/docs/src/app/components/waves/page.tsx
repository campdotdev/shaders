'use client';

import dynamic from 'next/dynamic';

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
  glow: number;
  independence: number;
  drift: number;
  layers: number;
}

const INITIAL: Params = {
  color: '#77eecc',
  amplitude: 0.07,
  frequency: 1,
  speed: 1,
  glow: 1,
  independence: 0.5,
  drift: 0,
  layers: 10,
};

export default function WavesPage() {
  const [params, paneContainerRef] = useTweakpane<Params>(
    '<Waves>',
    INITIAL,
    (pane, local, sync) => {
      pane.addBinding(local, 'color');
      pane.addBlade({ view: 'separator' });
      pane.addBinding(local, 'amplitude', { min: 0, max: 0.3, step: 0.005 });
      pane.addBinding(local, 'frequency', { min: 0.1, max: 10, step: 0.05 });
      pane.addBinding(local, 'speed', { min: 0, max: 4, step: 0.05 });
      pane.addBinding(local, 'glow', { min: 0, max: 3, step: 0.01 });
      pane.addBinding(local, 'independence', { min: 0, max: 1, step: 0.01 });
      pane.addBinding(local, 'drift', { min: 0, max: 1, step: 0.01 });
      pane.addBlade({ view: 'separator' });
      pane.addBinding(local, 'layers', { min: 1, max: 20, step: 1 });
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
            drift={params.drift}
            frequency={params.frequency}
            glow={params.glow}
            independence={params.independence}
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
  <Waves
    amplitude={0.07}
    frequency={1}
    speed={1}
    intensity={1}
    sharpness={150}
    layers={10}
  />
</ShaderScene>`}
        </pre>
      </section>
    </main>
  );
}
