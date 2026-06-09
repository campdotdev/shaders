'use client';

import dynamic from 'next/dynamic';

import { palette } from '@/lib/palette';
import { useTweakpane } from '@/lib/useTweakpane';
import { VisualTestPause } from '@/lib/visualTestHooks';

const ShaderScene = dynamic(() => import('@lovo/matter-react').then((m) => m.ShaderScene), {
  ssr: false,
});
const DotField = dynamic(() => import('@matter/registry/dot-field').then((m) => m.DotField), {
  ssr: false,
});

interface Params {
  color: string;
  spacing: number;
  dotSize: number;
  reach: number;
  strength: number;
  interactive: boolean;
}

const INITIAL: Params = {
  color: palette.gray[8],
  spacing: 30,
  dotSize: 2,
  reach: 100,
  strength: 1,
  interactive: true,
};

export default function DotFieldPage() {
  const [params, paneContainerRef] = useTweakpane<Params>(
    '<DotField>',
    INITIAL,
    (pane, local, sync) => {
      pane.addBinding(local, 'color');
      pane.addBlade({ view: 'separator' });
      pane.addBinding(local, 'spacing', { min: 8, max: 80, step: 1 });
      pane.addBinding(local, 'dotSize', {
        label: 'dot size',
        min: 1,
        max: 8,
        step: 0.5,
      });
      pane.addBlade({ view: 'separator' });
      pane.addBinding(local, 'reach', { min: 10, max: 400, step: 5 });
      pane.addBinding(local, 'strength', { min: 0, max: 3, step: 0.05 });
      pane.addBlade({ view: 'separator' });
      pane.addBinding(local, 'interactive', { label: 'interactive (cursor)' });
      pane.on('change', sync);
    },
  );

  return (
    <main style={{ minHeight: '100vh', position: 'relative' }}>
      <div data-shader-demo style={{ position: 'relative', height: '70vh', background: '#0a0a14' }}>
        <ShaderScene>
          <DotField
            color={params.color}
            dotSize={params.dotSize}
            interactive={params.interactive}
            reach={params.reach}
            spacing={params.spacing}
            strength={params.strength}
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
  <DotField spacing={30} dotSize={2} color="#888" reach={100} strength={1} />
</ShaderScene>`}
        </pre>
      </section>
    </main>
  );
}
