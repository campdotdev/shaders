// apps/docs/app/components/mesh-gradient/page.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { Pane } from 'tweakpane';
import dynamic from 'next/dynamic';
import { VisualTestPause } from '@/lib/visualTestHooks';

const MatterScene = dynamic(
  () => import('@lovo/matter-react').then((m) => m.MatterScene),
  {
    ssr: false,
  },
);
const MeshGradient = dynamic(
  () => import('@matter/registry/mesh-gradient').then((m) => m.MeshGradient),
  { ssr: false },
);

interface Params {
  speed: number;
  frequency: number;
  amplitude: number;
  cycleSpeed: number;
  cycleEase: number;
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
  a0: '#ffba89',
  a1: '#3162ee',
  a2: '#f69292',
  a3: '#59b5f3',
  b0: '#6931f5',
  b1: '#202a32',
  b2: '#e93334',
  b3: '#e9a04b',
};

export default function MeshGradientPage() {
  const paneContainerRef = useRef<HTMLDivElement>(null);
  const [params, setParams] = useState<Params>(INITIAL);

  useEffect(() => {
    const container = paneContainerRef.current;
    if (!container) return;
    const local: Params = { ...INITIAL };
    const pane = new Pane({ container, title: '<MeshGradient>' });
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

    pane.on('change', () => setParams({ ...local }));
    return () => pane.dispose();
  }, []);

  return (
    <main style={{ minHeight: '100vh', position: 'relative' }}>
      <div style={{ position: 'relative', height: '70vh' }}>
        <MatterScene>
          <MeshGradient
            speed={params.speed}
            frequency={params.frequency}
            amplitude={params.amplitude}
            cycleSpeed={params.cycleSpeed}
            cycleEase={params.cycleEase}
            paletteA={[params.a0, params.a1, params.a2, params.a3]}
            paletteB={[params.b0, params.b1, params.b2, params.b3]}
          />
          <VisualTestPause />
        </MatterScene>
        {/* Tweakpane manages its own DOM without ARIA labels. `aria-hidden`
            hides the pane from screen readers; the axe test excludes the
            `.tp-dfwv` subtree so the unlabeled internal controls don't trip
            aria-hidden-focus. The page content in <section> below is the
            accessible surface. */}
        <div
          ref={paneContainerRef}
          data-tweakpane-host
          aria-hidden="true"
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
        <p>Phase 5 — time-cycling palette. Film grain returns in Phase 6.</p>
      </section>
    </main>
  );
}
