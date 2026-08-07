'use client';

/**
 * GodRays demo page: shader preview plus an owned control panel for the ray
 * origin and cone, motion, shape dials, and layer colors.
 */
import dynamic from 'next/dynamic';
import { useMemo } from 'react';

import {
  ColorInput,
  ControlPanel,
  ControlsProvider,
  createControlStore,
  DemoLayout,
  ListInput,
  Section,
  SliderInput,
  useSnapshot,
} from '@/components/controls';
import { VisualTestPause } from '@/lib/visualTestHooks';

import { type GodRaysParams, INITIAL, MAX_COLORS, MIN_COLORS } from './params';

const GodRaysScene = dynamic(() => import('./scene'), { ssr: false });

const COPY_CONFIG = { componentName: 'GodRays' } as const;

/** A new color clones the last one in the list so the addition is visible. */
const createColor = (colors: readonly string[]): string =>
  colors[colors.length - 1] ?? 'oklch(0.8 0.1 80)';

function GodRaysDemo() {
  const params = useSnapshot<GodRaysParams>();

  return (
    <GodRaysScene params={params}>
      <VisualTestPause />
    </GodRaysScene>
  );
}

function GodRaysControls() {
  return (
    <ControlPanel copyConfig={COPY_CONFIG} title="<GodRays>">
      <Section title="Origin">
        <SliderInput label="Center X" max={1.5} min={-0.5} path="centerX" step={0.01} />
        <SliderInput label="Center Y" max={1.5} min={-0.5} path="centerY" step={0.01} />
        <SliderInput label="Angle" max={360} min={0} path="angle" step={1} />
        <SliderInput label="Spread" max={360} min={10} path="spread" step={1} />
      </Section>
      <Section title="Motion">
        <SliderInput label="Speed" max={3} min={0} path="speed" step={0.01} />
      </Section>
      <Section title="Shape">
        <SliderInput label="Intensity" max={3} min={0} path="intensity" step={0.01} />
        <SliderInput label="Density" max={64} min={2} path="density" step={0.5} />
        <SliderInput label="Diffusion" max={1} min={0} path="diffusion" step={0.01} />
        <SliderInput label="Patchiness" max={1} min={0} path="patchiness" step={0.01} />
        <SliderInput label="Radius" max={2} min={0} path="radius" step={0.01} />
        <SliderInput label="Glow radius" max={1} min={0} path="glowRadius" step={0.01} />
        <SliderInput label="Glow intensity" max={3} min={0} path="glowIntensity" step={0.01} />
      </Section>
      <ListInput<string>
        createItem={createColor}
        itemLabel="color"
        label="Colors (near to far)"
        max={MAX_COLORS}
        min={MIN_COLORS}
        path="colors"
      >
        {() => <ColorInput label="Color" path="" />}
      </ListInput>
    </ControlPanel>
  );
}

export default function GodRaysPage() {
  const store = useMemo(() => createControlStore<GodRaysParams>(INITIAL), []);

  return (
    <ControlsProvider store={store}>
      <main style={{ minHeight: '100vh' }}>
        <DemoLayout controls={<GodRaysControls />}>
          <div
            data-shader-demo
            style={{
              position: 'relative',
              // Dark dusk backdrop the rays emit over — the component itself
              // is transparent.
              background: 'linear-gradient(to top, #131b31, #0b0f1a)',
            }}
          >
            <GodRaysDemo />
          </div>
        </DemoLayout>
        <section style={{ padding: '2rem', maxWidth: '60ch', margin: '0 auto' }}>
          <h1 style={{ marginTop: 0 }}>&lt;GodRays /&gt;</h1>
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
  <GodRays center={[0.5, -0.05]} />
</ShaderScene>`}
          </pre>
          <p>
            Light rays radiate from <code>center</code> — park it off-canvas for a top-of-page sun.
            The rays emit over a transparent background; stack them above a dark layer.
          </p>
        </section>
      </main>
    </ControlsProvider>
  );
}
