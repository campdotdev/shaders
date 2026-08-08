'use client';

/**
 * Dither demo page: shader preview plus an owned control panel for the
 * threshold pattern, cell size, and quantization levels.
 */
import dynamic from 'next/dynamic';
import { useMemo } from 'react';

import {
  ControlPanel,
  ControlsProvider,
  createControlStore,
  DemoLayout,
  Section,
  SelectInput,
  SliderInput,
  useSnapshot,
} from '@/components/controls';
import { DemoPoster } from '@/components/DemoPoster';
import { VisualTestPause } from '@/lib/visualTestHooks';

import { type DitherParams, INITIAL } from './params';

const DitherScene = dynamic(() => import('./scene'), { ssr: false });

const COPY_CONFIG = { componentName: 'Dither', siblings: ['<MeshGradient />'] } as const;

const PATTERN_OPTIONS = [
  { label: 'Bayer 2x2', value: 'bayer-2x2' },
  { label: 'Bayer 4x4', value: 'bayer-4x4' },
  { label: 'Bayer 8x8', value: 'bayer-8x8' },
  { label: 'Dots', value: 'dots' },
  { label: 'Lines', value: 'lines' },
  { label: 'White noise', value: 'white-noise' },
  { label: 'Blue noise', value: 'blue-noise' },
  { label: 'Gradient noise', value: 'gradient-noise' },
] as const;

/**
 * Reads the live params and renders the scene. Split out from the page so it
 * subscribes to the store on its own — the page component itself never
 * re-renders during a drag, only this and the moved control do.
 */
function DitherDemo() {
  const params = useSnapshot<DitherParams>();

  return (
    <DemoPoster
      alt="Dither shader preview: mesh gradient pixelated into chunky ordered-dither cells"
      src="/posters/dither.jpg"
    >
      <DitherScene params={params}>
        <VisualTestPause />
      </DitherScene>
    </DemoPoster>
  );
}

function DitherControls() {
  return (
    <ControlPanel copyConfig={COPY_CONFIG} title="<Dither>">
      <Section title="Dither">
        <SelectInput label="Pattern" options={PATTERN_OPTIONS} path="pattern" />
        <SliderInput label="Pixel size" max={24} min={1} path="pixelSize" step={1} />
        <SliderInput label="Levels" max={8} min={2} path="levels" step={1} />
        <SliderInput label="Spread" max={2} min={0} path="spread" step={0.05} />
        <SliderInput label="Threshold" max={1} min={0} path="threshold" step={0.01} />
      </Section>
    </ControlPanel>
  );
}

export default function DitherPage() {
  const store = useMemo(() => createControlStore<DitherParams>(INITIAL), []);

  return (
    <ControlsProvider store={store}>
      <main style={{ minHeight: '100vh' }}>
        <DemoLayout controls={<DitherControls />}>
          <div data-shader-demo style={{ position: 'relative' }}>
            <DitherDemo />
          </div>
        </DemoLayout>
        <section style={{ padding: '2rem', maxWidth: '60ch', margin: '0 auto' }}>
          <h1 style={{ marginTop: 0 }}>&lt;Dither /&gt;</h1>
          <p>
            Retro ordered dithering. Dither is a post-process layer: stack it after any components
            inside a <code>&lt;ShaderScene&gt;</code> and it pixelates the composed scene into
            chunky cells, posterizing each channel to a few levels — the scene keeps its own colors.
          </p>
          <p>
            <code>pattern</code> picks the threshold map that decides how in-between colors resolve:
            the Bayer matrices trade smoothness (8x8) for crunch (2x2). <code>pixelSize</code> sets
            the cell size in CSS pixels, and <code>levels</code> is how many steps each color
            channel is allowed — <code>2</code> is the harshest look, <code>6</code> and up reads as
            subtle banding. <code>spread</code> dials the pattern&apos;s strength from clean
            posterize bands (<code>0</code>) to gritty overshoot (<code>2</code>), and{' '}
            <code>threshold</code> gates the effect by brightness — slide it down to release the
            highlights until the effect is gone.
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
  <Dither pattern="bayer-8x8" pixelSize={4} levels={4} />
</ShaderScene>`}
          </pre>
        </section>
      </main>
    </ControlsProvider>
  );
}
