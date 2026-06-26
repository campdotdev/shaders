'use client';

import dynamic from 'next/dynamic';
import Image from 'next/image';

import { useTweakpane } from '@/lib/useTweakpane';
import { VisualTestPause } from '@/lib/visualTestHooks';

import { INITIAL, type Params } from './params';

const DotFieldScene = dynamic(() => import('./scene'), { ssr: false });

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
      <div data-shader-demo style={{ position: 'relative', background: '#0a0a14' }}>
        <Image
          alt="Dot field shader preview: a sparse grid of small gray dots on a dark background"
          fill
          priority
          sizes="100vw"
          src="/posters/dot-field.png"
          style={{ objectFit: 'cover' }}
        />
        <DotFieldScene params={params}>
          <VisualTestPause />
        </DotFieldScene>
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
