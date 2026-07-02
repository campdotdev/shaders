'use client';

import dynamic from 'next/dynamic';
import Image from 'next/image';

import * as TweakpanePluginColorPlus from 'tweakpane-plugin-color-plus';

import { useTweakpane } from '@/lib/useTweakpane';
import { VisualTestPause } from '@/lib/visualTestHooks';

import { INITIAL, type Params } from './params';

const DotFieldScene = dynamic(() => import('./scene'), { ssr: false });

export default function DotFieldPage() {
  const [params, paneContainerRef] = useTweakpane<Params>(
    '<DotField>',
    INITIAL,
    (pane, local, sync) => {
      // Wide-gamut color picker: the built-in picker is sRGB and rejects
      // oklch()/oklab() strings, so register color-plus for P3-capable input.
      pane.registerPlugin(TweakpanePluginColorPlus);
      pane.addBinding(local, 'color', {
        label: 'color',
        view: 'color-plus',
        color: { formatLocked: true },
      });
      pane.addBlade({ view: 'separator' });
      pane.addBinding(local, 'spacing', { min: 8, max: 80, step: 1 });
      pane.addBinding(local, 'dotSize', {
        label: 'dot size',
        min: 1,
        max: 8,
        step: 0.5,
      });
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
  <DotField spacing={30} dotSize={2} color="oklch(0.65 0.01 150)" />
</ShaderScene>`}
        </pre>
      </section>
    </main>
  );
}
